/**
 * daily-income-engine.js
 * Daily Income Intelligence Engine for SpendWise Money Guardian.
 *
 * Implements:
 * 1. Daily Income Benchmark = Monthly Income / Days in Month (supports 28, 29, 30, 31 day months).
 * 2. Daily Safe Spending Allowance = (Monthly Income - Essential Obligations - Debt - Savings) / Days.
 * 3. Carryover Logic for unused daily allowance.
 * 4. Daily spending, remaining allowance, overspending amount, and consumption percentage.
 */

/**
 * Returns number of calendar days in a given month.
 * Handles leap years properly (e.g. Feb 2024 has 29 days, Feb 2025 has 28 days).
 * @param {number} year - Full year (e.g. 2026)
 * @param {number} month - 1-indexed month (1 = Jan, 12 = Dec)
 * @returns {number} Days in month (28, 29, 30, or 31)
 */
export function getDaysInCalendarMonth(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!y || !m || m < 1 || m > 12) {
    return 30; // sensible default
  }
  return new Date(y, m, 0).getDate();
}

/**
 * Calculates complete Daily Income Intelligence metrics.
 * @param {object} params
 * @param {number} params.monthlyIncome - Total monthly income (e.g. 500000)
 * @param {number} [params.year] - Current year (defaults to current system year)
 * @param {number} [params.month] - Current month (1-12, defaults to current month)
 * @param {number} [params.todayDay] - Current day of month (1-31, defaults to today)
 * @param {number} [params.totalProtectedObligations=0] - Total monthly reserved essentials + debt + emergency
 * @param {number} [params.spendingToday=0] - Total debits incurred today
 * @param {number} [params.spendingBeforeToday=0] - Total debits incurred this month before today
 * @param {boolean} [params.carryoverEnabled=true] - Whether unused daily allowance carries forward
 * @param {number} [params.dailySpendingCap=0] - Optional hard daily spending ceiling
 * @returns {object} Calculated daily income and safe allowance metrics
 */
export function calculateDailyIncomeMetrics({
  monthlyIncome = 500000,
  year = new Date().getFullYear(),
  month = new Date().getMonth() + 1,
  todayDay = new Date().getDate(),
  totalProtectedObligations = 0,
  spendingToday = 0,
  spendingBeforeToday = 0,
  carryoverEnabled = true,
  dailySpendingCap = 0,
}) {
  const income = Math.max(0, Number(monthlyIncome) || 0);
  const daysInMonth = getDaysInCalendarMonth(year, month);
  const safeDay = Math.min(Math.max(1, Number(todayDay) || 1), daysInMonth);
  const remainingDays = Math.max(1, daysInMonth - safeDay + 1);

  // A. DAILY INCOME BENCHMARK (Phase 2 - A)
  // Monthly income / Number of calendar days in selected month
  const dailyIncomeBenchmark = Math.round((income / daysInMonth) * 100) / 100;

  // B. DAILY SAFE SPENDING ALLOWANCE (Phase 2 - B)
  // (Monthly income - Essential obligations - Debt commitments - Planned savings) / applicable days
  const protectedObligations = Math.max(0, Number(totalProtectedObligations) || 0);
  const discretionaryMonthlyBudget = Math.max(0, income - protectedObligations);

  // Base daily allowance (if spread evenly across all days)
  const baseDailyAllowance = Math.round((discretionaryMonthlyBudget / daysInMonth) * 100) / 100;

  let dailySafeAllowance;
  if (carryoverEnabled) {
    // With carryover: remaining discretionary pool divided by remaining days
    const remainingDiscretionaryBudget = Math.max(0, discretionaryMonthlyBudget - spendingBeforeToday);
    dailySafeAllowance = Math.round((remainingDiscretionaryBudget / remainingDays) * 100) / 100;
  } else {
    dailySafeAllowance = baseDailyAllowance;
  }

  // Apply optional daily spending cap
  if (dailySpendingCap > 0 && dailySafeAllowance > dailySpendingCap) {
    dailySafeAllowance = dailySpendingCap;
  }

  // Today's consumption and allowance
  const spentToday = Math.max(0, Number(spendingToday) || 0);
  const remainingDailyAllowance = Math.max(0, Math.round((dailySafeAllowance - spentToday) * 100) / 100);
  const dailyOverspendingAmount = Math.max(0, Math.round((spentToday - dailySafeAllowance) * 100) / 100);

  const dailyConsumptionPct = dailySafeAllowance > 0
    ? Math.round((spentToday / dailySafeAllowance) * 100)
    : (spentToday > 0 ? 100 : 0);

  return {
    year,
    month,
    todayDay: safeDay,
    daysInMonth,
    remainingDays,
    monthlyIncome: income,
    dailyIncomeBenchmark,
    totalProtectedObligations: protectedObligations,
    discretionaryMonthlyBudget,
    baseDailyAllowance,
    dailySafeAllowance,
    carryoverEnabled: Boolean(carryoverEnabled),
    spendingToday: spentToday,
    remainingDailyAllowance,
    dailyOverspendingAmount,
    dailyConsumptionPct,
    isOverspent: spentToday > dailySafeAllowance,
  };
}
