# ClearLedger — Personal Expense Tracker

A minimalist, responsive personal finance and expense tracking web application built strictly with **HTML5**, **CSS3**, and **Vanilla JavaScript** (ES Modules), using **Chart.js** and **Lucide Icons** via CDN and **LocalStorage** for client-side persistence.

## Project Structure

```text
├── index.html          # Semantic HTML5 shell, sidebar, topbar, view panels, and modals
├── css/
│   └── style.css       # Minimalist light-theme stylesheet, responsive grid, tabular figures
├── js/
│   ├── app.js          # Application bootstrap, state, navigation, CSV export, and toasts
│   ├── storage.js      # Centralized LocalStorage repository (transactions & budget)
│   ├── transactions.js # Pure financial math, validation, modal CRUD, and History view
│   ├── dashboard.js    # Feature 1: KPI summary cards, budget snapshot, overview charts
│   ├── analytics.js    # Feature 4: Income vs. expenses, net savings, category distribution
│   └── budget.js       # Feature 5: Monthly budget target, utilization %, 80%/100% alerts
└── assets/
    └── logo.svg        # Brand mark SVG
```

## Running Locally

Because the application uses native ES Modules (`<script type="module">`), serve the directory over HTTP using any static file server:

```bash
# Option 1: Python 3
python3 -m http.server 3000

# Option 2: Node static server
npx serve -l 3000

# Option 3: Vite dev server (configured in this workspace)
npm run dev
```

Then open `http://localhost:3000` in your browser.
