/**
 * Batch Spending Handler
 * POST /spending/batch - Create multiple spending entries with rate limiting
 */

const { notion, DATABASE_ID, success, error, sleep, withRetry } = require('../notion-client');

// Configuration
const CHUNK_SIZE = 10;        // Items per batch
const DELAY_BETWEEN_ITEMS = 350;  // ms between API calls (Notion ~3 req/sec limit)

/**
 * Create multiple spending entries in batch
 * @param {object} event - API Gateway event
 * @returns {object} Lambda response
 */
async function batchCreateSpending(event) {
  try {
    const data = JSON.parse(event.body || '{}');
    const { transactions, fx_rate } = data;

    if (!transactions || !Array.isArray(transactions)) {
      return error('Missing or invalid transactions array', 400);
    }

    if (transactions.length === 0) {
      return success({ created: 0, failed: 0, errors: [], pages: [] });
    }

    const fxRate = parseFloat(fx_rate) || 21.5;
    const results = {
      created: 0,
      failed: 0,
      errors: [],
      pages: []
    };

    console.log(`Processing ${transactions.length} transactions with FX rate ${fxRate}`);

    // Process transactions sequentially with rate limiting
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];

      try {
        const page = await createSingleSpending(tx, fxRate);
        results.created++;
        results.pages.push({
          index: i,
          success: true,
          page_id: page.id,
          page_url: page.url
        });
      } catch (err) {
        console.error(`Failed to create transaction ${i}:`, err.message);
        results.failed++;
        results.errors.push({
          index: i,
          transaction: tx.transaction || tx.note,
          error: err.message
        });
      }

      // Rate limiting delay (except for last item)
      if (i < transactions.length - 1) {
        await sleep(DELAY_BETWEEN_ITEMS);
      }

      // Log progress every 10 items
      if ((i + 1) % 10 === 0) {
        console.log(`Progress: ${i + 1}/${transactions.length}`);
      }
    }

    console.log(`Batch complete: ${results.created} created, ${results.failed} failed`);

    return success(results);

  } catch (err) {
    console.error('Batch processing error:', err);
    return error(`Batch processing failed: ${err.message}`, 500);
  }
}

/**
 * Create a single spending entry
 * @param {object} tx - Transaction data
 * @param {number} fxRate - EUR/MXN exchange rate
 * @returns {object} Created Notion page
 */
async function createSingleSpending(tx, fxRate) {
  // Calculate euro_money if currency is MXN
  let euroMoney = parseFloat(tx.amount);
  if (tx.currency === 'MXN' && fxRate > 0) {
    euroMoney = parseFloat(tx.amount) / fxRate;
  }
  if (tx.euro_money) {
    euroMoney = parseFloat(tx.euro_money);
  }

  // Build Notion properties
  const properties = {
    transaction: {
      title: [{ text: { content: tx.transaction || tx.note || 'Imported expense' } }]
    },
    amount: { number: parseFloat(tx.amount) },
    currency: { select: { name: tx.currency || 'EUR' } },
    charge_date: { date: { start: tx.charge_date } },
    money_date: { date: { start: tx.charge_date } },
    type: { select: { name: 'spending' } },
    mm: { number: parseInt(tx.charge_date.split('-')[1], 10) },
    euro_money: { number: euroMoney }
  };

  // Add category relation if provided
  if (tx.category_id) {
    properties.category = { relation: [{ id: tx.category_id }] };
  }

  // Optional fields
  if (tx.method) {
    properties.method = { select: { name: tx.method } };
  }

  if (tx.transaction || tx.note) {
    properties.spend_name = {
      rich_text: [{ text: { content: tx.transaction || tx.note || '' } }]
    };
  }

  // Create with retry
  return withRetry(async () => {
    return notion.pages.create({
      parent: { database_id: DATABASE_ID },
      properties
    });
  }, 2, 500); // 2 retries with 500ms base delay for batch operations
}

module.exports = { batchCreateSpending };
