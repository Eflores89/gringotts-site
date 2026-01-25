/**
 * Gringotts Spending Tracker - Configuration
 */

const CONFIG = {
  // API Configuration
  API_URL: 'https://7lmkdtlssd.execute-api.us-east-1.amazonaws.com',

  // Authentication
  DASHBOARD_PASSWORD: 'floresguerrero',
  SESSION_KEY: 'gringotts_session',

  // Notion Database
  SPENDING_DATABASE_ID: '29313ec8894181fab424e008128e1b16',

  // Currency Settings
  CURRENCIES: ['EUR', 'MXN'],
  DEFAULT_CURRENCY: 'EUR',
  DEFAULT_FX_RATE: 21.5, // EUR to MXN default rate

  // Batch Processing
  BATCH_SIZE: 50,
  BATCH_DELAY_MS: 1000,
  API_TIMEOUT_MS: 30000,

  // Spendee Column Mapping
  SPENDEE_COLUMNS: {
    DATE: 'Date',
    WALLET: 'Wallet',
    TYPE: 'Type',
    CATEGORY: 'Category name',
    AMOUNT: 'Amount',
    CURRENCY: 'Currency',
    NOTE: 'Note',
    LABELS: 'Labels',
    AUTHOR: 'Author'
  },

  // Default values for new spending entries
  DEFAULTS: {
    TYPE: 'spending',
    STATUS: 'confirmed',
    METHOD: 'Cash'
  },

  // Month names for display
  MONTHS: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
};

// Freeze the config to prevent accidental modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.SPENDEE_COLUMNS);
Object.freeze(CONFIG.DEFAULTS);
Object.freeze(CONFIG.MONTHS);
