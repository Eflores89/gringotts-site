/**
 * Gringotts Spending Tracker - Auto-Categorization Engine
 * Matches merchant descriptions to categories using rules from CSV
 */

const Categorizer = {
  rules: [],
  loaded: false,

  /**
   * Load categorization rules from CSV file
   * @returns {Promise<void>}
   */
  async loadRules() {
    if (this.loaded) return;

    try {
      const response = await fetch('data/merchant-categories.csv');
      if (!response.ok) {
        console.warn('Could not load merchant-categories.csv, using empty rules');
        this.rules = [];
        this.loaded = true;
        return;
      }

      const csv = await response.text();
      this.rules = this.parseCSV(csv);
      this.loaded = true;
      console.log(`Loaded ${this.rules.length} categorization rules`);
    } catch (error) {
      console.error('Failed to load categorization rules:', error);
      this.rules = [];
      this.loaded = true;
    }
  },

  /**
   * Parse CSV content into rules array
   * @param {string} csv - CSV content
   * @returns {Array} - Parsed rules
   */
  parseCSV(csv) {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return []; // Need at least header + 1 rule

    const rules = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue; // Skip empty lines and comments

      // Parse CSV line (handle commas in quoted strings)
      const values = this.parseCSVLine(line);

      if (values.length >= 2 && values[0] && values[1]) {
        rules.push({
          pattern: values[0].toLowerCase().trim(),
          category: values[1].trim()
        });
      }
    }

    return rules;
  },

  /**
   * Parse a single CSV line (handles quoted values)
   * @param {string} line - CSV line
   * @returns {Array} - Parsed values
   */
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Don't forget the last value
    values.push(current.trim());

    return values;
  },

  /**
   * Categorize a single transaction
   * @param {object} transaction - Transaction to categorize
   * @returns {object} - Categorization result
   */
  categorize(transaction) {
    const description = (transaction.transaction || '').toLowerCase();

    // Try to match against rules
    for (const rule of this.rules) {
      if (description.includes(rule.pattern)) {
        return {
          category: rule.category,
          matched_rule: rule.pattern,
          auto_categorized: true
        };
      }
    }

    // Fallback: Use Spendee's original category if available and not generic
    const spendeeCategory = transaction.spendee_category;
    if (spendeeCategory &&
        spendeeCategory !== 'all-nonspec' &&
        spendeeCategory !== 'General') {
      return {
        category: spendeeCategory,
        matched_rule: 'spendee_original',
        auto_categorized: true
      };
    }

    // No match found
    return {
      category: null,
      matched_rule: null,
      auto_categorized: false
    };
  },

  /**
   * Categorize all transactions
   * @param {Array} transactions - Transactions to categorize
   * @returns {Array} - Transactions with categories applied
   */
  categorizeAll(transactions) {
    return transactions.map(tx => {
      const result = this.categorize(tx);
      return {
        ...tx,
        category: result.category,
        matched_rule: result.matched_rule,
        auto_categorized: result.auto_categorized
      };
    });
  },

  /**
   * Get list of unique categories from rules
   * @returns {Array} - Category names
   */
  getCategoriesFromRules() {
    const categories = new Set();
    this.rules.forEach(rule => categories.add(rule.category));
    return Array.from(categories).sort();
  },

  /**
   * Add a new rule dynamically (for learning from user corrections)
   * Note: This doesn't persist to the CSV file
   * @param {string} pattern - Merchant pattern
   * @param {string} category - Category name
   */
  addRule(pattern, category) {
    this.rules.push({
      pattern: pattern.toLowerCase().trim(),
      category: category.trim()
    });
  }
};
