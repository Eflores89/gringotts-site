/**
 * Categories Handler
 * GET /categories - Fetch distinct categories from Notion
 */

const { notion, DATABASE_ID, success, error, withRetry } = require('../notion-client');

/**
 * Get all unique categories from the spending database
 * @param {object} event - API Gateway event
 * @returns {object} Lambda response
 */
async function getCategories(event) {
  try {
    const categories = new Set();
    let cursor = undefined;
    let hasMore = true;

    // Query all pages to extract unique categories
    while (hasMore) {
      const response = await withRetry(async () => {
        return notion.databases.query({
          database_id: DATABASE_ID,
          start_cursor: cursor,
          page_size: 100,
          filter: {
            property: 'category',
            select: {
              is_not_empty: true
            }
          }
        });
      });

      // Extract categories from results
      for (const page of response.results) {
        const category = page.properties.category?.select?.name;
        if (category) {
          categories.add(category);
        }
      }

      hasMore = response.has_more;
      cursor = response.next_cursor;
    }

    // Sort alphabetically
    const sortedCategories = Array.from(categories).sort();

    return success({
      categories: sortedCategories,
      count: sortedCategories.length
    });

  } catch (err) {
    console.error('Error fetching categories:', err);
    return error(`Failed to fetch categories: ${err.message}`, 500);
  }
}

module.exports = { getCategories };
