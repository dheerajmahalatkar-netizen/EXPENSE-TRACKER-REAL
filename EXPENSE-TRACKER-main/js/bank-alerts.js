/**
 * bank-alerts.js
 * Phase 5: Smart Savings Alert Engine.
 * Analyzes bank activity, user thresholds, and historical spending patterns
 * to generate actionable financial alerts.
 */

import { formatINR } from './bank-service.js';

/**
 * Calculates active alerts based on account status, transaction history, and user settings.
 * @param {object} params
 * @param {object} params.account - Bank account data (balance, depositsThisMonth, withdrawalsThisMonth)
 * @param {Array<object>} params.transactions - List of bank transactions
 * @param {object} params.settings - Configured thresholds and goals
 * @param {Array<string>} [params.dismissedAlertIds] - Set of dismissed alert IDs
 * @returns {Array<object>} List of active alerts
 */
export function evaluateBankAlerts({ account, transactions = [], settings = {}, dismissedAlertIds = [] }) {
  if (!account || account.is_connected === 0) return [];

  const alerts = [];
  const dismissedSet = new Set(dismissedAlertIds);

  const balance = Number(account.balance) || 0;
  const withdrawalsThisMonth = Number(account.withdrawalsThisMonth) || 0;
  const depositsThisMonth = Number(account.depositsThisMonth) || 0;
  const netSavingsThisMonth = depositsThisMonth - withdrawalsThisMonth;

  const minBalance = Number(settings.min_savings_balance) || 25000;
  const spendingLimit = Number(settings.monthly_spending_limit) || 40000;
  const emergencyTarget = Number(settings.emergency_fund_target) || 100000;
  const savingsTarget = Number(settings.monthly_savings_target) || 20000;
  const upcomingCommitments = Number(settings.upcoming_commitments) || 10000;

  const todayStr = new Date().toISOString().slice(0, 10);

  // --------------------------------------------------------------------------
  // Alert A — Minimum Balance Breach
  // --------------------------------------------------------------------------
  if (balance < minBalance) {
    const alertId = 'alert_min_balance';
    if (!dismissedSet.has(alertId)) {
      alerts.push({
        id: alertId,
        title: 'Minimum Balance Breach',
        severity: 'critical',
        amount: formatINR(balance),
        reason: `Your current balance of ${formatINR(balance)} has dropped below your configured safety floor of ${formatINR(minBalance)}.`,
        recommendedAction: 'Halt non-essential withdrawals immediately and transfer emergency liquidity to restore your safety cushion.',
        date: todayStr,
      });
    }
  }

  // --------------------------------------------------------------------------
  // Alert C — Spending Limit Exceeded (takes precedence over Alert B)
  // --------------------------------------------------------------------------
  if (spendingLimit > 0 && withdrawalsThisMonth > spendingLimit) {
    const alertId = 'alert_spending_exceeded';
    const overage = withdrawalsThisMonth - spendingLimit;
    if (!dismissedSet.has(alertId)) {
      alerts.push({
        id: alertId,
        title: 'Monthly Spending Cap Exceeded',
        severity: 'critical',
        amount: formatINR(withdrawalsThisMonth),
        reason: `You have spent ${formatINR(withdrawalsThisMonth)} this month, exceeding your spending target of ${formatINR(spendingLimit)} by ${formatINR(overage)}.`,
        recommendedAction: 'Audit recent shopping or discretionary debits and pause non-urgent payments until next month.',
        date: todayStr,
      });
    }
  }
  // --------------------------------------------------------------------------
  // Alert B — 80% Spending Warning
  // --------------------------------------------------------------------------
  else if (spendingLimit > 0 && withdrawalsThisMonth >= 0.8 * spendingLimit) {
    const alertId = 'alert_spending_80pct';
    const pct = Math.round((withdrawalsThisMonth / spendingLimit) * 100);
    const remaining = spendingLimit - withdrawalsThisMonth;
    if (!dismissedSet.has(alertId)) {
      alerts.push({
        id: alertId,
        title: 'Approaching Monthly Spending Limit (80%+)',
        severity: 'warning',
        amount: formatINR(withdrawalsThisMonth),
        reason: `You have consumed ${pct}% of your monthly limit (${formatINR(withdrawalsThisMonth)} of ${formatINR(spendingLimit)}). Only ${formatINR(remaining)} remains.`,
        recommendedAction: 'Pace your discretionary purchases for the rest of the month to avoid overshooting your budget.',
        date: todayStr,
      });
    }
  }

  // --------------------------------------------------------------------------
  // Alert D — Emergency Reserve Warning
  // --------------------------------------------------------------------------
  const uncommittedBuffer = balance - upcomingCommitments;
  if (emergencyTarget > 0 && uncommittedBuffer < emergencyTarget) {
    const alertId = 'alert_emergency_deficit';
    const deficit = emergencyTarget - Math.max(0, uncommittedBuffer);
    if (!dismissedSet.has(alertId)) {
      alerts.push({
        id: alertId,
        title: 'Emergency Fund Below Target',
        severity: 'warning',
        amount: formatINR(deficit),
        reason: `Your uncommitted bank funds (${formatINR(Math.max(0, uncommittedBuffer))}) are ${formatINR(deficit)} short of your ${formatINR(emergencyTarget)} emergency target.`,
        recommendedAction: 'Direct any upcoming surplus or bonus allocations toward your Emergency Fund before taking on market investments.',
        date: todayStr,
      });
    }
  }

  // --------------------------------------------------------------------------
  // Alert E — Savings Target Achieved
  // --------------------------------------------------------------------------
  if (savingsTarget > 0 && netSavingsThisMonth >= savingsTarget) {
    const alertId = `alert_savings_achieved_${todayStr.slice(0, 7)}`;
    if (!dismissedSet.has(alertId)) {
      alerts.push({
        id: alertId,
        title: 'Monthly Savings Target Achieved! 🎉',
        severity: 'success',
        amount: formatINR(netSavingsThisMonth),
        reason: `You have retained a net savings of ${formatINR(netSavingsThisMonth)} this month, surpassing your target of ${formatINR(savingsTarget)}.`,
        recommendedAction: 'Excellent discipline! Review the Smart Money Action Center to allocate this surplus toward debt repayment or long-term growth.',
        date: todayStr,
      });
    }
  }

  // --------------------------------------------------------------------------
  // Alert F — Unusual Single Withdrawal
  // --------------------------------------------------------------------------
  const debitTxs = transactions.filter((t) => t.type === 'debit');
  if (debitTxs.length >= 3) {
    const totalDebits = debitTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const avgDebit = totalDebits / debitTxs.length;

    // Look at withdrawals from past 30 days
    const recentDebits = debitTxs.slice(0, 5);
    for (const tx of recentDebits) {
      const txAmt = Number(tx.amount) || 0;
      if (txAmt >= 2.5 * avgDebit && txAmt >= 5000) {
        const alertId = `alert_unusual_tx_${tx.id}`;
        if (!dismissedSet.has(alertId)) {
          alerts.push({
            id: alertId,
            title: 'Unusual High-Value Withdrawal',
            severity: 'warning',
            amount: formatINR(txAmt),
            reason: `Withdrawal of ${formatINR(txAmt)} for "${tx.description || tx.category}" on ${tx.date} is ${Math.round((txAmt / avgDebit) * 10) / 10}x higher than your average withdrawal (${formatINR(avgDebit)}).`,
            recommendedAction: 'Confirm this high-value debit was expected and adjust your remaining monthly allocation accordingly.',
            date: tx.date || todayStr,
          });
          break; // Show only the most prominent unusual withdrawal
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Alert G — Low Savings Rate Comparison
  // --------------------------------------------------------------------------
  if (transactions.length >= 6) {
    const curMonthKey = todayStr.slice(0, 7);
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const prevTxs = transactions.filter((t) => t.date && t.date.startsWith(prevMonthKey));
    const prevDeposits = prevTxs.filter((t) => t.type === 'credit').reduce((s, t) => s + Number(t.amount || 0), 0);
    const prevWithdrawals = prevTxs.filter((t) => t.type === 'debit').reduce((s, t) => s + Number(t.amount || 0), 0);

    if (prevDeposits > 0 && depositsThisMonth > 0) {
      const prevRate = Math.round(((prevDeposits - prevWithdrawals) / prevDeposits) * 100);
      const curRate = Math.round(((depositsThisMonth - withdrawalsThisMonth) / depositsThisMonth) * 100);

      if (prevRate > 15 && curRate < prevRate - 20) {
        const alertId = `alert_savings_rate_drop_${curMonthKey}`;
        if (!dismissedSet.has(alertId)) {
          alerts.push({
            id: alertId,
            title: 'Noticeable Savings Rate Decline',
            severity: 'info',
            amount: `${curRate}% vs ${prevRate}%`,
            reason: `Your savings rate of ${curRate}% this month is significantly lower than last month (${prevRate}%).`,
            recommendedAction: 'Check recurring subscriptions or discretionary categories to prevent unexpected savings erosion.',
            date: todayStr,
          });
        }
      }
    }
  }

  return alerts;
}
