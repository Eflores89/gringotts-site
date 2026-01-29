/**
 * Investments Handler
 * GET /investments - Query all investments
 * POST /investments - Create an investment entry
 */

const {
  notion,
  INVESTMENTS_DATABASE_ID,
  success,
  error,
  withRetry,
  extractInvestmentData
} = require('../notion-client');

/**
 * Create a single investment entry in Notion
 * @param {object} event - API Gateway event
 * @returns {object} Lambda response
 */
async function createInvestment(event) {
  try {
    const data = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!data.name || data.quantity == null || data.purchase_price == null) {
      return error('Missing required fields: name, quantity, purchase_price', 400);
    }

    // Build Notion properties
    const properties = {
      name: {
        title: [{ text: { content: data.name } }]
      },
      quantity: { number: parseFloat(data.quantity) },
      purchase_price: { number: parseFloat(data.purchase_price) },
      currency: { select: { name: data.currency || 'EUR' } },
      asset_type: { select: { name: data.asset_type || 'stock' } }
    };

    // Optional fields
    if (data.ticker) {
      properties.ticker = {
        rich_text: [{ text: { content: data.ticker } }]
      };
    }

    if (data.purchase_date) {
      properties.purchase_date = { date: { start: data.purchase_date } };
    }

    if (data.current_price != null) {
      properties.current_price = { number: parseFloat(data.current_price) };
    }

    if (data.vest_date) {
      properties.vest_date = { date: { start: data.vest_date } };
    }

    if (data.notes) {
      properties.notes = {
        rich_text: [{ text: { content: data.notes } }]
      };
    }

    // Create the page
    const page = await withRetry(async () => {
      return notion.pages.create({
        parent: { database_id: INVESTMENTS_DATABASE_ID },
        properties
      });
    });

    return success({
      success: true,
      investment: extractInvestmentData(page),
      page_url: page.url
    }, 201);

  } catch (err) {
    console.error('Error creating investment:', err);
    return error(`Failed to create investment: ${err.message}`, 500);
  }
}

/**
 * Query investment entries with optional filters
 * @param {object} event - API Gateway event
 * @returns {object} Lambda response
 */
async function getInvestments(event) {
  try {
    const params = event.queryStringParameters || {};
    const assetType = params.asset_type || null;
    const currency = params.currency || null;
    const vestedOnly = params.vested_only === 'true';

    // Build filter
    const filters = [];

    if (assetType) {
      filters.push({
        property: 'asset_type',
        select: { equals: assetType }
      });
    }

    if (currency) {
      filters.push({
        property: 'currency',
        select: { equals: currency }
      });
    }

    if (vestedOnly) {
      filters.push({
        or: [
          {
            property: 'vest_date',
            date: { is_empty: true }
          },
          {
            property: 'vest_date',
            date: { on_or_before: new Date().toISOString().split('T')[0] }
          }
        ]
      });
    }

    // Query with pagination
    const investments = [];
    let cursor = undefined;
    let hasMore = true;

    while (hasMore) {
      const queryParams = {
        database_id: INVESTMENTS_DATABASE_ID,
        start_cursor: cursor,
        page_size: 100,
        sorts: [
          { property: 'name', direction: 'ascending' }
        ]
      };

      if (filters.length > 0) {
        queryParams.filter = filters.length > 1 ? { and: filters } : filters[0];
      }

      const response = await withRetry(async () => {
        return notion.databases.query(queryParams);
      });

      for (const page of response.results) {
        investments.push(extractInvestmentData(page));
      }

      hasMore = response.has_more;
      cursor = response.next_cursor;
    }

    return success({
      investments,
      total_count: investments.length
    });

  } catch (err) {
    console.error('Error querying investments:', err);
    return error(`Failed to query investments: ${err.message}`, 500);
  }
}

module.exports = { createInvestment, getInvestments };
