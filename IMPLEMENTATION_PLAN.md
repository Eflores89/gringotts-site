# Gringotts Spending Tracker - Implementation Plan

## Overview
Create a password-protected spending tracker web application following the UI patterns of tarabrooch.github.io, with three main pages:
1. **Add Cash Spending** - Simple form for manual cash expense entry
2. **Clean Spending** - Upload Spendee exports, auto-categorize, review, and bulk upload to Notion
3. **Review Spending** - Dashboard comparing budget vs spending with charts/tables

## User Requirements Summary
- **Password**: `floresguerrero`
- **Notion Database ID**: `29313ec8894181fab424e008128e1b16`
- **AWS Region**: `us-east-1`
- **Hosting**: GitHub Pages
- **Categories**: Query dynamically from Notion (NOT hardcoded)
- **Auto-categorization**: CSV file with merchant patterns (user-maintainable)
- **Currency conversion**: EUR/MXN with user-inputted exchange rate
- **Budget vs Spending**: Same database, distinguished by `type` column

## Notion Database Schema
Single database with columns:
```
transaction | Created time | NID | amount | br | cashflow_budget | cashflow_real |
category | charge_date | contra-charge | currency | era | euro_money | family_fund |
group | gs_id | lifegroup | method | mm | money_date | spend_era_name | spend_name |
spend_type | status | trip | type
```
- Budget entries: `type = "budget"`
- Spending entries: `type = "spending"`

---

## File Structure

```
/gringotts-site/
├── index.html                    # Login page with navigation
├── add-cash.html                 # Add Cash Spending form page
├── clean-spending.html           # Bulk import & categorization page
├── review.html                   # Dashboard with charts/tables
├── css/
│   └── styles.css                # Main stylesheet (tarabrooch patterns)
├── js/
│   ├── auth.js                   # Authentication with sessionStorage
│   ├── config.js                 # API URLs, password, constants
│   ├── api.js                    # Lambda API wrapper functions
│   ├── utils.js                  # Date/currency formatting helpers
│   ├── xlsx-parser.js            # Spendee XLSX parsing logic
│   ├── categorizer.js            # Auto-categorization engine
│   ├── add-cash.js               # Add Cash page logic
│   ├── clean-spending.js         # Clean Spending page logic
│   └── review.js                 # Dashboard page logic
├── data/
│   └── merchant-categories.csv   # Auto-categorization rules
├── lambda/
│   ├── spending-handler.js       # Create/query spending entries
│   ├── batch-spending-handler.js # Bulk create with chunking
│   ├── budget-handler.js         # Query budget entries
│   ├── categories-handler.js     # Fetch categories from Notion
│   └── package.json              # Lambda dependencies
└── README.md
```

---

## PHASE 1: Core Infrastructure Setup

### Goal
Set up project structure, authentication, and API client following tarabrooch patterns.

### Files to Create
| File | Purpose |
|------|---------|
| `/index.html` | Login page with password form + navigation cards |
| `/add-cash.html` | Cash spending form page |
| `/clean-spending.html` | Spendee processing page |
| `/review.html` | Spending dashboard |
| `/css/styles.css` | Design system (CSS variables, grid, cards) |
| `/js/auth.js` | SessionStorage authentication |
| `/js/config.js` | Configuration constants |
| `/js/api.js` | Lambda API client |
| `/js/utils.js` | Helper functions |

### Key Implementation Details

**config.js:**
```javascript
const CONFIG = {
  API_URL: 'https://xxx.execute-api.us-east-1.amazonaws.com/prod',
  DASHBOARD_PASSWORD: 'floresguerrero',
  SESSION_KEY: 'gringotts_session',
  SPENDING_DATABASE_ID: '29313ec8894181fab424e008128e1b16',
  CURRENCIES: ['EUR', 'MXN'],
  DEFAULT_CURRENCY: 'EUR',
  DEFAULT_FX_RATE: 21.5,
  BATCH_SIZE: 50
};
```

**auth.js:**
- `Auth.isAuthenticated()` - Check sessionStorage
- `Auth.login(password)` - Validate and store session
- `Auth.logout()` - Clear session
- `Auth.requireAuth()` - Redirect if not authenticated

---

## PHASE 2: Add Cash Spending Page

### Goal
Simple form to add individual cash expenses with Notion page creation.

### UI Components
1. **Category dropdown** - Dynamically loaded from Notion
2. **Currency selector** - EUR (default) / MXN
3. **Amount input** - Number field
4. **Comments textarea** - Optional notes
5. **Submit button** - Creates Notion page
6. **Success display** - Link to created page

### Files to Create
| File | Purpose |
|------|---------|
| `/js/add-cash.js` | Form handling and API calls |

### Data Flow
```
Page Load → API.getCategories() → Populate dropdown
Submit → Validate → API.createSpending() → Show Notion link
```

---

## PHASE 3: Clean Spending Page

### Goal
Upload, categorize, review, and bulk-upload Spendee exports.

### Workflow
1. **Upload**: Select multiple .xlsx files + month/year
2. **Parse**: Client-side XLSX parsing with SheetJS
3. **Categorize**: Apply rules from merchant-categories.csv
4. **Review**: Editable table with category dropdowns
5. **Upload**: Batch create Notion pages with progress

### Files to Create
| File | Purpose |
|------|---------|
| `/js/xlsx-parser.js` | Parse Spendee XLSX files |
| `/js/categorizer.js` | Auto-categorization engine |
| `/js/clean-spending.js` | Page orchestration |
| `/data/merchant-categories.csv` | Category rules (user-editable) |

### Spendee to Notion Field Mapping
| Spendee Column | Notion Property | Transformation |
|----------------|-----------------|----------------|
| `Date` | `charge_date`, `money_date` | Parse ISO 8601, extract date |
| `Wallet` | `method` | Direct mapping |
| `Amount` | `amount` | `Math.abs()` (invert negative) |
| `Currency` | `currency` | Direct mapping |
| `Note` | `transaction`, `spend_name` | Direct mapping |
| *(computed)* | `mm` | Extract month (1-12) |
| *(computed)* | `euro_money` | Convert using FX rate |
| *(computed)* | `type` | Always "spending" |

### Auto-Categorization CSV Format
```csv
merchant_pattern,category
mercadona,Groceries
carrefour,Groceries
uber eats,Food
netflix,Entertainment
```
- Patterns match case-insensitively as substrings
- First match wins
- Unmatched → "Uncategorized" for user review

### Batch Upload Strategy
- Chunk size: 50 transactions per API call
- Rate limiting: 1 second pause between chunks
- Progress display: Show batch X of Y, percentage
- Error handling: Continue on failure, report at end

---

## PHASE 4: Review Spending Dashboard

### Goal
Interactive dashboard comparing budget vs actual spending.

### Views
1. **Budget vs Actual** - Monthly table with variance
2. **Spending Trends** - Annual chart by category

### Files to Create
| File | Purpose |
|------|---------|
| `/js/review.js` | Dashboard logic and chart rendering |

### UI Components
1. **Filters**: Month, Year, Category, FX Rate input
2. **Budget vs Actual Table**: Category | Budget | Actual | Variance | Status
3. **Trend Chart**: Bar chart (Chart.js) - monthly spending by category
4. **Summary Cards**: Total budget, total spent, variance

### Data Flow
```
Filters change → API.getSpending(filters) + API.getBudget(filters)
→ Client-side aggregation by category
→ Currency normalization (MXN → EUR using user FX rate)
→ Render table + charts
```

---

## PHASE 5: Lambda Backend Functions

### Goal
Create AWS Lambda functions for Notion integration.

### Functions to Create
| Function | Endpoint | Purpose |
|----------|----------|---------|
| `categories-handler` | `GET /categories` | Fetch distinct categories from Notion |
| `spending-handler` | `POST /spending` | Create single spending entry |
| `batch-spending-handler` | `POST /spending/batch` | Create multiple entries with chunking |
| `get-spending-handler` | `GET /spending` | Query spending with filters |
| `get-budget-handler` | `GET /budget` | Query budget entries |

### Environment Variables
```
NOTION_TOKEN=secret_xxx
SPENDING_DATABASE_ID=29313ec8894181fab424e008128e1b16
```

### Key Implementation: Batch Create
```javascript
async function batchCreate(transactions, fxRate) {
  const CHUNK_SIZE = 10;
  const results = [];

  for (let i = 0; i < transactions.length; i += CHUNK_SIZE) {
    const chunk = transactions.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(
      chunk.map(tx => createWithRetry(tx, fxRate))
    );
    results.push(...chunkResults);
    await sleep(1000); // Rate limiting
  }

  return { created: results.filter(r => r.success).length, results };
}
```

### API Gateway Setup
- REST API in us-east-1
- CORS enabled for GitHub Pages domain
- Routes: `/categories`, `/spending`, `/spending/batch`, `/budget`

---

## PHASE 6: Testing & Deployment

### Testing Checklist
- [ ] Login/logout flow
- [ ] Add cash form → Notion page created
- [ ] XLSX parsing with sample files
- [ ] Auto-categorization matches
- [ ] Batch upload (200+ items)
- [ ] Dashboard filters and calculations
- [ ] Currency conversion accuracy
- [ ] Error handling

### Deployment Steps
1. Deploy Lambda functions to AWS
2. Configure API Gateway endpoints
3. Update config.js with API URL
4. Push to GitHub → GitHub Pages

### Verification
1. **Add Cash**: Submit → Check Notion database for new page
2. **Clean Spending**: Upload test XLSX → Verify all pages created
3. **Dashboard**: Compare totals with manual Notion query

---

## Dependencies

| Library | Purpose | Source |
|---------|---------|--------|
| SheetJS (xlsx) | XLSX parsing | CDN |
| Chart.js | Dashboard charts | CDN |
| @notionhq/client | Notion API (Lambda) | npm |

---

## Critical Files Reference

Files to modify/create in order:
1. `/css/styles.css` - Design system foundation
2. `/js/config.js` - Configuration constants
3. `/js/auth.js` - Authentication
4. `/js/api.js` - API client
5. `/index.html` - Login page
6. `/js/add-cash.js` + `/add-cash.html` - Add cash feature
7. `/js/xlsx-parser.js` - XLSX parsing
8. `/js/categorizer.js` - Auto-categorization
9. `/js/clean-spending.js` + `/clean-spending.html` - Clean spending feature
10. `/js/review.js` + `/review.html` - Dashboard
11. `/lambda/*.js` - Backend functions

---

## Multi-Agent Execution Plan

This project can be parallelized across agents:

**Agent 1 - Frontend Infrastructure:**
- Phase 1: Core files (HTML, CSS, auth, config, api, utils)

**Agent 2 - Add Cash Feature:**
- Phase 2: add-cash.html + add-cash.js

**Agent 3 - Clean Spending Feature:**
- Phase 3: XLSX parser, categorizer, clean-spending page

**Agent 4 - Dashboard Feature:**
- Phase 4: review.html + review.js + Chart.js integration

**Agent 5 - Lambda Backend:**
- Phase 5: All Lambda functions + API Gateway config

**Dependencies:**
- Agent 2, 3, 4 depend on Agent 1 (core infrastructure)
- Agent 2, 3, 4 depend on Agent 5 (API endpoints)
- Agents 2, 3, 4 can run in parallel after Agent 1 completes
