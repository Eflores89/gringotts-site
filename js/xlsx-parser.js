/**
 * Gringotts Spending Tracker - XLSX Parser
 * Parses Spendee export files
 */

const XLSXParser = {
  /**
   * Parse multiple XLSX files
   * @param {FileList} files - Files to parse
   * @returns {Promise<Array>} - Parsed transactions
   */
  async parseFiles(files) {
    const allTransactions = [];

    for (const file of files) {
      try {
        const transactions = await this.parseFile(file);
        allTransactions.push(...transactions);
      } catch (error) {
        console.error(`Error parsing ${file.name}:`, error);
        throw new Error(`Failed to parse ${file.name}: ${error.message}`);
      }
    }

    return allTransactions;
  },

  /**
   * Parse a single XLSX file
   * @param {File} file - File to parse
   * @returns {Promise<Array>} - Parsed transactions
   */
  async parseFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });

          // Get first sheet
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];

          // Convert to JSON
          const rows = XLSX.utils.sheet_to_json(sheet);

          // Transform rows
          const transactions = rows
            .filter(row => this.isValidTransaction(row))
            .map(row => this.transformRow(row, file.name));

          resolve(transactions);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Check if a row is a valid transaction (expense with negative amount)
   * @param {object} row - Row data
   * @returns {boolean}
   */
  isValidTransaction(row) {
    const type = row[CONFIG.SPENDEE_COLUMNS.TYPE];
    const amount = row[CONFIG.SPENDEE_COLUMNS.AMOUNT];

    // Only include expenses (negative amounts or "Expense" type)
    return type === 'Expense' || (typeof amount === 'number' && amount < 0);
  },

  /**
   * Transform a row to our transaction format
   * @param {object} row - Row data
   * @param {string} sourceFile - Source file name
   * @returns {object}
   */
  transformRow(row, sourceFile) {
    const rawDate = row[CONFIG.SPENDEE_COLUMNS.DATE];
    const chargeDate = this.parseDate(rawDate);
    const amount = Math.abs(row[CONFIG.SPENDEE_COLUMNS.AMOUNT] || 0);
    const currency = row[CONFIG.SPENDEE_COLUMNS.CURRENCY] || 'EUR';
    const note = row[CONFIG.SPENDEE_COLUMNS.NOTE] || '';
    const wallet = row[CONFIG.SPENDEE_COLUMNS.WALLET] || '';
    const spendeeCategory = row[CONFIG.SPENDEE_COLUMNS.CATEGORY] || '';
    const labels = row[CONFIG.SPENDEE_COLUMNS.LABELS] || '';

    return {
      // Original data
      transaction: note || 'Unknown Transaction',
      spend_name: note || 'Unknown Transaction',
      amount: amount,
      currency: currency,
      charge_date: chargeDate,
      money_date: chargeDate,
      method: wallet,
      labels: labels,
      source_file: sourceFile,
      spendee_category: spendeeCategory,

      // To be filled by categorizer
      category: null,
      auto_categorized: false,
      matched_rule: null,

      // Computed fields (filled before upload)
      type: CONFIG.DEFAULTS.TYPE,
      status: CONFIG.DEFAULTS.STATUS,
      mm: Utils.getMonth(chargeDate),
      euro_money: null // Calculated with FX rate before upload
    };
  },

  /**
   * Parse date from various formats
   * @param {string|number} dateValue - Date value from Excel
   * @returns {string} - ISO date string (YYYY-MM-DD)
   */
  parseDate(dateValue) {
    if (!dateValue) {
      return Utils.formatDateISO(new Date());
    }

    // If it's already a string, try to parse it
    if (typeof dateValue === 'string') {
      // ISO 8601 format: 2025-09-08T17:00:00+00:00
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return Utils.formatDateISO(date);
      }
    }

    // If it's a number, it's an Excel serial date
    if (typeof dateValue === 'number') {
      // Excel dates are days since 1899-12-30
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
      return Utils.formatDateISO(date);
    }

    // Fallback to today
    return Utils.formatDateISO(new Date());
  },

  /**
   * Get summary statistics for parsed transactions
   * @param {Array} transactions - Parsed transactions
   * @param {number} fxRate - EUR/MXN exchange rate
   * @returns {object}
   */
  getStats(transactions, fxRate) {
    const total = transactions.length;
    const categorized = transactions.filter(t => t.category).length;
    const uncategorized = total - categorized;

    // Calculate total in EUR
    const totalEur = transactions.reduce((sum, t) => {
      const eurAmount = Utils.toEur(t.amount, t.currency, fxRate);
      return sum + eurAmount;
    }, 0);

    return {
      total,
      categorized,
      uncategorized,
      totalEur: totalEur.toFixed(2)
    };
  }
};
