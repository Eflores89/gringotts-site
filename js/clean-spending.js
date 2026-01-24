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
    // Populate month/year dropdowns
    this.populateDateDropdowns();

    // Set default FX rate
    Utils.$('fx-rate').value = this.fxRate;

    // Load categorization rules
    await Categorizer.loadRules();

    // Load categories from API
    await this.loadCategories();

    // Setup event handlers
    this.setupFileUpload();
    this.setupParseButton();
    this.setupReviewControls();
    this.setupUploadButton();
    this.setupStartOver();
  },

  /**
   * Populate month and year dropdowns
   */
  populateDateDropdowns() {
    const monthSelect = Utils.$('upload-month');
    const yearSelect = Utils.$('upload-year');

    // Months
    CONFIG.MONTHS.forEach((name, i) => {
      const opt = document.createElement('option');
      opt.value = i + 1;
      opt.textContent = name;
      if (i + 1 === Utils.getCurrentMonth()) opt.selected = true;
      monthSelect.appendChild(opt);
    });

    // Years (current year and 2 years back)
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
      // Use categories from rules as fallback
      this.categories = Categorizer.getCategoriesFromRules();
    }
  },

  /**
   * Setup file upload handling
   */
  setupFileUpload() {
    const dropZone = Utils.$('file-upload');
    const fileInput = Utils.$('file-input');

    // Click to open file dialog
    dropZone.addEventListener('click', () => fileInput.click());

    // File input change
    fileInput.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
    });

    // Drag and drop
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
   * @param {FileList} fileList - Selected files
   */
  handleFiles(fileList) {
    this.files = Array.from(fileList).filter(f =>
      f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );

    const listContainer = Utils.$('files-list');
    const listItems = Utils.$('files-list-items');
    const parseBtn = Utils.$('parse-btn');

    if (this.files.length > 0) {
      // Show file list
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
        // Parse files
        this.transactions = await XLSXParser.parseFiles(this.files);

        // Auto-categorize
        this.transactions = Categorizer.categorizeAll(this.transactions);

        // Show review step
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

    // Update stats
    const stats = XLSXParser.getStats(this.transactions, this.fxRate);
    Utils.setText('stat-total', stats.total);
    Utils.setText('stat-categorized', stats.categorized);
    Utils.setText('stat-uncategorized', stats.uncategorized);
    Utils.setText('stat-amount', Utils.formatCurrency(stats.totalEur, 'EUR'));
    Utils.setText('upload-count', stats.total);

    // Render table
    this.renderTransactionsTable();
  },

  /**
   * Render the transactions table
   */
  renderTransactionsTable() {
    const tbody = Utils.$('transactions-body');
    const filter = Utils.$('filter-status').value;

    // Filter transactions
    let filtered = this.transactions;
    if (filter === 'categorized') {
      filtered = this.transactions.filter(t => t.category);
    } else if (filter === 'uncategorized') {
      filtered = this.transactions.filter(t => !t.category);
    }

    // Render rows
    tbody.innerHTML = filtered.map((tx, i) => {
      const originalIndex = this.transactions.indexOf(tx);
      const rowClass = tx.category ? 'categorized' : 'uncategorized';
      const statusBadge = tx.auto_categorized
        ? '<span class="badge badge-success">Auto</span>'
        : (tx.category ? '<span class="badge badge-info">Manual</span>' : '<span class="badge badge-warning">Review</span>');

      return `
        <tr class="${rowClass}" data-index="${originalIndex}">
          <td>${Utils.formatDateDisplay(tx.charge_date)}</td>
          <td title="${tx.transaction}">${this.truncate(tx.transaction, 30)}</td>
          <td>${Utils.formatCurrency(tx.amount, tx.currency)}</td>
          <td>${tx.currency}</td>
          <td>${tx.method}</td>
          <td>
            <select class="category-select" data-index="${originalIndex}">
              <option value="">-- Select --</option>
              ${this.categories.map(c =>
                `<option value="${c}" ${tx.category === c ? 'selected' : ''}>${c}</option>`
              ).join('')}
            </select>
          </td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');

    // Add change handlers to category selects
    tbody.querySelectorAll('.category-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.transactions[index].category = e.target.value || null;
        this.transactions[index].auto_categorized = false;
        this.updateStats();
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
    const stats = XLSXParser.getStats(this.transactions, this.fxRate);
    Utils.setText('stat-categorized', stats.categorized);
    Utils.setText('stat-uncategorized', stats.uncategorized);
    Utils.setText('upload-count', stats.total);
  },

  /**
   * Setup review step controls
   */
  setupReviewControls() {
    // Filter change
    Utils.$('filter-status').addEventListener('change', () => {
      this.renderTransactionsTable();
    });

    // Back to upload
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
      // Check for uncategorized transactions
      const uncategorized = this.transactions.filter(t => !t.category);
      if (uncategorized.length > 0) {
        const proceed = confirm(
          `${uncategorized.length} transactions are still uncategorized. ` +
          'They will be skipped during upload. Continue?'
        );
        if (!proceed) return;
      }

      // Filter to only categorized transactions
      const toUpload = this.transactions.filter(t => t.category);
      if (toUpload.length === 0) {
        Utils.showAlert('review-alert', 'No categorized transactions to upload.', 'warning');
        Utils.show('review-alert');
        return;
      }

      // Calculate euro amounts
      toUpload.forEach(tx => {
        tx.euro_money = parseFloat(Utils.toEur(tx.amount, tx.currency, this.fxRate).toFixed(2));
      });

      // Show progress step
      Utils.hide('step-review');
      Utils.show('step-progress');
      Utils.setText('progress-total', toUpload.length);

      try {
        // Upload with progress
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

        // Show complete step
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
      // Reset state
      this.files = [];
      this.transactions = [];

      // Reset file input
      Utils.$('file-input').value = '';
      Utils.hide('files-list');
      Utils.$('parse-btn').disabled = true;

      // Reset progress
      Utils.$('progress-fill').style.width = '0%';
      Utils.setText('progress-current', '0');
      Utils.setText('progress-percent', '0%');
      Utils.setHTML('upload-status', '');

      // Hide errors
      Utils.hide('upload-errors');

      // Show upload step
      Utils.hide('step-complete');
      Utils.hide('step-progress');
      Utils.hide('step-review');
      Utils.show('step-upload');
    });
  }
};
