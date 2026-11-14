/**
 * spending-guard.js
 * Intelligent Overspending Detection & Configurable Spending Blocker.
 *
 * Implements:
 * 1. Daily threshold monitoring (50% progress, 80% caution, 100% limit reached, >100% overspending).
 * 2. Monthly discretionary monitoring with spending pace projection.
 * 3. Configurable Blocker Modes: 'warning' (alerts only) vs 'strict' (hard blocking).
 * 4. Essential Expense Exception (permits rent, utilities, food essentials, healthcare, insurance).
 * 5. Pre-transaction validation and explanation generation.
 */

export const ESSENTIAL_CATEGORIES = [
  'housing',
  'rent',
  'utilities',
  'electricity',
  'water',
  'internet',
  'broadband',
  'healthcare',
  'medical',
  'pharmacy',
  'insurance',
  'food essentials',
  'food & groceries',
  'groceries',
  'education',
  'tuition',
  'loan repayments',
  'loans & emis',
  'loan emi',
  'debt retirement',
];

/**
 * Checks whether a category is considered an essential expense obligation.
 * @param {string} category
 * @returns {boolean}
 */
export function isEssentialCategory(category) {
  if (!category) return false;
  const c = category.toLowerCase().trim();
  return ESSENTIAL_CATEGORIES.some((ec) => c.includes(ec) || ec.includes(c));
}

/**
 * Evaluates daily spending progress against threshold levels.
 * @param {number} dailyConsumptionPct
 * @param {number} spendingToday
 * @param {number} dailySafeAllowance
 * @returns {object} Status level, label, badge class, and message
 */
export function evaluateDailySpendingStatus(dailyConsumptionPct, spendingToday, dailySafeAllowance) {
  const pct = Number(dailyConsumptionPct) || 0;
  const spent = Number(spendingToday) || 0;
  const allowance = Number(dailySafeAllowance) || 0;
  const overspent = Math.max(0, spent - allowance);
  const remaining = Math.max(0, allowance - spent);

  if (pct > 100) {
    return {
      level: 'critical',
      code: 'OVERSPENDING',
      label: 'Daily Overspending Alert',
      badgeClass: 'badge-critical',
      color: 'var(--status-expense, #ef4444)',
      icon: 'alert-octagon',
      headline: 'Daily Safe Allowance Exceeded',
      message: `You have spent ₹${spent.toLocaleString('en-IN')}, exceeding your daily allowance of ₹${allowance.toLocaleString('en-IN')} by ₹${overspent.toLocaleString('en-IN')} (${pct}% consumed).`,
      overspent,
      remaining: 0,
      pct,
    };
  }

  if (pct >= 100) {
    return {
      level: 'warning',
      code: 'LIMIT_REACHED',
      label: '100% Daily Limit Reached',
      badgeClass: 'badge-warning',
      color: 'var(--status-warning, #f59e0b)',
      icon: 'alert-triangle',
      headline: 'Daily Spending Ceiling Reached',
      message: `You have reached exactly 100% of your daily allowance (₹${spent.toLocaleString('en-IN')}). Any additional discretionary purchases will breach your safe spending threshold.`,
      overspent: 0,
      remaining: 0,
      pct: 100,
    };
  }

  if (pct >= 80) {
    return {
      level: 'caution',
      code: 'CAUTION_80',
      label: '80% Spending Caution',
      badgeClass: 'badge-caution',
      color: '#f59e0b',
      icon: 'alert-circle',
      headline: 'Approaching Daily Spending Limit',
      message: `Caution: You have consumed ${pct}% of your daily allowance. Only ₹${remaining.toLocaleString('en-IN')} remains for discretionary spending today.`,
      overspent: 0,
      remaining,
      pct,
    };
  }

  if (pct >= 50) {
    return {
      level: 'progress',
      code: 'PROGRESS_50',
      label: '50% Spending Progress',
      badgeClass: 'badge-progress',
      color: 'var(--brand-accent, #3b82f6)',
      icon: 'info',
      headline: 'Halfway Through Daily Allowance',
      message: `You have used ${pct}% of your daily safe spending allowance. ₹${remaining.toLocaleString('en-IN')} remains available today.`,
      overspent: 0,
      remaining,
      pct,
    };
  }

  return {
    level: 'healthy',
    code: 'HEALTHY',
    label: 'Spending Healthy',
    badgeClass: 'badge-success',
    color: 'var(--status-income, #10b981)',
    icon: 'check-circle',
    headline: 'Within Safe Spending Limits',
    message: `You have spent ₹${spent.toLocaleString('en-IN')} (${pct}% of allowance). ₹${remaining.toLocaleString('en-IN')} remains available today.`,
    overspent: 0,
    remaining,
    pct,
  };
}

/**
 * Evaluates monthly spending pace and projects month-end spending.
 * @param {object} params
 * @param {number} params.withdrawalsThisMonth - Total spent to date this month
 * @param {number} params.monthlyBudget - Monthly spending budget/limit
 * @param {number} params.todayDay - Current calendar day (1-31)
 * @param {number} params.daysInMonth - Total days in calendar month
 * @returns {object} Monthly monitoring and projected outcome
 */
export function evaluateMonthlySpendingPace({
  withdrawalsThisMonth = 0,
  monthlyBudget = 40000,
  todayDay = 1,
  daysInMonth = 30,
}) {
  const spent = Math.max(0, Number(withdrawalsThisMonth) || 0);
  const budget = Math.max(1, Number(monthlyBudget) || 1);
  const day = Math.max(1, Number(todayDay) || 1);
  const totalDays = Math.max(1, Number(daysInMonth) || 30);

  const utilizationPct = Math.round((spent / budget) * 100);
  const remainingBudget = Math.max(0, budget - spent);

  // Actual daily burn rate so far
  const dailyBurnRate = spent / day;
  const projectedMonthEndSpending = Math.round(dailyBurnRate * totalDays * 100) / 100;
  const projectedVariance = projectedMonthEndSpending - budget;
  const isPaceExceedingBudget = projectedMonthEndSpending > budget;

  return {
    spent,
    budget,
    remainingBudget,
    utilizationPct,
    dailyBurnRate: Math.round(dailyBurnRate * 100) / 100,
    projectedMonthEndSpending,
    projectedVariance: Math.round(projectedVariance * 100) / 100,
    isPaceExceedingBudget,
    warning: isPaceExceedingBudget
      ? `At your current pace of ₹${Math.round(dailyBurnRate).toLocaleString('en-IN')}/day, projected month-end spending is ₹${projectedMonthEndSpending.toLocaleString('en-IN')}, exceeding your limit by ₹${Math.round(projectedVariance).toLocaleString('en-IN')}.`
      : `Spending pace is on track to stay within your monthly budget.`,
  };
}

/**
 * Evaluates whether a proposed transaction is permitted or should be blocked.
 * Handles both 'warning' and 'strict' modes with essential expense exceptions.
 * @param {object} params
 * @param {number} params.amount - Proposed transaction amount
 * @param {string} params.category - Transaction category
 * @param {string} [params.type='debit'] - 'credit' or 'debit'
 * @param {number} params.bankBalance - Current verified bank balance
 * @param {number} params.spendingToday - Debits spent today
 * @param {number} params.dailySafeAllowance - Daily safe allowance
 * @param {number} params.totalProtectedReserves - Total protected essential & emergency funds
 * @param {string} [params.mode='strict'] - 'warning' or 'strict'
 * @returns {object} Validation result
 */
export function validateTransactionDecision({
  amount,
  category = 'General',
  type = 'debit',
  bankBalance = 0,
  spendingToday = 0,
  dailySafeAllowance = 12000,
  totalProtectedReserves = 0,
  mode = 'strict',
}) {
  const numAmount = Number(amount) || 0;
  if (numAmount <= 0) {
    return { allowed: false, blocked: true, reason: 'Transaction amount must be greater than zero.' };
  }

  const isCredit = type === 'credit';
  if (isCredit) {
    return {
      allowed: true,
      blocked: false,
      mode,
      isCredit: true,
      reason: 'Deposit transaction confirmed. Funds will be added to the bank balance.',
    };
  }

  const isEssential = isEssentialCategory(category);

  // 1. Overdraft check (Always enforced regardless of mode or essential status)
  if (numAmount > bankBalance) {
    const shortfall = numAmount - bankBalance;
    return {
      allowed: false,
      blocked: true,
      mode,
      reason: `Overdraft Prevention: Purchase of ₹${numAmount.toLocaleString('en-IN')} exceeds available bank balance (₹${bankBalance.toLocaleString('en-IN')}) by ₹${shortfall.toLocaleString('en-IN')}.`,
      details: { bankBalance, shortfall, type: 'OVERDRAFT' },
    };
  }

  // 2. Essential Expense Exception
  if (isEssential) {
    return {
      allowed: true,
      blocked: false,
      mode,
      isEssential: true,
      reason: `Essential Expense Exception: "${category}" is recognized as a vital obligation and is approved against reserved funds.`,
    };
  }

  // 3. Strict Mode Check for Discretionary Spending
  if (mode === 'strict') {
    // Check A: Daily safe allowance
    const remainingDailyAllowance = Math.max(0, dailySafeAllowance - spendingToday);
    if (spendingToday + numAmount > dailySafeAllowance) {
      const excess = spendingToday + numAmount - dailySafeAllowance;
      return {
        allowed: false,
        blocked: true,
        mode: 'strict',
        reason: `Transaction blocked. You have only ₹${remainingDailyAllowance.toLocaleString('en-IN')} remaining in your daily spending allowance (purchase exceeds allowance by ₹${excess.toLocaleString('en-IN')}).`,
        details: {
          remainingDailyAllowance,
          excess,
          dailySafeAllowance,
          type: 'DAILY_ALLOWANCE_EXCEEDED',
        },
      };
    }

    // Check B: Protected funds breach
    const balanceAfter = bankBalance - numAmount;
    if (balanceAfter < totalProtectedReserves) {
      const breach = totalProtectedReserves - balanceAfter;
      return {
        allowed: false,
        blocked: true,
        mode: 'strict',
        reason: `Transaction blocked. This withdrawal would breach your protected essential and emergency reserves (₹${totalProtectedReserves.toLocaleString('en-IN')} protected).`,
        details: {
          totalProtectedReserves,
          balanceAfter,
          breach,
          type: 'PROTECTED_RESERVE_VIOLATION',
        },
      };
    }
  }

  // 4. Warning Mode: Check if allowance exceeded and attach warning message
  const isOverAllowance = spendingToday + numAmount > dailySafeAllowance;
  return {
    allowed: true,
    blocked: false,
    mode,
    isEssential: false,
    warning: isOverAllowance
      ? `Spending Caution: This purchase exceeds your safe daily allowance by ₹${(spendingToday + numAmount - dailySafeAllowance).toLocaleString('en-IN')}.`
      : null,
    reason: 'Transaction approved under spending guard parameters.',
  };
}
