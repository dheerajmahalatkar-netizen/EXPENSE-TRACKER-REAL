/**
 * analytics.js
 * Feature 4: Expense Analytics
 * Renders category-wise expense breakdown, monthly income vs. expenses,
 * spending distribution, highest spending category, total savings, and dynamic charts.
 */

import { getTransactions } from './storage.js';
import {
  calculateTotals,
  getCategoryBreakdown,
  getMonthlyTrend,
  formatCurrency,
  formatMonthLabel,
  escapeHtml,
  openTransactionModal,
} from './transactions.js';

let incomeVsExpenseChart = null;
let savingsTrendChart = null;
let distributionChart = null;

function destroyAnalyticsCharts() {
  if (incomeVsExpenseChart) {
    incomeVsExpenseChart.destroy();
    incomeVsExpenseChart = null;
  }
  if (savingsTrendChart) {
    savingsTrendChart.destroy();
    savingsTrendChart = null;
  }
  if (distributionChart) {
    distributionChart.destroy();
    distributionChart = null;
  }
}

/**
 * Filters transactions to match the chosen analytics period relative to activeMonth.
 * @param {Array<object>} transactions
 * @param {string} period - 'month' | '3m' | '6m' | 'all'
 * @param {string} activeMonth - YYYY-MM
 */
function filterByAnalyticsPeriod(transactions, period, activeMonth) {
  if (period === 'all') return transactions;

  if (period === 'month') {
    return transactions.filter((tx) => tx.date && tx.date.startsWith(activeMonth));
  }

  const count = period === '3m' ? 3 : 6;
  const [y, m] = activeMonth.split('-').map(Number);
  const allowedMonths = new Set();
  for (let i = 0; i < count; i++) {
    const d = new Date(y, m - 1 - i, 1);
    allowedMonths.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  return transactions.filter((tx) => tx.date && allowedMonths.has(tx.date.slice(0, 7)));
}

/**
 * Renders the Analytics view.
 * @param {HTMLElement} container
 * @param {object} appState
 * @param {object} actions
 */
export function renderAnalyticsView(container, appState, actions) {
  destroyAnalyticsCharts();

  const allTransactions = getTransactions();
  const activeMonth = appState.activeMonth;
  const period = appState.analyticsPeriod || '6m';

  const scopedTxs = filterByAnalyticsPeriod(allTransactions, period, activeMonth);
  const totals = calculateTotals(scopedTxs);
  const totalSavings = totals.totalBalance;
  const savingsRate =
    totals.totalIncome > 0
      ? Math.round((totalSavings / totals.totalIncome) * 1000) / 10
      : 0;

  const categoryBreakdown = getCategoryBreakdown(scopedTxs, 'expense');
  const highestCategory = categoryBreakdown.length > 0 ? categoryBreakdown[0] : null;
  const avgExpense =
    totals.expenseCount > 0
      ? Math.round((totals.totalExpenses / totals.expenseCount) * 100) / 100
      : 0;

  const trendMonthsCount = period === '3m' ? 3 : 6;
  const monthlyTrend = getMonthlyTrend(allTransactions, trendMonthsCount, activeMonth);

  const periodLabels = {
    month: formatMonthLabel(activeMonth),
    '3m': 'Last 3 Months',
    '6m': 'Last 6 Months',
    all: 'All Time',
  };

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h2 class="view-heading">Expense Analytics</h2>
        <p class="view-subtitle">Cash flow comparisons, category distribution, and savings performance for ${escapeHtml(periodLabels[period])}.</p>
      </div>
      <div class="segmented-control" role="group" aria-label="Analytics time period">
        <button type="button" class="segment-btn ${period === 'month' ? 'is-active' : ''}" data-analytics-period="month">This Month</button>
        <button type="button" class="segment-btn ${period === '3m' ? 'is-active' : ''}" data-analytics-period="3m">3 Months</button>
        <button type="button" class="segment-btn ${period === '6m' ? 'is-active' : ''}" data-analytics-period="6m">6 Months</button>
        <button type="button" class="segment-btn ${period === 'all' ? 'is-active' : ''}" data-analytics-period="all">All Time</button>
      </div>
    </div>

    <!-- Analytics KPI Row -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label-row">
          <span class="kpi-label">Total Savings</span>
          <i data-lucide="piggy-bank" class="kpi-icon" aria-hidden="true"></i>
        </div>
        <div class="kpi-value ${totalSavings >= 0 ? 'is-positive' : 'is-negative'}">
          ${formatCurrency(totalSavings, { showPlus: totalSavings > 0 })}
        </div>
        <div class="kpi-meta">
          <span>Savings rate</span>
          <span class="tabular-nums">${savingsRate}%</span>
          <span>of income</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label-row">
          <span class="kpi-label">Highest Spending Category</span>
          <i data-lucide="arrow-up-circle" class="kpi-icon" aria-hidden="true"></i>
        </div>
        <div class="kpi-value">
          ${highestCategory ? escapeHtml(highestCategory.category) : 'None'}
        </div>
        <div class="kpi-meta">
          ${
            highestCategory
              ? `<span class="tabular-nums">${formatCurrency(highestCategory.total)}</span><span aria-hidden="true">·</span><span class="tabular-nums">${highestCategory.percentage}% of expenses</span>`
              : '<span>No expenses in period</span>'
          }
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label-row">
          <span class="kpi-label">Period Income</span>
          <i data-lucide="trending-up" class="kpi-icon" aria-hidden="true"></i>
        </div>
        <div class="kpi-value is-positive">${formatCurrency(totals.totalIncome)}</div>
        <div class="kpi-meta">
          <span class="tabular-nums">${totals.incomeCount}</span>
          <span>${totals.incomeCount === 1 ? 'deposit' : 'deposits'}</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label-row">
          <span class="kpi-label">Period Expenses</span>
          <i data-lucide="receipt" class="kpi-icon" aria-hidden="true"></i>
        </div>
        <div class="kpi-value">${formatCurrency(totals.totalExpenses)}</div>
        <div class="kpi-meta">
          <span>Avg</span>
          <span class="tabular-nums">${formatCurrency(avgExpense)}</span>
          <span>per expense</span>
        </div>
      </div>
    </div>

    ${
      allTransactions.length === 0
        ? `
      <div class="card">
        <div class="empty-state">
          <div class="empty-icon-wrap">
            <i data-lucide="bar-chart-3" aria-hidden="true"></i>
          </div>
          <h3 class="empty-title">No data available for analytics</h3>
          <p class="empty-desc">Add income and expense transactions to generate dynamic charts and spending insights.</p>
          <button type="button" id="btn-analytics-empty-add" class="btn btn-primary btn-sm">
            <i data-lucide="plus" class="btn-icon" aria-hidden="true"></i>
            <span>Add Transaction</span>
          </button>
        </div>
      </div>
    `
        : `
      <!-- Top Charts Grid -->
      <div class="analytics-charts-grid">
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Monthly Income vs. Expenses</h3>
              <p class="card-subtitle">Side-by-side comparison across recent months</p>
            </div>
          </div>
          <div class="card-body">
            <div class="chart-container-tall">
              <canvas id="analytics-income-expense-canvas"></canvas>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Monthly Net Savings Trend</h3>
              <p class="card-subtitle">Net cash flow retained per month</p>
            </div>
          </div>
          <div class="card-body">
            <div class="chart-container-tall">
              <canvas id="analytics-savings-canvas"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Category Distribution + Breakdown Table -->
      <div class="analytics-detail-grid">
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Spending Distribution</h3>
              <p class="card-subtitle">Share by category (${escapeHtml(periodLabels[period])})</p>
            </div>
          </div>
          <div class="card-body">
            ${
              categoryBreakdown.length === 0
                ? `<div class="empty-state"><p class="empty-desc">No expenses recorded in this period.</p></div>`
                : `<div class="chart-container-tall"><canvas id="analytics-distribution-canvas"></canvas></div>`
            }
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Category-Wise Expense Breakdown</h3>
              <p class="card-subtitle">Exact spend, share, and entry count per category</p>
            </div>
          </div>
          ${
            categoryBreakdown.length === 0
              ? `<div class="card-body"><p class="empty-desc">No expense categories to display.</p></div>`
              : `
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th class="text-right">Entries</th>
                    <th class="text-right">Share</th>
                    <th class="text-right">Total Spent</th>
                  </tr>
                </thead>
                <tbody>
                  ${categoryBreakdown
                    .map(
                      (item) => `
                    <tr>
                      <td>
                        <div class="legend-left">
                          <span class="legend-swatch" style="background-color: ${item.color}"></span>
                          <span class="legend-name">${escapeHtml(item.category)}</span>
                        </div>
                      </td>
                      <td class="text-right tabular-nums">${item.count}</td>
                      <td class="text-right tabular-nums">${item.percentage}%</td>
                      <td class="text-right tabular-nums" style="font-weight: 600;">${formatCurrency(item.total)}</td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          `
          }
        </div>
      </div>
    `
    }
  `;

  // Bind Period Switcher
  container.querySelectorAll('[data-analytics-period]').forEach((btn) => {
    btn.addEventListener('click', () => {
      actions.setAnalyticsPeriod(btn.dataset.analyticsPeriod);
    });
  });

  const emptyAddBtn = container.querySelector('#btn-analytics-empty-add');
  if (emptyAddBtn) {
    emptyAddBtn.addEventListener('click', () => {
      openTransactionModal(null, { defaultMonth: activeMonth });
    });
  }

  if (allTransactions.length > 0 && typeof window.Chart !== 'undefined') {
    renderIncomeVsExpenseChart(monthlyTrend);
    renderSavingsTrendChart(monthlyTrend);
    if (categoryBreakdown.length > 0) {
      renderDistributionChart(categoryBreakdown);
    }
  }
}

function renderIncomeVsExpenseChart(trend) {
  const canvas = document.getElementById('analytics-income-expense-canvas');
  if (!canvas) return;

  incomeVsExpenseChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: trend.map((t) => t.label),
      datasets: [
        {
          label: 'Income',
          data: trend.map((t) => t.income),
          backgroundColor: '#16A34A',
          borderRadius: 6,
          barPercentage: 0.72,
        },
        {
          label: 'Expenses',
          data: trend.map((t) => t.expenses),
          backgroundColor: '#7C3AED',
          borderRadius: 6,
          barPercentage: 0.72,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            color: '#746F83',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: 600 },
          },
        },
        tooltip: {
          backgroundColor: '#181426',
          titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
          bodyFont: { family: "'JetBrains Mono', monospace", size: 12 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (item) => `${item.dataset.label}: ${formatCurrency(item.raw)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#9E99AE', font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#EEEAF5' },
          ticks: {
            color: '#9E99AE',
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback: (val) => `$${val}`,
          },
        },
      },
    },
  });
}

function renderSavingsTrendChart(trend) {
  const canvas = document.getElementById('analytics-savings-canvas');
  if (!canvas) return;

  savingsTrendChart = new window.Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: trend.map((t) => t.label),
      datasets: [
        {
          label: 'Net Savings',
          data: trend.map((t) => t.net),
          borderColor: '#7C3AED',
          backgroundColor: 'rgba(124, 58, 237, 0.12)',
          borderWidth: 2.5,
          pointRadius: 5,
          pointBackgroundColor: '#EC4899',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#181426',
          titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
          bodyFont: { family: "'JetBrains Mono', monospace", size: 12 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (item) => `Net Savings: ${formatCurrency(item.raw, { showPlus: true })}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#9E99AE', font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 } },
        },
        y: {
          grid: { color: '#EEEAF5' },
          ticks: {
            color: '#9E99AE',
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback: (val) => `$${val}`,
          },
        },
      },
    },
  });
}

function renderDistributionChart(items) {
  const canvas = document.getElementById('analytics-distribution-canvas');
  if (!canvas) return;

  distributionChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: items.map((i) => i.category),
      datasets: [
        {
          label: 'Spent',
          data: items.map((i) => i.total),
          backgroundColor: items.map((i) => i.color),
          borderRadius: 6,
          barThickness: 22,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#181426',
          titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
          bodyFont: { family: "'JetBrains Mono', monospace", size: 12 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (item) => {
              const entry = items[item.dataIndex];
              return `${formatCurrency(entry.total)} (${entry.percentage}%)`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: '#EEEAF5' },
          ticks: {
            color: '#9E99AE',
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback: (val) => `$${val}`,
          },
        },
        y: {
          grid: { display: false },
          ticks: { color: '#181426', font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: 600 } },
        },
      },
    },
  });
}
