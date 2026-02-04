/**
 * Shared Notion client configuration
 */

const { Client } = require('@notionhq/client');

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_TOKEN
});

// Database IDs from environment
const DATABASE_ID = process.env.SPENDING_DATABASE_ID;
const CATEGORIES_DATABASE_ID = process.env.CATEGORIES_DATABASE_ID;
const INVESTMENTS_DATABASE_ID = process.env.INVESTMENTS_DATABASE_ID;
const ALLOCATIONS_DATABASE_ID = process.env.ALLOCATIONS_DATABASE_ID;

// CORS headers for API Gateway
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

/**
 * Create a successful response
 * @param {object} data - Response data
 * @param {number} statusCode - HTTP status code
 * @returns {object} Lambda response
 */
function success(data, statusCode = 200) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(data)
  };
}

/**
 * Create an error response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @returns {object} Lambda response
 */
function error(message, statusCode = 500) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message })
  };
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param {function} fn - Function to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} baseDelay - Base delay in ms
 * @returns {Promise<any>}
 */
async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Don't retry on client errors (4xx)
      if (err.status && err.status >= 400 && err.status < 500) {
        throw err;
      }

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Extract page data from Notion response
 * @param {object} page - Notion page object
 * @returns {object} Simplified page data
 */
function extractPageData(page) {
  const props = page.properties;

  return {
    id: page.id,
    url: page.url,
    transaction: getTitle(props.transaction),
    amount: getNumber(props.amount),
    currency: getSelect(props.currency),
    category: getRelation(props.category),
    charge_date: getDate(props.charge_date),
    money_date: getDate(props.money_date),
    method: getSelect(props.method),
    type: getSelect(props.type),
    mm: getNumber(props.mm),
    euro_money: getNumber(props.euro_money),
    spend_name: getRollup(props.spend_name) || getRichText(props.spend_name),
    spend_era_name: getRollup(props.spend_era_name),
    status: getSelect(props.status),
    created_time: page.created_time
  };
}

/**
 * Extract investment data from Notion response
 * @param {object} page - Notion page object
 * @returns {object} Simplified investment data
 */
function extractInvestmentData(page) {
  const props = page.properties;

  return {
    id: page.id,
    url: page.url,
    name: getTitle(props.name),
    ticker: getRichText(props.ticker),
    quantity: getNumber(props.quantity),
    purchase_price: getNumber(props.purchase_price),
    purchase_date: getDate(props.purchase_date),
    current_price: getNumber(props.current_price),
    currency: getSelect(props.currency),
    asset_type: getSelect(props.asset_type),
    vest_date: getDate(props.vest_date),
    last_price_update: getDate(props.last_price_update),
    notes: getRichText(props.notes),
    annual_growth_rate: getNumber(props.annual_growth_rate),
    created_time: page.created_time
  };
}

/**
 * Extract allocation data from Notion response
 * @param {object} page - Notion page object
 * @returns {object} Simplified allocation data
 */
function extractAllocationData(page) {
  const props = page.properties;

  // The percentage property uses Notion's 'percent' format, which stores
  // values as decimals (e.g. 0.5 for 50%). Convert to whole numbers (0-100).
  const rawPct = getNumber(props.percentage);
  const percentage = rawPct != null ? rawPct * 100 : null;

  return {
    id: page.id,
    name: getTitle(props.name),
    investment: getRelation(props.investment),
    allocation_type: getSelect(props.allocation_type),
    category: getSelect(props.category),
    percentage
  };
}

// Property extractors
function getTitle(prop) {
  return prop?.title?.[0]?.text?.content || '';
}

function getNumber(prop) {
  return prop?.number ?? null;
}

function getSelect(prop) {
  return prop?.select?.name || null;
}

function getDate(prop) {
  return prop?.date?.start || null;
}

function getRichText(prop) {
  return prop?.rich_text?.[0]?.text?.content || '';
}

function getRelation(prop) {
  // Return first related page ID or null
  return prop?.relation?.[0]?.id || null;
}

function getRollup(prop) {
  // Handle rollup properties - can return array or single value
  if (!prop?.rollup) return null;

  const rollup = prop.rollup;

  // Single value rollups
  if (rollup.type === 'string') {
    return rollup.string || null;
  }
  if (rollup.type === 'number') {
    return rollup.number;
  }

  // Array rollups - get first value
  if (rollup.type === 'array' && rollup.array?.length > 0) {
    const first = rollup.array[0];
    if (first.type === 'rich_text') {
      return first.rich_text?.[0]?.text?.content || null;
    }
    if (first.type === 'title') {
      return first.title?.[0]?.text?.content || null;
    }
    if (first.type === 'select') {
      return first.select?.name || null;
    }
    if (first.type === 'number') {
      return first.number;
    }
  }

  return null;
}

module.exports = {
  notion,
  DATABASE_ID,
  CATEGORIES_DATABASE_ID,
  INVESTMENTS_DATABASE_ID,
  ALLOCATIONS_DATABASE_ID,
  CORS_HEADERS,
  success,
  error,
  sleep,
  withRetry,
  extractPageData,
  extractInvestmentData,
  extractAllocationData,
  getTitle,
  getNumber,
  getSelect,
  getDate,
  getRichText,
  getRelation,
  getRollup
};
