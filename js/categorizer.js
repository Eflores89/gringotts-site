/**
 * Gringotts Spending Tracker - Auto-Categorization Engine
 * Matches merchant descriptions to categories using rules from CSV
 */

const Categorizer = {
  rules: [],
  spendeeMap: [],
  loaded: false,

  /**
   * Load categorization rules from CSV files
   * @returns {Promise<void>}
   */
  async loadRules() {
    if (this.loaded) return;

    try {
      // Load both CSVs in parallel
      const [merchantResp, spendeeResp] = await Promise.all([
        fetch('data/merchant-categories.csv').catch(() => null),
        fetch('data/spendee-category-map.csv').catch(() => null)
      ]);

      if (merchantResp && merchantResp.ok) {
        const csv = await merchantResp.text();
        this.rules = this.parseCSV(csv);
        console.log(`Loaded ${this.rules.length} merchant categorization rules`);
      } else {
        console.warn('Could not load merchant-categories.csv, using empty rules');
        this.rules = [];
      }

      if (spendeeResp && spendeeResp.ok) {
        const csv = await spendeeResp.text();
        this.spendeeMap = this.parseSpendeeMap(csv);
        console.log(`Loaded ${this.spendeeMap.length} spendee category mappings`);
      } else {
        console.warn('Could not load spendee-category-map.csv');
        this.spendeeMap = [];
      }

      this.loaded = true;
    } catch (error) {
      console.error('Failed to load categorization rules:', error);
      this.rules = [];
      this.spendeeMap = [];
      this.loaded = true;
    }
  },

  /**
   * Parse spendee-category-map CSV into lookup array
   * @param {string} csv - CSV content (spendee_category,spend_id)
   * @returns {Array} - Parsed mappings
   */
  parseSpendeeMap(csv) {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];

    const mappings = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      const values = this.parseCSVLine(line);
      if (values.length >= 2 && values[0] && values[1]) {
        mappings.push({
          spendee_category: values[0].trim(),
          spend_id: values[1].trim()
        });
      }
    }
    return mappings;
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

    // No merchant match found — Tier 2 (spendee category map) is handled in categorizeAll()
    return {
      category: null,
      matched_rule: null,
      auto_categorized: false
    };
  },

  /**
   * Categorize all transactions using 3-tier matching:
   * Tier 1: Merchant pattern (description text match)
   * Tier 2: Spendee category → spend_id mapping
   * Tier 3: Manual review (no match)
   * @param {Array} transactions - Transactions to categorize
   * @param {Array} categoriesList - List of category objects with id, spend_name, spend_id
   * @returns {Array} - Transactions with categories applied
   */
  categorizeAll(transactions, categoriesList = []) {
    return transactions.map(tx => {
      const result = this.categorize(tx);

      let category_id = null;
      let matched_rule = result.matched_rule;
      let category = result.category;
      let auto_categorized = result.auto_categorized;

      // Tier 1: Look up category_id by spend_name (from merchant pattern match)
      if (category && categoriesList.length > 0) {
        const matched = categoriesList.find(c =>
          c.spend_name.toLowerCase() === category.toLowerCase()
        );
        if (matched) {
          category_id = matched.id;
        }
      }

      // Tier 2: If no match yet, try spendee category → spend_id mapping
      if (!category_id && tx.spendee_category && this.spendeeMap.length > 0 && categoriesList.length > 0) {
        const spendeeMapping = this.spendeeMap.find(m =>
          m.spendee_category.toLowerCase() === tx.spendee_category.toLowerCase()
        );
        if (spendeeMapping) {
          const matched = categoriesList.find(c =>
            c.spend_id === spendeeMapping.spend_id
          );
          if (matched) {
            category_id = matched.id;
            category = matched.spend_name;
            matched_rule = `spendee:${tx.spendee_category}`;
            auto_categorized = true;
          }
        }
      }

      return {
        ...tx,
        category: category,
        category_id: category_id,
        matched_rule: matched_rule,
        auto_categorized: auto_categorized && category_id !== null
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
