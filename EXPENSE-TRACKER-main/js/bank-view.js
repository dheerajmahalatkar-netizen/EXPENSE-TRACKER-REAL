/**
 * bank-view.js
 * Comprehensive View Renderer for SpendWise Smart Bank Connect.
 * Integrates Demo Bank Account, Smart Savings Alert Engine,
 * Intelligent Money Allocation Center, and Financial Goal Tracker.
 */

import {
  formatINR,
  fetchBankAccount,
  toggleBankConnection,
  refreshBankAccount,
  fetchBankTransactions,
  createBankTransaction,
  fetchBankSettings,
  updateBankSettings,
  fetchGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  importBankTxToSpendWise,
  fetchDismissedAlerts,
  dismissAlert,
} from './bank-service.js';

import { evaluateBankAlerts } from './bank-alerts.js';
import {
  calculateAvailableMoney,
  generateAllocationStrategy,
  getSmartActionCenterContext,
} from './smart-allocation.js';

import { escapeHtml, formatDate } from './transactions.js';

// Module state
let bankAccount = null;
let bankTransactions = [];
let bankSettings = null;
let bankGoals = [];
let dismissedAlertIds = [];
let activeTxFilter = 'all';
let txSearchQuery = '';
let selectedRisk = 'moderate';
let customAllocations = null; // When user drags sliders

/**
 * Loads all banking data and renders the view into the given container.
 * @param {HTMLElement} container
 * @param {object} appState
 * @param {object} actions
 */
export async function renderBankView(container, appState, actions) {
  container.innerHTML = `
    <div class="card" style="margin-top: 24px;">
      <div class="empty-state">
        <div class="empty-icon-wrap">
          <i data-lucide="loader" aria-hidden="true"></i>
        </div>
        <h3 class="empty-title">Synchronizing Smart Bank Connect...</h3>
        <p class="empty-desc">Connecting to SpendWise Demo Bank simulation.</p>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();

  try {
    const [acc, txs, settings, goals, dismissed] = await Promise.all([
      fetchBankAccount(),
      fetchBankTransactions(),
      fetchBankSettings(),
      fetchGoals(),
      fetchDismissedAlerts(),
    ]);

    bankAccount = acc;
    bankTransactions = txs;
    bankSettings = settings;
    bankGoals = goals;
    dismissedAlertIds = dismissed;
    selectedRisk = settings.risk_preference || 'moderate';

    renderBankContent(container, actions);
  } catch (err) {
    container.innerHTML = `
      <div class="alert-banner is-exceeded" role="alert" style="margin-top: 20px;">
        <i data-lucide="alert-circle" aria-hidden="true"></i>
        <div>
          <div class="alert-title">Demo Banking Connection Error</div>
          <div class="alert-desc">${escapeHtml(err.message || 'Failed to load banking data')}. Please verify the backend server is running on http://localhost:3000.</div>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }
}

function renderBankContent(container, actions) {
  if (!bankAccount) return;

  const isConnected = bankAccount.is_connected === 1;

  // 1. Calculate Available Money
  const emergencyGoal = bankGoals.find(
    (g) => g.category === 'emergency' || g.name.toLowerCase().includes('emergency')
  );
  const emergencySaved = emergencyGoal ? Number(emergencyGoal.current_amount) || 0 : 0;

  const avail = calculateAvailableMoney({
    balance: bankAccount.balance,
    minBalance: bankSettings.min_savings_balance,
    emergencyTarget: bankSettings.emergency_fund_target,
    upcomingCommitments: bankSettings.upcoming_commitments,
    emergencyFundSaved: emergencySaved,
  });

  // 2. Evaluate Alerts
  const activeAlerts = evaluateBankAlerts({
    account: bankAccount,
    transactions: bankTransactions,
    settings: bankSettings,
    dismissedAlertIds,
  });

  // 3. Action Center Context
  const actionCtx = getSmartActionCenterContext({
    balance: bankAccount.balance,
    minBalance: bankSettings.min_savings_balance,
    spendingLimit: bankSettings.monthly_spending_limit,
    withdrawalsThisMonth: bankAccount.withdrawalsThisMonth,
    emergencyTarget: bankSettings.emergency_fund_target,
    emergencySaved,
    savingsTarget: bankSettings.monthly_savings_target,
    netSavingsThisMonth: bankAccount.depositsThisMonth - bankAccount.withdrawalsThisMonth,
    debt: bankSettings.debt_obligations,
  });

  // 4. Allocation Strategy
  const allocation = generateAllocationStrategy({
    availableMoney: avail.availableMoney,
    settings: { ...bankSettings, risk_preference: selectedRisk },
    goals: bankGoals,
    currentBalance: bankAccount.balance,
  });

  // Filtered transactions for the activity table
  const filteredTxs = bankTransactions.filter((tx) => {
    if (activeTxFilter !== 'all' && tx.type !== activeTxFilter) return false;
    if (txSearchQuery) {
      const q = txSearchQuery.toLowerCase();
      const match =
        (tx.description && tx.description.toLowerCase().includes(q)) ||
        (tx.category && tx.category.toLowerCase().includes(q)) ||
        (tx.reference_no && tx.reference_no.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const lastSyncedTime = bankAccount.last_synced_at
    ? new Date(bankAccount.last_synced_at.replace(' ', 'T')).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Just now';

  container.innerHTML = `
    <!-- Top View Header -->
    <div class="view-header bank-header-flex">
      <div>
        <div class="bank-title-row">
          <h2 class="view-heading">Smart Bank Connect</h2>
          <span class="demo-account-badge">
            <i data-lucide="shield-check" aria-hidden="true"></i>
            DEMO ACCOUNT · SIMULATION ONLY
          </span>
        </div>
        <p class="view-subtitle">
          Intelligent financial monitoring, automated savings alerts, and algorithmic money allocation for ${escapeHtml(bankAccount.bank_name)}.
        </p>
      </div>

      <div class="bank-topbar-actions">
        <button type="button" id="btn-bank-settings" class="btn btn-secondary btn-sm" title="Configure financial parameters">
          <i data-lucide="sliders" class="btn-icon" aria-hidden="true"></i>
          <span>Settings & Goals</span>
        </button>

        <button type="button" id="btn-bank-refresh" class="btn btn-secondary btn-sm" title="Synchronize latest account data">
          <i data-lucide="refresh-cw" class="btn-icon" aria-hidden="true"></i>
          <span>Refresh</span>
        </button>

        <button type="button" id="btn-bank-toggle-connect" class="btn ${isConnected ? 'btn-secondary' : 'btn-primary'} btn-sm">
          <i data-lucide="${isConnected ? 'power-off' : 'plug-2'}" class="btn-icon" aria-hidden="true"></i>
          <span>${isConnected ? 'Disconnect' : 'Reconnect Demo Bank'}</span>
        </button>
      </div>
    </div>

    ${
      !isConnected
        ? `
      <div class="alert-banner is-warning" role="alert" style="margin-bottom: 24px;">
        <i data-lucide="power-off" aria-hidden="true"></i>
        <div style="flex: 1;">
          <div class="alert-title">SpendWise Demo Bank Account Disconnected</div>
          <div class="alert-desc">
            Your simulated bank account is currently disconnected. Your complete transaction history and financial goals remain safely stored in the database.
          </div>
        </div>
        <button type="button" id="btn-bank-reconnect-banner" class="btn btn-primary btn-sm">
          Reconnect Account
        </button>
      </div>
    `
        : ''
    }

    <!-- Top Bank Account Visual Card & Summary -->
    <div class="bank-hero-grid">
      <!-- Modern Credit/Debit Styled Bank Card -->
      <div class="bank-plastic-card ${!isConnected ? 'is-disabled' : ''}">
        <div class="card-chip-row">
          <div class="bank-card-chip"></div>
          <span class="bank-contactless">
            <i data-lucide="wifi" aria-hidden="true"></i>
          </span>
          <span class="bank-brand-logo">${escapeHtml(bankAccount.bank_name)}</span>
        </div>

        <div class="bank-card-balance-section">
          <span class="bank-card-balance-label">Verified Available Balance</span>
          <div class="bank-card-balance-val tabular-nums">${formatINR(bankAccount.balance)}</div>
        </div>

        <div class="bank-card-bottom-row">
          <div>
            <div class="bank-card-meta-label">Account Number</div>
            <div class="bank-card-meta-val tabular-nums">${escapeHtml(bankAccount.account_number)}</div>
          </div>
          <div>
            <div class="bank-card-meta-label">Account Holder</div>
            <div class="bank-card-meta-val">${escapeHtml(bankAccount.account_holder)}</div>
          </div>
          <div>
            <div class="bank-card-meta-label">Status</div>
            <div class="bank-card-meta-val">
              <span class="status-indicator-dot ${isConnected ? 'is-online' : 'is-offline'}"></span>
              ${isConnected ? 'Active' : 'Offline'}
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Metrics Grid -->
      <div class="bank-metrics-column">
        <div class="kpi-grid bank-metric-tiles">
          <div class="kpi-card">
            <div class="kpi-label-row">
              <span class="kpi-label">Deposits This Month</span>
              <i data-lucide="arrow-down-left" class="kpi-icon" style="color: var(--status-income);" aria-hidden="true"></i>
            </div>
            <div class="kpi-value is-positive tabular-nums">${formatINR(bankAccount.depositsThisMonth)}</div>
            <div class="kpi-meta">Verified bank inflows</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label-row">
              <span class="kpi-label">Withdrawals This Month</span>
              <i data-lucide="arrow-up-right" class="kpi-icon" style="color: var(--status-expense);" aria-hidden="true"></i>
            </div>
            <div class="kpi-value tabular-nums" style="color: var(--status-expense);">${formatINR(bankAccount.withdrawalsThisMonth)}</div>
            <div class="kpi-meta">Debits & bill payments</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label-row">
              <span class="kpi-label">Net Monthly Savings</span>
              <i data-lucide="wallet" class="kpi-icon" aria-hidden="true"></i>
            </div>
            <div class="kpi-value tabular-nums ${bankAccount.depositsThisMonth - bankAccount.withdrawalsThisMonth >= 0 ? 'is-positive' : 'is-negative'}">
              ${formatINR(bankAccount.depositsThisMonth - bankAccount.withdrawalsThisMonth, { showPlus: true })}
            </div>
            <div class="kpi-meta">Target: ${formatINR(bankSettings.monthly_savings_target)}</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label-row">
              <span class="kpi-label">Last Synchronized</span>
              <i data-lucide="clock" class="kpi-icon" aria-hidden="true"></i>
            </div>
            <div class="kpi-value tabular-nums" style="font-size: 19px;">${lastSyncedTime}</div>
            <div class="kpi-meta">Continuous Ledger Sync</div>
          </div>
        </div>
      </div>
    </div>

    <!-- =====================================================================
         PHASE SEVEN: SMART MONEY ACTION CENTER (MOST PROMINENT SECTION)
         ===================================================================== -->
    <div class="action-center-hero card ${actionCtx.bannerClass}">
      <div class="action-center-header">
        <div class="action-center-title-group">
          <div class="action-center-badge">
            <i data-lucide="sparkles" aria-hidden="true"></i>
            <span>SMART MONEY ACTION CENTER</span>
          </div>
          <h3 class="action-center-heading">WHAT SHOULD I DO WITH MY MONEY?</h3>
        </div>
        <div class="action-center-status-pill">
          <i data-lucide="${actionCtx.icon}" aria-hidden="true"></i>
          <span>${escapeHtml(actionCtx.headline)}</span>
        </div>
      </div>

      <p class="action-center-advice">${escapeHtml(actionCtx.message)}</p>

      <!-- 4-Pillar Capital Flow Breakdown -->
      <div class="capital-flow-strip">
        <div class="flow-pill">
          <span class="flow-label">Verified Bank Balance</span>
          <span class="flow-val tabular-nums">${formatINR(avail.balance)}</span>
        </div>
        <div class="flow-sep">−</div>
        <div class="flow-pill">
          <span class="flow-label">Protected Reserve</span>
          <span class="flow-val tabular-nums" style="color: var(--status-warning);">${formatINR(avail.protectedReserve)}</span>
        </div>
        <div class="flow-sep">−</div>
        <div class="flow-pill">
          <span class="flow-label">Upcoming Commitments</span>
          <span class="flow-val tabular-nums" style="color: var(--ink-secondary);">${formatINR(avail.upcomingCommitments)}</span>
        </div>
        <div class="flow-sep">=</div>
        <div class="flow-pill is-highlight">
          <span class="flow-label">Available for Allocation</span>
          <span class="flow-val tabular-nums is-positive" style="font-size: 20px;">${formatINR(avail.availableMoney)}</span>
        </div>
      </div>

      <!-- Emergency Fund Quick Progress -->
      <div class="action-emergency-bar">
        <div class="emergency-bar-info">
          <span>Emergency Reserve Progress: <strong>${formatINR(emergencySaved)}</strong> / ${formatINR(bankSettings.emergency_fund_target)}</span>
          <span class="tabular-nums">${Math.min(100, Math.round((emergencySaved / (bankSettings.emergency_fund_target || 1)) * 100))}% funded</span>
        </div>
        <div class="progress-track" role="progressbar" style="height: 6px;">
          <div class="progress-fill is-healthy" style="width: ${Math.min(100, Math.round((emergencySaved / (bankSettings.emergency_fund_target || 1)) * 100))}%;"></div>
        </div>
      </div>
    </div>

    <!-- =====================================================================
         PHASE FIVE: SMART SAVINGS ALERT ENGINE
         ===================================================================== -->
    <div class="card" style="margin-bottom: 24px;">
      <div class="card-header">
        <div>
          <h3 class="card-title">Active Savings & Security Alerts</h3>
          <p class="card-subtitle">Real-time risk monitoring across minimum balance, spending caps, and withdrawal anomalies.</p>
        </div>
        <span class="alerts-count-badge ${activeAlerts.length > 0 ? 'has-alerts' : 'is-clean'}">
          ${activeAlerts.length} ${activeAlerts.length === 1 ? 'Alert' : 'Alerts'}
        </span>
      </div>

      <div class="card-body">
        ${
          activeAlerts.length === 0
            ? `
          <div class="empty-state" style="padding: 24px 16px;">
            <div class="empty-icon-wrap" style="color: var(--status-income); background-color: var(--status-income-bg);">
              <i data-lucide="shield-check" aria-hidden="true"></i>
            </div>
            <h4 class="empty-title">All Savings Indicators Healthy</h4>
            <p class="empty-desc">No minimum balance breaches, overspending, or unusual withdrawals detected.</p>
          </div>
        `
            : `
          <div class="bank-alerts-list">
            ${activeAlerts
              .map(
                (alert) => `
              <div class="bank-alert-card severity-${alert.severity}">
                <div class="bank-alert-icon-box">
                  <i data-lucide="${alert.severity === 'critical' ? 'alert-octagon' : alert.severity === 'warning' ? 'alert-triangle' : alert.severity === 'success' ? 'check-circle' : 'info'}" aria-hidden="true"></i>
                </div>
                <div class="bank-alert-main">
                  <div class="bank-alert-title-row">
                    <span class="bank-alert-title">${escapeHtml(alert.title)}</span>
                    <span class="bank-alert-date tabular-nums">${escapeHtml(alert.date)}</span>
                  </div>
                  <div class="bank-alert-reason">${escapeHtml(alert.reason)}</div>
                  <div class="bank-alert-action">
                    <strong>Recommended Action:</strong> ${escapeHtml(alert.recommendedAction)}
                  </div>
                </div>
                <button type="button" class="btn-dismiss-alert icon-btn" data-alert-id="${escapeHtml(alert.id)}" title="Dismiss this alert" aria-label="Dismiss alert">
                  <i data-lucide="x" aria-hidden="true"></i>
                </button>
              </div>
            `
              )
              .join('')}
          </div>
        `
        }
      </div>
    </div>

    <!-- =====================================================================
         PHASE SIX: INTELLIGENT MONEY ALLOCATION ENGINE
         ===================================================================== -->
    <div class="card" style="margin-bottom: 24px;">
      <div class="card-header">
        <div>
          <h3 class="card-title">Intelligent Money Allocation</h3>
          <p class="card-subtitle">
            Algorithmic recommendation for your ${formatINR(avail.availableMoney)} available capital based on your risk profile.
          </p>
        </div>

        <!-- Risk Profile Switcher -->
        <div class="segmented-control" role="group" aria-label="Risk Preference">
          <button type="button" class="segment-btn ${selectedRisk === 'conservative' ? 'is-active' : ''}" data-risk="conservative">
            Conservative
          </button>
          <button type="button" class="segment-btn ${selectedRisk === 'moderate' ? 'is-active' : ''}" data-risk="moderate">
            Moderate
          </button>
          <button type="button" class="segment-btn ${selectedRisk === 'growth' ? 'is-active' : ''}" data-risk="growth">
            Growth
          </button>
        </div>
      </div>

      <div class="card-body">
        <!-- Live Color-Coded Multi-Segment Progress Bar -->
        <div class="allocation-bar-wrap">
          <div class="allocation-bar-header">
            <span style="font-size: 13px; font-weight: 600; color: var(--ink-primary);">Suggested Capital Allocation Breakdown</span>
            <span class="tabular-nums" style="font-size: 13px; color: var(--ink-secondary);">Total: ${formatINR(avail.availableMoney)}</span>
          </div>

          <div class="multi-segment-bar">
            ${allocation.recommendations
              .map((rec) => `<div class="bar-slice slice-${rec.categoryKey}" style="width: ${rec.percentage}%;" title="${rec.category}: ${rec.percentage}% (${formatINR(rec.amount)})"></div>`)
              .join('')}
          </div>

          <div class="allocation-legend-row">
            ${allocation.recommendations
              .map(
                (rec) => `
              <div class="allocation-legend-item">
                <span class="legend-swatch swatch-${rec.categoryKey}"></span>
                <span class="legend-label">${escapeHtml(rec.category)}</span>
                <span class="legend-val tabular-nums">${rec.percentage}% (${formatINR(rec.amount)})</span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <!-- 7-Point Educational Detail Cards -->
        <div class="recommendation-cards-grid">
          ${allocation.recommendations
            .map(
              (rec) => `
            <div class="recommendation-card">
              <div class="rec-card-header">
                <div class="rec-icon-box slice-${rec.categoryKey}">
                  <i data-lucide="${rec.icon}" aria-hidden="true"></i>
                </div>
                <div class="rec-title-group">
                  <h4 class="rec-title">${escapeHtml(rec.category)}</h4>
                  <span class="rec-badge ${rec.badgeClass}">${escapeHtml(rec.badge)}</span>
                </div>
                <div class="rec-amount-pill tabular-nums">
                  ${formatINR(rec.amount)}
                </div>
              </div>

              <div class="rec-card-body">
                <div class="rec-item">
                  <span class="rec-q">1. What should I do?</span>
                  <span class="rec-a">${escapeHtml(rec.whatToDo)}</span>
                </div>

                <div class="rec-item">
                  <span class="rec-q">2. Why is this suggested?</span>
                  <span class="rec-a">${escapeHtml(rec.whySuggested)}</span>
                </div>

                <div class="rec-item">
                  <span class="rec-q">3. Which goal does it support?</span>
                  <span class="rec-a">${escapeHtml(rec.goalSupported)}</span>
                </div>

                <div class="rec-item">
                  <span class="rec-q">4. What are the risks?</span>
                  <span class="rec-a">${escapeHtml(rec.risks)}</span>
                </div>

                <div class="rec-item">
                  <span class="rec-q">5. How easily can I access the money?</span>
                  <span class="rec-a">${escapeHtml(rec.liquidity)}</span>
                </div>

                <div class="rec-item">
                  <span class="rec-q">6. Key considerations before proceeding:</span>
                  <span class="rec-a">${escapeHtml(rec.considerations)}</span>
                </div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>

        <div class="fintech-disclaimer">
          <i data-lucide="info" aria-hidden="true"></i>
          <span>Educational Simulation: SpendWise Demo Bank allocations are mathematical suggestions to teach portfolio structure. No live trading, deposit execution, or market orders are performed.</span>
        </div>
      </div>
    </div>

    <!-- =====================================================================
         PHASE EIGHT: FINANCIAL GOAL TRACKER
         ===================================================================== -->
    <div class="card" style="margin-bottom: 24px;">
      <div class="card-header">
        <div>
          <h3 class="card-title">Financial Goal Tracker</h3>
          <p class="card-subtitle">Track targeted savings goals, funding milestones, and maturity dates.</p>
        </div>
        <button type="button" id="btn-add-goal" class="btn btn-primary btn-sm">
          <i data-lucide="plus" class="btn-icon" aria-hidden="true"></i>
          <span>Add Financial Goal</span>
        </button>
      </div>

      <div class="card-body">
        ${
          bankGoals.length === 0
            ? `
          <div class="empty-state">
            <div class="empty-icon-wrap">
              <i data-lucide="target" aria-hidden="true"></i>
            </div>
            <h4 class="empty-title">No financial goals created yet</h4>
            <p class="empty-desc">Create your first milestone (e.g. Emergency Fund, Laptop, Travel, Business Capital).</p>
          </div>
        `
            : `
          <div class="goals-grid">
            ${bankGoals
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
                      <span class="goal-target-date tabular-nums">Target: ${escapeHtml(formatDate(goal.target_date))}</span>
                    </div>
                    <div class="goal-actions">
                      <button type="button" class="btn-contribute-goal btn btn-secondary btn-sm" data-goal-id="${escapeHtml(goal.id)}" title="Contribute funds">
                        <i data-lucide="plus-circle" class="btn-icon" aria-hidden="true"></i>
                        <span>Add Funds</span>
                      </button>
                      <button type="button" class="icon-btn btn-edit-goal" data-goal-id="${escapeHtml(goal.id)}" title="Edit goal">
                        <i data-lucide="pencil" aria-hidden="true"></i>
                      </button>
                      <button type="button" class="icon-btn is-danger btn-delete-goal" data-goal-id="${escapeHtml(goal.id)}" title="Delete goal">
                        <i data-lucide="trash-2" aria-hidden="true"></i>
                      </button>
                    </div>
                  </div>

                  <div class="goal-progress-section">
                    <div class="goal-numbers-row">
                      <span class="goal-saved tabular-nums">${formatINR(current)}</span>
                      <span class="goal-pct tabular-nums">${pct}% funded</span>
                    </div>

                    <div class="progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
                      <div class="progress-fill ${pct >= 100 ? 'is-healthy' : 'is-primary'}" style="width: ${pct}%;"></div>
                    </div>

                    <div class="goal-footer-meta">
                      <span>Goal Target: <strong class="tabular-nums">${formatINR(target)}</strong></span>
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

    <!-- =====================================================================
         PHASE THREE: SIMULATED BANK TRANSACTIONS & DEMO GENERATOR
         ===================================================================== -->
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Demo Transaction Simulation Engine</h3>
          <p class="card-subtitle">Generate realistic banking deposits and debits to test balance calculations, overdraft protection, and alert generation.</p>
        </div>
        <button type="button" id="btn-custom-sim-tx" class="btn btn-primary btn-sm">
          <i data-lucide="plus" class="btn-icon" aria-hidden="true"></i>
          <span>Simulate Custom Transaction</span>
        </button>
      </div>

      <!-- Quick Action Simulation Buttons -->
      <div class="simulation-bar">
        <span class="simulation-bar-label">Quick Scenarios:</span>
        <button type="button" class="btn-quick-sim utility-btn" data-sim-type="salary">
          <i data-lucide="arrow-down-left" style="color: var(--status-income);" aria-hidden="true"></i>
          <span>+₹75,000 (Salary Deposit)</span>
        </button>
        <button type="button" class="btn-quick-sim utility-btn" data-sim-type="freelance">
          <i data-lucide="arrow-down-left" style="color: var(--status-income);" aria-hidden="true"></i>
          <span>+₹15,000 (Freelance Deposit)</span>
        </button>
        <button type="button" class="btn-quick-sim utility-btn" data-sim-type="shopping">
          <i data-lucide="arrow-up-right" style="color: var(--status-expense);" aria-hidden="true"></i>
          <span>−₹4,500 (Shopping Debit)</span>
        </button>
        <button type="button" class="btn-quick-sim utility-btn" data-sim-type="groceries">
          <i data-lucide="arrow-up-right" style="color: var(--status-expense);" aria-hidden="true"></i>
          <span>−₹2,800 (Groceries Debit)</span>
        </button>
        <button type="button" class="btn-quick-sim utility-btn" data-sim-type="bills">
          <i data-lucide="arrow-up-right" style="color: var(--status-expense);" aria-hidden="true"></i>
          <span>−₹3,200 (Utility Bill Debit)</span>
        </button>
      </div>

      <!-- Transaction Activity Table -->
      <div class="card-body">
        <div class="toolbar-grid" style="margin-bottom: 16px;">
          <div class="search-input-wrap">
            <i data-lucide="search" class="search-icon" aria-hidden="true"></i>
            <input
              type="search"
              id="bank-tx-search"
              class="form-input search-input"
              placeholder="Search description, category, or reference..."
              value="${escapeHtml(txSearchQuery)}"
              aria-label="Search bank transactions"
            />
          </div>

          <div class="segmented-control" role="group" aria-label="Filter transaction types">
            <button type="button" class="segment-btn ${activeTxFilter === 'all' ? 'is-active' : ''}" data-bank-filter="all">All</button>
            <button type="button" class="segment-btn ${activeTxFilter === 'credit' ? 'is-active' : ''}" data-bank-filter="credit">Deposits</button>
            <button type="button" class="segment-btn ${activeTxFilter === 'debit' ? 'is-active' : ''}" data-bank-filter="debit">Withdrawals</button>
          </div>
        </div>

        ${
          filteredTxs.length === 0
            ? `
          <div class="empty-state">
            <div class="empty-icon-wrap">
              <i data-lucide="receipt" aria-hidden="true"></i>
            </div>
            <h4 class="empty-title">No matching bank transactions</h4>
            <p class="empty-desc">Use the scenario buttons above to simulate deposits or withdrawals.</p>
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
                  <th class="text-right">SpendWise Ledger</th>
                </tr>
              </thead>
              <tbody>
                ${filteredTxs
                  .map((tx) => {
                    const isCredit = tx.type === 'credit';
                    return `
                    <tr>
                      <td>
                        <div class="tx-date tabular-nums">${escapeHtml(formatDate(tx.date))}</div>
                        <div class="bank-ref-tag monospace tabular-nums">${escapeHtml(tx.reference_no)}</div>
                      </td>
                      <td>
                        <div class="tx-title">${escapeHtml(tx.description)}</div>
                      </td>
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
                      <td class="text-right">
                        <button
                          type="button"
                          class="btn btn-secondary btn-sm btn-import-spendwise"
                          data-bank-tx-id="${escapeHtml(tx.id)}"
                          title="Import into SpendWise expense ledger (with duplicate detection)"
                        >
                          <i data-lucide="copy-plus" class="btn-icon" aria-hidden="true"></i>
                          <span>Import</span>
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
    </div>
  `;

  bindBankEvents(container, actions);
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Binds all interactive event handlers in the Smart Bank Connect view.
 */
function bindBankEvents(container, actions) {
  // 1. Refresh Button
  container.querySelector('#btn-bank-refresh')?.addEventListener('click', async () => {
    try {
      actions.showToast('Synchronizing SpendWise Demo Bank...');
      await refreshBankAccount();
      await renderBankView(container, null, actions);
      actions.showToast('Bank records up to date.');
    } catch (err) {
      actions.showToast(err.message, 'error');
    }
  });

  // 2. Toggle Disconnect / Reconnect
  const toggleBtn = container.querySelector('#btn-bank-toggle-connect');
  const bannerReconnectBtn = container.querySelector('#btn-bank-reconnect-banner');

  const handleToggle = async () => {
    try {
      const res = await toggleBankConnection();
      actions.showToast(res.message);
      await renderBankView(container, null, actions);
    } catch (err) {
      actions.showToast(err.message, 'error');
    }
  };

  toggleBtn?.addEventListener('click', handleToggle);
  bannerReconnectBtn?.addEventListener('click', handleToggle);

  // 3. Settings Modal Trigger
  container.querySelector('#btn-bank-settings')?.addEventListener('click', () => {
    openBankSettingsModal(actions);
  });

  // 4. Dismiss Alert Buttons
  container.querySelectorAll('.btn-dismiss-alert').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const alertId = btn.dataset.alertId;
      if (!alertId) return;
      try {
        await dismissAlert(alertId);
        dismissedAlertIds.push(alertId);
        actions.showToast('Alert dismissed.');
        renderBankContent(container, actions);
      } catch (err) {
        actions.showToast(err.message, 'error');
      }
    });
  });

  // 5. Risk Preference Switcher
  container.querySelectorAll('[data-risk]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      selectedRisk = btn.dataset.risk;
      try {
        await updateBankSettings({ risk_preference: selectedRisk });
        bankSettings.risk_preference = selectedRisk;
      } catch (e) {
        console.warn(e);
      }
      renderBankContent(container, actions);
    });
  });

  // 6. Quick Simulation Scenarios
  container.querySelectorAll('[data-sim-type]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.simType;
      const today = new Date().toISOString().slice(0, 10);
      let payload = null;

      if (type === 'salary') {
        payload = { type: 'credit', amount: 75000, category: 'Salary', description: 'Monthly Corporate Payroll - TechCorp Pvt Ltd', date: today };
      } else if (type === 'freelance') {
        payload = { type: 'credit', amount: 15000, category: 'Freelance & Consulting', description: 'Client Consulting Direct Deposit Milestone', date: today };
      } else if (type === 'shopping') {
        payload = { type: 'debit', amount: 4500, category: 'Shopping', description: 'Retail Apparel & Department Store Purchase', date: today };
      } else if (type === 'groceries') {
        payload = { type: 'debit', amount: 2800, category: 'Food & Groceries', description: 'Weekly Supermarket & Organic Pantry Refill', date: today };
      } else if (type === 'bills') {
        payload = { type: 'debit', amount: 3200, category: 'Utilities', description: 'Electricity & High-Speed Broadband Bill Payment', date: today };
      }

      if (payload) {
        try {
          const res = await createBankTransaction(payload);
          actions.showToast(res.message);
          await renderBankView(container, null, actions);
        } catch (err) {
          actions.showToast(err.message, 'error');
        }
      }
    });
  });

  // 7. Custom Simulation Modal Trigger
  container.querySelector('#btn-custom-sim-tx')?.addEventListener('click', () => {
    openCustomSimTxModal(actions, container);
  });

  // 8. Financial Goals: Add Goal Trigger
  container.querySelector('#btn-add-goal')?.addEventListener('click', () => {
    openGoalModal(null, actions, container);
  });

  // 9. Financial Goals: Edit Goal
  container.querySelectorAll('.btn-edit-goal').forEach((btn) => {
    btn.addEventListener('click', () => {
      const goal = bankGoals.find((g) => g.id === btn.dataset.goalId);
      if (goal) openGoalModal(goal, actions, container);
    });
  });

  // 10. Financial Goals: Delete Goal
  container.querySelectorAll('.btn-delete-goal').forEach((btn) => {
    btn.addEventListener('click', () => {
      const goal = bankGoals.find((g) => g.id === btn.dataset.goalId);
      if (!goal) return;
      actions.confirmAction({
        title: 'Delete Financial Goal',
        message: `Are you sure you want to delete "${goal.name}"? Saved funds will remain in your account.`,
        confirmLabel: 'Delete Goal',
        onConfirm: async () => {
          try {
            await deleteGoal(goal.id);
            actions.showToast('Goal deleted.');
            await renderBankView(container, null, actions);
          } catch (err) {
            actions.showToast(err.message, 'error');
          }
        },
      });
    });
  });

  // 11. Financial Goals: Contribute Funds
  container.querySelectorAll('.btn-contribute-goal').forEach((btn) => {
    btn.addEventListener('click', () => {
      const goal = bankGoals.find((g) => g.id === btn.dataset.goalId);
      if (goal) openContributeGoalModal(goal, actions, container);
    });
  });

  // 12. Search Input in Activity Table
  const searchInput = container.querySelector('#bank-tx-search');
  searchInput?.addEventListener('input', (e) => {
    txSearchQuery = e.target.value;
    renderBankContent(container, actions);
    const inputNow = container.querySelector('#bank-tx-search');
    if (inputNow) {
      inputNow.focus();
      const len = inputNow.value.length;
      inputNow.setSelectionRange(len, len);
    }
  });

  // 13. Transaction Type Segmented Filter
  container.querySelectorAll('[data-bank-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTxFilter = btn.dataset.bankFilter;
      renderBankContent(container, actions);
    });
  });

  // 14. Import to SpendWise Button
  container.querySelectorAll('.btn-import-spendwise').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const bankTxId = btn.dataset.bankTxId;
      if (!bankTxId) return;

      btn.disabled = true;
      try {
        const res = await importBankTxToSpendWise(bankTxId);
        actions.showToast(res.message);
        // Refresh active views
        await actions.refreshAll();
      } catch (err) {
        actions.showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });
}

/* ==========================================================================
   Modals Implementation for Demo Banking
   ========================================================================== */

function openBankSettingsModal(actions) {
  let modal = document.getElementById('bank-settings-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'bank-settings-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h2 class="modal-title">Bank Configuration & Risk Profile</h2>
        <button type="button" class="icon-btn btn-close-bank-modal" aria-label="Close modal">
          <i data-lucide="x" aria-hidden="true"></i>
        </button>
      </div>

      <form id="bank-settings-form" class="modal-form" novalidate>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Minimum Savings Balance (₹)</label>
            <input type="number" id="cfg-min-balance" class="form-input mono-input" min="0" step="500" value="${bankSettings.min_savings_balance}" required />
            <span class="field-error" id="err-cfg-min-balance"></span>
          </div>

          <div class="form-group">
            <label class="form-label">Monthly Spending Limit (₹)</label>
            <input type="number" id="cfg-spending-limit" class="form-input mono-input" min="0" step="500" value="${bankSettings.monthly_spending_limit}" required />
            <span class="field-error" id="err-cfg-spending-limit"></span>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Emergency Fund Target (₹)</label>
            <input type="number" id="cfg-emergency-target" class="form-input mono-input" min="0" step="1000" value="${bankSettings.emergency_fund_target}" required />
            <span class="field-error" id="err-cfg-emergency-target"></span>
          </div>

          <div class="form-group">
            <label class="form-label">Monthly Savings Target (₹)</label>
            <input type="number" id="cfg-savings-target" class="form-input mono-input" min="0" step="500" value="${bankSettings.monthly_savings_target}" required />
            <span class="field-error" id="err-cfg-savings-target"></span>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Upcoming Committed Expenses (₹)</label>
            <input type="number" id="cfg-commitments" class="form-input mono-input" min="0" step="500" value="${bankSettings.upcoming_commitments}" required />
            <span class="field-error" id="err-cfg-commitments"></span>
          </div>

          <div class="form-group">
            <label class="form-label">Outstanding Debt Obligations (₹)</label>
            <input type="number" id="cfg-debt" class="form-input mono-input" min="0" step="500" value="${bankSettings.debt_obligations}" required />
            <span class="field-error" id="err-cfg-debt"></span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Investment Risk Tolerance</label>
          <select id="cfg-risk" class="form-select">
            <option value="conservative" ${bankSettings.risk_preference === 'conservative' ? 'selected' : ''}>Conservative (Capital Preservation & FDs)</option>
            <option value="moderate" ${bankSettings.risk_preference === 'moderate' ? 'selected' : ''}>Moderate (Balanced Growth & FDs)</option>
            <option value="growth" ${bankSettings.risk_preference === 'growth' ? 'selected' : ''}>Growth (Equity Index Funds & Mutual Funds)</option>
          </select>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-close-bank-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Settings</button>
        </div>
      </form>
    </div>
  `;

  modal.hidden = false;
  if (window.lucide) window.lucide.createIcons();

  const close = () => { modal.hidden = true; };
  modal.querySelectorAll('.btn-close-bank-modal').forEach((b) => b.addEventListener('click', close));

  modal.querySelector('#bank-settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      min_savings_balance: Number(modal.querySelector('#cfg-min-balance').value),
      monthly_spending_limit: Number(modal.querySelector('#cfg-spending-limit').value),
      emergency_fund_target: Number(modal.querySelector('#cfg-emergency-target').value),
      monthly_savings_target: Number(modal.querySelector('#cfg-savings-target').value),
      upcoming_commitments: Number(modal.querySelector('#cfg-commitments').value),
      debt_obligations: Number(modal.querySelector('#cfg-debt').value),
      risk_preference: modal.querySelector('#cfg-risk').value,
    };

    try {
      const res = await updateBankSettings(payload);
      bankSettings = res.data;
      selectedRisk = bankSettings.risk_preference;
      actions.showToast(res.message || 'Settings updated.');
      close();
      const container = document.getElementById('view-bank');
      if (container) renderBankContent(container, actions);
    } catch (err) {
      actions.showToast(err.message, 'error');
    }
  });
}

function openCustomSimTxModal(actions, container) {
  let modal = document.getElementById('bank-custom-tx-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'bank-custom-tx-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h2 class="modal-title">Simulate Banking Transaction</h2>
        <button type="button" class="icon-btn btn-close-sim-modal" aria-label="Close modal">
          <i data-lucide="x" aria-hidden="true"></i>
        </button>
      </div>

      <form id="bank-custom-tx-form" class="modal-form" novalidate>
        <div class="form-group">
          <span class="form-label">Transaction Type</span>
          <div class="segmented-control" role="radiogroup">
            <button type="button" class="segment-btn is-active" data-sim-btn-type="debit">Withdrawal / Payment</button>
            <button type="button" class="segment-btn" data-sim-btn-type="credit">Deposit / Inflow</button>
          </div>
          <input type="hidden" id="sim-tx-type" value="debit" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Amount (₹)</label>
            <input type="number" id="sim-tx-amount" class="form-input mono-input" step="0.01" min="1" placeholder="0.00" required />
            <span class="field-error" id="err-sim-amount"></span>
          </div>

          <div class="form-group">
            <label class="form-label">Category</label>
            <select id="sim-tx-category" class="form-select" required>
              <option value="Shopping">Shopping</option>
              <option value="Food & Groceries">Food & Groceries</option>
              <option value="Utilities">Utilities</option>
              <option value="Housing">Housing</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Salary">Salary</option>
              <option value="Freelance & Consulting">Freelance & Consulting</option>
              <option value="Education">Education</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Date</label>
            <input type="date" id="sim-tx-date" class="form-input mono-input" value="${todayStr}" required />
          </div>

          <div class="form-group">
            <label class="form-label">Description</label>
            <input type="text" id="sim-tx-desc" class="form-input" placeholder="e.g. Dining out, Client invoice" required />
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-close-sim-modal">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-submit-sim">Process Simulation</button>
        </div>
      </form>
    </div>
  `;

  modal.hidden = false;
  if (window.lucide) window.lucide.createIcons();

  const close = () => { modal.hidden = true; };
  modal.querySelectorAll('.btn-close-sim-modal').forEach((b) => b.addEventListener('click', close));

  const typeInput = modal.querySelector('#sim-tx-type');
  modal.querySelectorAll('[data-sim-btn-type]').forEach((b) => {
    b.addEventListener('click', () => {
      modal.querySelectorAll('[data-sim-btn-type]').forEach((btn) => btn.classList.remove('is-active'));
      b.classList.add('is-active');
      typeInput.value = b.dataset.simBtnType;
    });
  });

  modal.querySelector('#bank-custom-tx-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amountVal = Number(modal.querySelector('#sim-tx-amount').value);
    const categoryVal = modal.querySelector('#sim-tx-category').value;
    const dateVal = modal.querySelector('#sim-tx-date').value;
    const descVal = modal.querySelector('#sim-tx-desc').value.trim() || `${categoryVal} payment`;

    if (!amountVal || amountVal <= 0) {
      modal.querySelector('#err-sim-amount').textContent = 'Please enter an amount greater than ₹0.00';
      return;
    }

    try {
      const res = await createBankTransaction({
        type: typeInput.value,
        amount: amountVal,
        category: categoryVal,
        date: dateVal,
        description: descVal,
      });
      actions.showToast(res.message);
      close();
      await renderBankView(container, null, actions);
    } catch (err) {
      actions.showToast(err.message, 'error');
    }
  });
}

function openGoalModal(existingGoal, actions, container) {
  let modal = document.getElementById('bank-goal-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'bank-goal-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const isEdit = Boolean(existingGoal && existingGoal.id);
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const defaultDate = nextYear.toISOString().slice(0, 10);

  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h2 class="modal-title">${isEdit ? 'Edit Financial Goal' : 'Create Financial Goal'}</h2>
        <button type="button" class="icon-btn btn-close-goal-modal" aria-label="Close modal">
          <i data-lucide="x" aria-hidden="true"></i>
        </button>
      </div>

      <form id="bank-goal-form" class="modal-form" novalidate>
        <div class="form-group">
          <label class="form-label">Goal Title</label>
          <input type="text" id="goal-name-input" class="form-input" placeholder="e.g. Emergency Fund, Laptop, Travel" value="${isEdit ? escapeHtml(existingGoal.name) : ''}" required />
          <span class="field-error" id="err-goal-name"></span>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Target Amount (₹)</label>
            <input type="number" id="goal-target-input" class="form-input mono-input" step="500" min="1" value="${isEdit ? existingGoal.target_amount : ''}" placeholder="100000" required />
            <span class="field-error" id="err-goal-target"></span>
          </div>

          <div class="form-group">
            <label class="form-label">Currently Saved (₹)</label>
            <input type="number" id="goal-current-input" class="form-input mono-input" step="500" min="0" value="${isEdit ? existingGoal.current_amount : '0'}" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Target Maturity Date</label>
            <input type="date" id="goal-date-input" class="form-input mono-input" value="${isEdit ? existingGoal.target_date : defaultDate}" required />
          </div>

          <div class="form-group">
            <label class="form-label">Category</label>
            <select id="goal-cat-input" class="form-select">
              <option value="emergency" ${isEdit && existingGoal.category === 'emergency' ? 'selected' : ''}>Emergency Safety</option>
              <option value="gadgets" ${isEdit && existingGoal.category === 'gadgets' ? 'selected' : ''}>Technology & Gadgets</option>
              <option value="travel" ${isEdit && existingGoal.category === 'travel' ? 'selected' : ''}>Travel & Leisure</option>
              <option value="business" ${isEdit && existingGoal.category === 'business' ? 'selected' : ''}>Business & Career</option>
              <option value="education" ${isEdit && existingGoal.category === 'education' ? 'selected' : ''}>Education</option>
              <option value="general" ${isEdit && existingGoal.category === 'general' ? 'selected' : ''}>General Goal</option>
            </select>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-close-goal-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Update Goal' : 'Save Goal'}</button>
        </div>
      </form>
    </div>
  `;

  modal.hidden = false;
  if (window.lucide) window.lucide.createIcons();

  const close = () => { modal.hidden = true; };
  modal.querySelectorAll('.btn-close-goal-modal').forEach((b) => b.addEventListener('click', close));

  modal.querySelector('#bank-goal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = modal.querySelector('#goal-name-input').value.trim();
    const target = Number(modal.querySelector('#goal-target-input').value);
    const current = Number(modal.querySelector('#goal-current-input').value) || 0;
    const date = modal.querySelector('#goal-date-input').value;
    const cat = modal.querySelector('#goal-cat-input').value;

    if (!name) {
      modal.querySelector('#err-goal-name').textContent = 'Please enter a goal title';
      return;
    }
    if (!target || target <= 0) {
      modal.querySelector('#err-goal-target').textContent = 'Please enter a target amount greater than ₹0';
      return;
    }

    try {
      if (isEdit) {
        await updateGoal(existingGoal.id, { name, target_amount: target, current_amount: current, target_date: date, category: cat });
        actions.showToast('Goal updated.');
      } else {
        await createGoal({ name, target_amount: target, current_amount: current, target_date: date, category: cat });
        actions.showToast('Financial goal created.');
      }
      close();
      await renderBankView(container, null, actions);
    } catch (err) {
      actions.showToast(err.message, 'error');
    }
  });
}

function openContributeGoalModal(goal, actions, container) {
  let modal = document.getElementById('bank-contribute-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'bank-contribute-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const remaining = Math.max(0, goal.target_amount - goal.current_amount);

  modal.innerHTML = `
    <div class="modal-card modal-card-sm">
      <div class="modal-header">
        <h2 class="modal-title">Contribute to Goal</h2>
        <button type="button" class="icon-btn btn-close-contrib" aria-label="Close modal">
          <i data-lucide="x" aria-hidden="true"></i>
        </button>
      </div>

      <form id="contrib-form" class="modal-form" novalidate>
        <p style="font-size: 13px; color: var(--ink-secondary); margin-bottom: 8px;">
          Add funds to <strong>${escapeHtml(goal.name)}</strong>. Remaining to reach target: <strong class="tabular-nums">${formatINR(remaining)}</strong>.
        </p>

        <div class="form-group">
          <label class="form-label">Contribution Amount (₹)</label>
          <input type="number" id="contrib-amount-input" class="form-input mono-input" step="100" min="1" placeholder="5000" required />
          <span class="field-error" id="err-contrib-amount"></span>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-close-contrib">Cancel</button>
          <button type="submit" class="btn btn-primary">Add Funds to Goal</button>
        </div>
      </form>
    </div>
  `;

  modal.hidden = false;
  if (window.lucide) window.lucide.createIcons();

  const close = () => { modal.hidden = true; };
  modal.querySelectorAll('.btn-close-contrib').forEach((b) => b.addEventListener('click', close));

  modal.querySelector('#contrib-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const addAmt = Number(modal.querySelector('#contrib-amount-input').value);
    if (!addAmt || addAmt <= 0) {
      modal.querySelector('#err-contrib-amount').textContent = 'Please enter an amount greater than ₹0';
      return;
    }

    try {
      const newCurrent = Math.round((Number(goal.current_amount || 0) + addAmt) * 100) / 100;
      await updateGoal(goal.id, { current_amount: newCurrent });
      actions.showToast(`Contributed ${formatINR(addAmt)} toward ${goal.name}!`);
      close();
      await renderBankView(container, null, actions);
    } catch (err) {
      actions.showToast(err.message, 'error');
    }
  });
}
