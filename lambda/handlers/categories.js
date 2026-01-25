/**
 * Categories Handler
 * GET /categories - Fetch categories from the Categories database
 */

const { notion, CATEGORIES_DATABASE_ID, success, error, withRetry } = require('../notion-client');

/**
 * Get all categories from the categories database
 * @param {object} event - API Gateway event
 * @returns {object} Lambda response
 */
async function getCategories(event) {
  try {
    const categories = [];
    let cursor = undefined;
    let hasMore = true;

    // Query the categories database (only status = "Latest")
    while (hasMore) {
      const response = await withRetry(async () => {
        return notion.databases.query({
          database_id: CATEGORIES_DATABASE_ID,
          start_cursor: cursor,
          page_size: 100,
          filter: {
            property: 'status',
            select: { equals: 'Latest' }
          },
          sorts: [
            { property: 'spend_name', direction: 'ascending' }
          ]
        });
      });

      // Extract category data from results
      for (const page of response.results) {
        const props = page.properties;

        // Get spend_name from the page
        const spendName = props.spend_name?.rich_text?.[0]?.text?.content
          || props.spend_name?.title?.[0]?.text?.content
          || '';

        if (spendName) {
          categories.push({
            id: page.id,
            spend_name: spendName,
            spend_id: props.spend_id?.rich_text?.[0]?.text?.content || '',
            spend_grp: props.spend_grp?.select?.name || props.spend_grp?.rich_text?.[0]?.text?.content || '',
            spend_lifegrp: props.spend_lifegrp?.select?.name || props.spend_lifegrp?.rich_text?.[0]?.text?.content || ''
          });
        }
      }

      hasMore = response.has_more;
      cursor = response.next_cursor;
    }

    // Sort by spend_name
    categories.sort((a, b) => a.spend_name.localeCompare(b.spend_name));

    return success({
      categories,
      count: categories.length
    });

  } catch (err) {
    console.error('Error fetching categories:', err);
    return error(`Failed to fetch categories: ${err.message}`, 500);
  }
}

module.exports = { getCategories };
