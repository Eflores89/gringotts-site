# Investment Tracking Feature - Implementation Plan

## Overview

Add investment portfolio tracking to the Gringotts personal finance app with:
- New Notion database for investments
- Daily stock price updates via free Yahoo Finance API
- Portfolio analytics with multiple chart types
- 5-year projections with vesting support

---

## Data Model

### 1. Investments Database (Notion)

| Property | Type | Description |
|----------|------|-------------|
| `name` | Title | Asset display name (e.g., "Apple Inc.") |
| `ticker` | Rich Text | Stock ticker symbol, nullable for private investments |
| `quantity` | Number | Number of shares/units |
| `purchase_price` | Number | Original cost per unit |
| `purchase_date` | Date | Acquisition date |
| `current_price` | Number | Latest market price (auto-updated for public stocks) |
| `currency` | Select | USD, EUR, MXN, GBP |
| `asset_type` | Select | stock, etf, mutual_fund, bond, crypto, private_equity, real_estate |
| `vest_date` | Date | Nullable - if null or past = liquid, if future = unvested |
| `last_price_update` | Date | When current_price was last refreshed |
| `notes` | Rich Text | Additional notes |

### 2. Allocation Matrix Database (Notion)

| Property | Type | Description |
|----------|------|-------------|
| `investment` | Relation | Links to Investments database |
| `allocation_type` | Select | industry, geography |
| `category` | Select | Tech, Finance, Healthcare, US, Europe, Asia, etc. |
| `percentage` | Number | Allocation percentage (0-100) |

---

## Implementation Phases

### Phase 1: Data Foundation

**Goal**: Set up Notion databases and core backend infrastructure.

**Files to Create/Modify**:
| File | Action | Description |
|------|--------|-------------|
| `lambda/notion-client.js` | MODIFY | Add `INVESTMENTS_DATABASE_ID`, `ALLOCATIONS_DATABASE_ID`, add `extractInvestmentData()` helper |
| `lambda/handlers/investments.js` | CREATE | New handler with `getInvestments()` and `createInvestment()` |
| `lambda/handlers/allocations.js` | CREATE | New handler with `getAllocations()` and `createAllocation()` |
| `lambda/index.js` | MODIFY | Add routes: `GET/POST /investments`, `GET/POST /allocations` |

**Environment Variables**:
```
INVESTMENTS_DATABASE_ID=<notion-db-id>
ALLOCATIONS_DATABASE_ID=<notion-db-id>
```

---

### Phase 2: Basic Display

**Goal**: Create investments.html page with summary stats and portfolio table.

**Files to Create/Modify**:
| File | Action | Description |
|------|--------|-------------|
| `investments.html` | CREATE | New page with header nav, stats cards, portfolio table |
| `js/investments.js` | CREATE | Module with `init()`, `loadData()`, `renderPortfolioTable()` |
| `js/api.js` | MODIFY | Add `getInvestments()`, `createInvestment()`, `getInvestmentAllocations()` |
| `js/config.js` | MODIFY | Add `FX_RATES` object with USD, GBP, MXN rates |
| `js/utils.js` | MODIFY | Add `convertToEur(amount, currency, fxRates)` function |
| `index.html` | MODIFY | Add "Investments" nav card to dashboard |
| `css/styles.css` | MODIFY | Add investment-specific styles (vesting badges, etc.) |

**Features**:
- Summary stats: Total value, gain/loss, liquid value, unvested value
- Portfolio table: Asset, ticker, quantity, value, gain/loss, % return, % portfolio, status
- FX rate inputs for USD, GBP, MXN → EUR conversion

---

### Phase 3: Price Updates

**Goal**: Automatic stock price fetching for public investments.

**Files to Create/Modify**:
| File | Action | Description |
|------|--------|-------------|
| `lambda/handlers/price-update.js` | CREATE | Lambda for Yahoo Finance price fetching |
| `lambda/index.js` | MODIFY | Add route `GET /investments/prices` |
| `js/api.js` | MODIFY | Add `API.updatePrices()` |
| `js/investments.js` | MODIFY | Add "Refresh Prices" button |

**API**: Yahoo Finance free API (no key needed)
- URL: `https://query1.finance.yahoo.com/v8/finance/chart/{ticker}`
- Rate limit: 350ms between calls

**Deployment**: Configure EventBridge trigger for daily execution at 9:00 PM UTC

---

### Phase 4: Advanced Charts and Allocations

**Goal**: Add allocation pie charts, gain/loss bar chart, portfolio value history.

**Charts to Implement**:

1. **Gain/Loss Bar Chart** (horizontal)
   - Shows gain/loss by asset
   - Green for gains, red for losses

2. **Asset Type Pie Chart**
   - Allocation by: stock, etf, private_equity, etc.

3. **Industry Pie Chart**
   - Weighted by investment value
   - Categories: Tech, Finance, Healthcare, etc.

4. **Geography Pie Chart**
   - Weighted by investment value
   - Categories: US, Europe, Asia, etc.

5. **Portfolio Value Over Time** (line chart)
   - Calculate from purchase dates + current value
   - Monthly data points

**Files to Modify**:
| File | Action | Description |
|------|--------|-------------|
| `investments.html` | MODIFY | Add chart containers |
| `js/investments.js` | MODIFY | Add chart rendering methods |

---

### Phase 5: Projections with Vesting

**Goal**: 5-year quarterly projections with growth rate controls.

**Features**:
- **Growth rate slider**: 0-20% annual rate (adjustable live)
- **Unvested toggle**: Include/exclude unvested shares
- **Vesting logic**: Add unvested shares when they vest
- **Projection chart**: Line chart with 20 quarters
- **Projection table**: Year × Quarter grid with values

**Calculation Logic**:
```javascript
quarterlyGrowthRate = (1 + annualRate)^0.25 - 1

For each quarter:
  1. Check if any unvested shares vest this quarter
  2. Add vested value to current total
  3. Apply quarterly growth rate
```

**Files to Modify**:
| File | Action | Description |
|------|--------|-------------|
| `investments.html` | MODIFY | Add projection controls and chart |
| `js/investments.js` | MODIFY | Add `calculateProjection()`, `renderProjection()` |
| `css/styles.css` | MODIFY | Add range slider styles |

---

## Phase Dependencies

```
Phase 1 (Backend)
     │
     ▼
Phase 2 (Basic Frontend) ──► Phase 3 (Price Updates)
     │                              │
     ▼                              │
Phase 4 (Charts) ◄─────────────────┘
     │
     ▼
Phase 5 (Projections)
```

- Phase 1 must complete first
- Phase 2 and 3 can run in parallel
- Phase 4 requires Phase 2
- Phase 5 requires Phase 4

---

## Currency Handling

All investments display in EUR regardless of original currency.

**Supported currencies**: USD, EUR, MXN, GBP

**Default FX rates** (user-adjustable):
```javascript
FX_RATES: {
  EUR: 1.0,
  USD: 0.92,
  MXN: 0.054,
  GBP: 1.17
}
```

---

## Vesting Logic

An investment is considered **liquid** if:
- `vest_date` is null, OR
- `vest_date` is in the past

An investment is considered **unvested** if:
- `vest_date` is in the future

In projections, unvested shares are added to the portfolio value in the quarter when they vest.

---

## Potential Challenges

1. **Yahoo Finance Rate Limits**: Add exponential backoff, cache prices
2. **Multi-currency Complexity**: Allow manual FX rate input
3. **Allocation Data Entry**: Use Notion directly for initial setup
4. **Historical Value Tracking**: Approximate from purchase dates (enhance later)

---

## New Files Summary

```
gringotts-site/
├── investments.html                    # NEW
├── js/
│   └── investments.js                  # NEW
├── lambda/
│   └── handlers/
│       ├── investments.js              # NEW
│       ├── allocations.js              # NEW
│       └── price-update.js             # NEW
└── docs/
    └── INVESTMENT_FEATURE_PLAN.md      # NEW (this file)
```

## Modified Files Summary

```
├── index.html                          # Add nav card
├── css/styles.css                      # Investment styles, slider
├── js/
│   ├── api.js                          # Investment API methods
│   ├── config.js                       # FX_RATES, database IDs
│   └── utils.js                        # convertToEur()
└── lambda/
    ├── index.js                        # Investment routes
    └── notion-client.js                # Investment extractors
```
