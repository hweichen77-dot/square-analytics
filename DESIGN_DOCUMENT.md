# Walley's Analytics — Design Document
**Windows Port & Cross-Platform Specification**

_Source: Swift/SwiftUI/SwiftData macOS app_
_Target: React + TypeScript + Tauri (macOS + Windows + Web)_
_Last Updated: April 2026_

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Architecture](#2-architecture)
3. [Data Models](#3-data-models)
4. [Analytics Engine](#4-analytics-engine)
5. [Views & Features](#5-views--features)
6. [External Integrations](#6-external-integrations)
7. [Windows-Specific Considerations](#7-windows-specific-considerations)
8. [Tech Stack & Dependencies](#8-tech-stack--dependencies)
9. [File & Folder Structure](#9-file--folder-structure)
10. [Category System](#10-category-system)
11. [Future Ideas & Roadmap](#11-future-ideas--roadmap)

---

## 1. Product Overview

Walley's Analytics is a **retail business intelligence dashboard** built for the Walley's school store. It ingests Square POS data (via live OAuth2 sync or CSV/XLSX import) and produces analytics across sales, staff, inventory, and purchasing.

### Core Value Proposition
- Understand what's selling, when, and by whom
- Identify dead stock, slow movers, and pricing problems
- Generate data-driven purchase orders
- Monitor staff performance and shift coverage
- Track the impact of school events on revenue

### Primary Users
- Store manager (daily operations, purchase decisions)
- Staff / student workers (view-only context)
- School administration (summary revenue)

### Data Sources
1. **Square POS CSV export** — bulk historical data import
2. **Square REST API v2** — live incremental sync via OAuth2
3. **Square Item Library XLSX** — catalogue data import

---

## 2. Architecture

### Platform Strategy

| Target | Runtime | Distribution |
|--------|---------|--------------|
| Web | Browser (SPA) | GitHub Pages |
| macOS | Tauri v2 | .dmg via GitHub Actions |
| **Windows** | **Tauri v2** | **.msi / .exe via GitHub Actions** |
| iOS | Capacitor v6 | App Store |
| Android | Capacitor v6 | Play Store |

### Data Flow

```
Square API ──→ SquareSyncEngine ──→ Dexie.js (IndexedDB) ──→ Analytics Engine ──→ UI Views
CSV/XLSX ──────────────────────────────────────────────↑
```

### Key Design Principles
- **All computation is client-side** — no server, no cloud backend, no external database
- **Offline-first** — all data persisted locally in IndexedDB via Dexie.js
- **Reactive queries** — UI auto-updates when underlying data changes (useLiveQuery)
- **Lazy computation** — analytics computed on-demand with cache invalidation on transaction count

---

## 3. Data Models

### 3.1 SalesTransaction

Core record representing one POS transaction.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (UUID) | Internal key |
| `transactionID` | string | Square unique ID (dedup key) |
| `date` | Date | Transaction date |
| `hour` | number | 0–23 |
| `dayOfWeek` | number | 1=Sun … 7=Sat (matches Swift Calendar) |
| `grossSales` | number | Pre-discount total |
| `discounts` | number | Amount discounted |
| `netSales` | number | grossSales − discounts |
| `tax` | number | Tax collected |
| `totalCollected` | number | Final amount paid |
| `itemDescription` | string | e.g. `"2 x Takis, 1 x Coke"` |
| `transactionStatus` | string | "Complete", "Pending", etc. |
| `squareCategory` | string | Category from Square POS |
| `location` | string | Store location name |
| `staffName` | string | Employee who processed |
| `assignedCategory` | string | Auto-classified (see §10) |
| `paymentMethod` | string | Card, Cash, etc. |
| `customerID` | string | Square customer ID |
| `customerName` | string | Customer display name |

**Computed helpers (TypeScript):**
- `parseProductItems(itemDescription)` → `{name: string, qty: number}[]`
- `splitProducts(itemDescription)` → `string[]` (unique product names)

**Dexie indexes:** `transactionID` (unique), `date`, `assignedCategory`, `staffName`

---

### 3.2 CategoryOverride

Manual category mappings that take precedence over the auto-classifier.

| Field | Type |
|-------|------|
| `productName` | string (unique key) |
| `category` | string |

---

### 3.3 RestockLog

Manual log entries when stock is received.

| Field | Type |
|-------|------|
| `id` | UUID |
| `productName` | string |
| `date` | Date |
| `quantity` | number |
| `notes` | string |

---

### 3.4 ProductCostData

Cost records for profit margin calculations.

| Field | Type | Notes |
|-------|------|-------|
| `productName` | string (unique key) | |
| `unitCost` | number | Per-unit cost (direct entry) |
| `casePrice` | number | Total case price |
| `unitsPerCase` | number | Units per case |
| `lastUpdated` | Date | |

**Computed:** `effectiveUnitCost` = casePrice / unitsPerCase if casePrice > 0, else unitCost

---

### 3.5 StoreEvent

School events used for seasonal/impact analysis.

| Field | Type | Options |
|-------|------|---------|
| `id` | UUID | |
| `name` | string | User-defined |
| `startDate` | Date | |
| `endDate` | Date | |
| `eventType` | string | Spirit Week, Homecoming, Finals, Back to School, Holiday, Sports Game, Custom |
| `notes` | string | |

**Event colors (CSS):** Spirit Week=purple, Homecoming=orange, Finals=red, Back to School=blue, Holiday=green, Sports Game=teal, Custom=gray

---

### 3.6 ProductBundle

User-defined product groupings for cross-sell analysis.

| Field | Type |
|-------|------|
| `id` | UUID |
| `name` | string |
| `productNames` | string[] |
| `bundlePrice` | number |
| `createdDate` | Date |
| `notes` | string |

---

### 3.7 CatalogueProduct

Imported from Square Item Library XLSX or Square API.

| Field | Type |
|-------|------|
| `name` | string |
| `sku` | string |
| `price` | number \| null |
| `category` | string |
| `taxable` | boolean |
| `enabled` | boolean |
| `quantity` | number \| null |
| `importedAt` | Date |
| `squareItemID` | string |

---

## 4. Analytics Engine

All functions are pure TypeScript, no side effects. Inputs: transaction array + support data.

### 4.1 ProductStats

Computed per-product aggregate. Inputs: `SalesTransaction[]`, `CategoryOverride[]`.

| Output Field | Description |
|-------------|-------------|
| `name` | Product name |
| `category` | Resolved category (override → auto → "Other") |
| `totalUnitsSold` | Sum of quantities |
| `totalRevenue` | Sum of net sales allocated to this product |
| `avgPrice` | totalRevenue / totalUnitsSold |
| `firstSoldDate` | Earliest transaction date |
| `lastSoldDate` | Most recent transaction date |
| `monthlySales` | Map of `yyyy-MM` → unit count |
| `dailySales` | Map of `Date` → unit count |
| `velocity` | Units per active day (days between first/last sale) |
| `isSlowMover` | No sales in last 30 active days |
| `trend` | Growing / Stable / Declining (last 2 months comparison) |

**Trend logic:** Compare last month vs prior month. >20% increase = Growing, <20% decrease = Declining, else Stable.

---

### 4.2 Revenue Aggregations

- `computeDailyRevenue(txns)` → `{date, revenue, transactionCount}[]`
- `computeWeeklyRevenue(txns)` → `{weekStart, revenue, transactionCount}[]`
- `computeMonthlyRevenue(txns)` → `{month (yyyy-MM), revenue, transactionCount}[]`

---

### 4.3 Category Revenue

`computeCategoryRevenue(txns, overrides)` → `{category, revenue, percentage}[]`

Distributes each transaction's net sales evenly across all products in that transaction, then sums by resolved category.

---

### 4.4 Heatmap

`computeHeatmap(txns)` → `{dayOfWeek, hour, count}[]` (168 cells: 7 × 24)

Transaction count per day-of-week / hour combination.

---

### 4.5 Staff Stats

`computeStaffStats(txns)` → `{name, totalSales, transactionCount}[]`

---

### 4.6 Monthly Comparison

`computeMonthlyComparison(txns)` → `{month, revenue, transactions, avgTransaction}[]`

---

### 4.7 Product-Level Analytics

For the Product Detail view:

- `computeProductTimeSeries(txns, productName, granularity)` → `{date, revenue, units}[]`
  - Granularity: "daily" | "weekly" | "monthly"
- `computeProductTransactions(txns, productName)` → `{date, time, qty, unitPrice, total, staff, paymentMethod}[]`
- `computeProductDayOfWeek(txns, productName)` → `{dayOfWeek, units}[]`

---

### 4.8 Purchase Order Engine

`generatePurchaseOrder(txns, products, costs, events, weeksAhead)` → `PurchaseOrderItem[]`

**Algorithm:**
1. Group transactions by base product name (strip variation suffixes)
2. Filter utility items (gift cards, "free", "open price")
3. Compute weekly velocity: `totalUnits / (daySpan / 7)`
4. Filter: velocity < 0.5 units/week excluded
5. Base qty: `Math.ceil(velocity × weeksAhead)`
6. **Seasonal adjustment:**
   - Compute each month's average units sold
   - If upcoming month avg > 10% above overall avg: ×1.20
   - If upcoming month avg < 10% below overall avg: ×0.90
7. **Event adjustment:** If events in next 14 days: ×1.15
8. **Stock check:** Skip if currentStock ≥ recommendedQty
9. Minimum order: filter < 2 units
10. Cost lookup: ProductCostData → CatalogueProduct price → null

**Seasonal labels by month:**

| Months | Label |
|--------|-------|
| Aug, Sep | Back to School |
| Oct, Nov | Fall / Homecoming |
| Dec, Jan | Winter Break / Finals |
| Feb, Mar | Spring / Valentine's |
| Apr, May | Spring Break / End of Year |
| Jun, Jul | Summer |

---

### 4.9 Price Change Detection

Scans product history for significant price changes (>5% delta).

Per detected change:
- `before30Units` / `after30Units`: Units sold in 30 days before/after change
- `before30Revenue` / `after30Revenue`: Revenue in same windows
- `priceChangePct`: % price change
- `unitChangePct`: % change in unit sales
- `revenueChangePct`: % change in revenue
- `elasticity`: unitChangePct / priceChangePct (price elasticity of demand)
  - < -1: Price-sensitive (elastic)
  - > -1: Price-insensitive (inelastic)
- `revenueImproved`: boolean

---

### 4.10 Dead Stock Classification

Three tiers:

| Tier | Condition | Color |
|------|-----------|-------|
| DEAD | No sales in 30+ active days | Red |
| DYING | Sales dropped 50%+ vs prior 30 days | Orange |
| SLOW | Bottom 20% by velocity | Yellow |

`capitalTiedUp` = currentStock × effectiveUnitCost (if cost data available)

---

### 4.11 Product Affinity / Bundle Scoring

For Bundle & Cross-Sell view:

- Parse all multi-item transactions
- For each product pair (A, B): count co-occurrences
- `affinityScore` = coOccurrences / min(totalTransactions(A), totalTransactions(B)) × 100
- Sort pairs by score descending
- Group by category pairing label (e.g., "Drinks × Food")

---

## 5. Views & Features

### Navigation Structure (17 primary routes)

```
/                     → Dashboard
/inventory            → Transaction Intelligence
/time-analysis        → Time Analysis
/staff                → Staff Performance
/restock              → Restock Alerts
/profit               → Profit Margins
/seasonal             → Seasonal & Events
/dead-stock           → Dead Stock Detector
/bundles              → Bundle & Cross-Sell
/price-optimization   → Price Optimization
/staff-shifts         → Staff Shift Analysis
/customers            → Customer Frequency
/catalogue-checker    → Catalogue Checker
/catalogue-products   → Catalogue Products
/purchase-order       → Purchase Order
/square-sync          → Square Sync
/import               → Import Data
/products/:name       → Product Detail (nested)
```

---

### 5.1 Dashboard

**KPI Cards:**
- Total Revenue (currency formatted)
- Total Transactions
- Average Transaction Value
- Top Product (by revenue)

**Charts:**
- **Revenue Over Time** — area + line chart with daily/weekly/monthly toggle
- **Revenue by Category** — donut chart (inner radius 60%) + legend + table
- **Top 10 Products** — horizontal bar chart, togglable by Revenue or Quantity

**Performance:** Async computation, caches on transaction count, shows skeleton loading state.

---

### 5.2 Transaction Intelligence (Inventory View)

Full product-level breakdown.

**Filters:**
- Text search (product name)
- Category dropdown
- Sort: Revenue ↓↑, Quantity ↓↑, Name A–Z, Velocity ↓

**Table columns:**
- Status icons (slow-mover ⚠, trend arrow ↑↓→)
- Product Name (clickable → Product Detail)
- Category
- Units Sold
- Revenue
- Avg Price
- Velocity (units/day)
- First Sold
- Last Sold (red if slow-mover)

**Context menu (right-click):** Set Category submenu → reassigns via CategoryOverride

---

### 5.3 Product Detail

Accessed by clicking any product name throughout the app.

**Header:**
- Product name + category badge
- KPIs: Units Sold, Total Revenue, Avg Price, Best Month, MoM % change

**Revenue & Units Over Time:**
- Granularity picker (Daily / Weekly / Monthly)
- Revenue chart: area + line + 3-period moving average (dashed)
- Units chart: bars
- Both show abbreviated values ($1.2k format)

**Sales Patterns:**
- Day-of-week bar chart (peak day highlighted)
- Best Day text, Peak Hour text, Trend badge

**Transaction History table:**
- Date, Time, Qty, Unit Price, Total, Staff, Payment Method
- Sortable by any column
- Shows first 100; "Show all" button if more exist

---

### 5.4 Time Analysis

**Date Range Filter:** From/To pickers + Reset button

**Heatmap:**
- 7 rows (Mon–Sun) × columns (hours, 6am–8pm shown)
- Cell color intensity: gray (0) → accent color (max)
- Count number inside each cell
- Hover tooltip
- Less → More legend

**Monthly Comparison:**
- Bar chart: month → revenue
- Table: Month, Revenue, Transactions, Avg Transaction Value

---

### 5.5 Staff Performance

- **Revenue by Staff** — horizontal bar chart, colored, annotated
- **Staff Table:** Staff Member, Transactions, Total Sales, Avg Sale, Share %

---

### 5.6 Staff Shift Analysis

**Header Stats:** Top Earner, Total Staff, Avg Revenue/Staff, Coverage %

**Metric Toggle:** Total Revenue | Transaction Count | Avg Transaction Value

**Leaderboard:** Bar chart (selected staff highlighted)

**Staff Table:** Staff Member, Transactions, Total Revenue, Avg Transaction, Days Worked, Top Product

**Per-Staff Detail (on selection):**
- Hourly revenue breakdown chart
- Daily revenue breakdown chart
- Peak hours visualization

---

### 5.7 Restock Alerts

**Summary Cards:** Total Products, Out of Stock, Critical (≤5 days), Low (6–10 days)

**Urgency Tiers:**

| Tier | Days Left | Color |
|------|-----------|-------|
| OUT_OF_STOCK | 0 | Red |
| CRITICAL | ≤ 5 | Red |
| LOW | 6–10 | Orange |
| SAFE | > 10 | Green |
| NO_DATA | — | Gray |

**Suggested Restock List:** Cards for urgent items with "Log Restock" button

**Full Products Table:** Product, Category, Weekly Velocity, Est. Stock, Days Left, Projected Stockout, Last Restocked, Action

**Log Restock Modal:**
- Product name
- Restock Date picker
- Quantity input
- Notes (optional)

---

### 5.8 Profit Margins

**Summary Cards:** Total Revenue, Total Cost, Total Gross Profit, Overall Margin %

**Color thresholds:** Margin < 20% = red, < 40% = yellow, ≥ 40% = green

**Money Losers Alert:** Red banner listing products at ≤ 0% margin

**Product Profit Table:** Product, Category, Unit Cost, Avg Price, Margin %, Units Sold, Revenue, Total Cost, Total Profit

**Visualizations:**
- Top 15 by Profit — horizontal bar chart
- Popularity vs Profitability — scatter plot (X=units, Y=margin %, zoomable/pannable)
- Profit by Category — donut chart

**Cost Management Sheet:**
- Search filter
- Per-product toggle: Unit Cost mode vs Case Price mode
- Unit cost input / Case price + units per case inputs
- Real-time effective cost calculation display
- Save All button

---

### 5.9 Seasonal & Events

**Event Management:**
- Event list: name, type badge, date range
- Edit / Delete per event
- Add Event button

**Event Types & Colors:**

| Type | Color |
|------|-------|
| Spirit Week | Purple |
| Homecoming | Orange |
| Finals | Red |
| Back to School | Blue |
| Holiday | Green |
| Sports Game | Teal |
| Custom | Gray |

**Event Add/Edit Modal:**
- Name, Type picker, Start Date, End Date, Notes

**Event Impact Analysis (per event):**
- Total revenue during event
- Avg daily revenue during event
- Avg daily revenue 14 days before (baseline)
- Uplift % = (during − baseline) / baseline × 100
- Top 3 products during event

**Revenue Timeline:** Line chart with event period overlays

**Seasonal Top Products:** Top products grouped by month/season

---

### 5.10 Dead Stock Detector

**Summary:** Dead count, Dying count, Slow Mover count, Total Capital Tied Up

**Tier Sections (each collapsible):**
- Dead (red, ✗ icon)
- Dying (orange, ↓ icon)
- Slow (yellow, turtle icon)

**Per-item columns:** Product, Category, Last Sale, Days Idle, Last 30d Units, Prior 30d Units, Trend %, Capital Tied Up

**Top 20 Sales Chart:** Bars colored by tier

**Recommendations Section:** Top 10 items with action text (e.g., "Consider discounting", "Bundle with popular items")

---

### 5.11 Bundle & Cross-Sell

**Summary:** Multi-item transactions, product pairs found, saved bundles

**Product Affinity Lookup:** Product picker → shows top 5 co-purchase partners with affinity score and progress bar

**Top Co-Purchase Pairs Table:**
- Grouped by category combination (e.g., "Drinks × Food")
- Product A, Product B, Bought Together count, Score %, Bundle Price suggestion

**Score colors:** > 20% = green, > 10% = orange, else default

**Saved Bundles:**
- Card layout: name, products, price, created date
- Edit / Delete
- Create Bundle modal: name, product selection checkboxes, price, notes

---

### 5.12 Price Optimization

**Summary:** Changes detected, Revenue Improved count (green), Revenue Declined count (red)

**Insight Banner:** "X of Y price changes resulted in higher revenue"

**Price Changes Table:**
- Product, Date, Old Price, New Price, Price Δ%, Unit Δ% (30d), Revenue Δ, Elasticity
- Color: Price↑ = red, Price↓ = green; Unit↑ = green, Unit↓ = red; Revenue improved = green

**Per-Product Price History (on select):**
- Line chart: before avg vs after avg revenue for each change point

**Price Simulation:**
- Input: Simulated new price
- Output: Estimated units, estimated revenue vs current

---

### 5.13 Customer Frequency

**Summary:** Identified Customers, Repeat Customers (+ %), Avg Lifetime Value, Avg Transactions/Customer

**Segments:**

| Segment | Threshold | Color |
|---------|-----------|-------|
| Regular | 10+ transactions | Green |
| Frequent | 5–9 | Blue |
| Occasional | 2–4 | Orange |
| One-Timer | 1 | Gray |

**Segment filter buttons** (click to filter table)

**Customer Table:**
- Search by name or ID
- Sort: Total Spent, Transactions, Last Visit, First Visit
- Columns: Customer, Transactions, Total Spent, Avg Transaction, Last Visit (X days ago), Segment

**Customer Detail (on select):**
- Lifetime value chart
- Monthly spending trend
- Top products purchased list

---

### 5.14 Catalogue Checker

**XLSX Import** button (Square Item Library format)

**Issue Types Detected:**

| Issue | Description |
|-------|-------------|
| Incorrect Tax | Expected taxable but marked non-taxable (or vice versa) |
| Wrong Category | Category mismatch vs auto-classifier |
| Missing Price | No price set |
| Zero Price | Price = $0.00 |
| Duplicate Name | Same name appears twice |
| Capitalization | ALL-CAPS or all-lowercase name |
| No Category | Category field empty |
| Unusual Price | Statistical outlier (> 2 SD from category mean) |

**Summary:** Open issues, Fixed, Auto-fixable count

**Filter by issue type** dropdown

**Issue List:**
- Icon, product name, detail text, suggested fix value
- Mark as fixed checkbox

**Export Options:**
- Cleaned Catalogue CSV (with fixes applied)
- Error Report .txt

---

### 5.15 Catalogue Products

**Header Stats:** Total Items, Active, Categories, With Price

**Filters:** Search (name, SKU, category), Category dropdown

**Table:** Name (with active/archived icon), SKU, Category, Price, Taxable, Qty, Status badge

---

### 5.16 Purchase Order

**Summary Banner:** Items to Order (count + units), Estimated Cost, Generated For (date range)

**Season Context Card:** Current season label, upcoming events badge

**Filters:** Toggle "only items needing reorder"

**Table:** Product, Category, Variations, Weekly Velocity, Recommended Qty (editable), Unit Cost, Est. Total Cost, Current Stock, Season Note, Trend

**Category Subtotals section:** Category, Item Count, Total Qty, Total Cost

**Export to XLSX:** Two-sheet workbook (full order + by-category summary)

---

### 5.17 Square Sync

**Connection Status:** Connected (green badge) / Not Connected (gray)

**Setup Panel (not connected):**
- Redirect URI info box + copy button
- Application ID field
- Application Secret field (show/hide toggle)
- Connect button (launches OAuth2 flow)

**Sync Panel (connected):**
- Merchant ID display
- Location picker (multi-location support)
- History Window stepper (days: 7–730)
- Last Sync date (relative, e.g., "2 hours ago")
- Transaction count
- Sync button
- Disconnect button

**Sync Progress States:** Ready → Syncing (with message) → Done (X new transactions) / Error

---

### 5.18 Import Data

**Transaction Import (CSV):**
- Drag-and-drop zone + Browse button
- Progress bar during import
- Error display with row details
- Success toast

**Catalogue Import (XLSX):**
- Import button
- Shows: item count, last imported date
- Help text explaining column format

**Supported CSV columns (flexible, case-insensitive):**

| Required | Optional |
|----------|---------|
| Date, Time, Gross Sales, Net Sales, Description, Transaction Status | Category, Location, Staff Name, Payment Method, Customer ID, Customer Name |

---

## 6. External Integrations

### 6.1 Square OAuth2 (Web / Tauri)

**Flow:**
- Web: Standard redirect to `https://connect.squareup.com/oauth2/authorize`
- Tauri (Windows/macOS): Open system browser via `@tauri-apps/plugin-opener`, deep-link callback via `walleys://square/callback`
- Capacitor (iOS/Android): In-app browser sheet, deep-link via `@capacitor/app`

**Required Scopes:**
`ORDERS_READ`, `PAYMENTS_READ`, `ITEMS_READ`, `INVENTORY_READ`, `MERCHANT_PROFILE_READ`

**Token storage:**
- Web: `localStorage`
- Tauri: `localStorage` (or Tauri secure storage plugin)
- Capacitor: `@capacitor/preferences` (SecureStorage)

**Redirect URIs to register in Square Developer Dashboard:**
- Web: `https://jasonhuang.github.io/walleys-analytics/square/callback` (or similar)
- Tauri: `walleys://square/callback`
- Capacitor: `walleys://square/callback`

---

### 6.2 Square REST API v2

Base URL: `https://connect.squareup.com/v2`
API Version Header: `2023-10-18`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/locations` | GET | Fetch store locations |
| `/orders/search` | POST | Fetch orders (paginated, 500/page) |
| `/catalog/list` | GET | Fetch all catalogue items (cursor-paginated) |
| `/inventory/counts/batch-retrieve` | POST | Fetch inventory (100 IDs/batch) |

**Order filters:** location_ids, date_time_filter (updated_at range), state_filter = COMPLETED

---

### 6.3 CSV Import

Parser: PapaParse (browser-native, no Node.js needed)

**Column detection:** Case-insensitive fuzzy matching, trims whitespace, removes BOM

**Date/Time formats supported:**
- Dates: `MM/dd/yyyy`, `yyyy-MM-dd`
- Times: `h:mm a`, `HH:mm`, `h:mm:ss a`, `HH:mm:ss`

**itemDescription encoding (preserved from Swift):**
`"2 x Takis, 1 x Coke"` — same format, no migration needed

**Deduplication:** On `transactionID` (upsert, not duplicate-insert)

---

### 6.4 XLSX Import (Catalogue)

Library: SheetJS (`xlsx` npm package)

**Column detection (flexible, same logic as Swift XLSXCatalogueParser):**

| Column | Keywords |
|--------|---------|
| Item Name | "item name", "name", "product" |
| SKU | "sku", "barcode", "token" |
| Price | "price", "selling price" |
| Category | "categories", "category" |
| Taxable | "tax" |
| Enabled | "enabled", "active", "sellable" (or inverse "archived") |
| Quantity | "current quantity", "quantity", "stock", "on hand" |
| Unit Cost | "default unit cost", "unit cost", "cost" |

---

### 6.5 XLSX Export (Purchase Order)

Library: SheetJS (`xlsx` npm package, write mode)

**Output:** `.xlsx` with two sheets:
1. **Purchase Order** — Product, Category, Variations, Weekly Velocity, Recommended Qty, Unit Cost, Est. Total Cost, Current Stock, Season Note, Trend
2. **By Category** — Category, Item Count, Total Qty, Total Cost

Triggered by "Export to XLSX" button in Purchase Order view.

---

## 7. Windows-Specific Considerations

### 7.1 Tauri v2 on Windows

The app uses **Tauri v2** as the native wrapper. Tauri ships a `.msi` / `.exe` installer on Windows.

**Key Tauri configuration (`src-tauri/tauri.conf.json`):**
```json
{
  "identifier": "com.walleys.analytics",
  "windows": [{ "title": "Walley's Analytics", "width": 1280, "height": 800 }],
  "bundle": {
    "targets": ["msi", "nsis"],
    "windows": { "wix": {}, "nsis": {} }
  }
}
```

**Deep link registration (Windows):**
- Register `walleys://` scheme in `tauri.conf.json` under `plugins.deep-link.schemes`
- Tauri handles the Windows registry entry automatically at install time
- Callback: `onOpenUrl` from `@tauri-apps/plugin-deep-link`

---

### 7.2 OAuth2 Redirect Flow on Windows

**Problem:** Square OAuth requires a registered redirect URI. On Windows desktop, `localhost` redirect (used in the original macOS Swift app via TCP listener on port 7329) is the safest approach. However, Tauri enables custom URL schemes.

**Recommended approach:**
1. User clicks "Connect to Square"
2. `startOAuthFlow()` opens the Square authorize URL in the **system browser** (Edge/Chrome) via `@tauri-apps/plugin-opener`
3. Square redirects to `walleys://square/callback?code=...`
4. Windows routes `walleys://` to the Tauri app via the registered URL scheme
5. Tauri fires `onOpenUrl`, app extracts `code`, exchanges for token

**Fallback:** If deep link doesn't fire, show a "Paste your redirect URL here" input as escape hatch.

---

### 7.3 File System Access (Windows)

Tauri provides `@tauri-apps/plugin-fs` and `dialog` plugin for native file pickers. On Windows:
- Use `open()` from `@tauri-apps/plugin-dialog` for file selection (replaces `NSOpenPanel`)
- Use `save()` for export file save dialogs
- Paths use Windows-style separators (`\`) but Tauri normalizes internally

**Permissions required in `tauri.conf.json`:**
```json
"plugins": {
  "fs": { "scope": ["$DOCUMENT/**", "$DOWNLOAD/**"] },
  "dialog": {}
}
```

---

### 7.4 Window Behavior

- **Minimum window size:** 1100×700 (sidebar + content need space)
- **Resizable:** Yes, with minimum constraint
- **No traffic light buttons** (Windows uses standard close/min/max chrome)
- **Title bar:** Use Tauri's default Windows title bar (not custom)
- **Menu bar:** Optional — consider adding File, Edit, View menus for Windows UX norms

---

### 7.5 XLSX Export on Windows

SheetJS `writeFile()` with `{ bookType: 'xlsx' }` works on Windows. For Tauri:
```typescript
// Generate XLSX ArrayBuffer with SheetJS
const buf = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
// Write via Tauri fs plugin
await writeFile('purchase-order.xlsx', new Uint8Array(buf), { baseDir: BaseDirectory.Download });
```

---

### 7.6 Keychain → localStorage

The Swift app used macOS Keychain for Square tokens. On Windows (Tauri), use:
- `localStorage` for basic persistence (cleared on app uninstall)
- `@tauri-apps/plugin-store` for encrypted key-value store (preferred for tokens)
- Never store raw tokens in plain localStorage in production builds

---

### 7.7 Build & Distribution

**GitHub Actions matrix** (`.github/workflows/tauri-build.yml`):

```yaml
matrix:
  include:
    - platform: macos-latest     # ARM (M-series)
      args: --target aarch64-apple-darwin
    - platform: macos-13         # Intel
      args: --target x86_64-apple-darwin
    - platform: windows-latest   # Windows x64
      args: ''
```

**Output artifacts:**
- macOS: `.dmg`
- Windows: `.msi` (WiX) and `.exe` (NSIS)

**Trigger:** On version tag push (`v*.*.*`)

---

### 7.8 Windows UX Adaptations

| macOS Pattern | Windows Equivalent |
|--------------|-------------------|
| Right-click context menu | Right-click context menu (same, works in Tauri) |
| Sheet modals | Dialog modals (same styling is fine) |
| NavigationSplitView (sidebar) | Left sidebar with collapse button |
| macOS accent color | System accent color via CSS `accent-color` |
| SF Symbols | Lucide React icons (already used in React port) |
| Cmd+K | Ctrl+K (keyboard shortcut mapping) |
| Cmd+S | Ctrl+S |

---

## 8. Tech Stack & Dependencies

### Core Framework

| Package | Version | Purpose |
|---------|---------|---------|
| React | 18 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 5 | Build tool |
| Tauri | v2 | Native wrapper (Windows + macOS) |
| Capacitor | v6 | Mobile wrapper (iOS + Android) |

### Data & State

| Package | Purpose |
|---------|---------|
| Dexie.js | IndexedDB ORM (replaces SwiftData) |
| Zustand | Global state (auth, date filters, settings) |
| React Router DOM | Client-side routing |

### UI

| Package | Purpose |
|---------|---------|
| Tailwind CSS | Utility-first styling |
| Recharts | Charts (replaces SwiftUI Charts) |
| react-toastify | Toast notifications |
| Lucide React | Icons (replaces SF Symbols) |

### Data Processing

| Package | Purpose |
|---------|---------|
| PapaParse | CSV parsing |
| SheetJS (xlsx) | XLSX read + write |
| date-fns | Date utilities |

### Square Integration

| Package | Purpose |
|---------|---------|
| @tauri-apps/plugin-opener | Open system browser for OAuth |
| @tauri-apps/plugin-deep-link | Handle walleys:// callback |
| @tauri-apps/plugin-dialog | Native file picker dialogs |
| @tauri-apps/plugin-fs | File system access |
| @capacitor/browser | In-app browser (mobile) |
| @capacitor/app | Deep link listener (mobile) |

---

## 9. File & Folder Structure

```
walleys-analytics/
├── src/
│   ├── App.tsx                     # Router + layout + deep link handler
│   ├── main.tsx                    # Entry point, DB init before render
│   ├── types/
│   │   └── models.ts               # All TypeScript interfaces
│   ├── db/
│   │   ├── database.ts             # Dexie schema + table definitions
│   │   ├── useTransactions.ts      # useLiveQuery hooks
│   │   └── dbUtils.ts              # upsert, clear, count helpers
│   ├── engine/
│   │   ├── analyticsEngine.ts      # All 11 computation functions
│   │   ├── categoryClassifier.ts   # Keyword-based classifier
│   │   ├── purchaseOrderEngine.ts  # PO generation algorithm
│   │   └── squareAuth.ts           # Platform-aware OAuth helpers
│   ├── store/
│   │   ├── authStore.ts            # Square token state (Zustand)
│   │   └── filterStore.ts          # Date range + category filters
│   ├── components/
│   │   ├── layout/
│   │   │   └── Sidebar.tsx         # Navigation sidebar
│   │   ├── shared/
│   │   │   ├── DateRangeFilter.tsx
│   │   │   ├── KPICard.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   └── charts/
│   │       ├── RevenueChart.tsx
│   │       ├── CategoryDonut.tsx
│   │       └── HeatmapGrid.tsx
│   ├── views/
│   │   ├── DashboardView.tsx
│   │   ├── InventoryView.tsx
│   │   ├── ProductDetailView.tsx
│   │   ├── TimeAnalysisView.tsx
│   │   ├── StaffView.tsx
│   │   ├── StaffShiftView.tsx
│   │   ├── RestockView.tsx
│   │   ├── ProfitView.tsx
│   │   ├── SeasonalView.tsx
│   │   ├── DeadStockView.tsx
│   │   ├── BundleView.tsx
│   │   ├── PriceOptimizationView.tsx
│   │   ├── CustomerView.tsx
│   │   ├── CatalogueCheckerView.tsx
│   │   ├── CatalogueProductsView.tsx
│   │   ├── PurchaseOrderView.tsx
│   │   ├── SquareSettingsView.tsx
│   │   └── ImportView.tsx
│   └── utils/
│       ├── csvParser.ts            # CSV parsing with PapaParse
│       ├── xlsxParser.ts           # XLSX catalogue parsing with SheetJS
│       ├── xlsxExporter.ts         # Purchase order XLSX export
│       └── formatters.ts           # Currency, date, number formatters
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   └── lib.rs
│   ├── tauri.conf.json             # Window config, bundle config, deep link
│   └── Cargo.toml                  # Rust deps (tauri, plugins)
├── capacitor.config.ts             # iOS/Android config
├── .github/workflows/
│   ├── deploy.yml                  # GitHub Pages deploy
│   └── tauri-build.yml             # macOS + Windows builds
├── vite.config.ts                  # base path switching (Tauri vs web)
├── package.json
└── DESIGN_DOCUMENT.md              # ← this file
```

---

## 10. Category System

### Built-in Categories

| Category | Keywords (sample) |
|----------|------------------|
| Drinks | soda, water, juice, tea, coffee, energy drink, gatorade, lemonade, kombucha, sparkling |
| Ice Cream | ice cream, gelato, popsicle, sorbet, frozen yogurt, fudge bar |
| Ramen / Hot Food | ramen, noodles, instant noodles, hot pot, udon, pho, cup noodles |
| Merch | hoodie, t-shirt, cap, hat, tote bag, sticker, lanyard, water bottle, phone case |
| Food | chips, candy, chocolate, cookie, granola bar, jerky, popcorn, crackers, gummy, fruit snack |
| Other | (default fallback) |

### Override System

- Users can right-click any product → "Set Category" to create a CategoryOverride
- Overrides take precedence over all auto-classification
- Stored in the `categoryOverrides` Dexie table
- Synced into analytics functions as a lookup map

---

## 11. Future Ideas & Roadmap

### Near-Term Enhancements

- **Dark mode** — Tailwind `dark:` variants, persisted in localStorage
- **Multi-location support** — Currently single-location; extend filter system to scope by location
- **Keyboard shortcuts** — Cmd/Ctrl+K for quick product search, Ctrl+S to save, etc.
- **Print / PDF export** — Print-optimized CSS for Dashboard summary
- **CSV export** — Export any table to CSV (right-click → Export)
- **Undo for data operations** — Undo last import or category override

### Analytics Enhancements

- **Forecasting** — Simple linear regression for next 30/60/90 day revenue projection
- **Inventory vs Sales correlation** — Flag products where stock quantity doesn't match expected velocity
- **Margin trend** — Track whether overall store margins are improving over time
- **Staff commissions** — If staff are paid commission, calculate earnings
- **Transaction anomaly detection** — Flag unusually large or small transactions
- **Hourly staffing recommendations** — Based on peak heatmap, suggest optimal staffing schedule

### Windows-Specific Features

- **Windows notifications** — Tauri `@tauri-apps/plugin-notification` for low-stock alerts
- **System tray** — Background sync indicator in Windows system tray
- **Auto-launch on startup** — Optional auto-start via Windows registry
- **Windows context menu** — Right-click on .csv files in Explorer to open with Walley's Analytics

### Integration Ideas

- **Email reports** — Weekly summary email (requires backend or email API)
- **Google Sheets sync** — Export analytics to Google Sheets via API
- **Slack alerts** — Push low-stock or anomaly alerts to Slack webhook
- **Quickbooks / accounting export** — Monthly revenue export in standard format
- **Barcode scanning** — Use camera (mobile) or USB scanner for manual inventory counts

### UI / UX Improvements

- **Comparison mode** — Compare any two date ranges side by side
- **Saved filters** — Save a date range + category combination as a named preset
- **Product tagging** — Beyond categories, allow freeform tags per product
- **Notes per transaction** — Annotate specific transactions for context
- **Revenue goals** — Set monthly revenue targets, track progress vs goal
- **Color themes** — Swap accent color (school colors, etc.)

---

_Document generated from Swift source at `/Users/jasonhuang/WalleysAnalytics/WalleysAnalytics/`_
_React port source at `/Users/jasonhuang/walleys-analytics/`_
