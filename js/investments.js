/**
 * Gringotts Spending Tracker - Investments Page Logic
 */

const Investments = {
  investments: [],
  allocations: [],
  fxRates: { ...CONFIG.FX_RATES },
  charts: {},

  /**
   * Initialize the Investments page
   */
  async init() {
    this.setupFxRateInputs();
    this.setupEventHandlers();
    await this.loadData();
  },

  /**
   * Populate FX rate inputs with defaults
   */
  setupFxRateInputs() {
    Utils.$('fx-usd').value = this.fxRates.USD;
    Utils.$('fx-gbp').value = this.fxRates.GBP;
    Utils.$('fx-mxn').value = this.fxRates.MXN;
  },

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    Utils.$('apply-fx').addEventListener('click', () => {
      this.fxRates.USD = parseFloat(Utils.$('fx-usd').value) || CONFIG.FX_RATES.USD;
      this.fxRates.GBP = parseFloat(Utils.$('fx-gbp').value) || CONFIG.FX_RATES.GBP;
      this.fxRates.MXN = parseFloat(Utils.$('fx-mxn').value) || CONFIG.FX_RATES.MXN;
      this.refresh();
    });
  },

  /**
   * Load investments and allocations from API
   */
  async loadData() {
    Utils.hide('stats-container');
    Utils.hide('portfolio-section');
    Utils.hide('charts-section');
    Utils.hide('empty-state');
    Utils.hide('alert-container');
    Utils.show('loading-state');

    try {
      const [investmentsRes, allocationsRes] = await Promise.all([
        API.getInvestments(),
        API.getAllocations()
      ]);

      this.investments = investmentsRes.investments || [];
      this.allocations = allocationsRes.allocations || [];

      Utils.hide('loading-state');

      if (this.investments.length === 0) {
        Utils.show('empty-state');
        return;
      }

      this.refresh();

    } catch (error) {
      console.error('Failed to load investments:', error);
      Utils.hide('loading-state');
      Utils.showAlert('alert-container', `Failed to load investments: ${error.message}`, 'error');
      Utils.show('alert-container');
    }
  },

  /**
   * Re-calculate and re-render everything (after FX rate change, etc.)
   */
  refresh() {
    this.updateStats();
    this.renderPortfolioTable();
    this.renderGainLossChart();
    this.renderAssetTypeChart();

    Utils.show('stats-container');
    Utils.show('portfolio-section');
    Utils.show('charts-section');
  },

  // ==================== Calculations ====================

  /**
   * Get current value of an investment in EUR
   */
  getEuroValue(inv) {
    const value = (inv.quantity || 0) * (inv.current_price || 0);
    return Utils.convertToEur(value, inv.currency || 'EUR', this.fxRates);
  },

  /**
   * Get cost basis of an investment in EUR
   */
  getCostBasis(inv) {
    const cost = (inv.quantity || 0) * (inv.purchase_price || 0);
    return Utils.convertToEur(cost, inv.currency || 'EUR', this.fxRates);
  },

  /**
   * Check if an investment is vested (liquid)
   * Liquid if vest_date is null or in the past
   */
  isVested(inv) {
    if (!inv.vest_date) return true;
    return new Date(inv.vest_date) <= new Date();
  },

  /**
   * Get total portfolio value in EUR
   */
  getTotalValue() {
    return this.investments.reduce((sum, inv) => sum + this.getEuroValue(inv), 0);
  },

  /**
   * Get total cost basis in EUR
   */
  getTotalCost() {
    return this.investments.reduce((sum, inv) => sum + this.getCostBasis(inv), 0);
  },

  // ==================== Stats ====================

  /**
   * Update summary statistics
   */
  updateStats() {
    const totalValue = this.getTotalValue();
    const totalCost = this.getTotalCost();
    const gainLoss = totalValue - totalCost;

    const liquidValue = this.investments
      .filter(inv => this.isVested(inv))
      .reduce((sum, inv) => sum + this.getEuroValue(inv), 0);

    const unvestedValue = totalValue - liquidValue;

    Utils.setText('stat-total-value', Utils.formatCurrency(totalValue, 'EUR'));
    Utils.setText('stat-gain-loss', Utils.formatCurrency(gainLoss, 'EUR'));
    Utils.setText('stat-liquid', Utils.formatCurrency(liquidValue, 'EUR'));
    Utils.setText('stat-unvested', Utils.formatCurrency(unvestedValue, 'EUR'));

    const gainLossPct = totalCost > 0 ? ((gainLoss / totalCost) * 100).toFixed(1) : 0;
    const pctEl = Utils.$('stat-gain-loss-pct');
    pctEl.textContent = `${gainLoss >= 0 ? '+' : ''}${gainLossPct}%`;
    pctEl.className = `change ${gainLoss >= 0 ? 'positive' : 'negative'}`;
  },

  // ==================== Portfolio Table ====================

  /**
   * Render portfolio holdings table
   */
  renderPortfolioTable() {
    const totalValue = this.getTotalValue();
    const totalCost = this.getTotalCost();
    const totalGainLoss = totalValue - totalCost;
    const totalReturnPct = totalCost > 0 ? ((totalGainLoss / totalCost) * 100).toFixed(2) : '0.00';

    const tbody = Utils.$('portfolio-table-body');

    // Sort by current value descending
    const sorted = [...this.investments].sort((a, b) =>
      this.getEuroValue(b) - this.getEuroValue(a)
    );

    const rows = sorted.map(inv => {
      const value = this.getEuroValue(inv);
      const cost = this.getCostBasis(inv);
      const gainLoss = value - cost;
      const pctReturn = cost > 0 ? ((gainLoss / cost) * 100).toFixed(2) : '0.00';
      const pctPortfolio = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : '0.0';
      const vested = this.isVested(inv);
      const ticker = inv.ticker ? ` (${inv.ticker})` : '';
      const assetType = inv.asset_type || '-';

      return `<tr>
        <td>${inv.name}${ticker}</td>
        <td><span class="badge badge-info">${assetType}</span></td>
        <td style="text-align: right;">${inv.quantity || 0}</td>
        <td style="text-align: right;">${Utils.formatCurrency(value, 'EUR')}</td>
        <td style="text-align: right; color: ${gainLoss >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">
          ${gainLoss >= 0 ? '+' : ''}${Utils.formatCurrency(gainLoss, 'EUR')}
        </td>
        <td style="text-align: right; color: ${gainLoss >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">
          ${gainLoss >= 0 ? '+' : ''}${pctReturn}%
        </td>
        <td style="text-align: right;">${pctPortfolio}%</td>
        <td>${vested
          ? '<span class="badge badge-success">Liquid</span>'
          : '<span class="badge badge-warning">Unvested</span>'}</td>
      </tr>`;
    }).join('');

    tbody.innerHTML = rows;

    // Update footer totals
    Utils.$('total-value').textContent = Utils.formatCurrency(totalValue, 'EUR');

    const totalGLEl = Utils.$('total-gain-loss');
    totalGLEl.innerHTML = `<span style="color: ${totalGainLoss >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">
      ${totalGainLoss >= 0 ? '+' : ''}${Utils.formatCurrency(totalGainLoss, 'EUR')}
    </span>`;

    const totalRetEl = Utils.$('total-return');
    totalRetEl.innerHTML = `<span style="color: ${totalGainLoss >= 0 ? 'var(--success-color)' : 'var(--danger-color)'}">
      ${totalGainLoss >= 0 ? '+' : ''}${totalReturnPct}%
    </span>`;
  },

  // ==================== Charts ====================

  /**
   * Render gain/loss horizontal bar chart
   */
  renderGainLossChart() {
    const ctx = Utils.$('gainloss-chart').getContext('2d');

    if (this.charts.gainLoss) {
      this.charts.gainLoss.destroy();
    }

    const data = this.investments
      .map(inv => ({
        name: inv.ticker || inv.name,
        gainLoss: this.getEuroValue(inv) - this.getCostBasis(inv)
      }))
      .sort((a, b) => b.gainLoss - a.gainLoss);

    this.charts.gainLoss = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.name),
        datasets: [{
          label: 'Gain/Loss (EUR)',
          data: data.map(d => d.gainLoss),
          backgroundColor: data.map(d =>
            d.gainLoss >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'
          ),
          borderColor: data.map(d =>
            d.gainLoss >= 0 ? '#10b981' : '#ef4444'
          ),
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { color: 'rgba(148, 163, 184, 0.1)' },
            ticks: {
              color: '#64748b',
              font: { family: 'Inter, sans-serif' },
              callback: value => Utils.formatCurrency(value, 'EUR')
            }
          },
          y: {
            grid: { display: false },
            ticks: {
              color: '#94a3b8',
              font: { family: 'Inter, sans-serif' }
            }
          }
        }
      }
    });
  },

  /**
   * Render asset type allocation doughnut chart
   */
  renderAssetTypeChart() {
    const ctx = Utils.$('asset-type-chart').getContext('2d');

    if (this.charts.assetType) {
      this.charts.assetType.destroy();
    }

    // Group by asset type
    const byType = {};
    this.investments.forEach(inv => {
      const type = inv.asset_type || 'other';
      byType[type] = (byType[type] || 0) + this.getEuroValue(inv);
    });

    const labels = Object.keys(byType).sort();
    const values = labels.map(l => byType[l]);

    const colors = [
      '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
      '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'
    ];

    this.charts.assetType = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors.slice(0, labels.length),
          borderColor: 'var(--bg-primary)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#94a3b8',
              font: { family: 'Inter, sans-serif' },
              padding: 16,
              generateLabels: (chart) => {
                const dataset = chart.data.datasets[0];
                const total = dataset.data.reduce((a, b) => a + b, 0);
                return chart.data.labels.map((label, i) => {
                  const pct = total > 0 ? ((dataset.data[i] / total) * 100).toFixed(1) : '0.0';
                  return {
                    text: `${label} (${pct}%)`,
                    fillStyle: dataset.backgroundColor[i],
                    strokeStyle: dataset.borderColor,
                    lineWidth: dataset.borderWidth,
                    index: i
                  };
                });
              }
            }
          }
        }
      }
    });
  }
};
