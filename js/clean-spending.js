/**
 * Gringotts Spending Tracker - Clean Spending Page Logic
 */

const CleanSpending = {
  files: [],
  transactions: [],
  categories: [],
  fxRate: CONFIG.DEFAULT_FX_RATE,

  /**
   * Initialize the Clean Spending page
   */
  async init() {
    this.populateDateDropdowns();
    Utils.$('fx-rate').value = this.fxRate;

    await Categorizer.loadRules();
    await this.loadCategories();

    this.setupFileUpload();
    this.setupParseButton();
    this.setupReviewControls();
    this.setupUploadButton();
    this.setupStartOver();
    this.setupDownloadRules();
  },

  /**
   * Populate month and year dropdowns
   */
  populateDateDropdowns() {
    const monthSelect = Utils.$('upload-month');
    const yearSelect = Utils.$('upload-year');

    CONFIG.MONTHS.forEach((name, i) => {
      const opt = document.createElement('option');
      opt.value = i + 1;
      opt.textContent = name;
      if (i + 1 === Utils.getCurrentMonth()) opt.selected = true;
      monthSelect.appendChild(opt);
    });

    const currentYear = Utils.getCurrentYear();
    for (let y = currentYear; y >= currentYear - 2; y--) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      if (y === currentYear) opt.selected = true;
      yearSelect.appendChild(opt);
    }
  },

  /**
   * Load categories from API
   */
  async loadCategories() {
    try {
      const response = await API.getCategories();
      this.categories = response.categories || [];
    } catch (error) {
      console.error('Failed to load categories:', error);
      this.categories = [];
    }
  },

  /**
   * Find spend_id for a given category_id
   */
  getSpendIdForCategoryId(category_id) {
    const cat = this.categories.find(c => c.id === category_id);
    return cat ? cat.spend_id : null;
  },

  /**
   * Setup file upload handling
   */
  setupFileUpload() {
    const dropZone = Utils.$('file-upload');
    const fileInput = Utils.$('file-input');

    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      this.handleFiles(e.dataTransfer.files);
    });
  },

  /**
   * Handle selected files
   */
  handleFiles(fileList) {
    this.files = Array.from(fileList).filter(f =>
      f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );

    const listContainer = Utils.$('files-list');
    const listItems = Utils.$('files-list-items');
    const parseBtn = Utils.$('parse-btn');

    if (this.files.length > 0) {
      Utils.show(listContainer);
      listItems.innerHTML = this.files
        .map(f => `<li>${f.name} (${(f.size / 1024).toFixed(1)} KB)</li>`)
        .join('');
      parseBtn.disabled = false;
    } else {
      Utils.hide(listContainer);
      parseBtn.disabled = true;
    }
  },

  /**
   * Setup parse button
   */
  setupParseButton() {
    const parseBtn = Utils.$('parse-btn');

    parseBtn.addEventListener('click', async () => {
      this.fxRate = parseFloat(Utils.$('fx-rate').value) || CONFIG.DEFAULT_FX_RATE;

      Utils.setButtonLoading(parseBtn, true, 'Parsing...');

      try {
        this.transactions = await XLSXParser.parseFiles(this.files);
        this.transactions = Categorizer.categorizeAll(this.transactions, this.categories);
        this.showReviewStep();
      } catch (error) {
        console.error('Failed to parse files:', error);
        Utils.showAlert('review-alert', `Error: ${error.message}`, 'error');
        Utils.show('review-alert');
      } finally {
        Utils.setButtonLoading(parseBtn, false, 'Parse Files');
      }
    });
  },

  /**
   * Show the review step with parsed transactions
   */
  showReviewStep() {
    Utils.hide('step-upload');
    Utils.show('step-review');

    Utils.setText('stat-total', this.transactions.length);
    const stats = XLSXParser.getStats(this.transactions, this.fxRate);
    Utils.setText('stat-amount', Utils.formatCurrency(stats.totalEur, 'EUR'));

    this.renderTransactionsTable();
    this.updateStats();
    this.updateSavedRulesCount();
  },

  /**
   * Render the transactions table
   */
  renderTransactionsTable() {
    const tbody = Utils.$('transactions-body');
    const filter = Utils.$('filter-status').value;

    let filtered = this.transactions;
    if (filter === 'categorized') {
      filtered = this.transactions.filter(t => t.category_id && !t.skipped);
    } else if (filter === 'uncategorized') {
      filtered = this.transactions.filter(t => !t.category_id && !t.skipped);
    } else if (filter === 'skipped') {
      filtered = this.transactions.filter(t => t.skipped);
    }

    tbody.innerHTML = filtered.map((tx, i) => {
      const originalIndex = this.transactions.indexOf(tx);
      let rowClass = tx.skipped ? 'skipped' : (tx.category_id ? 'categorized' : 'uncategorized');

      let statusBadge;
      if (tx.skipped) {
        statusBadge = '<span class="badge badge-danger" title="Skipped — will not upload">X</span>';
      } else if (tx.match_tier === 'merchant') {
        statusBadge = `<span class="badge badge-success" title="Merchant: ${tx.matched_rule || ''}">M</span>`;
      } else if (tx.match_tier === 'spendee') {
        statusBadge = `<span class="badge badge-info" title="Spendee: ${tx.matched_rule || ''}">S</span>`;
      } else if (tx.category_id) {
        statusBadge = '<span class="badge badge-manual" title="Manually assigned">?</span>';
      } else {
        statusBadge = '<span class="badge badge-warning" title="Needs review">!</span>';
      }

      const canSave = tx.category_id && !tx.skipped;
      const hasSpendee = tx.spendee_category && tx.spendee_category !== 'all-nonspec' && tx.spendee_category !== 'General';

      return `
        <tr class="${rowClass}" data-index="${originalIndex}">
          <td>${Utils.formatDateDisplay(tx.charge_date)}</td>
          <td class="desc-cell" title="${tx.transaction}">${this.truncate(tx.transaction, 30)}</td>
          <td>${Utils.formatCurrency(tx.amount, tx.currency)}</td>
          <td>${tx.method}</td>
          <td>
            <select class="category-select" data-index="${originalIndex}" ${tx.skipped ? 'disabled' : ''}>
              <option value="">-- Select --</option>
              ${this.categories.map(c =>
                `<option value="${c.id}" ${tx.category_id === c.id ? 'selected' : ''}>${c.name}</option>`
              ).join('')}
            </select>
          </td>
          <td>${statusBadge}</td>
          <td class="actions-cell">
            <button class="btn-save-rule btn-save-merchant" data-index="${originalIndex}" ${canSave ? '' : 'disabled'}
              title="Save description as merchant rule">+M</button>
            <button class="btn-save-rule btn-save-spendee" data-index="${originalIndex}" ${canSave && hasSpendee ? '' : 'disabled'}
              title="Save spendee category as rule">+S</button>
            <button class="btn-skip" data-index="${originalIndex}"
              title="Skip — do not upload">${tx.skipped ? 'Undo' : 'Skip'}</button>
          </td>
        </tr>
      `;
    }).join('');

    // Category select change handlers
    tbody.querySelectorAll('.category-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        const tx = this.transactions[index];
        tx.category_id = e.target.value || null;
        tx.auto_categorized = false;
        tx.match_tier = null;

        // Resolve spend_id from selected category
        if (tx.category_id) {
          const cat = this.categories.find(c => c.id === tx.category_id);
          if (cat) {
            tx.spend_id = cat.spend_id;
            tx.category = cat.spend_name;
          }
        } else {
          tx.spend_id = null;
          tx.category = null;
        }

        // Enable/disable save buttons for this row
        const row = e.target.closest('tr');
        row.querySelectorAll('.btn-save-merchant').forEach(b => b.disabled = !tx.category_id);
        // Only enable spendee button if there's a useful spendee_category
        row.querySelectorAll('.btn-save-spendee').forEach(b => {
          b.disabled = !tx.category_id || !tx.spendee_category || tx.spendee_category === 'all-nonspec' || tx.spendee_category === 'General';
        });

        this.updateStats();
      });
    });

    // Save merchant rule buttons
    tbody.querySelectorAll('.btn-save-merchant').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        const tx = this.transactions[index];
        if (!tx.spend_id || !tx.transaction) return;

        Categorizer.saveMerchantRule(tx.transaction, tx.spend_id);
        tx.match_tier = 'merchant';
        tx.matched_rule = tx.transaction.toLowerCase();

        e.target.textContent = 'M';
        e.target.classList.add('saved');
        e.target.disabled = true;

        this.updateSavedRulesCount();
      });
    });

    // Save spendee rule buttons
    tbody.querySelectorAll('.btn-save-spendee').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        const tx = this.transactions[index];
        if (!tx.spend_id || !tx.spendee_category) return;

        Categorizer.saveSpendeeRule(tx.spendee_category, tx.spend_id);

        // Apply to all transactions with the same spendee_category that aren't already categorized
        this.transactions.forEach(otherTx => {
          if (otherTx.spendee_category === tx.spendee_category && !otherTx.category_id) {
            const resolved = Categorizer.resolveSpendId(tx.spend_id, this.categories);
            if (resolved) {
              otherTx.spend_id = tx.spend_id;
              otherTx.category_id = resolved.id;
              otherTx.category = resolved.spend_name;
              otherTx.match_tier = 'spendee';
              otherTx.matched_rule = tx.spendee_category;
              otherTx.auto_categorized = true;
            }
          }
        });

        this.updateStats();
        this.renderTransactionsTable();
        this.updateSavedRulesCount();
      });
    });

    // Skip buttons
    tbody.querySelectorAll('.btn-skip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        const tx = this.transactions[index];
        tx.skipped = !tx.skipped;
        this.updateStats();
        this.renderTransactionsTable();
      });
    });
  },

  /**
   * Truncate text with ellipsis
   */
  truncate(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },

  /**
   * Update stats after category changes
   */
  updateStats() {
    const active = this.transactions.filter(t => !t.skipped);
    const skipped = this.transactions.length - active.length;
    const stats = XLSXParser.getStats(active, this.fxRate);
    Utils.setText('stat-categorized', stats.categorized);
    Utils.setText('stat-uncategorized', stats.uncategorized);
    Utils.setText('stat-skipped', skipped);
    Utils.setText('upload-count', active.filter(t => t.category_id).length);
  },

  /**
   * Update the saved rules counter display
   */
  updateSavedRulesCount() {
    const counts = Categorizer.getSavedRuleCounts();
    const total = counts.merchant + counts.spendee;
    const el = Utils.$('saved-rules-count');
    if (el) {
      el.textContent = `${total} saved rule${total !== 1 ? 's' : ''} (${counts.merchant} merchant, ${counts.spendee} spendee)`;
      const container = Utils.$('download-rules-section');
      if (container) {
        if (total > 0) Utils.show(container);
        else Utils.hide(container);
      }
    }
  },

  /**
   * Setup download rules buttons
   */
  setupDownloadRules() {
    const dlMerchant = Utils.$('download-merchant-csv');
    const dlSpendee = Utils.$('download-spendee-csv');
    const clearBtn = Utils.$('clear-saved-rules');

    if (dlMerchant) {
      dlMerchant.addEventListener('click', () => {
        const csv = Categorizer.exportMerchantCSV();
        if (csv) this.downloadFile('merchant-rules-new.csv', csv);
      });
    }

    if (dlSpendee) {
      dlSpendee.addEventListener('click', () => {
        const csv = Categorizer.exportSpendeeCSV();
        if (csv) this.downloadFile('spendee-rules-new.csv', csv);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Clear all saved rules from browser storage?')) {
          localStorage.removeItem(STORAGE_KEYS.MERCHANT);
          localStorage.removeItem(STORAGE_KEYS.SPENDEE);
          this.updateSavedRulesCount();
        }
      });
    }
  },

  /**
   * Trigger a file download in the browser
   */
  downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Setup review step controls
   */
  setupReviewControls() {
    Utils.$('filter-status').addEventListener('change', () => {
      this.renderTransactionsTable();
    });

    Utils.$('back-to-upload').addEventListener('click', () => {
      Utils.hide('step-review');
      Utils.show('step-upload');
    });
  },

  /**
   * Setup upload button
   */
  setupUploadButton() {
    const uploadBtn = Utils.$('upload-btn');

    uploadBtn.addEventListener('click', async () => {
      const active = this.transactions.filter(t => !t.skipped);
      const uncategorized = active.filter(t => !t.category_id);
      if (uncategorized.length > 0) {
        const proceed = confirm(
          `${uncategorized.length} transactions are still uncategorized. ` +
          'They will be skipped during upload. Continue?'
        );
        if (!proceed) return;
      }

      const toUpload = active.filter(t => t.category_id);
      if (toUpload.length === 0) {
        Utils.showAlert('review-alert', 'No categorized transactions to upload.', 'warning');
        Utils.show('review-alert');
        return;
      }

      toUpload.forEach(tx => {
        tx.euro_money = parseFloat(Utils.toEur(tx.amount, tx.currency, this.fxRate).toFixed(2));
      });

      Utils.hide('step-review');
      Utils.show('step-progress');
      Utils.setText('progress-total', toUpload.length);

      try {
        const result = await API.batchCreateSpending(
          toUpload,
          this.fxRate,
          (current, total) => {
            Utils.setText('progress-current', current);
            const percent = Math.round((current / total) * 100);
            Utils.setText('progress-percent', `${percent}%`);
            Utils.$('progress-fill').style.width = `${percent}%`;
          }
        );

        this.showCompleteStep(result);
      } catch (error) {
        console.error('Upload failed:', error);
        Utils.setHTML('upload-status',
          `<div class="alert alert-error">Upload failed: ${error.message}</div>`
        );
      }
    });
  },

  /**
   * Show the completion step
   */
  showCompleteStep(result) {
    Utils.hide('step-progress');
    Utils.show('step-complete');

    Utils.setText('result-created', result.created);
    Utils.setText('result-failed', result.failed);

    if (result.errors && result.errors.length > 0) {
      const errorsDiv = Utils.$('upload-errors');
      errorsDiv.innerHTML = `
        <div class="alert alert-warning">
          <strong>Some transactions failed:</strong>
          <ul style="margin-top: 10px;">
            ${result.errors.slice(0, 10).map(e => `<li>${e.error || e}</li>`).join('')}
            ${result.errors.length > 10 ? `<li>...and ${result.errors.length - 10} more</li>` : ''}
          </ul>
        </div>
      `;
      Utils.show(errorsDiv);
    }
  },

  /**
   * Setup start over button
   */
  setupStartOver() {
    Utils.$('start-over-btn').addEventListener('click', () => {
      this.files = [];
      this.transactions = [];

      Utils.$('file-input').value = '';
      Utils.hide('files-list');
      Utils.$('parse-btn').disabled = true;

      Utils.$('progress-fill').style.width = '0%';
      Utils.setText('progress-current', '0');
      Utils.setText('progress-percent', '0%');
      Utils.setHTML('upload-status', '');

      Utils.hide('upload-errors');

      Utils.hide('step-complete');
      Utils.hide('step-progress');
      Utils.hide('step-review');
      Utils.show('step-upload');
    });
  }
};
