/**
 * Gringotts Spending Tracker - Review Dashboard Page Logic
 */

const Review = {
  spending: [],
  budget: [],
  categories: [],
  categoryMap: {}, // Maps category ID to name
  fxRate: CONFIG.DEFAULT_FX_RATE,
  budgetChart: null,
  trendsChart: null,

  /**
   * Initialize the Review page
   */
  async init() {
    // Populate filter dropdowns
    this.populateFilterDropdowns();

    // Set default FX rate
    Utils.$('filter-fx-rate').value = this.fxRate;

    // Load categories
    await this.loadCategories();

    // Setup event handlers
    this.setupFilters();

    // Load initial data
    await this.loadData();
  },

  /**
   * Populate month and year dropdowns
   */
  populateFilterDropdowns() {
    const monthSelect = Utils.$('filter-month');
    const yearSelect = Utils.$('filter-year');

    // Add "All Months" option for trends view
    const allOpt = document.createElement('option');
    allOpt.value = '';
    allOpt.textContent = 'All Months';
    monthSelect.appendChild(allOpt);

    // Months
    CONFIG.MONTHS.forEach((name, i) => {
      const opt = document.createElement('option');
      opt.value = i + 1;
      opt.textContent = name;
      if (i + 1 === Utils.getCurrentMonth()) opt.selected = true;
      monthSelect.appendChild(opt);
    });

    // Years
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

      // Build category ID to name mapping
      this.categoryMap = {};
      this.categories.forEach(cat => {
        this.categoryMap[cat.id] = cat.name || cat.spend_name;
      });

      // Populate category filter
      const select = Utils.$('filter-category');
      this.categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name || cat.spend_name;
        select.appendChild(opt);
      });
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  },

  /**
   * Get category name from ID
   * @param {string} categoryId - The category ID (UUID)
   * @returns {string} The category name or 'Uncategorized'
   */
  getCategoryName(categoryId) {
    if (!categoryId) return 'Uncategorized';
    return this.categoryMap[categoryId] || categoryId;
  },

  /**
   * Setup filter controls
   */
  setupFilters() {
    // View change
    Utils.$('filter-view').addEventListener('change', () => {
      this.updateView();
    });

    // Apply button
    Utils.$('apply-filters').addEventListener('click', async () => {
      await this.loadData();
    });
  },

  /**
   * Load spending and budget data
   */
  async loadData() {
    const month = Utils.$('filter-month').value;
    const year = Utils.$('filter-year').value;
    const category = Utils.$('filter-category').value;
    this.fxRate = parseFloat(Utils.$('filter-fx-rate').value) || CONFIG.DEFAULT_FX_RATE;

    // Show loading
    Utils.hide('stats-container');
    Utils.hide('view-budget-vs-actual');
    Utils.hide('view-spending-trends');
    Utils.hide('empty-state');
    Utils.hide('alert-container');
    Utils.show('loading-state');

    try {
      // Build filters
      const filters = { year };
      if (month) filters.month = month;
      if (category) filters.category = category;

      // Load data in parallel
      const [spendingRes, budgetRes] = await Promise.all([
        API.getSpending(filters),
        API.getBudget(filters)
      ]);

      this.spending = spendingRes.spending || [];
      this.budget = budgetRes.budget || [];

      Utils.hide('loading-state');

      if (this.spending.length === 0 && this.budget.length === 0) {
        Utils.show('empty-state');
        return;
      }

      // Update stats
      this.updateStats();

      // Update view
      this.updateView();

    } catch (error) {
      console.error('Failed to load data:', error);
      Utils.hide('loading-state');
      Utils.showAlert('alert-container', `Failed to load data: ${error.message}`, 'error');
      Utils.show('alert-container');
    }
  },

  /**
   * Get amount in euros for any record (spending or budget)
   * Uses euro_money if available, otherwise converts using FX rate
   */
  getEuroAmount(record) {
    if (record.euro_money != null) {
      return record.euro_money;
    }
    // Fallback: convert using amount and currency
    return Utils.toEur(record.amount || 0, record.currency || 'EUR', this.fxRate);
  },

  /**
   * Update summary statistics
   */
  updateStats() {
    const totalBudget = this.budget.reduce((sum, b) => sum + this.getEuroAmount(b), 0);
    const totalSpent = this.spending.reduce((sum, s) => sum + this.getEuroAmount(s), 0);
    const variance = totalBudget - totalSpent;

    Utils.setText('stat-budget', Utils.formatCurrency(totalBudget, 'EUR'));
    Utils.setText('stat-spent', Utils.formatCurrency(totalSpent, 'EUR'));
    Utils.setText('stat-variance', Utils.formatCurrency(variance, 'EUR'));
    Utils.setText('stat-transactions', this.spending.length);

    const variancePct = totalBudget > 0 ? ((variance / totalBudget) * 100).toFixed(1) : 0;
    const varianceEl = Utils.$('stat-variance-pct');
    varianceEl.textContent = `${variance >= 0 ? '+' : ''}${variancePct}%`;
    varianceEl.className = `change ${variance >= 0 ? 'positive' : 'negative'}`;

    Utils.show('stats-container');
  },

  /**
   * Update the current view
   */
  updateView() {
    const view = Utils.$('filter-view').value;

    Utils.hide('view-budget-vs-actual');
    Utils.hide('view-spending-trends');

    if (view === 'budget-vs-actual') {
      this.renderBudgetVsActual();
      Utils.show('view-budget-vs-actual');
    } else {
      this.renderSpendingTrends();
      Utils.show('view-spending-trends');
    }
  },

  /**
   * Render Budget vs Actual view
   */
  renderBudgetVsActual() {
    // Group spending by era and category
    const spendingByEra = {};
    const spendingByCategory = {};
    this.spending.forEach(s => {
      const era = s.spend_era_name || 'Other';
      const cat = s.category || 'Uncategorized';
      const amount = this.getEuroAmount(s);

      // Track by era -> category
      if (!spendingByEra[era]) {
        spendingByEra[era] = {};
      }
      spendingByEra[era][cat] = (spendingByEra[era][cat] || 0) + amount;

      // Also track total by category for chart
      spendingByCategory[cat] = (spendingByCategory[cat] || 0) + amount;
    });

    // Group budget by era and category
    const budgetByEra = {};
    const budgetByCategory = {};
    this.budget.forEach(b => {
      const era = b.spend_era_name || 'Other';
      const cat = b.category || 'Uncategorized';
      const amount = this.getEuroAmount(b);

      // Track by era -> category
      if (!budgetByEra[era]) {
        budgetByEra[era] = {};
      }
      budgetByEra[era][cat] = (budgetByEra[era][cat] || 0) + amount;

      // Also track total by category for chart
      budgetByCategory[cat] = (budgetByCategory[cat] || 0) + amount;
    });

    // Get all eras and categories
    const allEras = [...new Set([
      ...Object.keys(spendingByEra),
      ...Object.keys(budgetByEra)
    ])].sort();

    const allCategories = [...new Set([
      ...Object.keys(spendingByCategory),
      ...Object.keys(budgetByCategory)
    ])].sort();

    // Render table with era groups
    const tbody = Utils.$('budget-table-body');
    let totalBudget = 0;
    let totalActual = 0;
    let rows = [];

    allEras.forEach(era => {
      const eraSpending = spendingByEra[era] || {};
      const eraBudget = budgetByEra[era] || {};

      // Get all categories in this era
      const eraCategories = [...new Set([
        ...Object.keys(eraSpending),
        ...Object.keys(eraBudget)
      ])].sort();

      if (eraCategories.length === 0) return;

      // Calculate era subtotals
      let eraTotalBudget = 0;
      let eraTotalActual = 0;
      eraCategories.forEach(cat => {
        eraTotalBudget += eraBudget[cat] || 0;
        eraTotalActual += eraSpending[cat] || 0;
      });
      const eraVariance = eraTotalBudget - eraTotalActual;

      // Add subtotal row at top of era group
      const subtotalStatus = eraVariance >= 0
        ? '<span class="badge badge-success">Under</span>'
        : '<span class="badge badge-danger">Over</span>';

      rows.push(`
        <tr class="era-subtotal-row">
          <td><strong>${era}</strong></td>
          <td style="text-align: right;"><strong>${Utils.formatCurrency(eraTotalBudget, 'EUR')}</strong></td>
          <td style="text-align: right;"><strong>${Utils.formatCurrency(eraTotalActual, 'EUR')}</strong></td>
          <td style="text-align: right; color: ${eraVariance >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">
            <strong>${eraVariance >= 0 ? '+' : ''}${Utils.formatCurrency(eraVariance, 'EUR')}</strong>
          </td>
          <td>${subtotalStatus}</td>
        </tr>
      `);

      // Add category rows within this era
      eraCategories.forEach(cat => {
        const budget = eraBudget[cat] || 0;
        const actual = eraSpending[cat] || 0;
        const variance = budget - actual;

        totalBudget += budget;
        totalActual += actual;

        const status = variance >= 0
          ? '<span class="badge badge-success">Under</span>'
          : '<span class="badge badge-danger">Over</span>';

        rows.push(`
          <tr class="era-category-row">
            <td style="padding-left: 28px;">${this.getCategoryName(cat)}</td>
            <td style="text-align: right;">${Utils.formatCurrency(budget, 'EUR')}</td>
            <td style="text-align: right;">${Utils.formatCurrency(actual, 'EUR')}</td>
            <td style="text-align: right; color: ${variance >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">
              ${variance >= 0 ? '+' : ''}${Utils.formatCurrency(variance, 'EUR')}
            </td>
            <td>${status}</td>
          </tr>
        `);
      });
    });

    tbody.innerHTML = rows.join('');

    // Update totals
    const totalVariance = totalBudget - totalActual;
    Utils.setText('total-budget', Utils.formatCurrency(totalBudget, 'EUR'));
    Utils.setText('total-actual', Utils.formatCurrency(totalActual, 'EUR'));
    Utils.$('total-variance').innerHTML = `
      <span style="color: ${totalVariance >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">
        ${totalVariance >= 0 ? '+' : ''}${Utils.formatCurrency(totalVariance, 'EUR')}
      </span>
    `;
    Utils.$('total-status').innerHTML = totalVariance >= 0
      ? '<span class="badge badge-success">Under</span>'
      : '<span class="badge badge-danger">Over</span>';

    // Render chart
    this.renderBudgetChart(allCategories, budgetByCategory, spendingByCategory);
  },

  /**
   * Render budget vs actual chart
   */
  renderBudgetChart(categories, budgetData, actualData) {
    const ctx = Utils.$('budget-chart').getContext('2d');

    // Destroy existing chart
    if (this.budgetChart) {
      this.budgetChart.destroy();
    }

    this.budgetChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: categories.map(c => this.getCategoryName(c)),
        datasets: [
          {
            label: 'Budget',
            data: categories.map(c => budgetData[c] || 0),
            backgroundColor: 'rgba(59, 130, 246, 0.6)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Actual',
            data: categories.map(c => actualData[c] || 0),
            backgroundColor: 'rgba(16, 185, 129, 0.6)',
            borderColor: 'rgba(16, 185, 129, 1)',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#94a3b8',
              font: { family: 'Inter, sans-serif' },
              padding: 20
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(148, 163, 184, 0.1)'
            },
            ticks: {
              color: '#64748b',
              font: { family: 'Inter, sans-serif' },
              callback: value => Utils.formatCurrency(value, 'EUR')
            }
          },
          x: {
            grid: {
              color: 'rgba(148, 163, 184, 0.1)'
            },
            ticks: {
              color: '#64748b',
              font: { family: 'Inter, sans-serif' }
            }
          }
        }
      }
    });
  },

  /**
   * Render Spending Trends view
   */
  renderSpendingTrends() {
    // Group spending by era, category, and month
    const dataByEra = {};
    const dataByCategory = {};

    this.spending.forEach(s => {
      const era = s.spend_era_name || 'Other';
      const cat = s.category || 'Uncategorized';
      const month = Utils.getMonth(s.charge_date);
      const amount = this.getEuroAmount(s);

      // Track by era -> category
      if (!dataByEra[era]) {
        dataByEra[era] = {};
      }
      if (!dataByEra[era][cat]) {
        dataByEra[era][cat] = Array(12).fill(0);
      }
      dataByEra[era][cat][month - 1] += amount;

      // Also track by category for chart
      if (!dataByCategory[cat]) {
        dataByCategory[cat] = Array(12).fill(0);
      }
      dataByCategory[cat][month - 1] += amount;
    });

    // Get all eras sorted
    const allEras = Object.keys(dataByEra).sort();
    const categories = Object.keys(dataByCategory).sort();

    // Render table with era groups
    const tbody = Utils.$('trends-table-body');
    let rows = [];

    allEras.forEach(era => {
      const eraData = dataByEra[era];
      const eraCategories = Object.keys(eraData).sort();

      if (eraCategories.length === 0) return;

      // Calculate era subtotals by month
      const eraMonthlyTotals = Array(12).fill(0);
      eraCategories.forEach(cat => {
        eraData[cat].forEach((val, i) => {
          eraMonthlyTotals[i] += val;
        });
      });
      const eraTotal = eraMonthlyTotals.reduce((a, b) => a + b, 0);

      // Add subtotal row at top of era group
      rows.push(`
        <tr class="era-subtotal-row">
          <td><strong>${era}</strong></td>
          ${eraMonthlyTotals.map(v => `
            <td style="text-align: right;"><strong>${v > 0 ? Utils.formatCurrency(v, 'EUR') : '-'}</strong></td>
          `).join('')}
          <td style="text-align: right;"><strong>${Utils.formatCurrency(eraTotal, 'EUR')}</strong></td>
        </tr>
      `);

      // Add category rows within this era
      eraCategories.forEach(cat => {
        const monthlyData = eraData[cat];
        const total = monthlyData.reduce((a, b) => a + b, 0);

        rows.push(`
          <tr class="era-category-row">
            <td style="padding-left: 28px;">${this.getCategoryName(cat)}</td>
            ${monthlyData.map(v => `
              <td style="text-align: right;">${v > 0 ? Utils.formatCurrency(v, 'EUR') : '-'}</td>
            `).join('')}
            <td style="text-align: right; font-weight: bold;">${Utils.formatCurrency(total, 'EUR')}</td>
          </tr>
        `);
      });
    });

    tbody.innerHTML = rows.join('');

    // Render chart
    this.renderTrendsChart(categories, dataByCategory);
  },

  /**
   * Render spending trends chart
   */
  renderTrendsChart(categories, data) {
    const ctx = Utils.$('trends-chart').getContext('2d');

    // Destroy existing chart
    if (this.trendsChart) {
      this.trendsChart.destroy();
    }

    // Generate colors for each category (dark theme friendly)
    const colors = [
      '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
      '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
      '#84cc16', '#0ea5e9', '#a855f7', '#22c55e', '#64748b'
    ];

    const datasets = categories.map((cat, i) => ({
      label: this.getCategoryName(cat),
      data: data[cat],
      backgroundColor: colors[i % colors.length] + 'aa',
      borderColor: colors[i % colors.length],
      borderWidth: 1,
      borderRadius: 2
    }));

    this.trendsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: CONFIG.MONTHS.map(m => m.substring(0, 3)),
        datasets: datasets
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#94a3b8',
              font: { family: 'Inter, sans-serif' },
              padding: 16,
              boxWidth: 12
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: {
              color: 'rgba(148, 163, 184, 0.1)'
            },
            ticks: {
              color: '#64748b',
              font: { family: 'Inter, sans-serif' }
            }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            grid: {
              color: 'rgba(148, 163, 184, 0.1)'
            },
            ticks: {
              color: '#64748b',
              font: { family: 'Inter, sans-serif' },
              callback: value => Utils.formatCurrency(value, 'EUR')
            }
          }
        }
      }
    });
  }
};
