/**
 * Price Update Handler
 * POST /investments/prices - Fetch latest prices and update Notion
 *
 * Uses Yahoo Finance v8 chart API (free, no key required).
 * Can be triggered manually from the frontend or via a scheduled EventBridge rule.
 */

const {
  notion,
  INVESTMENTS_DATABASE_ID,
  success,
  error,
  withRetry,
  sleep,
  extractInvestmentData
} = require('../notion-client');

const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const DELAY_BETWEEN_FETCHES = 400; // ms between Yahoo requests

/**
 * Fetch current price for a ticker from Yahoo Finance
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<{price: number, currency: string}|null>}
 */
async function fetchPrice(ticker) {
  try {
    const url = `${YAHOO_CHART_URL}${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Gringotts/1.0' }
    });

    if (!response.ok) {
      console.warn(`Yahoo Finance returned ${response.status} for ${ticker}`);
      return null;
    }

    const data = await response.json();
    const meta = data.chart?.result?.[0]?.meta;

    if (meta?.regularMarketPrice) {
      return {
        price: meta.regularMarketPrice,
        currency: meta.currency || null
      };
    }

    return null;
  } catch (err) {
    console.error(`Failed to fetch price for ${ticker}:`, err.message);
    return null;
  }
}

/**
 * Query all investments that have a ticker symbol
 * @returns {Promise<Array>} - List of investments with tickers
 */
async function queryInvestmentsWithTickers() {
  const investments = [];
  let cursor = undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await withRetry(async () => {
      return notion.databases.query({
        database_id: INVESTMENTS_DATABASE_ID,
        start_cursor: cursor,
        page_size: 100,
        filter: {
          property: 'ticker',
          rich_text: { is_not_empty: true }
        }
      });
    });

    for (const page of response.results) {
      investments.push(extractInvestmentData(page));
    }

    hasMore = response.has_more;
    cursor = response.next_cursor;
  }

  return investments;
}

/**
 * Update prices for all investments with tickers
 * @param {object} event - API Gateway event
 * @returns {object} Lambda response
 */
async function updatePrices(event) {
  try {
    const investments = await queryInvestmentsWithTickers();

    const results = {
      updated: 0,
      failed: 0,
      skipped: 0,
      total: investments.length,
      details: []
    };

    const today = new Date().toISOString().split('T')[0];

    for (const inv of investments) {
      if (!inv.ticker) {
        results.skipped++;
        continue;
      }

      // Skip if already updated today
      if (inv.last_price_update === today) {
        results.skipped++;
        results.details.push({
          ticker: inv.ticker,
          status: 'skipped',
          reason: 'Already updated today'
        });
        continue;
      }

      const priceData = await fetchPrice(inv.ticker);

      if (priceData && priceData.price > 0) {
        try {
          await withRetry(async () => {
            return notion.pages.update({
              page_id: inv.id,
              properties: {
                current_price: { number: priceData.price },
                last_price_update: { date: { start: today } }
              }
            });
          });

          results.updated++;
          results.details.push({
            ticker: inv.ticker,
            status: 'updated',
            old_price: inv.current_price,
            new_price: priceData.price
          });
        } catch (updateErr) {
          results.failed++;
          results.details.push({
            ticker: inv.ticker,
            status: 'failed',
            reason: `Notion update failed: ${updateErr.message}`
          });
        }
      } else {
        results.failed++;
        results.details.push({
          ticker: inv.ticker,
          status: 'failed',
          reason: 'Price not available from Yahoo Finance'
        });
      }

      // Rate limit between requests
      await sleep(DELAY_BETWEEN_FETCHES);
    }

    return success(results);

  } catch (err) {
    console.error('Price update error:', err);
    return error(`Price update failed: ${err.message}`, 500);
  }
}

module.exports = { updatePrices };
