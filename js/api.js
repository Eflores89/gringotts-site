/**
 * Gringotts Spending Tracker - API Client
 * Handles all communication with Lambda backend
 */

const API = {
  /**
   * Make an API request
   * @param {string} endpoint - API endpoint path
   * @param {object} options - Fetch options
   * @returns {Promise<object>} - Response data
   */
  async request(endpoint, options = {}) {
    const url = `${CONFIG.API_URL}${endpoint}`;

    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const fetchOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT_MS);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      throw error;
    }
  },

  // ==================== Categories ====================

  /**
   * Get all categories from Notion database
   * @returns {Promise<Array>} - List of categories
   */
  async getCategories() {
    return this.request('/categories');
  },

  // ==================== Spending ====================

  /**
   * Create a single spending entry
   * @param {object} data - Spending data
   * @returns {Promise<object>} - Created page info with URL
   */
  async createSpending(data) {
    return this.request('/spending', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  /**
   * Create multiple spending entries in batch
   * @param {Array} transactions - Array of spending data
   * @param {number} fxRate - EUR/MXN exchange rate
   * @param {function} onProgress - Progress callback (current, total)
   * @returns {Promise<object>} - Batch result with success/failure counts
   */
  async batchCreateSpending(transactions, fxRate, onProgress = null) {
    const results = {
      created: 0,
      failed: 0,
      errors: [],
      pages: []
    };

    // Split into chunks
    const chunks = [];
    for (let i = 0; i < transactions.length; i += CONFIG.BATCH_SIZE) {
      chunks.push(transactions.slice(i, i + CONFIG.BATCH_SIZE));
    }

    let processed = 0;

    for (let i = 0; i < chunks.length; i++) {
      try {
        const response = await this.request('/spending/batch', {
          method: 'POST',
          body: JSON.stringify({
            transactions: chunks[i],
            fx_rate: fxRate
          })
        });

        results.created += response.created || 0;
        results.failed += response.failed || 0;
        if (response.errors) results.errors.push(...response.errors);
        if (response.pages) results.pages.push(...response.pages);

      } catch (error) {
        // Mark entire chunk as failed
        results.failed += chunks[i].length;
        results.errors.push({
          chunk: i,
          error: error.message
        });
      }

      processed += chunks[i].length;

      if (onProgress) {
        onProgress(processed, transactions.length);
      }

      // Delay between chunks to respect rate limits
      if (i < chunks.length - 1) {
        await this.sleep(CONFIG.BATCH_DELAY_MS);
      }
    }

    return results;
  },

  /**
   * Get spending entries with filters
   * @param {object} filters - Query filters (month, year, category)
   * @returns {Promise<object>} - Spending data
   */
  async getSpending(filters = {}) {
    const params = new URLSearchParams();
    if (filters.month) params.append('month', filters.month);
    if (filters.year) params.append('year', filters.year);
    if (filters.category) params.append('category', filters.category);

    const queryString = params.toString();
    const endpoint = queryString ? `/spending?${queryString}` : '/spending';

    return this.request(endpoint);
  },

  // ==================== Budget ====================

  /**
   * Get budget entries with filters
   * @param {object} filters - Query filters (month, year)
   * @returns {Promise<object>} - Budget data
   */
  async getBudget(filters = {}) {
    const params = new URLSearchParams();
    if (filters.month) params.append('month', filters.month);
    if (filters.year) params.append('year', filters.year);

    const queryString = params.toString();
    const endpoint = queryString ? `/budget?${queryString}` : '/budget';

    return this.request(endpoint);
  },

  // ==================== Investments ====================

  /**
   * Get all investments
   * @param {object} filters - Query filters (asset_type, currency, vested_only)
   * @returns {Promise<object>} - Investment data
   */
  async getInvestments(filters = {}) {
    const params = new URLSearchParams();
    if (filters.asset_type) params.append('asset_type', filters.asset_type);
    if (filters.currency) params.append('currency', filters.currency);
    if (filters.vested_only) params.append('vested_only', 'true');

    const queryString = params.toString();
    const endpoint = queryString ? `/investments?${queryString}` : '/investments';

    return this.request(endpoint);
  },

  /**
   * Create a new investment entry
   * @param {object} data - Investment data
   * @returns {Promise<object>} - Created investment
   */
  async createInvestment(data) {
    return this.request('/investments', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  /**
   * Get allocations for investments
   * @param {object} filters - Query filters (investment_id, allocation_type)
   * @returns {Promise<object>} - Allocation data
   */
  async getAllocations(filters = {}) {
    const params = new URLSearchParams();
    if (filters.investment_id) params.append('investment_id', filters.investment_id);
    if (filters.allocation_type) params.append('allocation_type', filters.allocation_type);

    const queryString = params.toString();
    const endpoint = queryString ? `/allocations?${queryString}` : '/allocations';

    return this.request(endpoint);
  },

  // ==================== Price Updates ====================

  /**
   * Trigger price refresh for all investments with tickers
   * @returns {Promise<object>} - Update results {updated, failed, skipped, details}
   */
  async updatePrices() {
    return this.request('/investments/prices', {
      method: 'POST'
    });
  },

  // ==================== Utilities ====================

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};
