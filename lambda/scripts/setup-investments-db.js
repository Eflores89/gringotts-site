/**
 * Setup script to create Investments and Allocations databases in Notion
 *
 * Usage: NOTION_TOKEN=<token> node scripts/setup-investments-db.js
 */

const { Client } = require('@notionhq/client');

const PARENT_PAGE_ID = '29f13ec88941802cb9dad53ccef55460';

const notion = new Client({
  auth: process.env.NOTION_TOKEN
});

async function createInvestmentsDatabase() {
  console.log('Creating Investments database...');

  const response = await notion.databases.create({
    parent: { page_id: PARENT_PAGE_ID },
    title: [{ type: 'text', text: { content: 'Investments' } }],
    properties: {
      name: {
        title: {}
      },
      ticker: {
        rich_text: {}
      },
      quantity: {
        number: { format: 'number' }
      },
      purchase_price: {
        number: { format: 'number' }
      },
      purchase_date: {
        date: {}
      },
      current_price: {
        number: { format: 'number' }
      },
      currency: {
        select: {
          options: [
            { name: 'USD', color: 'green' },
            { name: 'EUR', color: 'blue' },
            { name: 'MXN', color: 'orange' },
            { name: 'GBP', color: 'purple' }
          ]
        }
      },
      asset_type: {
        select: {
          options: [
            { name: 'stock', color: 'blue' },
            { name: 'etf', color: 'green' },
            { name: 'mutual_fund', color: 'yellow' },
            { name: 'bond', color: 'gray' },
            { name: 'crypto', color: 'orange' },
            { name: 'private_equity', color: 'purple' },
            { name: 'real_estate', color: 'brown' },
            { name: 'other', color: 'default' }
          ]
        }
      },
      vest_date: {
        date: {}
      },
      last_price_update: {
        date: {}
      },
      notes: {
        rich_text: {}
      }
    }
  });

  console.log(`Investments database created: ${response.id}`);
  return response.id;
}

async function createAllocationsDatabase(investmentsDatabaseId) {
  console.log('Creating Allocations database...');

  const response = await notion.databases.create({
    parent: { page_id: PARENT_PAGE_ID },
    title: [{ type: 'text', text: { content: 'Investment Allocations' } }],
    properties: {
      name: {
        title: {}
      },
      investments: {
        relation: {
          database_id: investmentsDatabaseId,
          single_property: {}
        }
      },
      allocation_type: {
        select: {
          options: [
            { name: 'industry', color: 'blue' },
            { name: 'geography', color: 'green' },
            { name: 'fund', color: 'yellow' }
          ]
        }
      },
      category: {
        select: {
          options: [
            // Industry categories
            { name: 'Technology', color: 'blue' },
            { name: 'Finance', color: 'green' },
            { name: 'Healthcare', color: 'red' },
            { name: 'Consumer', color: 'orange' },
            { name: 'Energy', color: 'yellow' },
            { name: 'Industrial', color: 'gray' },
            { name: 'Real Estate', color: 'brown' },
            { name: 'Utilities', color: 'purple' },
            { name: 'Materials', color: 'pink' },
            { name: 'Communication', color: 'default' },
            // Geography categories
            { name: 'US', color: 'blue' },
            { name: 'Europe', color: 'green' },
            { name: 'Asia', color: 'red' },
            { name: 'Latin America', color: 'orange' },
            { name: 'Emerging Markets', color: 'yellow' },
            { name: 'Global', color: 'gray' }
          ]
        }
      },
      percentage: {
        number: { format: 'percent' }
      }
    }
  });

  console.log(`Allocations database created: ${response.id}`);
  return response.id;
}

async function main() {
  if (!process.env.NOTION_TOKEN) {
    console.error('Error: NOTION_TOKEN environment variable is required');
    process.exit(1);
  }

  try {
    const investmentsDbId = await createInvestmentsDatabase();
    const allocationsDbId = await createAllocationsDatabase(investmentsDbId);

    console.log('\n========================================');
    console.log('Databases created successfully!');
    console.log('========================================\n');
    console.log('Add these environment variables to your Lambda:');
    console.log(`INVESTMENTS_DATABASE_ID=${investmentsDbId}`);
    console.log(`ALLOCATIONS_DATABASE_ID=${allocationsDbId}`);
    console.log('\n');
  } catch (err) {
    console.error('Error creating databases:', err.message);
    if (err.body) {
      console.error('Details:', JSON.stringify(err.body, null, 2));
    }
    process.exit(1);
  }
}

main();
