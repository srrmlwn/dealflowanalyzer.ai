# Deal Flow Analyzer - Project Overview

## What This Does

**Deal Flow Analyzer** automates real estate investment analysis. It fetches property listings, calculates financial metrics (cash flow, ROI, cap rate, etc.), and presents results in a web dashboard.

**Core Value:** Turn hours of spreadsheet work into seconds of automated analysis.

---

## Architecture

```
dealflowanalyzer/
├── backend/          # Node.js API (Express + TypeScript)
│   ├── services/     # Core business logic
│   └── routes/       # API endpoints
├── frontend/         # Next.js web app (React + TypeScript)
├── shared/           # Shared types and validation (Zod schemas)
├── config/           # JSON configuration files
│   ├── buybox.json   # What properties to fetch (zip codes, price range)
│   └── financial.json # Financial assumptions (interest rate, down payment, etc.)
├── data/             # Stored analysis results and property data
└── scripts/          # Utility scripts for data operations
```

**Tech Stack:**
- Backend: Node.js, Express, TypeScript, Zod validation
- Frontend: Next.js 14, React, Tailwind CSS
- Data: Local JSON files (designed for single-user deployment)
- APIs: Zillow (property listings), HUD Fair Market Rent

---

## The Three Core Functions

### 1. Data Fetcher
**Purpose:** Download property listings matching your criteria

**Current State:**
- ✅ Zillow API integration working
- ✅ Recently sold data fetching
- ✅ HUD rental data integration
- ⚠️ **Missing:** Periodic automated fetching (scheduler exists but not active)
- ⚠️ **Missing:** Redfin/MLS alternatives

**How to Use:**
```bash
# Fetch current listings
npm run generate:analysis

# Fetch recently sold properties
npm run fetch:recently-sold
```

**Configuration:** Edit `config/buybox.json`
```json
{
  "zipCodes": ["43211", "43224"],
  "priceRange": { "min": 0, "max": 250000 },
  "statusType": "ForSale"
}
```

---

### 2. Metric Calculations
**Purpose:** Calculate investment metrics for each property

**Current State:**
- ✅ 15+ financial metrics calculated
- ✅ Cash flow (monthly/annual)
- ✅ ROI metrics (cash-on-cash return, cap rate, GRM, DSCR)
- ✅ Long-term projections (10-year appreciation)
- ✅ Operating expenses breakdown (8 categories)
- ⚠️ **Missing:** Equity buildup over time
- ⚠️ **Missing:** Amortization schedule
- ⚠️ **Missing:** Tax calculations (depreciation, capital gains)

**Key Formulas:**
- **Monthly Cash Flow** = Rent - Mortgage Payment - Operating Expenses
- **Cash-on-Cash Return** = Annual Cash Flow ÷ Total Cash Invested × 100
- **Cap Rate** = Net Operating Income ÷ Purchase Price × 100
- **DSCR** = Net Operating Income ÷ Annual Debt Service

**Rental Estimation Priority:**
1. HUD Fair Market Rent (most reliable)
2. Zillow rentZestimate
3. Fallback: 0.8% of purchase price

**Configuration:** Edit `config/financial.json`
```json
{
  "mortgage": {
    "interestRate": 6.50,
    "downPaymentPercent": 20,
    "loanTermYears": 30
  },
  "operatingExpenses": {
    "propertyManagementPercent": 10,
    "maintenancePercent": 8,
    "vacancyRate": 5,
    "propertyTaxPercent": 1.2
  }
}
```

---

### 3. Web Application
**Purpose:** View, filter, and analyze properties

**Current State:**
- ✅ Dashboard with property table
- ✅ Sortable/filterable results
- ✅ CSV export
- ✅ Individual property detail pages
- ✅ Price vs. market comparison
- ✅ Backend API integration
- ⚠️ **Missing:** Pagination (shows all properties at once)
- ⚠️ **Missing:** Watchlist/saved properties
- ⚠️ **Missing:** Property comparison view
- ⚠️ **Missing:** AI chatbot for natural language queries
- ⚠️ **Missing:** Mobile app

**Access:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp env.template .env
# Add your RAPIDAPI_KEY for Zillow access

# 3. Start development servers
npm run dev

# 4. Generate analysis data (one-time setup)
npm run generate:analysis
```

**Available Scripts:**
- `npm run dev` - Start both frontend and backend
- `npm run generate:analysis` - Fetch properties and calculate metrics
- `npm run fetch:recently-sold` - Fetch recently sold data for comparison
- `npm run test:analysis` - Run financial calculation tests

---

## Data Storage

```
data/
├── analysis/           # Analysis results by zip code and date
│   └── {zipCode}/
│       └── {date}/
│           └── analysis-results.json
├── properties/         # Raw property data from Zillow
│   └── {zipCode}/
│       └── {date}/
│           └── {buybox-name}.json
├── recently-sold/      # Recently sold properties for comparison
│   └── {zipCode}/
│       └── {date}/
│           └── {buybox-name}.json
└── hud-rental-data.json # HUD Fair Market Rent data
```

---

## Strategic Plan: Back to Fundamentals

### Current Reality Check

**What Works:**
- Property fetching (manual trigger)
- Financial calculations (solid)
- Web UI (functional and nice-looking)
- Price comparison with recently sold

**What Doesn't Work:**
- **No automation** - all data fetching is manual
- **No scheduling** - scheduler exists but isn't enabled/integrated
- **Stale data** - properties from months ago, not fresh listings
- **No monitoring** - can't see when data was last updated
- **No alerts** - can't notify when good deals appear

**Core Problem:** This is a *periodic batch analysis tool* but it's being run like a *one-time script*.

---

## Fresh Strategic Plan

### PHASE 1: Automation Foundation (Week 1-2)

**Goal:** Make the app run itself automatically

#### 1.1 Enable Scheduled Data Collection
- [ ] Integrate scheduler service into main backend server
- [ ] Add scheduler configuration to config files
- [ ] Default schedule: Daily at 2 AM
- [ ] Add endpoint to manually trigger schedule: `POST /api/scheduler/run-now`
- [ ] Add endpoint to check status: `GET /api/scheduler/status`

**Config Addition:**
```json
// config/scheduler.json (new file)
{
  "enabled": true,
  "cronSchedule": "0 2 * * *",  // Daily at 2 AM
  "timezone": "America/New_York",
  "tasks": [
    {
      "name": "fetch-listings",
      "enabled": true,
      "schedule": "0 2 * * *"
    },
    {
      "name": "fetch-recently-sold",
      "enabled": true,
      "schedule": "0 3 * * 0"  // Weekly on Sunday at 3 AM
    },
    {
      "name": "run-analysis",
      "enabled": true,
      "schedule": "0 4 * * *"  // Daily at 4 AM (after fetching)
    },
    {
      "name": "cleanup-old-data",
      "enabled": true,
      "schedule": "0 5 * * 0",  // Weekly on Sunday at 5 AM
      "retentionDays": 90
    }
  ]
}
```

#### 1.2 Data Freshness Indicators
- [ ] Add "Last Updated" timestamp to all data files
- [ ] Display data age on dashboard ("Updated 2 hours ago")
- [ ] Warning badge if data is >24 hours old
- [ ] Show next scheduled update time

#### 1.3 API Rate Limit Management
- [ ] Track API usage in persistent storage
- [ ] Display remaining API calls on dashboard
- [ ] Automatic throttling if approaching limits
- [ ] Alert if running out of quota

#### 1.4 Error Handling & Logging
- [ ] Centralized error logging to files
- [ ] Email/SMS alerts on critical failures
- [ ] Retry logic for transient API failures
- [ ] Dashboard indicator for failed jobs

**Outcome:** App runs unattended, keeps data fresh automatically

---

### PHASE 2: Enhanced Fundamentals (Week 3-4)

**Goal:** Make the core analysis more complete and useful

#### 2.1 Complete Financial Metrics
- [ ] **Equity Buildup Calculator**
  - Year-by-year equity accumulation
  - Amortization schedule (principal vs. interest)
  - Equity at any point in holding period
- [ ] **Tax Calculations**
  - Depreciation (27.5 years straight-line)
  - Tax savings from depreciation
  - After-tax cash flow
  - Capital gains tax on exit
- [ ] **Total Return Calculation**
  - Cash flow + Appreciation + Equity buildup + Tax savings
  - True IRR (Internal Rate of Return)
  - Comparison to alternative investments (S&P 500)

#### 2.2 Better Rental Estimates
- [ ] Integrate Rentometer API (if available)
- [ ] Show multiple estimates side-by-side
- [ ] Confidence scoring based on data source agreement
- [ ] Manual override capability for known rents

#### 2.3 Market Intelligence
- [ ] Days on market tracking (identify motivated sellers)
- [ ] Price reduction history (properties that dropped price)
- [ ] Inventory trends (market heating up or cooling down?)
- [ ] Sold vs. list price ratio (how much below asking do things sell?)

**Outcome:** Professional-grade analysis with complete financial picture

---

### PHASE 3: User Experience (Week 5-6)

**Goal:** Make the app delightful to use

#### 3.1 Smart Filtering & Sorting
- [ ] Save filter presets ("Show me positive cash flow deals")
- [ ] Advanced filters (min bedrooms, max price, min ROI)
- [ ] Multi-column sorting
- [ ] Pagination (don't show 119 properties at once)
- [ ] Infinite scroll or page-based navigation

#### 3.2 Watchlist & Favorites
- [ ] Save interesting properties to watchlist
- [ ] Get alerts when watchlisted properties change price
- [ ] Notes on each property
- [ ] Star rating system

#### 3.3 Property Comparison
- [ ] Select 2-3 properties to compare side-by-side
- [ ] Highlight which property wins on each metric
- [ ] Export comparison as PDF

#### 3.4 Scenario Modeling ("What-If" Analysis)
- [ ] Interactive sliders on detail page
- [ ] Adjust interest rate, rent, expenses in real-time
- [ ] See how metrics change
- [ ] Save multiple scenarios per property

**Outcome:** Fast, intuitive workflow for deal analysis

---

### PHASE 4: Intelligence Layer (Week 7-8)

**Goal:** Add smart recommendations and insights

#### 4.1 Deal Scoring System
- [ ] Proprietary scoring algorithm (0-100 points)
- [ ] Weighted factors: cash flow, ROI, appreciation, market
- [ ] "A", "B", "C", "D" grades for quick filtering
- [ ] Show why a property scored high/low

#### 4.2 Automated Alerts
- [ ] Email/SMS when good deals appear
- [ ] Configurable thresholds (e.g., "notify if ROI > 15%")
- [ ] Daily digest of new listings
- [ ] Price drop alerts on watchlisted properties

#### 4.3 AI Chatbot Integration
- [ ] Natural language queries: "Show me 3-bed properties under $200k with positive cash flow"
- [ ] Property recommendations: "What's the best deal in 43211?"
- [ ] Explanation of metrics: "Why does this property have negative cash flow?"
- [ ] Market insights: "Is this a good time to buy in Columbus?"

**Outcome:** App proactively finds deals for you

---

### PHASE 5: Multi-Market Expansion (Week 9-10)

**Goal:** Scale beyond Columbus

#### 5.1 Multi-City Support
- [ ] Expand buybox to handle multiple cities/states
- [ ] City-level market comparison
- [ ] Different financial assumptions per market
- [ ] Market scoring (which markets have best opportunities?)

#### 5.2 Portfolio Tracking
- [ ] Track properties you actually own
- [ ] Portfolio-level metrics (total cash flow, total equity)
- [ ] Rebalancing recommendations
- [ ] Performance vs. projections

#### 5.3 Alternative Data Sources
- [ ] Redfin scraper (backup for Zillow)
- [ ] MLS integration (if available)
- [ ] County tax assessor data (actual tax rates)
- [ ] Crime data, school ratings, walkability scores

**Outcome:** National real estate analysis platform

---

## Immediate Next Steps

If starting now, this is the priority order:

### Session 1-2: Automation (CRITICAL)
1. ✅ Enable the scheduler service in backend server
2. ✅ Add scheduler config file
3. ✅ Implement scheduled data fetching (listings + recently sold + analysis)
4. ✅ Add data freshness indicators to UI
5. ✅ Test: Let it run for 3 days, verify automatic updates

### Session 3-4: Complete Metrics
6. ✅ Implement equity buildup calculator
7. ✅ Add amortization schedule
8. ✅ Add tax calculations (depreciation, after-tax cash flow)
9. ✅ Display on property detail page

### Session 5-6: Better UX
10. ✅ Add pagination to analysis table
11. ✅ Implement watchlist functionality
12. ✅ Create property comparison view
13. ✅ Add scenario modeling to detail page

---

## Key Files Reference

**Configuration:**
- `config/buybox.json` - What properties to fetch
- `config/financial.json` - Financial assumptions
- `config/scheduler.json` - *(to be created)* Automation schedule
- `.env` - API keys and environment variables

**Core Services:**
- `backend/src/services/financialAnalysisService.ts` - Main analysis orchestrator
- `backend/src/services/financialCalculator.ts` - Calculation engine
- `backend/src/services/zillowService.ts` - Zillow API integration
- `backend/src/services/scheduler.ts` - Automated scheduling (exists, not enabled)

**Frontend Pages:**
- `frontend/pages/index.tsx` - Dashboard
- `frontend/pages/analysis.tsx` - Analysis results table
- `frontend/pages/property/[zpid].tsx` - Property detail page

**Scripts:**
- `scripts/generateAnalysisData.ts` - Manual analysis generation
- `scripts/fetchRecentlySold.ts` - Fetch recently sold data
- `scripts/convertHudData.ts` - Convert HUD CSV to JSON

---

## Development Workflow

```bash
# Start development
npm run dev

# Fetch new data
npm run generate:analysis
npm run fetch:recently-sold

# Run tests
npm run test:analysis

# Build for production
npm run build
```

---

## Success Metrics

**Phase 1 Success:**
- [ ] App runs automatically every day without manual intervention
- [ ] Data freshness shown on dashboard
- [ ] Can see scheduler status and next run time

**Phase 2 Success:**
- [ ] Complete financial picture with equity, taxes, and total return
- [ ] Multiple rental estimates with confidence scores
- [ ] Market intelligence (days on market, price trends)

**Phase 5 Success:**
- [ ] Analyzing 10+ markets across multiple states
- [ ] AI chatbot answers investment questions accurately
- [ ] Portfolio tracking for owned properties

**Final Vision:**
- User wakes up to daily email: "3 new deals match your criteria"
- Opens app, sees fresh data from last night's run
- Asks chatbot: "Which property has best 10-year return?"
- Makes offer on property within 30 minutes of it hitting market

---

## Recent History (Compressed)

**Last 3 Sessions (Jan 10-11, 2026):**
- ✅ Fixed frontend-backend API integration
- ✅ Added recently sold data with price comparison
- ✅ Created property detail pages
- ✅ Cleaned up code (extracted helpers, removed duplication)
- ✅ Tested: 119 properties analyzed across 2 zip codes

**Current State:**
- Backend: Fully functional API with analysis, storage, and data services
- Frontend: Working UI with table, filters, detail pages, CSV export
- Data: 71 properties in 43211, 48 in 43224 (from Sept 2025 - needs refresh)
- **Main Gap:** No automation - everything is manual triggers

---

## Questions for User

1. **Scheduling Priority:** Should we enable daily automated data fetching first, or focus on completing financial metrics (equity/taxes)?

2. **Data Costs:** Zillow API has rate limits. How frequently do you want to fetch new listings? Daily? Weekly?

3. **Notifications:** Do you want email/SMS alerts for new deals, or just check the dashboard?

4. **Market Expansion:** Still focused on Columbus, or ready to add other cities?

5. **Chatbot:** Is AI integration a priority, or focus on core fundamentals first?

---

**Last Updated:** 2026-01-12
**Status:** Phase 1 (Automation) Ready to Start
**Branch:** `claude/compress-codebase-context-Z3u7l`


MY COMMENTS - 
1. Why do certain imports use absolute paths? e.g. import { ZillowApiResponse, Property, BuyboxConfig } from '/Users/sriram/projects/dealflowanalyzer.ai/shared/dist/types'; in propertyService.ts? Clean everything up to use relative importas so they work when deployed to prod.

2. I want to move away from an API based approach, to scraping zillow. Can you develop a plan to use our user defined buybox config to scrape zillow for matching listings? Eventually, we can scrape an entire city etc. 


