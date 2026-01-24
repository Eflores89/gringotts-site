/**
 * Gringotts Spending Tracker - Review Dashboard Page Logic
 */

const Review = {
  spending: [],
  budget: [],
  categories: [],
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

      // Populate category filter
      const select = Utils.$('filter-category');
      this.categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
      });
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
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
   * Update summary statistics
   */
  updateStats() {
    const totalBudget = this.budget.reduce((sum, b) => sum + (b.amount || 0), 0);
    const totalSpent = this.spending.reduce((sum, s) => {
      return sum + Utils.toEur(s.amount, s.currency, this.fxRate);
    }, 0);
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
    // Group spending by category
    const spendingByCategory = {};
    this.spending.forEach(s => {
      const cat = s.category || 'Uncategorized';
      const amount = Utils.toEur(s.amount, s.currency, this.fxRate);
      spendingByCategory[cat] = (spendingByCategory[cat] || 0) + amount;
    });

    // Group budget by category
    const budgetByCategory = {};
    this.budget.forEach(b => {
      const cat = b.category || 'Uncategorized';
      budgetByCategory[cat] = (budgetByCategory[cat] || 0) + (b.amount || 0);
    });

    // Get all categories
    const allCategories = [...new Set([
      ...Object.keys(spendingByCategory),
      ...Object.keys(budgetByCategory)
    ])].sort();

    // Render table
    const tbody = Utils.$('budget-table-body');
    let totalBudget = 0;
    let totalActual = 0;

    tbody.innerHTML = allCategories.map(cat => {
      const budget = budgetByCategory[cat] || 0;
      const actual = spendingByCategory[cat] || 0;
      const variance = budget - actual;

      totalBudget += budget;
      totalActual += actual;

      const status = variance >= 0
        ? '<span class="badge badge-success">Under</span>'
        : '<span class="badge badge-danger">Over</span>';

      return `
        <tr>
          <td>${cat}</td>
          <td style="text-align: right;">${Utils.formatCurrency(budget, 'EUR')}</td>
          <td style="text-align: right;">${Utils.formatCurrency(actual, 'EUR')}</td>
          <td style="text-align: right; color: ${variance >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">
            ${variance >= 0 ? '+' : ''}${Utils.formatCurrency(variance, 'EUR')}
          </td>
          <td>${status}</td>
        </tr>
      `;
    }).join('');

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
        labels: categories,
        datasets: [
          {
            label: 'Budget',
            data: categories.map(c => budgetData[c] || 0),
            backgroundColor: 'rgba(52, 152, 219, 0.7)',
            borderColor: 'rgba(52, 152, 219, 1)',
            borderWidth: 1
          },
          {
            label: 'Actual',
            data: categories.map(c => actualData[c] || 0),
            backgroundColor: 'rgba(46, 204, 113, 0.7)',
            borderColor: 'rgba(46, 204, 113, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: value => Utils.formatCurrency(value, 'EUR')
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
    // Group spending by category and month
    const dataByCategory = {};
    const months = Array(12).fill(0).map((_, i) => i + 1);

    this.spending.forEach(s => {
      const cat = s.category || 'Uncategorized';
      const month = Utils.getMonth(s.charge_date);
      const amount = Utils.toEur(s.amount, s.currency, this.fxRate);

      if (!dataByCategory[cat]) {
        dataByCategory[cat] = Array(12).fill(0);
      }
      dataByCategory[cat][month - 1] += amount;
    });

    const categories = Object.keys(dataByCategory).sort();

    // Render table
    const tbody = Utils.$('trends-table-body');
    tbody.innerHTML = categories.map(cat => {
      const monthlyData = dataByCategory[cat];
      const total = monthlyData.reduce((a, b) => a + b, 0);

      return `
        <tr>
          <td>${cat}</td>
          ${monthlyData.map(v => `
            <td style="text-align: right;">${v > 0 ? Utils.formatCurrency(v, 'EUR') : '-'}</td>
          `).join('')}
          <td style="text-align: right; font-weight: bold;">${Utils.formatCurrency(total, 'EUR')}</td>
        </tr>
      `;
    }).join('');

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

    // Generate colors for each category
    const colors = [
      '#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6',
      '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b',
      '#27ae60', '#2980b9', '#8e44ad', '#d35400', '#7f8c8d'
    ];

    const datasets = categories.map((cat, i) => ({
      label: cat,
      data: data[cat],
      backgroundColor: colors[i % colors.length] + '99',
      borderColor: colors[i % colors.length],
      borderWidth: 1
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
            position: 'top'
          }
        },
        scales: {
          x: {
            stacked: true
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              callback: value => Utils.formatCurrency(value, 'EUR')
            }
          }
        }
      }
    });
  }
};
