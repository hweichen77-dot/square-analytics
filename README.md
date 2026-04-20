# Walley's Analytics

Business intelligence desktop app for small retail businesses. Connect your Square account and get instant insight into sales, inventory, profit, and customers — no spreadsheets needed.

## Features

- **Live Square Sync** — auto-syncs transactions incrementally; no full re-import required
- **Sales Dashboard** — daily/weekly/monthly revenue with period-over-period comparison
- **Inventory Manager** — track stock, restock alerts, and export CSV
- **Profit & Loss** — monthly income statement with OPEX tracking
- **QuickBooks Export** — one-click XLSX export formatted for QuickBooks import
- **Customer LTV** — lifetime value, Pareto (top 20% customers), and loyalty tracking
- **Staff ROI** — per-staff revenue attribution
- **Forecasting** — revenue and velocity projections
- **Basket Analysis** — frequently bought together items
- **Import** — Shopify and Etsy CSV import alongside Square data

## Requirements

- macOS 11.0 (Big Sur) or later
- Square seller account
- Square Developer account (free) to obtain API credentials

## Installation

1. Download the latest `.dmg` from [Releases](../../releases)
2. Open the `.dmg` and drag **Walley's Analytics** to your Applications folder
3. Launch the app — macOS may ask you to confirm opening an app from an unidentified developer (right-click → Open)

## Square Setup

Walley's Analytics uses Square OAuth. You need to create a free Square Developer app first.

### Step 1 — Create a Square Developer App

1. Go to [developer.squareup.com](https://developer.squareup.com) and sign in with your Square account
2. Click **Create Application** → give it any name (e.g. "Walley's")
3. Go to your app → **OAuth** tab

### Step 2 — Add Redirect URIs

Add all of the following redirect URIs (the app tries each port until one is free):

```
http://localhost:7329/square/callback
http://localhost:7330/square/callback
http://localhost:7331/square/callback
http://localhost:7332/square/callback
http://localhost:7333/square/callback
```

Save changes.

### Step 3 — Connect in Walley's Analytics

1. Open Walley's Analytics → go to **Square Sync**
2. Paste your **Application ID** (starts with `sq0idp-`) and **Application Secret**
3. Click **Connect** — a browser window will open for Square authorization
4. Approve access → the app connects and begins syncing your data

## Data & Privacy

All data is stored locally on your Mac using IndexedDB. Nothing is sent to any external server other than Square's own API for fetching your transaction data.

## License

Private — all rights reserved.
