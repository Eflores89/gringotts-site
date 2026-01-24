/**
 * Budget Handler
 * GET /budget - Query budget entries with filters
 */

const { notion, DATABASE_ID, success, error, withRetry, extractPageData } = require('../notion-client');

/**
 * Query budget entries with filters
 * @param {object} event - API Gateway event
 * @returns {object} Lambda response
 */
async function getBudget(event) {
  try {
    const params = event.queryStringParameters || {};
    const month = params.month ? parseInt(params.month, 10) : null;
    const year = params.year ? parseInt(params.year, 10) : null;

    // Build filter - budget entries have type = "budget"
    const filters = [
      {
        property: 'type',
        select: { equals: 'budget' }
      }
    ];

    // Add month filter
    if (month) {
      filters.push({
        property: 'mm',
        number: { equals: month }
      });
    }

    // Add date-based year filter (if budget items have dates)
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

    // Query with pagination
    const budget = [];
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
            { property: 'category', direction: 'ascending' }
          ]
        });
      });

      for (const page of response.results) {
        budget.push(extractPageData(page));
      }

      hasMore = response.has_more;
      cursor = response.next_cursor;
    }

    return success({
      budget,
      total_count: budget.length
    });

  } catch (err) {
    console.error('Error querying budget:', err);
    return error(`Failed to query budget: ${err.message}`, 500);
  }
}

module.exports = { getBudget };
