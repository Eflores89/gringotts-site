/**
 * Gringotts Lambda - Main Handler
 * Routes requests to appropriate handlers
 */

const { CORS_HEADERS, error } = require('./notion-client');
const categoriesHandler = require('./handlers/categories');
const spendingHandler = require('./handlers/spending');
const batchSpendingHandler = require('./handlers/batch-spending');
const budgetHandler = require('./handlers/budget');

/**
 * Main Lambda handler
 * @param {object} event - API Gateway event
 * @returns {object} Lambda response
 */
exports.handler = async (event) => {
  console.log('Request:', JSON.stringify({
    path: event.path,
    method: event.httpMethod,
    queryParams: event.queryStringParameters
  }));

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  const path = event.path || event.rawPath || '';
  const method = event.httpMethod || event.requestContext?.http?.method;

  try {
    // Route requests
    if (path === '/categories' && method === 'GET') {
      return await categoriesHandler.getCategories(event);
    }

    if (path === '/spending' && method === 'POST') {
      return await spendingHandler.createSpending(event);
    }

    if (path === '/spending' && method === 'GET') {
      return await spendingHandler.getSpending(event);
    }

    if (path === '/spending/batch' && method === 'POST') {
      return await batchSpendingHandler.batchCreateSpending(event);
    }

    if (path === '/budget' && method === 'GET') {
      return await budgetHandler.getBudget(event);
    }

    // 404 Not Found
    return error(`Not found: ${method} ${path}`, 404);

  } catch (err) {
    console.error('Handler error:', err);
    return error(err.message || 'Internal server error', 500);
  }
};
