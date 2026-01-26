/**
 * Gringotts Spending Tracker - Add Cash Page Logic
 */

const AddCash = {
  categories: [],

  /**
   * Initialize the Add Cash page
   */
  async init() {
    // Set default date to today
    const dateInput = Utils.$('charge_date');
    if (dateInput) {
      dateInput.value = Utils.formatDateISO(new Date());
    }

    // Load categories
    await this.loadCategories();

    // Setup form submission
    this.setupForm();

    // Setup "Add Another" button
    this.setupAddAnother();
  },

  /**
   * Load categories from API
   */
  async loadCategories() {
    const select = Utils.$('category');
    if (!select) return;

    try {
      const response = await API.getCategories();
      this.categories = response.categories || [];

      // Populate select with category objects (value = id, label = spend_name)
      select.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Select a category...';
      placeholder.disabled = true;
      placeholder.selected = true;
      select.appendChild(placeholder);

      this.categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;  // Store the Notion page ID
        opt.textContent = cat.name || cat.spend_name;  // Display the name
        select.appendChild(opt);
      });
    } catch (error) {
      console.error('Failed to load categories:', error);
      // Show error but allow manual entry
      Utils.showAlert('alert-container',
        'Could not load categories from server. Please check your connection.',
        'warning'
      );
      select.innerHTML = '<option value="" disabled selected>Error loading categories</option>';
    }
  },

  /**
   * Setup form submission handler
   */
  setupForm() {
    const form = Utils.$('add-cash-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    });
  },

  /**
   * Handle form submission
   */
  async handleSubmit() {
    const form = Utils.$('add-cash-form');
    const submitBtn = Utils.$('submit-btn');

    // Get form data
    const categoryId = Utils.$('category').value;  // This is now the Notion page ID
    const categorySelect = Utils.$('category');
    const categoryName = categorySelect.options[categorySelect.selectedIndex]?.text || '';
    const amount = parseFloat(Utils.$('amount').value);
    const currency = document.querySelector('input[name="currency"]:checked').value;
    const chargeDate = Utils.$('charge_date').value;
    const note = Utils.$('note').value.trim();

    // Validate
    if (!categoryId) {
      Utils.showAlert('alert-container', 'Please select a category.', 'error');
      return;
    }

    if (!amount || amount <= 0) {
      Utils.showAlert('alert-container', 'Please enter a valid amount.', 'error');
      return;
    }

    if (!chargeDate) {
      Utils.showAlert('alert-container', 'Please select a date.', 'error');
      return;
    }

    // Hide any previous alerts
    Utils.hideAlert('alert-container');
    Utils.hide('success-container');

    // Set loading state
    Utils.setButtonLoading(submitBtn, true, 'Creating...');

    try {
      // Calculate euro amount
      const fxRate = CONFIG.DEFAULT_FX_RATE;
      const euroMoney = currency === 'MXN' ? Utils.mxnToEur(amount, fxRate) : amount;

      // Prepare data for API
      const data = {
        transaction: note || `Cash - ${categoryName}`,
        spend_name: note || `Cash - ${categoryName}`,
        amount: amount,
        currency: currency,
        category_id: categoryId,  // Pass the Notion page ID for the relation
        charge_date: chargeDate,
        money_date: chargeDate,
        method: CONFIG.DEFAULTS.METHOD,
        type: CONFIG.DEFAULTS.TYPE,
        status: CONFIG.DEFAULTS.STATUS,
        mm: Utils.getMonth(chargeDate),
        euro_money: parseFloat(euroMoney.toFixed(2))
      };

      // Create spending entry
      const result = await API.createSpending(data);

      // Show success
      Utils.hide('add-cash-form');
      Utils.show('success-container');

      // Set Notion link
      const notionLink = Utils.$('notion-link');
      if (notionLink && result.page_url) {
        notionLink.href = result.page_url;
      }

    } catch (error) {
      console.error('Failed to create spending:', error);
      Utils.showAlert('alert-container',
        `Failed to create spending entry: ${error.message}`,
        'error'
      );
    } finally {
      Utils.setButtonLoading(submitBtn, false, 'Create Spending Entry');
    }
  },

  /**
   * Setup "Add Another" button
   */
  setupAddAnother() {
    const btn = Utils.$('add-another-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      // Reset form
      const form = Utils.$('add-cash-form');
      if (form) {
        form.reset();
        // Reset date to today
        Utils.$('charge_date').value = Utils.formatDateISO(new Date());
        // Reset currency to EUR
        document.querySelector('input[name="currency"][value="EUR"]').checked = true;
      }

      // Hide success, show form
      Utils.hide('success-container');
      Utils.show('add-cash-form');
      Utils.hideAlert('alert-container');

      // Focus on category
      Utils.$('category').focus();
    });
  }
};
