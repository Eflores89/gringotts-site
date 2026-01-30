/**
 * Gringotts Spending Tracker - Investments Page Logic
 */

const Investments = {
  investments: [],
  allocations: [],
  fxRates: { ...CONFIG.FX_RATES },
  growthRates: {}, // { investmentId -> annual % }
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

    Utils.$('refresh-prices').addEventListener('click', () => {
      this.refreshPrices();
    });

    // Allocation view toggle
    document.querySelectorAll('input[name="allocation-view"]').forEach(radio => {
      radio.addEventListener('change', () => {
        this.renderAllocationChart();
      });
    });

    // Projection controls - "Set All" global slider
    const slider = Utils.$('growth-rate-slider');
    const valueLabel = Utils.$('growth-rate-value');
    slider.addEventListener('input', () => {
      const rate = parseFloat(slider.value);
      valueLabel.textContent = `${rate.toFixed(1)}%`;
      // Update all per-investment growth rates
      this.investments.forEach(inv => {
        this.growthRates[inv.id] = rate;
      });
      // Sync inline sliders in the table
      document.querySelectorAll('.inv-growth-slider').forEach(el => {
        el.value = rate;
        el.nextElementSibling.textContent = `${rate.toFixed(1)}%`;
      });
      this.renderProjection();
    });

    Utils.$('include-unvested').addEventListener('change', () => {
      this.renderProjection();
    });
  },

  /**
   * Trigger backend price refresh and reload data
   */
  async refreshPrices() {
    const btn = Utils.$('refresh-prices');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px;"></div> Updating...';

    try {
      const result = await API.updatePrices();

      const msg = `Prices updated: ${result.updated} updated, ${result.failed} failed, ${result.skipped} skipped`;
      Utils.showAlert('alert-container', msg, result.failed > 0 ? 'warning' : 'success');
      Utils.show('alert-container');

      // Reload data to reflect new prices
      await this.loadData();

    } catch (err) {
      console.error('Price refresh failed:', err);
      Utils.showAlert('alert-container', `Price refresh failed: ${err.message}`, 'error');
      Utils.show('alert-container');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
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

      // Initialize per-investment growth rates from Notion data
      const defaultRate = parseFloat(Utils.$('growth-rate-slider').value);
      this.investments.forEach(inv => {
        this.growthRates[inv.id] = inv.annual_growth_rate != null ? inv.annual_growth_rate : defaultRate;
      });

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
    this.renderAllocationChart();
    this.renderValueHistoryChart();
    this.renderProjection();

    Utils.show('stats-container');
    Utils.show('portfolio-section');
    Utils.show('charts-section');
    Utils.show('projections-section');
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

      const growthRate = this.growthRates[inv.id] != null ? this.growthRates[inv.id] : 7;

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
        <td class="growth-slider-cell">
          <input type="range" class="inv-growth-slider" data-inv-id="${inv.id}"
            min="0" max="20" step="0.5" value="${growthRate}">
          <span class="inv-growth-value">${growthRate.toFixed(1)}%</span>
        </td>
      </tr>`;
    }).join('');

    tbody.innerHTML = rows;

    // Attach per-investment growth slider listeners
    tbody.querySelectorAll('.inv-growth-slider').forEach(slider => {
      slider.addEventListener('input', () => {
        const rate = parseFloat(slider.value);
        const invId = slider.dataset.invId;
        this.growthRates[invId] = rate;
        slider.nextElementSibling.textContent = `${rate.toFixed(1)}%`;
        this.renderProjection();
      });
    });

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
  },

  // ==================== Allocation Breakdown Chart ====================

  /**
   * Calculate weighted allocation percentages across all investments
   * Each investment's allocations are weighted by its EUR value share of portfolio
   * @param {string} type - 'industry' or 'geography'
   * @returns {{labels: string[], values: number[]}}
   */
  calculateWeightedAllocations(type) {
    const totalValue = this.getTotalValue();
    if (totalValue === 0) return { labels: [], values: [] };

    const weighted = {};

    this.investments.forEach(inv => {
      const invValue = this.getEuroValue(inv);
      const weight = invValue / totalValue;

      // Find allocations for this investment matching the type
      const invAllocations = this.allocations.filter(a =>
        a.allocation_type === type &&
        a.investment && a.investment.includes(inv.id)
      );

      if (invAllocations.length === 0) {
        // No allocation data - bucket as "Unclassified"
        weighted['Unclassified'] = (weighted['Unclassified'] || 0) + weight * 100;
      } else {
        invAllocations.forEach(a => {
          const cat = a.category || 'Other';
          weighted[cat] = (weighted[cat] || 0) + weight * (a.percentage || 0);
        });
      }
    });

    // Sort by value descending
    const sorted = Object.entries(weighted)
      .filter(([, v]) => v > 0.1) // Filter out tiny slices
      .sort((a, b) => b[1] - a[1]);

    return {
      labels: sorted.map(([k]) => k),
      values: sorted.map(([, v]) => v)
    };
  },

  /**
   * Render allocation breakdown doughnut chart (industry or geography)
   */
  renderAllocationChart() {
    const type = document.querySelector('input[name="allocation-view"]:checked')?.value || 'industry';
    const ctx = Utils.$('allocation-chart');
    const emptyEl = Utils.$('allocation-empty');

    if (this.charts.allocation) {
      this.charts.allocation.destroy();
      this.charts.allocation = null;
    }

    const data = this.calculateWeightedAllocations(type);

    if (data.labels.length === 0) {
      ctx.style.display = 'none';
      Utils.show('allocation-empty');
      return;
    }

    ctx.style.display = '';
    Utils.hide('allocation-empty');

    const colors = [
      '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
      '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
      '#84cc16', '#0ea5e9', '#a855f7', '#22c55e', '#64748b'
    ];

    this.charts.allocation = new Chart(ctx.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: data.labels,
        datasets: [{
          data: data.values,
          backgroundColor: colors.slice(0, data.labels.length),
          borderColor: '#0a0a0f',
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
              padding: 14,
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
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((context.raw / total) * 100).toFixed(1) : '0.0';
                return `${context.label}: ${pct}%`;
              }
            }
          }
        }
      }
    });
  },

  // ==================== Portfolio Value Over Time ====================

  /**
   * Build monthly portfolio value history from purchase dates
   * Assumes each investment was added at purchase_date and still held at current value
   * @returns {{labels: string[], values: number[]}}
   */
  calculateValueHistory() {
    if (this.investments.length === 0) return { labels: [], values: [] };

    // Sort investments by purchase date
    const sorted = [...this.investments]
      .filter(inv => inv.purchase_date)
      .sort((a, b) => new Date(a.purchase_date) - new Date(b.purchase_date));

    if (sorted.length === 0) return { labels: [], values: [] };

    const earliest = new Date(sorted[0].purchase_date);
    const now = new Date();

    // Generate monthly data points from earliest purchase to now
    const labels = [];
    const values = [];
    const cursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1);

    while (cursor <= now) {
      const dateStr = cursor.toISOString().split('T')[0];
      const label = `${cursor.toLocaleString('en', { month: 'short' })} ${cursor.getFullYear()}`;

      // Sum value of all investments purchased on or before this month
      let monthValue = 0;
      this.investments.forEach(inv => {
        if (!inv.purchase_date) return;
        const purchaseDate = new Date(inv.purchase_date);
        if (purchaseDate <= new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)) {
          // Use cost basis for historical months, current value for current month
          const isCurrentMonth = cursor.getFullYear() === now.getFullYear() &&
                                  cursor.getMonth() === now.getMonth();
          monthValue += isCurrentMonth ? this.getEuroValue(inv) : this.getCostBasis(inv);
        }
      });

      labels.push(label);
      values.push(monthValue);

      cursor.setMonth(cursor.getMonth() + 1);
    }

    // Ensure the last data point uses current market values
    if (values.length > 0) {
      values[values.length - 1] = this.getTotalValue();
    }

    return { labels, values };
  },

  /**
   * Render portfolio value over time line chart
   */
  renderValueHistoryChart() {
    const ctx = Utils.$('value-history-chart').getContext('2d');

    if (this.charts.valueHistory) {
      this.charts.valueHistory.destroy();
    }

    const data = this.calculateValueHistory();

    if (data.labels.length === 0) return;

    this.charts.valueHistory = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Portfolio Value (EUR)',
          data: data.values,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          fill: true,
          tension: 0.3,
          pointRadius: data.labels.length > 24 ? 0 : 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#10b981',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => Utils.formatCurrency(context.raw, 'EUR')
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            grid: { color: 'rgba(148, 163, 184, 0.1)' },
            ticks: {
              color: '#64748b',
              font: { family: 'Inter, sans-serif' },
              callback: value => Utils.formatCurrency(value, 'EUR')
            }
          },
          x: {
            grid: { color: 'rgba(148, 163, 184, 0.05)' },
            ticks: {
              color: '#64748b',
              font: { family: 'Inter, sans-serif' },
              maxRotation: 45,
              maxTicksLimit: 12
            }
          }
        }
      }
    });
  },

  // ==================== Projections ====================

  /**
   * Recalculate and render both projection chart and table
   */
  renderProjection() {
    const data = this.calculateProjection();
    this.renderProjectionChart(data);
    this.renderProjectionTable(data);
  },

  /**
   * Clean projection calculation that properly handles vesting transitions
   * @returns {{labels: string[], liquid: number[], withUnvested: number[], yearlyData: Array}}
   */
  calculateProjection() {
    const includeUnvested = Utils.$('include-unvested').checked;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(now.getMonth() / 3); // 0-based

    // Build individual investment tracking with per-investment growth rates
    const holdings = this.investments.map(inv => {
      const annualRate = (this.growthRates[inv.id] != null ? this.growthRates[inv.id] : 7) / 100;
      const quarterlyRate = Math.pow(1 + annualRate, 0.25) - 1;
      return {
        value: this.getEuroValue(inv),
        quarterlyRate,
        vested: this.isVested(inv),
        vestQuarterOffset: inv.vest_date ? (() => {
          const vd = new Date(inv.vest_date);
          const yDiff = vd.getFullYear() - currentYear;
          const qDiff = Math.floor(vd.getMonth() / 3) - currentQuarter;
          return yDiff * 4 + qDiff;
        })() : -1 // -1 means already vested or no vest date
      };
    });

    const labels = [];
    const liquidSeries = [];
    const withUnvestedSeries = [];
    const yearlyData = [];
    let currentYearData = null;

    for (let q = 0; q <= 20; q++) {
      const absYear = currentYear + Math.floor((currentQuarter + q) / 4);
      const absQ = (currentQuarter + q) % 4;
      const label = `Q${absQ + 1} ${absYear}`;

      let liquidTotal = 0;
      let unvestedTotal = 0;

      holdings.forEach(h => {
        const grownValue = h.value * Math.pow(1 + h.quarterlyRate, q);
        // Check if this holding has vested by quarter q
        const isVestedByQ = h.vested || (h.vestQuarterOffset >= 0 && q >= h.vestQuarterOffset);

        if (isVestedByQ) {
          liquidTotal += grownValue;
        } else {
          unvestedTotal += grownValue;
        }
      });

      labels.push(label);
      liquidSeries.push(liquidTotal);
      withUnvestedSeries.push(liquidTotal + unvestedTotal);

      // Track yearly data
      if (!currentYearData || currentYearData.year !== absYear) {
        if (currentYearData) yearlyData.push(currentYearData);
        currentYearData = { year: absYear, quarters: [null, null, null, null] };
      }
      currentYearData.quarters[absQ] = includeUnvested
        ? liquidTotal + unvestedTotal
        : liquidTotal;
    }

    if (currentYearData) yearlyData.push(currentYearData);

    return { labels, liquid: liquidSeries, withUnvested: withUnvestedSeries, yearlyData };
  },

  /**
   * Render the projection line chart
   * @param {{labels: string[], liquid: number[], withUnvested: number[]}} data
   */
  renderProjectionChart(data) {
    const ctx = Utils.$('projection-chart').getContext('2d');
    const includeUnvested = Utils.$('include-unvested').checked;

    if (this.charts.projection) {
      this.charts.projection.destroy();
    }

    const datasets = [
      {
        label: 'Liquid Value (EUR)',
        data: data.liquid,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: '#10b981',
        borderWidth: 2
      }
    ];

    if (includeUnvested) {
      datasets.push({
        label: 'With Unvested (EUR)',
        data: data.withUnvested,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.06)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: '#f59e0b',
        borderWidth: 2,
        borderDash: [6, 3]
      });
    }

    // Add a "Today" annotation via a vertical marker at index 0
    this.charts.projection = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: includeUnvested,
            labels: {
              color: '#94a3b8',
              font: { family: 'Inter, sans-serif' },
              padding: 16
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${Utils.formatCurrency(context.raw, 'EUR')}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            grid: { color: 'rgba(148, 163, 184, 0.1)' },
            ticks: {
              color: '#64748b',
              font: { family: 'Inter, sans-serif' },
              callback: value => Utils.formatCurrency(value, 'EUR')
            }
          },
          x: {
            grid: { color: 'rgba(148, 163, 184, 0.05)' },
            ticks: {
              color: '#64748b',
              font: { family: 'Inter, sans-serif' },
              maxRotation: 45,
              maxTicksLimit: 10
            }
          }
        }
      }
    });
  },

  /**
   * Render the projection summary table (Year x Quarter grid)
   * @param {{yearlyData: Array}} data
   */
  renderProjectionTable(data) {
    const tbody = Utils.$('projection-table-body');
    const yearlyData = data.yearlyData;

    if (yearlyData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No data</td></tr>';
      return;
    }

    const rows = yearlyData.map((yd, idx) => {
      const qCells = yd.quarters.map(val =>
        `<td style="text-align: right;">${val !== null ? Utils.formatCurrency(val, 'EUR') : '-'}</td>`
      ).join('');

      // Year-end = last non-null quarter value
      const yearEnd = [...yd.quarters].reverse().find(v => v !== null);

      // YoY growth: compare to previous year's year-end
      let yoyPct = '-';
      if (idx > 0) {
        const prevYd = yearlyData[idx - 1];
        const prevEnd = [...prevYd.quarters].reverse().find(v => v !== null);
        if (prevEnd && prevEnd > 0 && yearEnd) {
          const pct = ((yearEnd - prevEnd) / prevEnd * 100).toFixed(1);
          const isPositive = yearEnd >= prevEnd;
          yoyPct = `<span style="color: ${isPositive ? 'var(--success-color)' : 'var(--danger-color)'}">
            ${isPositive ? '+' : ''}${pct}%
          </span>`;
        }
      } else {
        yoyPct = '<span style="color: var(--text-muted);">baseline</span>';
      }

      return `<tr>
        <td><strong>${yd.year}</strong></td>
        ${qCells}
        <td style="text-align: right; font-weight: 600;">${yearEnd !== null && yearEnd !== undefined ? Utils.formatCurrency(yearEnd, 'EUR') : '-'}</td>
        <td style="text-align: right;">${yoyPct}</td>
      </tr>`;
    }).join('');

    tbody.innerHTML = rows;
  }
};
