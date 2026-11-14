/**
 * budget.js
 * Feature 5: Budget Management
 * Tracks monthly expenses against monthly budget limit, computes remaining budget
 * and utilization percentage, displays 80% warning and 100%+ exceeded alerts,
 * and allows updating budget targets.
 */

import { getTransactions, getBudget, saveBudget } from './storage.js';
import {
  calculateMonthlySummary,
  getCategoryBreakdown,
  formatCurrency,
  formatMonthLabel,
  roundCurrency,
  escapeHtml,
} from './transactions.js';

/**
 * Pure calculation helper for monthly budget state (independent of storage/DOM).
 * @param {number} monthlyExpenses
 * @param {number} budgetLimit
 */
export function calculateBudgetStatus(monthlyExpenses, budgetLimit) {
  const spent = roundCurrency(monthlyExpenses);
  const limit = roundCurrency(budgetLimit);
  const remaining = roundCurrency(limit - spent);
  const utilizationPct = limit > 0 ? Math.round((spent / limit) * 1000) / 10 : 0;

  let status = 'healthy'; // 'healthy' | 'warning' | 'exceeded'
  if (utilizationPct >= 100) {
    status = 'exceeded';
  } else if (utilizationPct >= 80) {
    status = 'warning';
  }

  return {
    spent,
    limit,
    remaining,
    utilizationPct,
    status,
  };
}

/**
 * Renders the Budget Management view.
 * @param {HTMLElement} container
 * @param {object} appState
 * @param {object} actions
 */
export function renderBudgetView(container, appState, actions) {
  const activeMonth = appState.activeMonth;
  const transactions = getTransactions();
  const monthly = calculateMonthlySummary(transactions, activeMonth);
  const budgetConfig = getBudget(activeMonth);

  const budgetState = calculateBudgetStatus(monthly.expenses, budgetConfig.limit);
  const monthlyTxs = transactions.filter((tx) => tx.date && tx.date.startsWith(activeMonth));
  const categoryBreakdown = getCategoryBreakdown(monthlyTxs, 'expense');

  const alertHtml = renderBudgetAlertBanner(budgetState, activeMonth);
  const barWidth = Math.min(100, Math.max(0, budgetState.utilizationPct));
  const barClass =
    budgetState.status === 'exceeded'
      ? 'is-exceeded'
      : budgetState.status === 'warning'
      ? 'is-warning'
      : 'is-healthy';

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h2 class="view-heading">Budget Management</h2>
        <p class="view-subtitle">Configure monthly spending caps and monitor utilization for ${escapeHtml(formatMonthLabel(activeMonth))}.</p>
      </div>
    </div>

    ${alertHtml}

    <div class="budget-layout">
      <!-- Budget Tracking Card -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">${escapeHtml(formatMonthLabel(activeMonth))} Spending Tracker</h3>
            <p class="card-subtitle">
              ${
                budgetConfig.isOverride
                  ? 'Using month-specific budget target'
                  : 'Using default monthly budget target'
              }
            </p>
          </div>
          <span class="tabular-nums" style="font-size: 13px; font-weight: 600; color: var(--ink-primary);">
            ${budgetState.utilizationPct}% utilized
          </span>
        </div>

        <div class="card-body">
          <div class="budget-progress-header">
            <span class="tx-category">Monthly Progress</span>
            <span class="tabular-nums" style="font-weight: 500;">
              ${formatCurrency(budgetState.spent)} / ${formatCurrency(budgetState.limit)}
            </span>
          </div>

          <div
            class="progress-track"
            role="progressbar"
            aria-valuenow="${Math.round(barWidth)}"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div class="progress-fill ${barClass}" style="width: ${barWidth}%"></div>
          </div>

          <div class="budget-metrics-row">
            <div>
              <div class="budget-metric-label">Monthly Budget</div>
              <div class="budget-metric-val tabular-nums">${formatCurrency(budgetState.limit)}</div>
            </div>
            <div>
              <div class="budget-metric-label">Monthly Expenses</div>
              <div class="budget-metric-val tabular-nums">${formatCurrency(budgetState.spent)}</div>
            </div>
            <div>
              <div class="budget-metric-label">${budgetState.remaining >= 0 ? 'Remaining Budget' : 'Over Budget'}</div>
              <div class="budget-metric-val tabular-nums ${budgetState.remaining >= 0 ? 'is-positive' : 'is-negative'}">
                ${formatCurrency(Math.abs(budgetState.remaining))}
              </div>
            </div>
          </div>

          <div style="font-size: 12.5px; color: var(--ink-muted); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <span>Warning threshold: 80% (${formatCurrency(budgetState.limit * 0.8)})</span>
            <span>Monthly income recorded: <strong class="tabular-nums" style="color: var(--ink-primary)">${formatCurrency(monthly.income)}</strong></span>
          </div>
        </div>
      </div>

      <!-- Set Monthly Budget Form Card -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Set Monthly Budget</h3>
            <p class="card-subtitle">Adjust your target limit and alert threshold</p>
          </div>
        </div>

        <div class="card-body">
          <form id="budget-settings-form" class="budget-form" novalidate>
            <div class="form-group">
              <label for="budget-limit-input" class="form-label">Monthly Limit ($)</label>
              <input
                type="number"
                id="budget-limit-input"
                class="form-input mono-input"
                step="0.01"
                min="1"
                value="${budgetState.limit}"
                required
              />
              <span class="field-error" id="err-budget-limit" aria-live="polite"></span>
            </div>

            <div class="form-group">
              <span class="form-label">Apply Limit To</span>
              <div class="radio-stack">
                <label class="radio-option">
                  <input
                    type="radio"
                    name="budget-scope"
                    value="default"
                    ${!budgetConfig.isOverride ? 'checked' : ''}
                  />
                  <span>Default for all months (unless overridden)</span>
                </label>
                <label class="radio-option">
                  <input
                    type="radio"
                    name="budget-scope"
                    value="month"
                    ${budgetConfig.isOverride ? 'checked' : ''}
                  />
                  <span>Only ${escapeHtml(formatMonthLabel(activeMonth))}</span>
                </label>
              </div>
            </div>

            <button type="submit" class="btn btn-primary" style="align-self: flex-start;">
              Save Budget
            </button>
          </form>
        </div>
      </div>
    </div>

    <!-- Category Contributions to Monthly Budget -->
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Monthly Expense Breakdown by Category</h3>
          <p class="card-subtitle">Share of ${escapeHtml(formatMonthLabel(activeMonth))} budget consumed per category</p>
        </div>
      </div>
      ${
        categoryBreakdown.length === 0
          ? `
        <div class="empty-state">
          <div class="empty-icon-wrap">
            <i data-lucide="wallet" aria-hidden="true"></i>
          </div>
          <h4 class="empty-title">No expenses recorded in ${escapeHtml(formatMonthLabel(activeMonth))}</h4>
          <p class="empty-desc">Your monthly budget is 100% available. Add an expense to start tracking utilization.</p>
        </div>
      `
          : `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th class="text-right">Transactions</th>
                <th class="text-right">% of Budget</th>
                <th class="text-right">Amount Spent</th>
              </tr>
            </thead>
            <tbody>
              ${categoryBreakdown
                .map((item) => {
                  const pctOfBudget =
                    budgetState.limit > 0
                      ? Math.round((item.total / budgetState.limit) * 1000) / 10
                      : 0;
                  return `
                    <tr>
                      <td>
                        <div class="legend-left">
                          <span class="legend-swatch" style="background-color: ${item.color}"></span>
                          <span class="legend-name">${escapeHtml(item.category)}</span>
                        </div>
                      </td>
                      <td class="text-right tabular-nums">${item.count}</td>
                      <td class="text-right tabular-nums">${pctOfBudget}%</td>
                      <td class="text-right tabular-nums" style="font-weight: 600;">${formatCurrency(item.total)}</td>
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

  // Bind Form Submit
  const form = container.querySelector('#budget-settings-form');
  const input = container.querySelector('#budget-limit-input');
  const errEl = container.querySelector('#err-budget-limit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawVal = input.value.trim();
    const numVal = Number(rawVal);

    if (!rawVal || !Number.isFinite(numVal) || numVal <= 0) {
      input.classList.add('is-invalid');
      errEl.textContent = 'Please enter a monthly budget greater than $0.00.';
      return;
    }

    if (numVal > 100000000) {
      input.classList.add('is-invalid');
      errEl.textContent = 'Budget limit exceeds maximum allowed value.';
      return;
    }

    input.classList.remove('is-invalid');
    errEl.textContent = '';

    const scope = form.querySelector('input[name="budget-scope"]:checked')?.value || 'default';
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      await saveBudget(numVal, activeMonth, scope === 'default');
      actions.showToast(
        scope === 'default'
          ? `Default monthly budget set to ${formatCurrency(numVal)}.`
          : `Budget for ${formatMonthLabel(activeMonth, 'short')} set to ${formatCurrency(numVal)}.`
      );
      actions.refreshAll();
    } catch (err) {
      actions.showToast(err.message || 'Failed to save budget', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

function renderBudgetAlertBanner(budgetState, activeMonth) {
  const monthLabel = escapeHtml(formatMonthLabel(activeMonth));

  if (budgetState.status === 'exceeded') {
    const overage = formatCurrency(Math.abs(budgetState.remaining));
    return `
      <div class="alert-banner is-exceeded" role="alert">
        <i data-lucide="alert-octagon" aria-hidden="true"></i>
        <div>
          <div class="alert-title">Budget Exceeded (${budgetState.utilizationPct}%)</div>
          <div class="alert-desc">
            Your expenses for ${monthLabel} have exceeded your ${formatCurrency(budgetState.limit)} budget by <strong class="tabular-nums">${overage}</strong>.
          </div>
        </div>
      </div>
    `;
  }

  if (budgetState.status === 'warning') {
    return `
      <div class="alert-banner is-warning" role="status">
        <i data-lucide="alert-triangle" aria-hidden="true"></i>
        <div>
          <div class="alert-title">Budget Warning (${budgetState.utilizationPct}% used)</div>
          <div class="alert-desc">
            You have reached or exceeded 80% of your ${monthLabel} budget. <strong class="tabular-nums">${formatCurrency(budgetState.remaining)}</strong> remaining.
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="alert-banner is-healthy" role="status">
      <i data-lucide="check-circle-2" aria-hidden="true"></i>
      <div>
        <div class="alert-title">On Track (${budgetState.utilizationPct}% used)</div>
        <div class="alert-desc">
          Spending for ${monthLabel} is within budget. You have <strong class="tabular-nums">${formatCurrency(budgetState.remaining)}</strong> remaining.
        </div>
      </div>
    </div>
  `;
}
