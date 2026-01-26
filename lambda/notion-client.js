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
    spend_name: getRichText(props.spend_name),
    status: getSelect(props.status),
    created_time: page.created_time
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

module.exports = {
  notion,
  DATABASE_ID,
  CATEGORIES_DATABASE_ID,
  CORS_HEADERS,
  success,
  error,
  sleep,
  withRetry,
  extractPageData
};
