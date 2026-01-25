/**
 * Spending Handler
 * POST /spending - Create a spending entry
 * GET /spending - Query spending entries with filters
 */

const { notion, DATABASE_ID, success, error, withRetry, extractPageData } = require('../notion-client');

/**
 * Create a single spending entry in Notion
 * @param {object} event - API Gateway event
 * @returns {object} Lambda response
 */
async function createSpending(event) {
  try {
    const data = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!data.amount || !data.category_id || !data.charge_date) {
      return error('Missing required fields: amount, category_id, charge_date', 400);
    }

    // Build Notion properties
    const properties = {
      transaction: {
        title: [{ text: { content: data.transaction || data.note || 'Cash expense' } }]
      },
      amount: { number: parseFloat(data.amount) },
      currency: { select: { name: data.currency || 'EUR' } },
      category: { relation: [{ id: data.category_id }] },
      charge_date: { date: { start: data.charge_date } },
      money_date: { date: { start: data.charge_date } },
      type: { select: { name: 'spending' } },
      mm: { number: parseInt(data.charge_date.split('-')[1], 10) },
      euro_money: { number: parseFloat(data.euro_money || data.amount) }
    };

    // Optional fields
    if (data.method) {
      properties.method = { select: { name: data.method } };
    }

    if (data.note || data.transaction) {
      properties.spend_name = {
        rich_text: [{ text: { content: data.note || data.transaction || '' } }]
      };
    }

    // Create the page
    const page = await withRetry(async () => {
      return notion.pages.create({
        parent: { database_id: DATABASE_ID },
        properties
      });
    });

    return success({
      success: true,
      page_id: page.id,
      page_url: page.url
    }, 201);

  } catch (err) {
    console.error('Error creating spending:', err);
    return error(`Failed to create spending: ${err.message}`, 500);
  }
}

/**
 * Query spending entries with filters
 * @param {object} event - API Gateway event
 * @returns {object} Lambda response
 */
async function getSpending(event) {
  try {
    const params = event.queryStringParameters || {};
    const month = params.month ? parseInt(params.month, 10) : null;
    const year = params.year ? parseInt(params.year, 10) : null;
    const category = params.category || null;

    // Build filter
    const filters = [
      {
        property: 'type',
        select: { equals: 'spending' }
      }
    ];

    // Add month filter
    if (month) {
      filters.push({
        property: 'mm',
        number: { equals: month }
      });
    }

    // Add date-based year filter
    if (year) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      filters.push({
        property: 'charge_date',
        date: { on_or_after: startDate }
      });
      filters.push({
        property: 'charge_date',
        date: { on_or_before: endDate }
      });
    }

    // Add category filter (by relation page ID)
    if (category) {
      filters.push({
        property: 'category',
        relation: { contains: category }
      });
    }

    // Query with pagination
    const spending = [];
    let cursor = undefined;
    let hasMore = true;

    while (hasMore) {
      const response = await withRetry(async () => {
        return notion.databases.query({
          database_id: DATABASE_ID,
          start_cursor: cursor,
          page_size: 100,
          filter: filters.length > 1 ? { and: filters } : filters[0],
          sorts: [
            { property: 'charge_date', direction: 'descending' }
          ]
        });
      });

      for (const page of response.results) {
        spending.push(extractPageData(page));
      }

      hasMore = response.has_more;
      cursor = response.next_cursor;
    }

    return success({
      spending,
      total_count: spending.length
    });

  } catch (err) {
    console.error('Error querying spending:', err);
    return error(`Failed to query spending: ${err.message}`, 500);
  }
}

module.exports = { createSpending, getSpending };
