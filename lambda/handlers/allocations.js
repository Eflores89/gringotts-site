/**
 * Allocations Handler
 * GET /allocations - Query allocations (optionally filtered by investment ID)
 * POST /allocations - Create an allocation entry
 */

const {
  notion,
  ALLOCATIONS_DATABASE_ID,
  success,
  error,
  withRetry,
  extractAllocationData
} = require('../notion-client');

/**
 * Create a single allocation entry in Notion
 * @param {object} event - API Gateway event
 * @returns {object} Lambda response
 */
async function createAllocation(event) {
  try {
    const data = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!data.investment_id || !data.allocation_type || !data.category || data.percentage == null) {
      return error('Missing required fields: investment_id, allocation_type, category, percentage', 400);
    }

    if (data.percentage < 0 || data.percentage > 100) {
      return error('Percentage must be between 0 and 100', 400);
    }

    // Build Notion properties
    const properties = {
      name: {
        title: [{ text: { content: `${data.category} (${data.allocation_type})` } }]
      },
      investments: {
        relation: [{ id: data.investment_id }]
      },
      allocation_type: { select: { name: data.allocation_type } },
      category: { select: { name: data.category } },
      percentage: { number: data.percentage }
    };

    // Create the page
    const page = await withRetry(async () => {
      return notion.pages.create({
        parent: { database_id: ALLOCATIONS_DATABASE_ID },
        properties
      });
    });

    return success({
      success: true,
      allocation: extractAllocationData(page)
    }, 201);

  } catch (err) {
    console.error('Error creating allocation:', err);
    return error(`Failed to create allocation: ${err.message}`, 500);
  }
}

/**
 * Query allocations, optionally filtered by investment ID or allocation type
 * @param {object} event - API Gateway event
 * @returns {object} Lambda response
 */
async function getAllocations(event) {
  try {
    const params = event.queryStringParameters || {};
    const investmentId = params.investment_id || null;
    const allocationType = params.allocation_type || null;

    // Build filter
    const filters = [];

    if (investmentId) {
      filters.push({
        property: 'investments',
        relation: { contains: investmentId }
      });
    }

    if (allocationType) {
      filters.push({
        property: 'allocation_type',
        select: { equals: allocationType }
      });
    }

    // Query with pagination
    const allocations = [];
    let cursor = undefined;
    let hasMore = true;

    while (hasMore) {
      const queryParams = {
        database_id: ALLOCATIONS_DATABASE_ID,
        start_cursor: cursor,
        page_size: 100,
        sorts: [
          { property: 'allocation_type', direction: 'ascending' }
        ]
      };

      if (filters.length > 0) {
        queryParams.filter = filters.length > 1 ? { and: filters } : filters[0];
      }

      const response = await withRetry(async () => {
        return notion.databases.query(queryParams);
      });

      for (const page of response.results) {
        allocations.push(extractAllocationData(page));
      }

      hasMore = response.has_more;
      cursor = response.next_cursor;
    }

    return success({
      allocations,
      total_count: allocations.length
    });

  } catch (err) {
    console.error('Error querying allocations:', err);
    return error(`Failed to query allocations: ${err.message}`, 500);
  }
}

module.exports = { createAllocation, getAllocations };
