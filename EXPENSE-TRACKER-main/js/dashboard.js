/**
 * dashboard.js
 * Feature 1: Dashboard Overview
 * Renders dynamic financial summary cards, monthly budget snapshot,
 * monthly spending overview chart, expense category breakdown, and recent transactions.
 */

import { getTransactions, getBudget, getTransactionById } from './storage.js';
import {
  calculateTotals,
  calculateMonthlySummary,
  getCategoryBreakdown,
  getDailySpendingSeries,
  getMonthlyTrend,
  filterAndSortTransactions,
  formatCurrency,
  formatDate,
  formatMonthLabel,
  escapeHtml,
  openTransactionModal,
} from './transactions.js';

let overviewChartInstance = null;
let breakdownChartInstance = null;

/**
 * Destroys active Chart.js instances before re-rendering.
 */
function destroyDashboardCharts() {
  if (overviewChartInstance) {
    overviewChartInstance.destroy();
    overviewChartInstance = null;
  }
  if (breakdownChartInstance) {
    breakdownChartInstance.destroy();
    breakdownChartInstance = null;
  }
}

/**
 * Renders the Dashboard view into the given container.
 * @param {HTMLElement} container
 * @param {object} appState
 * @param {object} actions
 */
export function renderDashboardView(container, appState, actions) {
  destroyDashboardCharts();

  const transactions = getTransactions();
  const activeMonth = appState.activeMonth;
  const chartMode = appState.dashboardChartMode || 'daily';

  // Dynamic Calculations
  const totals = calculateTotals(transactions);
  const monthly = calculateMonthlySummary(transactions, activeMonth);
  const budgetInfo = getBudget(activeMonth);
  const budgetLimit = budgetInfo.limit;
  const utilizationPct = budgetLimit > 0 ? Math.round((monthly.expenses / budgetLimit) * 1000) / 10 : 0;
  const remainingBudget = Math.round((budgetLimit - monthly.expenses) * 100) / 100;

  let budgetBarClass = 'is-healthy';
  let budgetStatusText = 'On Track';
  if (utilizationPct >= 100) {
    budgetBarClass = 'is-exceeded';
    budgetStatusText = 'Budget Exceeded';
  } else if (utilizationPct >= 80) {
    budgetBarClass = 'is-warning';
    budgetStatusText = 'Approaching Limit (80%+)';
  }

  // Monthly Category Breakdown (falls back to all-time if active month has 0 expenses)
  const monthlyTxs = transactions.filter((tx) => tx.date && tx.date.startsWith(activeMonth));
  const monthlyBreakdown = getCategoryBreakdown(monthlyTxs, 'expense');
  const breakdownScopeLabel =
    monthlyBreakdown.length > 0 ? formatMonthLabel(activeMonth, 'short') : 'All Time';
  const breakdownItems =
    monthlyBreakdown.length > 0
      ? monthlyBreakdown
      : getCategoryBreakdown(transactions, 'expense');

  // Recent 6 transactions sorted newest first
  const recentTxs = filterAndSortTransactions(transactions, { sortBy: 'date-desc' }).slice(0, 6);

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h2 class="view-heading">Financial Overview</h2>
        <p class="view-subtitle">Summary across all accounts with monthly spending tracked for ${escapeHtml(formatMonthLabel(activeMonth))}.</p>
      </div>
    </div>

    <!-- 4-Card Summary Grid -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label-row">
          <span class="kpi-label">Total Balance</span>
          <i data-lucide="landmark" class="kpi-icon" aria-hidden="true"></i>
        </div>
        <div class="kpi-value ${totals.totalBalance < 0 ? 'is-negative' : ''}">
          ${formatCurrency(totals.totalBalance)}
        </div>
        <div class="kpi-meta">
          <span>Income minus expenses across</span>
          <span class="tabular-nums">${totals.totalCount}</span>
          <span>entries</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label-row">
          <span class="kpi-label">Total Income</span>
          <i data-lucide="trending-up" class="kpi-icon" aria-hidden="true"></i>
        </div>
        <div class="kpi-value is-positive">${formatCurrency(totals.totalIncome)}</div>
        <div class="kpi-meta">
          <span class="tabular-nums">${totals.incomeCount}</span>
          <span>income ${totals.incomeCount === 1 ? 'transaction' : 'transactions'}</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label-row">
          <span class="kpi-label">Total Expenses</span>
          <i data-lucide="trending-down" class="kpi-icon" aria-hidden="true"></i>
        </div>
        <div class="kpi-value">${formatCurrency(totals.totalExpenses)}</div>
        <div class="kpi-meta">
          <span class="tabular-nums">${totals.expenseCount}</span>
          <span>expense ${totals.expenseCount === 1 ? 'transaction' : 'transactions'}</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label-row">
          <span class="kpi-label">Monthly Spending</span>
          <i data-lucide="calendar" class="kpi-icon" aria-hidden="true"></i>
        </div>
        <div class="kpi-value">${formatCurrency(monthly.expenses)}</div>
        <div class="kpi-meta">
          <span>${escapeHtml(formatMonthLabel(activeMonth, 'short'))}</span>
          <span aria-hidden="true">·</span>
          <span>Net ${formatCurrency(monthly.savings, { showPlus: true })}</span>
        </div>
      </div>
    </div>

    <!-- Monthly Budget Snapshot Strip -->
    <div class="budget-strip">
      <div class="budget-strip-info">
        <div class="budget-strip-top">
          <span class="budget-strip-title">${escapeHtml(formatMonthLabel(activeMonth))} Budget · ${escapeHtml(budgetStatusText)}</span>
          <span class="budget-strip-numbers tabular-nums">
            ${formatCurrency(monthly.expenses)} spent of ${formatCurrency(budgetLimit)} (${utilizationPct}%) ·
            ${
              remainingBudget >= 0
                ? `${formatCurrency(remainingBudget)} remaining`
                : `${formatCurrency(Math.abs(remainingBudget))} over budget`
            }
          </span>
        </div>
        <div class="progress-track" role="progressbar" aria-valuenow="${Math.min(100, Math.round(utilizationPct))}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-fill ${budgetBarClass}" style="width: ${Math.min(100, Math.max(0, utilizationPct))}%"></div>
        </div>
      </div>
      <button type="button" id="btn-dash-manage-budget" class="btn btn-secondary btn-sm">
        Manage Budget
      </button>
    </div>

    <!-- Charts Row -->
    <div class="dashboard-charts-grid">
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Monthly Spending Overview</h3>
            <p class="card-subtitle">
              ${
                chartMode === 'daily'
                  ? `Daily expenses for ${escapeHtml(formatMonthLabel(activeMonth))}`
                  : '6-month income vs. expense trajectory'
              }
            </p>
          </div>
          <div class="segmented-control" role="group" aria-label="Spending overview chart mode">
            <button type="button" class="segment-btn ${chartMode === 'daily' ? 'is-active' : ''}" data-dash-chart="daily">Daily</button>
            <button type="button" class="segment-btn ${chartMode === 'trend' ? 'is-active' : ''}" data-dash-chart="trend">6-Month</button>
          </div>
        </div>
        <div class="card-body">
          <div class="chart-container" id="dash-overview-wrap">
            <canvas id="dash-overview-canvas"></canvas>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Expense Category Breakdown</h3>
            <p class="card-subtitle">${escapeHtml(breakdownScopeLabel)} expense distribution</p>
          </div>
        </div>
        <div class="card-body">
          ${
            breakdownItems.length === 0
              ? `
            <div class="empty-state">
              <div class="empty-icon-wrap">
                <i data-lucide="pie-chart" aria-hidden="true"></i>
              </div>
              <h4 class="empty-title">No expense data</h4>
              <p class="empty-desc">Add an expense transaction to visualize category spending.</p>
            </div>
          `
              : `
            <div class="breakdown-layout">
              <div class="doughnut-wrap">
                <canvas id="dash-breakdown-canvas"></canvas>
              </div>
              <div class="category-legend-list">
                ${breakdownItems
                  .slice(0, 6)
                  .map(
                    (item) => `
                  <div class="category-legend-row">
                    <div class="legend-left">
                      <span class="legend-swatch" style="background-color: ${item.color}"></span>
                      <span class="legend-name">${escapeHtml(item.category)}</span>
                    </div>
                    <div class="legend-right">
                      <span class="legend-pct tabular-nums">${item.percentage}%</span>
                      <span class="legend-amount tabular-nums">${formatCurrency(item.total)}</span>
                    </div>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>
          `
          }
        </div>
      </div>
    </div>

    <!-- Recent Transactions Table -->
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Recent Transactions</h3>
          <p class="card-subtitle">Latest ledger activity across all dates</p>
        </div>
        <button type="button" id="btn-dash-view-all" class="btn-link">
          View all transactions
        </button>
      </div>
      ${
        recentTxs.length === 0
          ? `
        <div class="empty-state">
          <div class="empty-icon-wrap">
            <i data-lucide="receipt" aria-hidden="true"></i>
          </div>
          <h4 class="empty-title">No transactions yet</h4>
          <p class="empty-desc">Record an income or expense entry to populate your dashboard.</p>
          <button type="button" id="btn-dash-empty-add" class="btn btn-primary btn-sm">
            <i data-lucide="plus" class="btn-icon" aria-hidden="true"></i>
            <span>Add Transaction</span>
          </button>
        </div>
      `
          : `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Transaction</th>
                <th>Category</th>
                <th>Type</th>
                <th class="text-right">Amount</th>
                <th class="text-right">Edit</th>
              </tr>
            </thead>
            <tbody>
              ${recentTxs
                .map((tx) => {
                  const isIncome = tx.type === 'income';
                  return `
                    <tr>
                      <td class="tx-date tabular-nums">${escapeHtml(formatDate(tx.date))}</td>
                      <td>
                        <div class="tx-title-cell">
                          <span class="tx-title">${escapeHtml(tx.title)}</span>
                          ${tx.description ? `<span class="tx-desc">${escapeHtml(tx.description)}</span>` : ''}
                        </div>
                      </td>
                      <td class="tx-category">${escapeHtml(tx.category)}</td>
                      <td>
                        <span class="tx-type-label ${isIncome ? 'is-income' : 'is-expense'}">
                          <i data-lucide="${isIncome ? 'arrow-down-left' : 'arrow-up-right'}" aria-hidden="true"></i>
                          <span>${isIncome ? 'Income' : 'Expense'}</span>
                        </span>
                      </td>
                      <td class="text-right tx-amount tabular-nums ${isIncome ? 'is-income' : 'is-expense'}">
                        ${isIncome ? '+' : '-'}${formatCurrency(tx.amount)}
                      </td>
                      <td class="text-right">
                        <button
                          type="button"
                          class="icon-btn"
                          data-dash-edit="${escapeHtml(tx.id)}"
                          aria-label="Edit ${escapeHtml(tx.title)}"
                          title="Edit"
                        >
                          <i data-lucide="pencil" aria-hidden="true"></i>
                        </button>
                      </td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      `
      }
    </div>
  `;

  // Bind Event Listeners
  container.querySelector('#btn-dash-manage-budget').addEventListener('click', () => {
    actions.navigate('budget');
  });

  container.querySelector('#btn-dash-view-all').addEventListener('click', () => {
    actions.navigate('transactions');
  });

  const emptyAddBtn = container.querySelector('#btn-dash-empty-add');
  if (emptyAddBtn) {
    emptyAddBtn.addEventListener('click', () => {
      openTransactionModal(null, { defaultMonth: activeMonth });
    });
  }

  container.querySelectorAll('[data-dash-chart]').forEach((btn) => {
    btn.addEventListener('click', () => {
      actions.setDashboardChartMode(btn.dataset.dashChart);
    });
  });

  container.querySelectorAll('[data-dash-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tx = getTransactionById(btn.dataset.dashEdit);
      if (tx) openTransactionModal(tx);
    });
  });

  // Render Charts via Chart.js
  renderOverviewChart(transactions, activeMonth, chartMode);
  if (breakdownItems.length > 0) {
    renderBreakdownChart(breakdownItems);
  }
}

function renderOverviewChart(transactions, activeMonth, mode) {
  const canvas = document.getElementById('dash-overview-canvas');
  if (!canvas || typeof window.Chart === 'undefined') return;

  const ctx = canvas.getContext('2d');

  if (mode === 'trend') {
    const trend = getMonthlyTrend(transactions, 6, activeMonth);
    overviewChartInstance = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: trend.map((m) => m.label),
        datasets: [
          {
            label: 'Income',
            data: trend.map((m) => m.income),
            backgroundColor: '#16A34A',
            borderRadius: 6,
            barPercentage: 0.72,
          },
          {
            label: 'Expenses',
            data: trend.map((m) => m.expenses),
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
              usePointStyle: false,
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
    return;
  }

  // Daily Spending Bar Chart for Selected Month
  const daily = getDailySpendingSeries(transactions, activeMonth);
  overviewChartInstance = new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels: daily.map((d) => d.label),
      datasets: [
        {
          label: 'Daily Expense',
          data: daily.map((d) => d.total),
          backgroundColor: '#7C3AED',
          hoverBackgroundColor: '#EC4899',
          borderRadius: 4,
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
            title: (items) =>
              `${formatMonthLabel(activeMonth, 'short')} · Day ${items[0].label}`,
            label: (item) => `Spent: ${formatCurrency(item.raw)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#9E99AE',
            font: { family: "'JetBrains Mono', monospace", size: 10 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 15,
          },
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

function renderBreakdownChart(items) {
  const canvas = document.getElementById('dash-breakdown-canvas');
  if (!canvas || typeof window.Chart === 'undefined') return;

  const ctx = canvas.getContext('2d');
  breakdownChartInstance = new window.Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: items.map((i) => i.category),
      datasets: [
        {
          data: items.map((i) => i.total),
          backgroundColor: items.map((i) => i.color),
          borderColor: '#FFFFFF',
          borderWidth: 2,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '66%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => {
              const entry = items[item.dataIndex];
              return `${entry.category}: ${formatCurrency(entry.total)} (${entry.percentage}%)`;
            },
          },
        },
      },
    },
  });
}
