/**
 * Gringotts Spending Tracker - Auto-Categorization Engine
 * Two-tier matching: merchant patterns and Spendee categories, both resolving to spend_id
 */

const STORAGE_KEYS = {
  MERCHANT: 'gringotts_merchant_rules',
  SPENDEE: 'gringotts_spendee_rules'
};

const Categorizer = {
  merchantRules: [],
  spendeeMap: [],
  loaded: false,
  // Track rules added this session for UI feedback
  sessionMerchantRules: [],
  sessionSpendeeRules: [],

  /**
   * Load categorization rules from CSV files + localStorage
   */
  async loadRules() {
    if (this.loaded) return;

    try {
      const [merchantResp, spendeeResp] = await Promise.all([
        fetch('data/merchant-categories.csv').catch(() => null),
        fetch('data/spendee-category-map.csv').catch(() => null)
      ]);

      if (merchantResp && merchantResp.ok) {
        const csv = await merchantResp.text();
        this.merchantRules = this.parseCSV(csv);
      }

      if (spendeeResp && spendeeResp.ok) {
        const csv = await spendeeResp.text();
        this.spendeeMap = this.parseCSV(csv);
      }

      // Merge saved rules from localStorage
      this.loadSavedRules();

      this.loaded = true;
      console.log(`Loaded ${this.merchantRules.length} merchant rules, ${this.spendeeMap.length} spendee rules`);
    } catch (error) {
      console.error('Failed to load categorization rules:', error);
      this.merchantRules = [];
      this.spendeeMap = [];
      this.loaded = true;
    }
  },

  /**
   * Parse a 2-column CSV (key,spend_id) into array of {key, spend_id}
   */
  parseCSV(csv) {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];

    const entries = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      const values = this.parseCSVLine(line);
      if (values.length >= 2 && values[0] && values[1]) {
        entries.push({
          key: values[0].trim(),
          spend_id: values[1].trim()
        });
      }
    }
    return entries;
  },

  /**
   * Parse a single CSV line (handles quoted values)
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
    values.push(current.trim());
    return values;
  },

  /**
   * Load saved rules from localStorage and merge with CSV rules
   */
  loadSavedRules() {
    try {
      const savedMerchant = JSON.parse(localStorage.getItem(STORAGE_KEYS.MERCHANT) || '[]');
      const savedSpendee = JSON.parse(localStorage.getItem(STORAGE_KEYS.SPENDEE) || '[]');

      // Merge saved rules (they take priority — appended after CSV rules,
      // but since we match first-found, we prepend so saved overrides CSV)
      this.merchantRules = [...savedMerchant, ...this.merchantRules];
      this.spendeeMap = [...savedSpendee, ...this.spendeeMap];
    } catch (e) {
      console.warn('Could not load saved rules from localStorage:', e);
    }
  },

  /**
   * Save a new merchant rule (description pattern → spend_id)
   */
  saveMerchantRule(pattern, spend_id) {
    const rule = { key: pattern.toLowerCase().trim(), spend_id: spend_id.trim() };

    // Add to active rules (prepend so it takes priority)
    this.merchantRules.unshift(rule);
    this.sessionMerchantRules.push(rule);

    // Persist to localStorage
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.MERCHANT) || '[]');
    // Avoid duplicates
    const exists = saved.findIndex(r => r.key === rule.key);
    if (exists >= 0) {
      saved[exists] = rule;
    } else {
      saved.push(rule);
    }
    localStorage.setItem(STORAGE_KEYS.MERCHANT, JSON.stringify(saved));
  },

  /**
   * Save a new spendee category rule (spendee_category → spend_id)
   */
  saveSpendeeRule(spendee_category, spend_id) {
    const rule = { key: spendee_category.trim(), spend_id: spend_id.trim() };

    this.spendeeMap.unshift(rule);
    this.sessionSpendeeRules.push(rule);

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.SPENDEE) || '[]');
    const exists = saved.findIndex(r => r.key === rule.key);
    if (exists >= 0) {
      saved[exists] = rule;
    } else {
      saved.push(rule);
    }
    localStorage.setItem(STORAGE_KEYS.SPENDEE, JSON.stringify(saved));
  },

  /**
   * Find category info from spend_id using the categories list
   */
  resolveSpendId(spend_id, categoriesList) {
    if (!spend_id || !categoriesList.length) return null;
    return categoriesList.find(c => c.spend_id === spend_id) || null;
  },

  /**
   * Categorize all transactions using 2-tier matching:
   * Tier 1: Merchant pattern (description → spend_id)
   * Tier 2: Spendee category (spendee_category → spend_id)
   */
  categorizeAll(transactions, categoriesList = []) {
    return transactions.map(tx => {
      const description = String(tx.transaction || '').toLowerCase();
      const spendeeCategory = tx.spendee_category || '';

      let spend_id = null;
      let matched_rule = null;
      let match_tier = null;

      // Tier 1: Merchant pattern match
      for (const rule of this.merchantRules) {
        if (description.includes(rule.key.toLowerCase())) {
          spend_id = rule.spend_id;
          matched_rule = rule.key;
          match_tier = 'merchant';
          break;
        }
      }

      // Tier 2: Spendee category match
      if (!spend_id && spendeeCategory && spendeeCategory !== 'all-nonspec' && spendeeCategory !== 'General') {
        for (const rule of this.spendeeMap) {
          if (rule.key.toLowerCase() === spendeeCategory.toLowerCase()) {
            spend_id = rule.spend_id;
            matched_rule = rule.key;
            match_tier = 'spendee';
            break;
          }
        }
      }

      // Resolve spend_id → category_id
      let category_id = null;
      let category = null;
      if (spend_id) {
        const resolved = this.resolveSpendId(spend_id, categoriesList);
        if (resolved) {
          category_id = resolved.id;
          category = resolved.spend_name;
        }
      }

      return {
        ...tx,
        spend_id: spend_id,
        category: category,
        category_id: category_id,
        matched_rule: matched_rule,
        match_tier: match_tier,
        auto_categorized: category_id !== null && match_tier !== null
      };
    });
  },

  /**
   * Export merged merchant rules as CSV string
   */
  exportMerchantCSV() {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.MERCHANT) || '[]');
    if (saved.length === 0) return null;

    let csv = '# New merchant rules (merge into merchant-categories.csv)\n';
    csv += 'merchant_pattern,spend_id\n';
    saved.forEach(r => {
      csv += `${r.key},${r.spend_id}\n`;
    });
    return csv;
  },

  /**
   * Export merged spendee rules as CSV string
   */
  exportSpendeeCSV() {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.SPENDEE) || '[]');
    if (saved.length === 0) return null;

    let csv = '# New spendee rules (merge into spendee-category-map.csv)\n';
    csv += 'spendee_category,spend_id\n';
    saved.forEach(r => {
      csv += `${r.key},${r.spend_id}\n`;
    });
    return csv;
  },

  /**
   * Get count of saved (localStorage) rules
   */
  getSavedRuleCounts() {
    const merchant = JSON.parse(localStorage.getItem(STORAGE_KEYS.MERCHANT) || '[]');
    const spendee = JSON.parse(localStorage.getItem(STORAGE_KEYS.SPENDEE) || '[]');
    return { merchant: merchant.length, spendee: spendee.length };
  }
};
