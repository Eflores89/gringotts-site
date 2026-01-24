/**
 * Gringotts Spending Tracker - Utility Functions
 */

const Utils = {
  // ==================== Date Formatting ====================

  /**
   * Format date as YYYY-MM-DD
   * @param {Date|string} date - Date to format
   * @returns {string}
   */
  formatDateISO(date) {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  },

  /**
   * Format date for display (e.g., "Oct 15, 2025")
   * @param {Date|string} date - Date to format
   * @returns {string}
   */
  formatDateDisplay(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  },

  /**
   * Get month number (1-12) from date
   * @param {Date|string} date - Date to extract month from
   * @returns {number}
   */
  getMonth(date) {
    return new Date(date).getMonth() + 1;
  },

  /**
   * Get year from date
   * @param {Date|string} date - Date to extract year from
   * @returns {number}
   */
  getYear(date) {
    return new Date(date).getFullYear();
  },

  /**
   * Get current month (1-12)
   * @returns {number}
   */
  getCurrentMonth() {
    return new Date().getMonth() + 1;
  },

  /**
   * Get current year
   * @returns {number}
   */
  getCurrentYear() {
    return new Date().getFullYear();
  },

  // ==================== Currency Formatting ====================

  /**
   * Format amount as currency
   * @param {number} amount - Amount to format
   * @param {string} currency - Currency code (EUR, MXN)
   * @returns {string}
   */
  formatCurrency(amount, currency = 'EUR') {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return formatter.format(amount);
  },

  /**
   * Convert MXN to EUR
   * @param {number} amountMXN - Amount in MXN
   * @param {number} fxRate - EUR/MXN exchange rate
   * @returns {number}
   */
  mxnToEur(amountMXN, fxRate) {
    return amountMXN / fxRate;
  },

  /**
   * Convert EUR to MXN
   * @param {number} amountEUR - Amount in EUR
   * @param {number} fxRate - EUR/MXN exchange rate
   * @returns {number}
   */
  eurToMxn(amountEUR, fxRate) {
    return amountEUR * fxRate;
  },

  /**
   * Convert any amount to EUR
   * @param {number} amount - Amount to convert
   * @param {string} currency - Source currency
   * @param {number} fxRate - EUR/MXN exchange rate
   * @returns {number}
   */
  toEur(amount, currency, fxRate) {
    if (currency === 'EUR') return amount;
    if (currency === 'MXN') return this.mxnToEur(amount, fxRate);
    return amount; // Unknown currency, return as-is
  },

  // ==================== DOM Helpers ====================

  /**
   * Get element by ID
   * @param {string} id - Element ID
   * @returns {HTMLElement|null}
   */
  $(id) {
    return document.getElementById(id);
  },

  /**
   * Query selector shorthand
   * @param {string} selector - CSS selector
   * @param {HTMLElement} parent - Parent element (default: document)
   * @returns {HTMLElement|null}
   */
  qs(selector, parent = document) {
    return parent.querySelector(selector);
  },

  /**
   * Query selector all shorthand
   * @param {string} selector - CSS selector
   * @param {HTMLElement} parent - Parent element (default: document)
   * @returns {NodeList}
   */
  qsa(selector, parent = document) {
    return parent.querySelectorAll(selector);
  },

  /**
   * Show element
   * @param {HTMLElement|string} el - Element or ID
   */
  show(el) {
    const element = typeof el === 'string' ? this.$(el) : el;
    if (element) element.classList.remove('hidden');
  },

  /**
   * Hide element
   * @param {HTMLElement|string} el - Element or ID
   */
  hide(el) {
    const element = typeof el === 'string' ? this.$(el) : el;
    if (element) element.classList.add('hidden');
  },

  /**
   * Toggle element visibility
   * @param {HTMLElement|string} el - Element or ID
   * @param {boolean} show - Force show/hide
   */
  toggle(el, show) {
    const element = typeof el === 'string' ? this.$(el) : el;
    if (element) {
      if (show === undefined) {
        element.classList.toggle('hidden');
      } else {
        element.classList.toggle('hidden', !show);
      }
    }
  },

  /**
   * Set element text content
   * @param {HTMLElement|string} el - Element or ID
   * @param {string} text - Text content
   */
  setText(el, text) {
    const element = typeof el === 'string' ? this.$(el) : el;
    if (element) element.textContent = text;
  },

  /**
   * Set element HTML content
   * @param {HTMLElement|string} el - Element or ID
   * @param {string} html - HTML content
   */
  setHTML(el, html) {
    const element = typeof el === 'string' ? this.$(el) : el;
    if (element) element.innerHTML = html;
  },

  // ==================== Form Helpers ====================

  /**
   * Get form data as object
   * @param {HTMLFormElement} form - Form element
   * @returns {object}
   */
  getFormData(form) {
    const formData = new FormData(form);
    const data = {};
    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }
    return data;
  },

  /**
   * Populate select element with options
   * @param {HTMLSelectElement|string} select - Select element or ID
   * @param {Array} options - Array of {value, label} or strings
   * @param {string} placeholder - Optional placeholder text
   */
  populateSelect(select, options, placeholder = null) {
    const element = typeof select === 'string' ? this.$(select) : select;
    if (!element) return;

    element.innerHTML = '';

    if (placeholder) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = placeholder;
      opt.disabled = true;
      opt.selected = true;
      element.appendChild(opt);
    }

    options.forEach(option => {
      const opt = document.createElement('option');
      if (typeof option === 'string') {
        opt.value = option;
        opt.textContent = option;
      } else {
        opt.value = option.value;
        opt.textContent = option.label || option.value;
      }
      element.appendChild(opt);
    });
  },

  // ==================== Validation ====================

  /**
   * Check if value is a valid number
   * @param {*} value - Value to check
   * @returns {boolean}
   */
  isValidNumber(value) {
    return !isNaN(parseFloat(value)) && isFinite(value);
  },

  /**
   * Check if value is not empty
   * @param {*} value - Value to check
   * @returns {boolean}
   */
  isNotEmpty(value) {
    return value !== null && value !== undefined && value.toString().trim() !== '';
  },

  // ==================== Alerts ====================

  /**
   * Show alert message
   * @param {string} containerId - Container element ID
   * @param {string} message - Alert message
   * @param {string} type - Alert type (success, error, warning, info)
   */
  showAlert(containerId, message, type = 'info') {
    const container = this.$(containerId);
    if (!container) return;

    container.className = `alert alert-${type}`;
    container.textContent = message;
    container.classList.remove('hidden');
  },

  /**
   * Hide alert message
   * @param {string} containerId - Container element ID
   */
  hideAlert(containerId) {
    this.hide(containerId);
  },

  // ==================== Loading States ====================

  /**
   * Set button loading state
   * @param {HTMLButtonElement|string} button - Button element or ID
   * @param {boolean} loading - Loading state
   * @param {string} loadingText - Text to show while loading
   */
  setButtonLoading(button, loading, loadingText = 'Loading...') {
    const btn = typeof button === 'string' ? this.$(button) : button;
    if (!btn) return;

    if (loading) {
      btn.disabled = true;
      btn.dataset.originalText = btn.textContent;
      btn.innerHTML = `<span class="spinner"></span> ${loadingText}`;
    } else {
      btn.disabled = false;
      btn.textContent = btn.dataset.originalText || 'Submit';
    }
  },

  // ==================== Data Processing ====================

  /**
   * Group array by key
   * @param {Array} array - Array to group
   * @param {string|function} key - Key to group by
   * @returns {object}
   */
  groupBy(array, key) {
    return array.reduce((result, item) => {
      const groupKey = typeof key === 'function' ? key(item) : item[key];
      (result[groupKey] = result[groupKey] || []).push(item);
      return result;
    }, {});
  },

  /**
   * Sum array of numbers or objects
   * @param {Array} array - Array to sum
   * @param {string} key - Optional key for object arrays
   * @returns {number}
   */
  sum(array, key = null) {
    return array.reduce((total, item) => {
      const value = key ? item[key] : item;
      return total + (parseFloat(value) || 0);
    }, 0);
  },

  /**
   * Sort array by key
   * @param {Array} array - Array to sort
   * @param {string} key - Key to sort by
   * @param {boolean} ascending - Sort direction
   * @returns {Array}
   */
  sortBy(array, key, ascending = true) {
    return [...array].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      if (aVal < bVal) return ascending ? -1 : 1;
      if (aVal > bVal) return ascending ? 1 : -1;
      return 0;
    });
  }
};
