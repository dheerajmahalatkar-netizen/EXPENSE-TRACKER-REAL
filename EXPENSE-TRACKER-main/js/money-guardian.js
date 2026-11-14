/**
 * money-guardian.js
 * Comprehensive View Renderer & State Controller for Money Guardian:
 * Your Personal Financial Control System.
 *
 * Implements:
 * 1. Money Guardian Dashboard (Live Balances, Daily Income, Safe Spending Allowance,
 *    Protected Funds, Overspending Gauge, Upcoming Bills, and Smart Savings).
 * 2. Bills & Subscriptions Management View.
 * 3. Savings Goals Management View.
 * 4. Guarded Transaction Simulation with Real-Time Spending Blocker.
 * 5. Configuration & Protected Reserves Settings Modals.
 */

import {
  formatINR,
  fetchGuardianSummary,
  fetchGuardianSettings,
  updateGuardianSettings,
  fetchProtectedReserves,
  updateProtectedReserve,
  fetchBills,
  createBill,
  updateBill,
  deleteBill,
  payBill,
  preCheckTransaction,
  executeGuardedTransaction,
} from './guardian-service.js';

import {
  fetchBankAccount,
  fetchBankTransactions,
  fetchGoals,
  createGoal,
  updateGoal,
  deleteGoal,
} from './bank-service.js';

import { calculateDailyIncomeMetrics } from './daily-income-engine.js';
import {
  evaluateDailySpendingStatus,
  evaluateMonthlySpendingPace,
  validateTransactionDecision,
} from './spending-guard.js';
import { generateBillReminders, calculateBillsSummary } from './bill-manager.js';
import { generateGuardianSavingsRecommendations } from './savings-engine.js';
import { refreshNotificationCenter } from './notification-manager.js';
import { escapeHtml, formatDate } from './transactions.js';

let cachedSummary = null;
let cachedReserves = [];
let cachedBills = [];
let cachedGoals = [];
let cachedTxs = [];
let billFilter = 'all';
let billSearch = '';

/* ==========================================================================
   VIEW 1: MONEY GUARDIAN MAIN DASHBOARD
   ========================================================================== */

export async function renderGuardianDashboard(container, appState, actions) {
  container.innerHTML = `
    <div class="card" style="margin-top: 24px;">
      <div class="empty-state">
        <div class="empty-icon-wrap">
          <i data-lucide="shield" aria-hidden="true"></i>
        </div>
        <h3 class="empty-title">Synchronizing Money Guardian...</h3>
        <p class="empty-desc">Connecting to real-time financial control system.</p>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();

  try {
    const [summary, reserves, bills, goals, txs] = await Promise.all([
      fetchGuardianSummary(),
      fetchProtectedReserves(),
      fetchBills(),
      fetchGoals(),
      fetchBankTransactions({ limit: 15 }),
    ]);

    cachedSummary = summary;
    cachedReserves = reserves;
    cachedBills = bills;
    cachedGoals = goals;
    cachedTxs = txs;

    renderGuardianContent(container, actions);
    refreshNotificationCenter();
  } catch (err) {
    container.innerHTML = `
      <div class="alert-banner is-exceeded" role="alert" style="margin-top: 20px;">
        <i data-lucide="alert-circle" aria-hidden="true"></i>
        <div>
          <div class="alert-title">Money Guardian Initialization Warning</div>
          <div class="alert-desc">${escapeHtml(err.message || 'Failed to load Guardian summary')}. Ensure backend is running on http://localhost:3000.</div>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }
}

function renderGuardianContent(container, actions) {
  if (!cachedSummary) return;

  const s = cachedSummary;
  const dailyStatus = evaluateDailySpendingStatus(s.dailyConsumptionPct, s.spendingToday, s.dailySafeAllowance);
  const monthlyPace = evaluateMonthlySpendingPace({
    withdrawalsThisMonth: s.withdrawalsThisMonth,
    monthlyBudget: s.discretionaryMonthlyBudget,
    todayDay: s.todayDay,
    daysInMonth: s.daysInMonth,
  });

  const reminders = generateBillReminders(cachedBills);
  const emergencyGoal = cachedGoals.find(
    (g) => g.category === 'emergency' || g.name.toLowerCase().includes('emergency')
  );
  const emergencySaved = emergencyGoal ? Number(emergencyGoal.current_amount) || 0 : 0;

  const recommendations = generateGuardianSavingsRecommendations({
    bankBalance: s.bankBalance,
    monthlyIncome: s.monthlyIncome,
    dailySpending: s.spendingToday,
    dailySafeAllowance: s.dailySafeAllowance,
    totalProtectedReserves: s.totalProtectedReserves,
    emergencyReserveTarget: s.emergencyReserveTarget,
    emergencyReserveCurrent: emergencySaved,
    debtObligations: s.debtObligations,
    goals: cachedGoals,
    bills: cachedBills,
  });

  const isStrict = s.spendingControlMode === 'strict';

  container.innerHTML = `
    <!-- Top View Header -->
    <div class="view-header bank-header-flex">
      <div>
        <div class="bank-title-row">
          <h2 class="view-heading">Money Guardian</h2>
          <span class="guardian-mode-pill ${isStrict ? 'mode-strict' : 'mode-warning'}">
            <i data-lucide="${isStrict ? 'shield-check' : 'shield-alert'}" aria-hidden="true"></i>
            ${isStrict ? 'STRICT SPENDING PROTECTION ACTIVE' : 'WARNING-ONLY MODE ACTIVE'}
          </span>
          <span class="demo-account-badge">
            <i data-lucide="building" aria-hidden="true"></i>
            DEMO BANK
          </span>
        </div>
        <p class="view-subtitle">
          Intelligent live bank balance monitoring, daily safe spending limits, protected essential reserves, and proactive bill reminders.
        </p>
      </div>

      <div class="bank-topbar-actions">
        <button type="button" id="btn-guardian-simulate" class="btn btn-primary btn-sm" title="Simulate a transaction against spending guard">
          <i data-lucide="plus-circle" class="btn-icon" aria-hidden="true"></i>
          <span>Simulate Purchase</span>
        </button>

        <button type="button" id="btn-guardian-settings" class="btn btn-secondary btn-sm" title="Configure income and spending parameters">
          <i data-lucide="sliders" class="btn-icon" aria-hidden="true"></i>
          <span>Guardian Settings</span>
        </button>

        <button type="button" id="btn-guardian-refresh" class="btn btn-secondary btn-sm" title="Refresh live balances and ledger">
          <i data-lucide="refresh-cw" class="btn-icon" aria-hidden="true"></i>
          <span>Sync</span>
        </button>
      </div>
    </div>

    <!-- Active Spending Warning Banner if needed -->
    ${
      dailyStatus.level === 'critical' || dailyStatus.level === 'caution'
        ? `
      <div class="alert-banner ${dailyStatus.level === 'critical' ? 'is-exceeded' : 'is-warning'}" role="alert" style="margin-bottom: 20px;">
        <i data-lucide="${dailyStatus.icon}" aria-hidden="true"></i>
        <div style="flex: 1;">
          <div class="alert-title">${escapeHtml(dailyStatus.headline)}</div>
          <div class="alert-desc">${escapeHtml(dailyStatus.message)}</div>
        </div>
      </div>
    `
        : ''
    }

    <!-- =====================================================================
         SECTION 1: FINANCIAL COMMAND TILES
         ===================================================================== -->
    <div class="guardian-kpi-grid">
      <!-- 1. Verified Bank Balance -->
      <div class="kpi-card guardian-card-highlight">
        <div class="kpi-label-row">
          <span class="kpi-label">Current Bank Balance</span>
          <i data-lucide="landmark" class="kpi-icon" style="color: var(--brand-accent);" aria-hidden="true"></i>
        </div>
        <div class="kpi-value tabular-nums" style="font-size: 26px;">${formatINR(s.bankBalance)}</div>
        <div class="guardian-card-subline">
          <span>Available Discretionary: <strong>${formatINR(s.availableBalance)}</strong></span>
        </div>
      </div>

      <!-- 2. Daily Income Benchmark -->
      <div class="kpi-card">
        <div class="kpi-label-row">
          <span class="kpi-label">Daily Income Benchmark</span>
          <i data-lucide="trending-up" class="kpi-icon" style="color: var(--status-income);" aria-hidden="true"></i>
        </div>
        <div class="kpi-value is-positive tabular-nums" style="font-size: 24px;">${formatINR(s.dailyIncomeBenchmark)}/day</div>
        <div class="guardian-card-subline">
          <span>Monthly Income: <strong>${formatINR(s.monthlyIncome)}</strong> (${s.daysInMonth} days)</span>
        </div>
      </div>

      <!-- 3. Safe Daily Spending Allowance -->
      <div class="kpi-card">
        <div class="kpi-label-row">
          <span class="kpi-label">Safe Daily Allowance</span>
          <i data-lucide="shield" class="kpi-icon" style="color: #6366f1;" aria-hidden="true"></i>
        </div>
        <div class="kpi-value tabular-nums" style="font-size: 24px;">${formatINR(s.dailySafeAllowance)}/day</div>
        <div class="guardian-card-subline">
          <span>Carryover: <strong>${s.dailyAllowanceCarryover ? 'Active (Dynamic)' : 'Fixed'}</strong></span>
        </div>
      </div>

      <!-- 4. Today's Remaining Allowance -->
      <div class="kpi-card">
        <div class="kpi-label-row">
          <span class="kpi-label">Remaining Today</span>
          <i data-lucide="${dailyStatus.icon}" class="kpi-icon" style="color: ${dailyStatus.color};" aria-hidden="true"></i>
        </div>
        <div class="kpi-value tabular-nums ${s.isOverspent ? 'is-negative' : 'is-positive'}" style="font-size: 24px;">
          ${formatINR(s.remainingDailyAllowance)}
        </div>
        <div class="guardian-card-subline">
          <span>Spent today: <strong>${formatINR(s.spendingToday)}</strong> (${s.dailyConsumptionPct}%)</span>
        </div>
      </div>
    </div>

    <!-- =====================================================================
         SECTION 2: DAILY & MONTHLY SPENDING PROGRESS METERS
         ===================================================================== -->
    <div class="guardian-meters-grid">
      <!-- Daily Spending Gauge Card -->
      <div class="card guardian-meter-card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Today's Daily Spending Gauge</h3>
            <p class="card-subtitle">Real-time daily consumption against safe allowance.</p>
          </div>
          <span class="status-pill ${dailyStatus.badgeClass}">
            <i data-lucide="${dailyStatus.icon}" aria-hidden="true"></i>
            ${escapeHtml(dailyStatus.label)}
          </span>
        </div>

        <div class="card-body">
          <div class="gauge-numbers-row">
            <div>
              <span class="gauge-lbl">Spent Today</span>
              <div class="gauge-val tabular-nums ${s.isOverspent ? 'is-negative' : ''}">${formatINR(s.spendingToday)}</div>
            </div>
            <div class="text-right">
              <span class="gauge-lbl">Daily Safe Limit</span>
              <div class="gauge-val tabular-nums">${formatINR(s.dailySafeAllowance)}</div>
            </div>
          </div>

          <div class="progress-track" role="progressbar" style="height: 10px; margin: 12px 0;">
            <div
              class="progress-fill ${s.dailyConsumptionPct > 100 ? 'is-exceeded' : s.dailyConsumptionPct >= 80 ? 'is-warning' : 'is-healthy'}"
              style="width: ${Math.min(100, s.dailyConsumptionPct)}%;"
            ></div>
          </div>

          <div class="guardian-meter-footer">
            <span>Remaining Today: <strong class="tabular-nums">${formatINR(s.remainingDailyAllowance)}</strong></span>
            ${
              s.isOverspent
                ? `<span style="color: var(--status-expense); font-weight: 600;">Overspent by ${formatINR(s.dailyOverspendingAmount)}</span>`
                : `<span>${100 - Math.min(100, s.dailyConsumptionPct)}% of allowance unused</span>`
            }
          </div>
        </div>
      </div>

      <!-- Monthly Discretionary Pace Card -->
      <div class="card guardian-meter-card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Monthly Discretionary Budget Pace</h3>
            <p class="card-subtitle">Spending trajectory for calendar month (${s.todayDay} of ${s.daysInMonth} days).</p>
          </div>
          <span class="status-pill ${monthlyPace.isPaceExceedingBudget ? 'badge-warning' : 'badge-success'}">
            <i data-lucide="${monthlyPace.isPaceExceedingBudget ? 'trending-up' : 'check'}" aria-hidden="true"></i>
            ${monthlyPace.isPaceExceedingBudget ? 'Pace Exceeding' : 'Pace On Track'}
          </span>
        </div>

        <div class="card-body">
          <div class="gauge-numbers-row">
            <div>
              <span class="gauge-lbl">Spent This Month</span>
              <div class="gauge-val tabular-nums">${formatINR(s.withdrawalsThisMonth)}</div>
            </div>
            <div class="text-right">
              <span class="gauge-lbl">Discretionary Pool</span>
              <div class="gauge-val tabular-nums">${formatINR(s.discretionaryMonthlyBudget)}</div>
            </div>
          </div>

          <div class="progress-track" role="progressbar" style="height: 10px; margin: 12px 0;">
            <div
              class="progress-fill ${monthlyPace.utilizationPct > 100 ? 'is-exceeded' : monthlyPace.utilizationPct >= 80 ? 'is-warning' : 'is-primary'}"
              style="width: ${Math.min(100, monthlyPace.utilizationPct)}%;"
            ></div>
          </div>

          <div class="guardian-meter-footer">
            <span>Projected Month-End: <strong class="tabular-nums">${formatINR(s.projectedMonthEndSpending)}</strong></span>
            <span>Burn rate: <strong>${formatINR(monthlyPace.dailyBurnRate)}/day</strong></span>
          </div>
        </div>
      </div>
    </div>

    <!-- =====================================================================
         SECTION 3: PROTECTED ESSENTIAL RESERVES (PHASE 6)
         ===================================================================== -->
    <div class="card" style="margin-bottom: 24px;">
      <div class="card-header">
        <div>
          <h3 class="card-title">Protected Essential Reserves</h3>
          <p class="card-subtitle">
            Segregated capital for non-negotiable living obligations (Rent, Utilities, Healthcare, Debt, Emergency). Total Protected: <strong>${formatINR(s.totalProtectedReserves)}</strong>.
          </p>
        </div>
        <button type="button" id="btn-edit-reserves" class="btn btn-secondary btn-sm">
          <i data-lucide="sliders" class="btn-icon" aria-hidden="true"></i>
          <span>Configure Reserves</span>
        </button>
      </div>

      <div class="card-body">
        <div class="reserves-grid">
          ${cachedReserves
            .map((r) => {
              const spent = Number(r.spent_amount) || 0;
              const total = Number(r.monthly_amount) || 0;
              const pct = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0;
              const remaining = Math.max(0, total - spent);

              return `
              <div class="reserve-tile ${r.is_depleted ? 'is-depleted' : ''}">
                <div class="reserve-tile-header">
                  <span class="reserve-name">${escapeHtml(r.name)}</span>
                  <span class="reserve-total tabular-nums">${formatINR(total)}</span>
                </div>

                <div class="progress-track" role="progressbar" style="height: 6px; margin: 8px 0;">
                  <div class="progress-fill ${pct >= 100 ? 'is-exceeded' : 'is-healthy'}" style="width: ${pct}%;"></div>
                </div>

                <div class="reserve-tile-footer">
                  <span>Spent: <strong class="tabular-nums">${formatINR(spent)}</strong></span>
                  <span>Remaining: <strong class="tabular-nums">${formatINR(remaining)}</strong></span>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      </div>
    </div>

    <!-- =====================================================================
         SECTION 4: UPCOMING BILLS & REMINDERS STRIP (PHASE 5)
         ===================================================================== -->
    <div class="card" style="margin-bottom: 24px;">
      <div class="card-header">
        <div>
          <h3 class="card-title">Upcoming Bills & Recurring Subscriptions</h3>
          <p class="card-subtitle">
            Scheduled obligations due soon. Unpaid Commitments: <strong>${formatINR(s.totalUnpaidBillsAmount)}</strong>.
          </p>
        </div>
        <button type="button" id="btn-view-all-bills" class="btn btn-secondary btn-sm">
          <i data-lucide="arrow-right" class="btn-icon" aria-hidden="true"></i>
          <span>Manage All Bills</span>
        </button>
      </div>

      <div class="card-body">
        ${
          cachedBills.filter((b) => b.payment_status !== 'paid').length === 0
            ? `
          <div class="empty-state" style="padding: 20px 0;">
            <div class="empty-icon-wrap" style="color: var(--status-income); background-color: var(--status-income-bg);">
              <i data-lucide="check-circle-2" aria-hidden="true"></i>
            </div>
            <h4 class="empty-title">All scheduled bills paid</h4>
            <p class="empty-desc">No outstanding payments or subscriptions due.</p>
          </div>
        `
            : `
          <div class="bills-quick-list">
            ${cachedBills
              .filter((b) => b.payment_status !== 'paid')
              .slice(0, 4)
              .map((bill) => {
                const diff = Math.ceil(
                  (new Date(bill.due_date).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime()) /
                    (1000 * 60 * 60 * 24)
                );
                const isOverdue = diff < 0;
                const isDueToday = diff === 0;

                return `
                <div class="bill-quick-item ${isOverdue ? 'is-overdue' : ''}">
                  <div class="bill-info-main">
                    <div class="bill-name-row">
                      <span class="bill-item-name">${escapeHtml(bill.name)}</span>
                      <span class="bill-tag ${bill.is_essential ? 'tag-essential' : 'tag-discretionary'}">
                        ${bill.is_essential ? 'Essential' : 'Discretionary'}
                      </span>
                    </div>
                    <div class="bill-meta-row">
                      <span>Due: <strong>${escapeHtml(formatDate(bill.due_date))}</strong></span>
                      <span class="bill-due-badge ${isOverdue ? 'due-overdue' : isDueToday ? 'due-today' : 'due-future'}">
                        ${isOverdue ? `Overdue by ${Math.abs(diff)}d` : isDueToday ? 'Due Today' : `Due in ${diff}d`}
                      </span>
                    </div>
                  </div>

                  <div class="bill-action-col">
                    <span class="bill-amount tabular-nums">${formatINR(bill.amount)}</span>
                    <button type="button" class="btn btn-primary btn-sm btn-quick-pay-bill" data-bill-id="${escapeHtml(bill.id)}" title="Pay and record in bank ledger">
                      <i data-lucide="check" class="btn-icon" aria-hidden="true"></i>
                      <span>Pay Bill</span>
                    </button>
                  </div>
                </div>
              `;
              })
              .join('')}
          </div>
        `
        }
      </div>
    </div>

    <!-- =====================================================================
         SECTION 5: SMART SAVINGS & FINANCIAL GUIDANCE (PHASE 7)
         ===================================================================== -->
    <div class="card" style="margin-bottom: 24px;">
      <div class="card-header">
        <div>
          <h3 class="card-title">Money Guardian Savings & Allocation Engine</h3>
          <p class="card-subtitle">
            Contextual fintech recommendations to optimize cash flow, reinforce emergency buffers, and fund short-term milestones.
          </p>
        </div>
      </div>

      <div class="card-body">
        <div class="guardian-recommendations-list">
          ${recommendations
            .map(
              (rec) => `
            <div class="guardian-rec-card">
              <div class="guardian-rec-header">
                <div class="rec-icon-box" style="background-color: var(--surface-secondary); color: var(--brand-accent);">
                  <i data-lucide="${rec.icon || 'shield'}" aria-hidden="true"></i>
                </div>
                <div class="rec-title-group">
                  <h4 class="rec-title">${escapeHtml(rec.category)}</h4>
                  <span class="rec-badge ${rec.badgeClass}">${escapeHtml(rec.badge)}</span>
                </div>
                ${
                  rec.suggestedAmount > 0
                    ? `<div class="rec-amount-pill tabular-nums">${formatINR(rec.suggestedAmount)}</div>`
                    : ''
                }
              </div>

              <div class="guardian-rec-body">
                <p class="guardian-rec-action"><strong>Action:</strong> ${escapeHtml(rec.whatToDo)}</p>
                <p class="guardian-rec-rationale"><strong>Reasoning:</strong> ${escapeHtml(rec.whySuggested)}</p>
                <div class="guardian-rec-details-grid">
                  <div><span>Goal:</span> ${escapeHtml(rec.goalSupported)}</div>
                  <div><span>Risk:</span> ${escapeHtml(rec.risks)}</div>
                </div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    </div>

    <!-- =====================================================================
         SECTION 6: RECENT BANK ACTIVITY
         ===================================================================== -->
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Recent Bank Ledger Activity</h3>
          <p class="card-subtitle">Transactions verified and monitored by Money Guardian.</p>
        </div>
      </div>

      <div class="card-body">
        ${
          cachedTxs.length === 0
            ? `
          <div class="empty-state">
            <div class="empty-icon-wrap"><i data-lucide="receipt" aria-hidden="true"></i></div>
            <h4 class="empty-title">No transactions recorded yet</h4>
            <p class="empty-desc">Simulated banking transactions will appear here.</p>
          </div>
        `
            : `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date & Ref</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th class="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${cachedTxs
                  .slice(0, 8)
                  .map((tx) => {
                    const isCredit = tx.type === 'credit';
                    return `
                    <tr>
                      <td>
                        <div class="tx-date tabular-nums">${escapeHtml(formatDate(tx.date))}</div>
                        <div class="bank-ref-tag monospace tabular-nums">${escapeHtml(tx.reference_no)}</div>
                      </td>
                      <td><div class="tx-title">${escapeHtml(tx.description)}</div></td>
                      <td><span class="tx-category">${escapeHtml(tx.category)}</span></td>
                      <td>
                        <span class="tx-type-label ${isCredit ? 'is-income' : 'is-expense'}">
                          <i data-lucide="${isCredit ? 'arrow-down-left' : 'arrow-up-right'}" aria-hidden="true"></i>
                          <span>${isCredit ? 'Deposit' : 'Withdrawal'}</span>
                        </span>
                      </td>
                      <td class="text-right tx-amount tabular-nums ${isCredit ? 'is-income' : 'is-expense'}">
                        ${isCredit ? '+' : '−'}${formatINR(tx.amount)}
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
    </div>
  `;

  bindGuardianEvents(container, actions);
  if (window.lucide) window.lucide.createIcons();
}

/* ==========================================================================
   EVENT HANDLERS FOR GUARDIAN DASHBOARD
   ========================================================================== */

function bindGuardianEvents(container, actions) {
  // Sync Button
  container.querySelector('#btn-guardian-refresh')?.addEventListener('click', async () => {
    try {
      actions.showToast('Synchronizing Money Guardian with bank ledger...');
      await renderGuardianDashboard(container, null, actions);
      actions.showToast('Financial records up to date.');
    } catch (err) {
      actions.showToast(err.message, 'error');
    }
  });

  // Settings Modal Trigger
  container.querySelector('#btn-guardian-settings')?.addEventListener('click', () => {
    openGuardianSettingsModal(actions, () => renderGuardianDashboard(container, null, actions));
  });

  // Configure Reserves Trigger
  container.querySelector('#btn-edit-reserves')?.addEventListener('click', () => {
    openReservesConfigModal(actions, () => renderGuardianDashboard(container, null, actions));
  });

  // Manage Bills Trigger
  container.querySelector('#btn-view-all-bills')?.addEventListener('click', () => {
    actions.navigate('bills');
  });

  // Quick Simulate Purchase Button
  container.querySelector('#btn-guardian-simulate')?.addEventListener('click', () => {
    openGuardedSimulationModal(actions, () => renderGuardianDashboard(container, null, actions));
  });

  // Quick Pay Bill Buttons
  container.querySelectorAll('.btn-quick-pay-bill').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const billId = btn.dataset.billId;
      if (!billId) return;

      const bill = cachedBills.find((b) => b.id === billId);
      if (!bill) return;

      actions.confirmAction({
        title: 'Confirm Bill Payment',
        message: `Pay ₹${Number(bill.amount).toLocaleString('en-IN')} for "${bill.name}" from your SpendWise Demo Bank account?`,
        confirmLabel: 'Pay Bill Now',
        onConfirm: async () => {
          btn.disabled = true;
          try {
            const res = await payBill(billId);
            actions.showToast(res.message);
            await renderGuardianDashboard(container, null, actions);
          } catch (err) {
            actions.showToast(err.message, 'error');
          } finally {
            btn.disabled = false;
          }
        },
      });
    });
  });
}

/* ==========================================================================
   VIEW 2: BILLS & SUBSCRIPTIONS MANAGER
   ========================================================================== */

export async function renderBillsView(container, appState, actions) {
  container.innerHTML = `
    <div class="card" style="margin-top: 24px;">
      <div class="empty-state">
        <div class="empty-icon-wrap"><i data-lucide="receipt" aria-hidden="true"></i></div>
        <h3 class="empty-title">Loading Bills & Subscriptions...</h3>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();

  try {
    cachedBills = await fetchBills();
    renderBillsContent(container, actions);
  } catch (err) {
    container.innerHTML = `
      <div class="alert-banner is-exceeded" role="alert" style="margin-top: 20px;">
        <i data-lucide="alert-circle" aria-hidden="true"></i>
        <div>
          <div class="alert-title">Failed to load bills</div>
          <div class="alert-desc">${escapeHtml(err.message)}</div>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }
}

function renderBillsContent(container, actions) {
  const summary = calculateBillsSummary(cachedBills);

  const filteredBills = cachedBills.filter((b) => {
    if (billFilter === 'unpaid' && b.payment_status === 'paid') return false;
    if (billFilter === 'paid' && b.payment_status !== 'paid') return false;
    if (billFilter === 'essential' && b.is_essential !== 1) return false;
    if (billFilter === 'discretionary' && b.is_essential === 1) return false;

    if (billSearch) {
      const q = billSearch.toLowerCase();
      const match =
        (b.name && b.name.toLowerCase().includes(q)) ||
        (b.category && b.category.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  container.innerHTML = `
    <div class="view-header bank-header-flex">
      <div>
        <h2 class="view-heading">Bills & Subscriptions Manager</h2>
        <p class="view-subtitle">Track recurring utility bills, loan EMIs, and entertainment subscriptions with proactive reminders.</p>
      </div>

      <div class="bank-topbar-actions">
        <button type="button" id="btn-add-bill" class="btn btn-primary btn-sm">
          <i data-lucide="plus" class="btn-icon" aria-hidden="true"></i>
          <span>Add New Bill / Subscription</span>
        </button>
      </div>
    </div>

    <!-- Bills Summary Metrics -->
    <div class="kpi-grid" style="margin-bottom: 24px;">
      <div class="kpi-card">
        <div class="kpi-label-row">
          <span class="kpi-label">Total Unpaid Commitments</span>
          <i data-lucide="wallet" class="kpi-icon" aria-hidden="true"></i>
        </div>
        <div class="kpi-value tabular-nums">${formatINR(summary.totalCommitted)}</div>
        <div class="kpi-meta">${summary.unpaidCount} bills pending payment</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label-row">
          <span class="kpi-label">Essential Living Obligations</span>
          <i data-lucide="shield-alert" class="kpi-icon" style="color: var(--brand-accent);" aria-hidden="true"></i>
        </div>
        <div class="kpi-value tabular-nums">${formatINR(summary.essentialTotal)}</div>
        <div class="kpi-meta">Protected from discretionary spending</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label-row">
          <span class="kpi-label">Due Within 7 Days</span>
          <i data-lucide="calendar" class="kpi-icon" style="color: var(--status-warning);" aria-hidden="true"></i>
        </div>
        <div class="kpi-value tabular-nums" style="color: var(--status-warning);">${formatINR(summary.dueWithin7DaysAmount)}</div>
        <div class="kpi-meta">${summary.dueWithin7DaysCount} upcoming payments</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label-row">
          <span class="kpi-label">Overdue Payments</span>
          <i data-lucide="alert-octagon" class="kpi-icon" style="color: var(--status-expense);" aria-hidden="true"></i>
        </div>
        <div class="kpi-value tabular-nums ${summary.overdueCount > 0 ? 'is-negative' : 'is-positive'}">${formatINR(summary.overdueAmount)}</div>
        <div class="kpi-meta">${summary.overdueCount} bills overdue</div>
      </div>
    </div>

    <!-- Toolbar Filters -->
    <div class="card">
      <div class="card-body">
        <div class="toolbar-grid" style="margin-bottom: 16px;">
          <div class="search-input-wrap">
            <i data-lucide="search" class="search-icon" aria-hidden="true"></i>
            <input
              type="search"
              id="bills-search-input"
              class="form-input search-input"
              placeholder="Search bill or subscription name..."
              value="${escapeHtml(billSearch)}"
            />
          </div>

          <div class="segmented-control" role="group">
            <button type="button" class="segment-btn ${billFilter === 'all' ? 'is-active' : ''}" data-bill-filter="all">All</button>
            <button type="button" class="segment-btn ${billFilter === 'unpaid' ? 'is-active' : ''}" data-bill-filter="unpaid">Unpaid</button>
            <button type="button" class="segment-btn ${billFilter === 'essential' ? 'is-active' : ''}" data-bill-filter="essential">Essential</button>
            <button type="button" class="segment-btn ${billFilter === 'discretionary' ? 'is-active' : ''}" data-bill-filter="discretionary">Subscriptions</button>
            <button type="button" class="segment-btn ${billFilter === 'paid' ? 'is-active' : ''}" data-bill-filter="paid">Paid</button>
          </div>
        </div>

        ${
          filteredBills.length === 0
            ? `
          <div class="empty-state">
            <div class="empty-icon-wrap"><i data-lucide="receipt" aria-hidden="true"></i></div>
            <h4 class="empty-title">No matching bills found</h4>
            <p class="empty-desc">Add recurring bills or adjust your search filter above.</p>
          </div>
        `
            : `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Bill / Subscription</th>
                  <th>Category & Type</th>
                  <th>Recurrence</th>
                  <th>Due Date & Status</th>
                  <th class="text-right">Amount</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${filteredBills
                  .map((b) => {
                    const diff = Math.ceil(
                      (new Date(b.due_date).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime()) /
                        (1000 * 60 * 60 * 24)
                    );
                    const isPaid = b.payment_status === 'paid';
                    const isOverdue = !isPaid && diff < 0;

                    return `
                    <tr>
                      <td>
                        <div class="tx-title" style="font-weight: 600;">${escapeHtml(b.name)}</div>
                        <div class="tx-date">${b.is_essential ? '🔒 Essential Living Obligation' : 'Discretionary Subscription'}</div>
                      </td>
                      <td>
                        <span class="tx-category">${escapeHtml(b.category)}</span>
                      </td>
                      <td>
                        <span class="recurrence-badge">${escapeHtml(b.recurrence.toUpperCase())}</span>
                      </td>
                      <td>
                        <div class="tabular-nums" style="font-size: 13px; font-weight: 500;">${escapeHtml(formatDate(b.due_date))}</div>
                        <span class="status-indicator-tag ${isPaid ? 'status-paid' : isOverdue ? 'status-overdue' : 'status-pending'}">
                          ${isPaid ? 'Paid' : isOverdue ? `Overdue by ${Math.abs(diff)}d` : `Due in ${diff}d`}
                        </span>
                      </td>
                      <td class="text-right tabular-nums tx-amount" style="font-weight: 700;">
                        ${formatINR(b.amount)}
                      </td>
                      <td class="text-right">
                        <div style="display: inline-flex; align-items: center; gap: 4px;">
                          ${
                            !isPaid
                              ? `
                            <button type="button" class="btn btn-secondary btn-sm btn-pay-bill" data-bill-id="${escapeHtml(b.id)}" title="Pay bill">
                              <i data-lucide="check" class="btn-icon" aria-hidden="true"></i>
                              <span>Pay</span>
                            </button>
                          `
                              : ''
                          }
                          <button type="button" class="icon-btn btn-edit-bill" data-bill-id="${escapeHtml(b.id)}" title="Edit bill">
                            <i data-lucide="pencil" aria-hidden="true"></i>
                          </button>
                          <button type="button" class="icon-btn is-danger btn-delete-bill" data-bill-id="${escapeHtml(b.id)}" title="Delete bill">
                            <i data-lucide="trash-2" aria-hidden="true"></i>
                          </button>
                        </div>
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
    </div>
  `;

  bindBillsEvents(container, actions);
  if (window.lucide) window.lucide.createIcons();
}

function bindBillsEvents(container, actions) {
  // Search
  container.querySelector('#bills-search-input')?.addEventListener('input', (e) => {
    billSearch = e.target.value;
    renderBillsContent(container, actions);
    const inp = container.querySelector('#bills-search-input');
    if (inp) {
      inp.focus();
      inp.setSelectionRange(billSearch.length, billSearch.length);
    }
  });

  // Filter
  container.querySelectorAll('[data-bill-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      billFilter = btn.dataset.billFilter;
      renderBillsContent(container, actions);
    });
  });

  // Add Bill
  container.querySelector('#btn-add-bill')?.addEventListener('click', () => {
    openAddEditBillModal(actions, null, () => renderBillsView(container, null, actions));
  });

  // Edit Bill
  container.querySelectorAll('.btn-edit-bill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const bId = btn.dataset.billId;
      const b = cachedBills.find((x) => x.id === bId);
      if (b) openAddEditBillModal(actions, b, () => renderBillsView(container, null, actions));
    });
  });

  // Delete Bill
  container.querySelectorAll('.btn-delete-bill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const bId = btn.dataset.billId;
      const b = cachedBills.find((x) => x.id === bId);
      if (!b) return;

      actions.confirmAction({
        title: 'Delete Bill Reminder',
        message: `Are you sure you want to delete "${b.name}"? This will remove all scheduled reminders.`,
        confirmLabel: 'Delete Bill',
        onConfirm: async () => {
          try {
            await deleteBill(bId);
            actions.showToast(`Bill "${b.name}" deleted.`);
            await renderBillsView(container, null, actions);
          } catch (err) {
            actions.showToast(err.message, 'error');
          }
        },
      });
    });
  });

  // Pay Bill
  container.querySelectorAll('.btn-pay-bill').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const bId = btn.dataset.billId;
      const b = cachedBills.find((x) => x.id === bId);
      if (!b) return;

      actions.confirmAction({
        title: 'Confirm Bill Payment',
        message: `Pay ₹${Number(b.amount).toLocaleString('en-IN')} for "${b.name}"? This will record a debit in your bank ledger and calculate the next recurring due date.`,
        confirmLabel: 'Pay Now',
        onConfirm: async () => {
          try {
            const res = await payBill(bId);
            actions.showToast(res.message);
            await renderBillsView(container, null, actions);
          } catch (err) {
            actions.showToast(err.message, 'error');
          }
        },
      });
    });
  });
}

/* ==========================================================================
   VIEW 3: SAVINGS GOALS DEDICATED VIEW
   ========================================================================== */

export async function renderSavingsGoalsView(container, appState, actions) {
  container.innerHTML = `
    <div class="card" style="margin-top: 24px;">
      <div class="empty-state">
        <div class="empty-icon-wrap"><i data-lucide="target" aria-hidden="true"></i></div>
        <h3 class="empty-title">Loading Savings Goals...</h3>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();

  try {
    cachedGoals = await fetchGoals();
    renderGoalsContent(container, actions);
  } catch (err) {
    container.innerHTML = `
      <div class="alert-banner is-exceeded" role="alert" style="margin-top: 20px;">
        <i data-lucide="alert-circle" aria-hidden="true"></i>
        <div>
          <div class="alert-title">Failed to load goals</div>
          <div class="alert-desc">${escapeHtml(err.message)}</div>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }
}

function renderGoalsContent(container, actions) {
  const totalTarget = cachedGoals.reduce((sum, g) => sum + (Number(g.target_amount) || 0), 0);
  const totalSaved = cachedGoals.reduce((sum, g) => sum + (Number(g.current_amount) || 0), 0);
  const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

  container.innerHTML = `
    <div class="view-header bank-header-flex">
      <div>
        <h2 class="view-heading">Savings Goals & Wealth Milestones</h2>
        <p class="view-subtitle">Track targeted savings goals, funding milestones, and maturity dates.</p>
      </div>

      <div class="bank-topbar-actions">
        <button type="button" id="btn-add-goal-view" class="btn btn-primary btn-sm">
          <i data-lucide="plus" class="btn-icon" aria-hidden="true"></i>
          <span>Create New Goal</span>
        </button>
      </div>
    </div>

    <!-- Goals Metric Tiles -->
    <div class="kpi-grid" style="margin-bottom: 24px;">
      <div class="kpi-card">
        <div class="kpi-label-row">
          <span class="kpi-label">Total Cumulative Saved</span>
          <i data-lucide="piggy-bank" class="kpi-icon" style="color: var(--status-income);" aria-hidden="true"></i>
        </div>
        <div class="kpi-value is-positive tabular-nums">${formatINR(totalSaved)}</div>
        <div class="kpi-meta">Across ${cachedGoals.length} active goals</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label-row">
          <span class="kpi-label">Total Goals Target</span>
          <i data-lucide="target" class="kpi-icon" aria-hidden="true"></i>
        </div>
        <div class="kpi-value tabular-nums">${formatINR(totalTarget)}</div>
        <div class="kpi-meta">${overallPct}% funded overall</div>
      </div>
    </div>

    <!-- Goals Grid -->
    <div class="card">
      <div class="card-body">
        ${
          cachedGoals.length === 0
            ? `
          <div class="empty-state">
            <div class="empty-icon-wrap"><i data-lucide="target" aria-hidden="true"></i></div>
            <h4 class="empty-title">No financial goals created yet</h4>
            <p class="empty-desc">Create milestones for Emergency Fund, Laptop, Travel, or Education.</p>
          </div>
        `
            : `
          <div class="goals-grid">
            ${cachedGoals
              .map((goal) => {
                const target = Number(goal.target_amount) || 1;
                const current = Number(goal.current_amount) || 0;
                const pct = Math.min(100, Math.round((current / target) * 100));
                const remaining = Math.max(0, target - current);

                return `
                <div class="goal-card">
                  <div class="goal-card-top">
                    <div class="goal-title-wrap">
                      <span class="goal-name">${escapeHtml(goal.name)}</span>
                      <span class="goal-target-date tabular-nums">Target Date: ${escapeHtml(formatDate(goal.target_date))}</span>
                    </div>
                    <div class="goal-actions">
                      <button type="button" class="btn btn-secondary btn-sm btn-contribute-goal-v" data-goal-id="${escapeHtml(goal.id)}" title="Contribute funds">
                        <i data-lucide="plus" class="btn-icon" aria-hidden="true"></i>
                        <span>Add Funds</span>
                      </button>
                      <button type="button" class="icon-btn btn-edit-goal-v" data-goal-id="${escapeHtml(goal.id)}" title="Edit goal">
                        <i data-lucide="pencil" aria-hidden="true"></i>
                      </button>
                      <button type="button" class="icon-btn is-danger btn-delete-goal-v" data-goal-id="${escapeHtml(goal.id)}" title="Delete goal">
                        <i data-lucide="trash-2" aria-hidden="true"></i>
                      </button>
                    </div>
                  </div>

                  <div class="goal-progress-section">
                    <div class="goal-numbers-row">
                      <span class="goal-saved tabular-nums">${formatINR(current)}</span>
                      <span class="goal-pct tabular-nums">${pct}% funded</span>
                    </div>

                    <div class="progress-track" role="progressbar" style="height: 8px;">
                      <div class="progress-fill ${pct >= 100 ? 'is-healthy' : 'is-primary'}" style="width: ${pct}%;"></div>
                    </div>

                    <div class="goal-footer-meta">
                      <span>Target: <strong class="tabular-nums">${formatINR(target)}</strong></span>
                      <span>Remaining: <strong class="tabular-nums">${formatINR(remaining)}</strong></span>
                    </div>
                  </div>
                </div>
              `;
              })
              .join('')}
          </div>
        `
        }
      </div>
    </div>
  `;

  bindGoalsEvents(container, actions);
  if (window.lucide) window.lucide.createIcons();
}

function bindGoalsEvents(container, actions) {
  // Add Goal
  container.querySelector('#btn-add-goal-view')?.addEventListener('click', () => {
    openAddEditGoalModal(actions, null, () => renderSavingsGoalsView(container, null, actions));
  });

  // Edit Goal
  container.querySelectorAll('.btn-edit-goal-v').forEach((btn) => {
    btn.addEventListener('click', () => {
      const gId = btn.dataset.goalId;
      const g = cachedGoals.find((x) => x.id === gId);
      if (g) openAddEditGoalModal(actions, g, () => renderSavingsGoalsView(container, null, actions));
    });
  });

  // Delete Goal
  container.querySelectorAll('.btn-delete-goal-v').forEach((btn) => {
    btn.addEventListener('click', () => {
      const gId = btn.dataset.goalId;
      const g = cachedGoals.find((x) => x.id === gId);
      if (!g) return;

      actions.confirmAction({
        title: 'Delete Financial Goal',
        message: `Delete goal "${g.name}"? Progress records will be deleted.`,
        confirmLabel: 'Delete Goal',
        onConfirm: async () => {
          try {
            await deleteGoal(gId);
            actions.showToast(`Goal "${g.name}" deleted.`);
            await renderSavingsGoalsView(container, null, actions);
          } catch (err) {
            actions.showToast(err.message, 'error');
          }
        },
      });
    });
  });

  // Contribute Funds
  container.querySelectorAll('.btn-contribute-goal-v').forEach((btn) => {
    btn.addEventListener('click', () => {
      const gId = btn.dataset.goalId;
      const g = cachedGoals.find((x) => x.id === gId);
      if (g) openContributeGoalModal(actions, g, () => renderSavingsGoalsView(container, null, actions));
    });
  });
}

/* ==========================================================================
   MODAL 1: MONEY GUARDIAN SETTINGS MODAL
   ========================================================================== */

export async function openGuardianSettingsModal(actions, onSaved) {
  let modal = document.getElementById('guardian-settings-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'guardian-settings-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  let settings;
  try {
    settings = await fetchGuardianSettings();
  } catch (e) {
    settings = cachedSummary || {
      monthly_income: 500000,
      spending_control_mode: 'strict',
      daily_allowance_carryover: 1,
      daily_spending_cap: 12000,
      emergency_reserve_target: 150000,
    };
  }

  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h2 class="modal-title">Money Guardian Configuration</h2>
        <button type="button" class="icon-btn btn-close-modal" aria-label="Close modal">
          <i data-lucide="x" aria-hidden="true"></i>
        </button>
      </div>

      <form id="form-guardian-settings" class="modal-form" novalidate>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Monthly Income (₹)</label>
            <input type="number" id="cfg-monthly-income" class="form-input mono-input" min="0" step="1000" value="${settings.monthly_income}" required />
            <span class="field-hint">e.g. ₹5,00,000 for daily income benchmark calculation</span>
          </div>

          <div class="form-group">
            <label class="form-label">Spending Protection Mode</label>
            <select id="cfg-control-mode" class="form-select">
              <option value="strict" ${settings.spending_control_mode === 'strict' ? 'selected' : ''}>Strict Mode (Hard Blocks Violations)</option>
              <option value="warning" ${settings.spending_control_mode === 'warning' ? 'selected' : ''}>Warning-Only Mode (Alerts Only)</option>
            </select>
            <span class="field-hint">Strict mode blocks purchases exceeding daily allowance</span>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Daily Allowance Carryover</label>
            <select id="cfg-carryover" class="form-select">
              <option value="1" ${settings.daily_allowance_carryover ? 'selected' : ''}>Enabled (Unused allowance rolls over dynamically)</option>
              <option value="0" ${!settings.daily_allowance_carryover ? 'selected' : ''}>Disabled (Fixed daily allowance every day)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Daily Hard Spending Ceiling (₹)</label>
            <input type="number" id="cfg-daily-cap" class="form-input mono-input" min="0" step="500" value="${settings.daily_spending_cap || 12000}" />
            <span class="field-hint">Cap on maximum safe daily spend</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Emergency Safety Reserve Target (₹)</label>
          <input type="number" id="cfg-emergency-target" class="form-input mono-input" min="0" step="5000" value="${settings.emergency_reserve_target || 150000}" />
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Guardian Settings</button>
        </div>
      </form>
    </div>
  `;

  modal.hidden = false;
  if (window.lucide) window.lucide.createIcons();

  const close = () => { modal.hidden = true; };
  modal.querySelectorAll('.btn-close-modal').forEach((b) => b.addEventListener('click', close));

  modal.querySelector('#form-guardian-settings').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      monthly_income: Number(modal.querySelector('#cfg-monthly-income').value),
      spending_control_mode: modal.querySelector('#cfg-control-mode').value,
      daily_allowance_carryover: modal.querySelector('#cfg-carryover').value === '1',
      daily_spending_cap: Number(modal.querySelector('#cfg-daily-cap').value),
      emergency_reserve_target: Number(modal.querySelector('#cfg-emergency-target').value),
    };

    try {
      const res = await updateGuardianSettings(payload);
      actions.showToast(res.message || 'Guardian settings updated.');
      close();
      if (typeof onSaved === 'function') onSaved();
    } catch (err) {
      actions.showToast(err.message, 'error');
    }
  });
}

/* ==========================================================================
   MODAL 2: CONFIGURE PROTECTED RESERVES MODAL
   ========================================================================== */

export async function openReservesConfigModal(actions, onSaved) {
  let modal = document.getElementById('reserves-config-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'reserves-config-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const reserves = cachedReserves.length > 0 ? cachedReserves : await fetchProtectedReserves();

  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h2 class="modal-title">Configure Protected Essential Reserves</h2>
        <button type="button" class="icon-btn btn-close-modal" aria-label="Close modal">
          <i data-lucide="x" aria-hidden="true"></i>
        </button>
      </div>

      <div class="modal-body" style="padding: 16px 20px;">
        <p style="font-size: 13px; color: var(--ink-secondary); margin-bottom: 16px;">
          Money Guardian locks these reserved amounts so discretionary purchases cannot consume funds needed for living essentials.
        </p>

        <div style="display: flex; flex-direction: column; gap: 12px; max-height: 380px; overflow-y: auto;">
          ${reserves
            .map(
              (r) => `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px; background-color: var(--surface-secondary); border-radius: 6px;">
              <div style="flex: 1;">
                <div style="font-size: 13.5px; font-weight: 600; color: var(--ink-primary);">${escapeHtml(r.name)}</div>
                <div style="font-size: 11.5px; color: var(--ink-secondary);">${escapeHtml(r.notes || '')}</div>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 13px; font-weight: 600;">₹</span>
                <input
                  type="number"
                  class="form-input mono-input input-reserve-val"
                  data-reserve-id="${escapeHtml(r.id)}"
                  value="${r.monthly_amount}"
                  min="0"
                  step="500"
                  style="width: 110px; padding: 6px 8px; font-size: 13px;"
                />
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
        <button type="button" id="btn-save-all-reserves" class="btn btn-primary">Save All Reserves</button>
      </div>
    </div>
  `;

  modal.hidden = false;
  if (window.lucide) window.lucide.createIcons();

  const close = () => { modal.hidden = true; };
  modal.querySelectorAll('.btn-close-modal').forEach((b) => b.addEventListener('click', close));

  modal.querySelector('#btn-save-all-reserves').addEventListener('click', async () => {
    const inputs = modal.querySelectorAll('.input-reserve-val');
    try {
      for (const input of inputs) {
        const id = input.dataset.reserveId;
        const val = Number(input.value) || 0;
        await updateProtectedReserve(id, { monthly_amount: val });
      }
      actions.showToast('Protected reserves updated successfully.');
      close();
      if (typeof onSaved === 'function') onSaved();
    } catch (err) {
      actions.showToast(err.message, 'error');
    }
  });
}

/* ==========================================================================
   MODAL 3: GUARDED PURCHASE SIMULATION MODAL
   ========================================================================== */

export function openGuardedSimulationModal(actions, onComplete) {
  let modal = document.getElementById('guardian-sim-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'guardian-sim-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h2 class="modal-title">Simulate Guarded Transaction</h2>
        <button type="button" class="icon-btn btn-close-modal" aria-label="Close modal">
          <i data-lucide="x" aria-hidden="true"></i>
        </button>
      </div>

      <form id="form-guarded-sim" class="modal-form" novalidate>
        <div class="form-group">
          <label class="form-label">Transaction Type</label>
          <div class="segmented-control" role="radiogroup">
            <button type="button" class="segment-btn is-active" data-sim-type="debit">Withdrawal / Payment</button>
            <button type="button" class="segment-btn" data-sim-type="credit">Deposit / Inflow</button>
          </div>
          <input type="hidden" id="sim-type" value="debit" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Amount (₹)</label>
            <input type="number" id="sim-amount" class="form-input mono-input" step="0.01" min="1" placeholder="0.00" required />
            <span class="field-error" id="err-sim-amount"></span>
          </div>

          <div class="form-group">
            <label class="form-label">Category</label>
            <select id="sim-category" class="form-select" required>
              <option value="Shopping">Shopping (Discretionary)</option>
              <option value="Food & Groceries">Food & Groceries (Essential)</option>
              <option value="Utilities">Utilities (Essential)</option>
              <option value="Housing">Housing (Essential)</option>
              <option value="Healthcare">Healthcare (Essential)</option>
              <option value="Salary">Salary (Deposit)</option>
              <option value="Freelance">Freelance (Deposit)</option>
              <option value="Entertainment">Entertainment (Discretionary)</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Description</label>
          <input type="text" id="sim-desc" class="form-input" placeholder="e.g. Weekend retail electronics or supermarket run" />
        </div>

        <!-- Real-time Pre-Check Feedback Area -->
        <div id="sim-precheck-box" class="sim-precheck-box" style="display: none; padding: 12px; border-radius: 6px; font-size: 13px; line-height: 1.45;"></div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
          <button type="submit" id="btn-submit-guarded-tx" class="btn btn-primary">Process Transaction</button>
        </div>
      </form>
    </div>
  `;

  modal.hidden = false;
  if (window.lucide) window.lucide.createIcons();

  const close = () => { modal.hidden = true; };
  modal.querySelectorAll('.btn-close-modal').forEach((b) => b.addEventListener('click', close));

  // Type Toggle
  modal.querySelectorAll('[data-sim-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('[data-sim-type]').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      modal.querySelector('#sim-type').value = btn.dataset.simType;
      triggerPreCheck();
    });
  });

  const amountInput = modal.querySelector('#sim-amount');
  const catSelect = modal.querySelector('#sim-category');
  const precheckBox = modal.querySelector('#sim-precheck-box');

  const triggerPreCheck = async () => {
    const amt = Number(amountInput.value);
    const cat = catSelect.value;
    const type = modal.querySelector('#sim-type').value;

    if (!amt || amt <= 0) {
      precheckBox.style.display = 'none';
      return;
    }

    try {
      const res = await preCheckTransaction({ amount: amt, category: cat, type });
      precheckBox.style.display = 'block';

      if (!res.allowed) {
        precheckBox.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
        precheckBox.style.border = '1px solid var(--status-expense)';
        precheckBox.style.color = 'var(--status-expense)';
        precheckBox.innerHTML = `<strong>⚠️ Blocked by Money Guardian:</strong> ${escapeHtml(res.reason)}`;
      } else if (res.isEssential) {
        precheckBox.style.backgroundColor = 'rgba(59, 130, 246, 0.08)';
        precheckBox.style.border = '1px solid var(--brand-accent)';
        precheckBox.style.color = 'var(--brand-accent)';
        precheckBox.innerHTML = `<strong>🛡️ Essential Obligation Approved:</strong> ${escapeHtml(res.reason)}`;
      } else if (res.warning) {
        precheckBox.style.backgroundColor = 'rgba(245, 158, 11, 0.08)';
        precheckBox.style.border = '1px solid var(--status-warning)';
        precheckBox.style.color = 'var(--status-warning)';
        precheckBox.innerHTML = `<strong>⚠️ Caution:</strong> ${escapeHtml(res.warning)}`;
      } else {
        precheckBox.style.backgroundColor = 'rgba(16, 185, 129, 0.08)';
        precheckBox.style.border = '1px solid var(--status-income)';
        precheckBox.style.color = 'var(--status-income)';
        precheckBox.innerHTML = `<strong>✓ Approved:</strong> Safe within spending parameters.`;
      }
    } catch (err) {
      precheckBox.style.display = 'none';
    }
  };

  amountInput.addEventListener('input', triggerPreCheck);
  catSelect.addEventListener('change', triggerPreCheck);

  modal.querySelector('#form-guarded-sim').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amt = Number(amountInput.value);
    const cat = catSelect.value;
    const desc = modal.querySelector('#sim-desc').value;
    const type = modal.querySelector('#sim-type').value;

    if (!amt || amt <= 0) {
      actions.showToast('Please enter a valid amount greater than zero', 'error');
      return;
    }

    try {
      const res = await executeGuardedTransaction({
        amount: amt,
        category: cat,
        description: desc,
        type,
      });

      actions.showToast(res.message);
      close();
      if (typeof onComplete === 'function') onComplete();
    } catch (err) {
      actions.showToast(err.message, 'error');
    }
  });
}

/* ==========================================================================
   MODAL 4: ADD / EDIT BILL MODAL
   ========================================================================== */

function openAddEditBillModal(actions, existingBill, onSaved) {
  let modal = document.getElementById('add-edit-bill-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'add-edit-bill-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const isEdit = Boolean(existingBill);
  const todayStr = new Date().toISOString().slice(0, 10);

  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h2 class="modal-title">${isEdit ? 'Edit Scheduled Bill' : 'Add Bill / Subscription'}</h2>
        <button type="button" class="icon-btn btn-close-modal" aria-label="Close modal">
          <i data-lucide="x" aria-hidden="true"></i>
        </button>
      </div>

      <form id="form-add-bill" class="modal-form" novalidate>
        <div class="form-group">
          <label class="form-label">Bill / Subscription Name</label>
          <input type="text" id="bill-name" class="form-input" value="${isEdit ? escapeHtml(existingBill.name) : ''}" placeholder="e.g. Fiber Broadband, Apartment Rent, Gym Pass" required />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Category</label>
            <select id="bill-category" class="form-select" required>
              <option value="Utilities" ${isEdit && existingBill.category === 'Utilities' ? 'selected' : ''}>Utilities</option>
              <option value="Housing" ${isEdit && existingBill.category === 'Housing' ? 'selected' : ''}>Housing & Rent</option>
              <option value="Insurance" ${isEdit && existingBill.category === 'Insurance' ? 'selected' : ''}>Insurance</option>
              <option value="Loans & EMIs" ${isEdit && existingBill.category === 'Loans & EMIs' ? 'selected' : ''}>Loans & EMIs</option>
              <option value="Healthcare" ${isEdit && existingBill.category === 'Healthcare' ? 'selected' : ''}>Healthcare</option>
              <option value="Education" ${isEdit && existingBill.category === 'Education' ? 'selected' : ''}>Education</option>
              <option value="Subscriptions" ${isEdit && existingBill.category === 'Subscriptions' ? 'selected' : ''}>Subscriptions & Entertainment</option>
              <option value="Other" ${isEdit && existingBill.category === 'Other' ? 'selected' : ''}>Other</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Amount (₹)</label>
            <input type="number" id="bill-amount" class="form-input mono-input" step="1" min="1" value="${isEdit ? existingBill.amount : ''}" required />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input type="date" id="bill-due-date" class="form-input" value="${isEdit ? existingBill.due_date : todayStr}" required />
          </div>

          <div class="form-group">
            <label class="form-label">Recurrence</label>
            <select id="bill-recurrence" class="form-select">
              <option value="monthly" ${isEdit && existingBill.recurrence === 'monthly' ? 'selected' : ''}>Monthly</option>
              <option value="quarterly" ${isEdit && existingBill.recurrence === 'quarterly' ? 'selected' : ''}>Quarterly</option>
              <option value="annual" ${isEdit && existingBill.recurrence === 'annual' ? 'selected' : ''}>Annual</option>
              <option value="weekly" ${isEdit && existingBill.recurrence === 'weekly' ? 'selected' : ''}>Weekly</option>
              <option value="one_time" ${isEdit && existingBill.recurrence === 'one_time' ? 'selected' : ''}>One-Time Payment</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Classification</label>
          <div style="display: flex; gap: 16px; margin-top: 4px;">
            <label style="display: flex; align-items: center; gap: 6px; font-size: 13.5px; cursor: pointer;">
              <input type="radio" name="bill-essential" value="1" ${!isEdit || existingBill.is_essential === 1 ? 'checked' : ''} />
              <span>Essential (Protected from daily discretionary limits)</span>
            </label>
            <label style="display: flex; align-items: center; gap: 6px; font-size: 13.5px; cursor: pointer;">
              <input type="radio" name="bill-essential" value="0" ${isEdit && existingBill.is_essential === 0 ? 'checked' : ''} />
              <span>Discretionary Subscription</span>
            </label>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Create Bill'}</button>
        </div>
      </form>
    </div>
  `;

  modal.hidden = false;
  if (window.lucide) window.lucide.createIcons();

  const close = () => { modal.hidden = true; };
  modal.querySelectorAll('.btn-close-modal').forEach((b) => b.addEventListener('click', close));

  modal.querySelector('#form-add-bill').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: modal.querySelector('#bill-name').value.trim(),
      category: modal.querySelector('#bill-category').value,
      amount: Number(modal.querySelector('#bill-amount').value),
      due_date: modal.querySelector('#bill-due-date').value,
      recurrence: modal.querySelector('#bill-recurrence').value,
      is_essential: modal.querySelector('input[name="bill-essential"]:checked').value === '1',
    };

    if (!payload.name || !payload.amount || !payload.due_date) {
      actions.showToast('Please fill all required bill fields', 'error');
      return;
    }

    try {
      if (isEdit) {
        await updateBill(existingBill.id, payload);
        actions.showToast(`Bill "${payload.name}" updated.`);
      } else {
        await createBill(payload);
        actions.showToast(`Bill "${payload.name}" scheduled.`);
      }
      close();
      if (typeof onSaved === 'function') onSaved();
    } catch (err) {
      actions.showToast(err.message, 'error');
    }
  });
}

/* ==========================================================================
   MODAL 5: ADD / EDIT FINANCIAL GOAL MODAL
   ========================================================================== */

function openAddEditGoalModal(actions, existingGoal, onSaved) {
  let modal = document.getElementById('add-edit-goal-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'add-edit-goal-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const isEdit = Boolean(existingGoal);
  const futureYear = new Date().getFullYear() + 1;
  const defaultDate = `${futureYear}-06-30`;

  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h2 class="modal-title">${isEdit ? 'Edit Savings Goal' : 'Create Financial Milestone'}</h2>
        <button type="button" class="icon-btn btn-close-modal" aria-label="Close modal">
          <i data-lucide="x" aria-hidden="true"></i>
        </button>
      </div>

      <form id="form-goal" class="modal-form" novalidate>
        <div class="form-group">
          <label class="form-label">Goal Name</label>
          <input type="text" id="goal-name" class="form-input" value="${isEdit ? escapeHtml(existingGoal.name) : ''}" placeholder="e.g. Emergency Buffer, Tech Gear, Higher Education" required />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Target Amount (₹)</label>
            <input type="number" id="goal-target" class="form-input mono-input" min="1" step="500" value="${isEdit ? existingGoal.target_amount : ''}" required />
          </div>

          <div class="form-group">
            <label class="form-label">Current Saved Amount (₹)</label>
            <input type="number" id="goal-current" class="form-input mono-input" min="0" step="500" value="${isEdit ? existingGoal.current_amount : '0'}" required />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Target Completion Date</label>
            <input type="date" id="goal-date" class="form-input" value="${isEdit ? existingGoal.target_date : defaultDate}" required />
          </div>

          <div class="form-group">
            <label class="form-label">Category</label>
            <select id="goal-category" class="form-select">
              <option value="emergency" ${isEdit && existingGoal.category === 'emergency' ? 'selected' : ''}>Emergency Safety Buffer</option>
              <option value="gadgets" ${isEdit && existingGoal.category === 'gadgets' ? 'selected' : ''}>Electronics & Gadgets</option>
              <option value="travel" ${isEdit && existingGoal.category === 'travel' ? 'selected' : ''}>Travel & Vacation</option>
              <option value="business" ${isEdit && existingGoal.category === 'business' ? 'selected' : ''}>Business Seed Capital</option>
              <option value="education" ${isEdit && existingGoal.category === 'education' ? 'selected' : ''}>Education</option>
              <option value="general" ${isEdit && existingGoal.category === 'general' ? 'selected' : ''}>General Savings</option>
            </select>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Create Goal'}</button>
        </div>
      </form>
    </div>
  `;

  modal.hidden = false;
  if (window.lucide) window.lucide.createIcons();

  const close = () => { modal.hidden = true; };
  modal.querySelectorAll('.btn-close-modal').forEach((b) => b.addEventListener('click', close));

  modal.querySelector('#form-goal').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: modal.querySelector('#goal-name').value.trim(),
      target_amount: Number(modal.querySelector('#goal-target').value),
      current_amount: Number(modal.querySelector('#goal-current').value),
      target_date: modal.querySelector('#goal-date').value,
      category: modal.querySelector('#goal-category').value,
    };

    if (!payload.name || !payload.target_amount || !payload.target_date) {
      actions.showToast('Please complete all required goal fields', 'error');
      return;
    }

    try {
      if (isEdit) {
        await updateGoal(existingGoal.id, payload);
        actions.showToast(`Goal "${payload.name}" updated.`);
      } else {
        await createGoal(payload);
        actions.showToast(`Goal "${payload.name}" created.`);
      }
      close();
      if (typeof onSaved === 'function') onSaved();
    } catch (err) {
      actions.showToast(err.message, 'error');
    }
  });
}

function openContributeGoalModal(actions, goal, onSaved) {
  let modal = document.getElementById('contribute-goal-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'contribute-goal-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount));

  modal.innerHTML = `
    <div class="modal-card modal-card-sm">
      <div class="modal-header">
        <h2 class="modal-title">Contribute to "${escapeHtml(goal.name)}"</h2>
        <button type="button" class="icon-btn btn-close-modal" aria-label="Close modal">
          <i data-lucide="x" aria-hidden="true"></i>
        </button>
      </div>

      <form id="form-contribute-goal" class="modal-form" novalidate>
        <div class="form-group">
          <label class="form-label">Contribution Amount (₹)</label>
          <input type="number" id="contrib-amount" class="form-input mono-input" min="1" step="100" placeholder="e.g. 5000" required />
          <span class="field-hint">Currently saved: ${formatINR(goal.current_amount)} · Remaining: ${formatINR(remaining)}</span>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">Add Funds</button>
        </div>
      </form>
    </div>
  `;

  modal.hidden = false;
  if (window.lucide) window.lucide.createIcons();

  const close = () => { modal.hidden = true; };
  modal.querySelectorAll('.btn-close-modal').forEach((b) => b.addEventListener('click', close));

  modal.querySelector('#form-contribute-goal').addEventListener('submit', async (e) => {
    e.preventDefault();
    const addAmt = Number(modal.querySelector('#contrib-amount').value);
    if (!addAmt || addAmt <= 0) {
      actions.showToast('Enter a valid contribution amount', 'error');
      return;
    }

    try {
      const newTotal = (Number(goal.current_amount) || 0) + addAmt;
      await updateGoal(goal.id, { current_amount: newTotal });
      actions.showToast(`Added ${formatINR(addAmt)} to "${goal.name}".`);
      close();
      if (typeof onSaved === 'function') onSaved();
    } catch (err) {
      actions.showToast(err.message, 'error');
    }
  });
}

/* ==========================================================================
   VIEW 4: SETTINGS & PREFERENCES DASHBOARD (SECTION 3.9)
   ========================================================================== */

export async function renderSettingsView(container, appState, actions) {
  container.innerHTML = `
    <div class="card" style="margin-top: 24px;">
      <div class="empty-state">
        <div class="empty-icon-wrap"><i data-lucide="sliders" aria-hidden="true"></i></div>
        <h3 class="empty-title">Loading Preferences...</h3>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();

  let settings;
  try {
    settings = await fetchGuardianSettings();
  } catch (err) {
    settings = {
      monthly_income: 500000,
      spending_control_mode: 'strict',
      daily_allowance_carryover: 1,
      daily_spending_cap: 12000,
      emergency_reserve_target: 150000,
    };
  }

  container.innerHTML = `
    <div class="view-header bank-header-flex">
      <div>
        <h2 class="view-heading">Settings & Preferences</h2>
        <p class="view-subtitle">Manage financial calculation parameters, visual themes, spending guardrails, and data tools.</p>
      </div>
    </div>

    <div class="settings-grid">
      <!-- Card 1: Money Guardian Financial Controls -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Money Guardian Controls</h3>
            <p class="card-subtitle">Spending limits, daily income benchmarks, and protection mode.</p>
          </div>
          <span class="status-pill badge-progress">
            <i data-lucide="shield" aria-hidden="true"></i>
            Active
          </span>
        </div>

        <div class="card-body">
          <form id="form-full-settings" class="modal-form" style="padding: 0;" novalidate>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Monthly Income Benchmark (₹)</label>
                <input type="number" id="set-income" class="form-input mono-input" value="${settings.monthly_income}" min="0" step="1000" required />
                <span class="field-hint">Used for Daily Income Benchmark = Monthly Income / Days in Month</span>
              </div>

              <div class="form-group">
                <label class="form-label">Spending Protection Mode</label>
                <select id="set-mode" class="form-select">
                  <option value="strict" ${settings.spending_control_mode === 'strict' ? 'selected' : ''}>Strict Mode (Blocks Discretionary Overspending)</option>
                  <option value="warning" ${settings.spending_control_mode === 'warning' ? 'selected' : ''}>Warning-Only Mode (Alerts Without Blocking)</option>
                </select>
                <span class="field-hint">Strict mode blocks withdrawals exceeding daily safe allowance</span>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Daily Safe Allowance Carryover</label>
                <select id="set-carryover" class="form-select">
                  <option value="1" ${settings.daily_allowance_carryover ? 'selected' : ''}>Enabled (Unspent daily budget rolls over dynamically)</option>
                  <option value="0" ${!settings.daily_allowance_carryover ? 'selected' : ''}>Disabled (Fixed daily allowance every day)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Daily Hard Spending Ceiling (₹)</label>
                <input type="number" id="set-daily-cap" class="form-input mono-input" value="${settings.daily_spending_cap || 12000}" min="0" step="500" />
                <span class="field-hint">Upper ceiling on safe daily discretionary allowance</span>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Emergency Safety Reserve Target (₹)</label>
              <input type="number" id="set-emergency-target" class="form-input mono-input" value="${settings.emergency_reserve_target || 150000}" min="0" step="5000" />
              <span class="field-hint">Recommended: 3 to 6 months of non-negotiable living expenses</span>
            </div>

            <div style="display: flex; gap: 10px; margin-top: 14px;">
              <button type="submit" class="btn btn-primary">Save Guardian Settings</button>
              <button type="button" id="btn-open-reserves-from-settings" class="btn btn-secondary">
                <i data-lucide="sliders" class="btn-icon" aria-hidden="true"></i>
                <span>Configure 8 Protected Reserves</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Card 2: Visual Theme & 3D Experience (Canva-Inspired White Pink Purple) -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Visual Theme & 3D Experience</h3>
            <p class="card-subtitle">Aesthetics inspired by Canva White Pink Purple Gradients.</p>
          </div>
          <span class="status-pill badge-success">
            <i data-lucide="sparkles" aria-hidden="true"></i>
            Premium 3D
          </span>
        </div>

        <div class="card-body" style="display: flex; flex-direction: column; gap: 16px;">
          <div class="theme-palette-preview">
            <span class="color-swatch-box" style="background: #FFFFFF; border: 1px solid #EEEAF5;" title="Primary Canvas: #FFFFFF"></span>
            <span class="color-swatch-box" style="background: #FAF7FF;" title="Secondary Canvas: #FAF7FF"></span>
            <span class="color-swatch-box" style="background: #FCE7F3;" title="Soft Pink: #FCE7F3"></span>
            <span class="color-swatch-box" style="background: #EDE9FE;" title="Light Purple: #EDE9FE"></span>
            <span class="color-swatch-box" style="background: #EC4899;" title="Accent Pink: #EC4899"></span>
            <span class="color-swatch-box" style="background: #7C3AED;" title="Primary Purple: #7C3AED"></span>
            <span class="color-swatch-box" style="background: #5B21B6;" title="Deep Purple: #5B21B6"></span>
          </div>

          <div style="font-size: 13.5px; line-height: 1.6; color: var(--ink-secondary);">
            Active Visual Mode: <strong>Luminous White Pink Purple 3D Experience</strong>. Features soft glassmorphism, layered perspective cards, subtle mouse-follow tilt, floating decorative elements, and smooth cubic bezier transitions.
          </div>

          <div class="form-group">
            <label class="form-label">Interactive 3D Mouse Tilt</label>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="status-pill badge-success">✓ Enabled</span>
              <span style="font-size: 12.5px; color: var(--ink-secondary);">Cards react smoothly to cursor movement and hover depth.</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Card 3: Currency & Data Tools -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Currency & Data Tools</h3>
            <p class="card-subtitle">Export transactions, manage demo data, and verify connectivity.</p>
          </div>
        </div>

        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
            <div style="background-color: var(--surface-secondary); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-hairline);">
              <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 4px; color: var(--ink-primary);">Data Portability</h4>
              <p style="font-size: 12.5px; color: var(--ink-secondary); margin-bottom: 12px;">Export all recorded transactions into a CSV spreadsheet.</p>
              <button type="button" id="btn-settings-export-csv" class="btn btn-secondary btn-sm">
                <i data-lucide="download" class="btn-icon" aria-hidden="true"></i>
                <span>Download CSV File</span>
              </button>
            </div>

            <div style="background-color: var(--surface-secondary); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-hairline);">
              <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 4px; color: var(--ink-primary);">Sample Dataset</h4>
              <p style="font-size: 12.5px; color: var(--ink-secondary); margin-bottom: 12px;">Reset starter transactions for demonstration purposes.</p>
              <button type="button" id="btn-settings-reset-demo" class="btn btn-secondary btn-sm">
                <i data-lucide="rotate-ccw" class="btn-icon" aria-hidden="true"></i>
                <span>Restore Sample Dataset</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // Bind settings form submit
  container.querySelector('#form-full-settings')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      monthly_income: Number(container.querySelector('#set-income').value),
      spending_control_mode: container.querySelector('#set-mode').value,
      daily_allowance_carryover: container.querySelector('#set-carryover').value === '1',
      daily_spending_cap: Number(container.querySelector('#set-daily-cap').value),
      emergency_reserve_target: Number(container.querySelector('#set-emergency-target').value),
    };

    try {
      const res = await updateGuardianSettings(payload);
      actions.showToast(res.message || 'Settings saved successfully.');
    } catch (err) {
      actions.showToast(err.message, 'error');
    }
  });

  // Open reserves modal from settings
  container.querySelector('#btn-open-reserves-from-settings')?.addEventListener('click', () => {
    openReservesConfigModal(actions, () => renderSettingsView(container, appState, actions));
  });

  // Export CSV
  container.querySelector('#btn-settings-export-csv')?.addEventListener('click', () => {
    document.getElementById('btn-export-csv')?.click();
  });

  // Reset Demo
  container.querySelector('#btn-settings-reset-demo')?.addEventListener('click', () => {
    document.getElementById('btn-restore-demo')?.click();
  });
}
