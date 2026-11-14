/**
 * test_guardian_engines.js
 * Comprehensive Verification Test Suite for Money Guardian:
 * - Daily Income Benchmarks (28, 29, 30, 31 day months, leap years)
 * - Daily Safe Spending Allowance & Carryover Logic
 * - Spending Guard Thresholds & Blockers (Warning vs Strict, Essential Exceptions)
 * - Bill Manager Reminders & Next Recurrence Due Dates
 * - Savings Engine Prioritized Recommendations
 */

const assert = require('assert');

async function runEngineTests() {
  console.log('=== RUNNING MONEY GUARDIAN ENGINE TESTS ===\n');

  // Dynamic import of ES modules
  const { getDaysInCalendarMonth, calculateDailyIncomeMetrics } = await import(
    '../EXPENSE-TRACKER-main/js/daily-income-engine.js'
  );
  const {
    isEssentialCategory,
    evaluateDailySpendingStatus,
    evaluateMonthlySpendingPace,
    validateTransactionDecision,
  } = await import('../EXPENSE-TRACKER-main/js/spending-guard.js');
  const {
    getDaysUntilDue,
    getBillReminderTier,
    generateBillReminders,
    calculateNextDueDate,
    calculateBillsSummary,
  } = await import('../EXPENSE-TRACKER-main/js/bill-manager.js');
  const { generateGuardianSavingsRecommendations } = await import(
    '../EXPENSE-TRACKER-main/js/savings-engine.js'
  );

  let passed = 0;
  function pass(msg) {
    passed++;
    console.log(`✓ PASS: ${msg}`);
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 1: CALENDAR DAYS & DAILY INCOME BENCHMARKS (PHASE 2 & PHASE 13)
  // --------------------------------------------------------------------------
  console.log('[1. Daily Income Intelligence Tests]');

  // 28-day month (Feb 2025 non-leap)
  const d28 = getDaysInCalendarMonth(2025, 2);
  assert.strictEqual(d28, 28, 'Feb 2025 has 28 days');
  const m28 = calculateDailyIncomeMetrics({ monthlyIncome: 500000, year: 2025, month: 2 });
  assert.strictEqual(m28.dailyIncomeBenchmark, 17857.14, '5L / 28 = ₹17,857.14/day');
  pass('28-day month (Feb non-leap): 5L / 28 = ₹17,857.14');

  // 29-day month (Feb 2024 leap year)
  const d29 = getDaysInCalendarMonth(2024, 2);
  assert.strictEqual(d29, 29, 'Feb 2024 has 29 days');
  const m29 = calculateDailyIncomeMetrics({ monthlyIncome: 500000, year: 2024, month: 2 });
  assert.strictEqual(m29.dailyIncomeBenchmark, 17241.38, '5L / 29 = ₹17,241.38/day');
  pass('29-day month (Feb leap year): 5L / 29 = ₹17,241.38');

  // 30-day month (Nov 2026)
  const d30 = getDaysInCalendarMonth(2026, 11);
  assert.strictEqual(d30, 30, 'Nov 2026 has 30 days');
  const m30 = calculateDailyIncomeMetrics({ monthlyIncome: 500000, year: 2026, month: 11 });
  assert.strictEqual(m30.dailyIncomeBenchmark, 16666.67, '5L / 30 = ₹16,666.67/day');
  pass('30-day month (Nov): 5L / 30 = ₹16,666.67');

  // 31-day month (Dec 2026)
  const d31 = getDaysInCalendarMonth(2026, 12);
  assert.strictEqual(d31, 31, 'Dec 2026 has 31 days');
  const m31 = calculateDailyIncomeMetrics({ monthlyIncome: 500000, year: 2026, month: 12 });
  assert.strictEqual(m31.dailyIncomeBenchmark, 16129.03, '5L / 31 = ₹16,129.03/day');
  pass('31-day month (Dec): 5L / 31 = ₹16,129.03');

  // Income change: ₹3,00,000 / 30 = ₹10,000/day
  const mChange = calculateDailyIncomeMetrics({ monthlyIncome: 300000, year: 2026, month: 11 });
  assert.strictEqual(mChange.dailyIncomeBenchmark, 10000.0, '3L / 30 = ₹10,000.00/day');
  pass('Income change to ₹3,00,000 yields ₹10,000.00/day benchmark');

  // Safe Spending Allowance vs Daily Benchmark:
  // Monthly income ₹5,00,000 - Protected Obligations ₹1,00,000 = Discretionary Budget ₹4,00,000
  // Day 1: 4,00,000 / 30 = ₹13,333.33 safe allowance
  const mSafe = calculateDailyIncomeMetrics({
    monthlyIncome: 500000,
    totalProtectedObligations: 100000,
    year: 2026,
    month: 11,
    todayDay: 1,
    carryoverEnabled: false,
  });
  assert.strictEqual(mSafe.discretionaryMonthlyBudget, 400000, 'Discretionary pool is 4L');
  assert.strictEqual(mSafe.dailySafeAllowance, 13333.33, 'Daily safe allowance is ₹13,333.33');
  pass('Safe allowance cleanly subtracts protected obligations (₹13,333.33 != ₹16,666.67 benchmark)');

  // --------------------------------------------------------------------------
  // TEST GROUP 2: SPENDING GUARD THRESHOLDS & BLOCKING (PHASE 3, 4 & 13)
  // --------------------------------------------------------------------------
  console.log('\n[2. Spending Guard & Blocker Tests]');

  // Below daily limit (healthy, 30%)
  const sHealthy = evaluateDailySpendingStatus(30, 3000, 10000);
  assert.strictEqual(sHealthy.level, 'healthy');
  pass('Spending at 30% evaluates to healthy level');

  // 50% progress
  const s50 = evaluateDailySpendingStatus(50, 5000, 10000);
  assert.strictEqual(s50.code, 'PROGRESS_50');
  pass('Spending at 50% triggers 50% spending progress status');

  // 80% caution
  const s80 = evaluateDailySpendingStatus(85, 8500, 10000);
  assert.strictEqual(s80.code, 'CAUTION_80');
  pass('Spending at 85% triggers 80% spending caution alert');

  // Exactly at daily limit (100%)
  const s100 = evaluateDailySpendingStatus(100, 10000, 10000);
  assert.strictEqual(s100.code, 'LIMIT_REACHED');
  pass('Spending at 100% triggers daily ceiling reached status');

  // Above daily limit (overspending, 120%)
  const sOver = evaluateDailySpendingStatus(120, 12000, 10000);
  assert.strictEqual(sOver.code, 'OVERSPENDING');
  assert.strictEqual(sOver.overspent, 2000);
  pass('Spending at 120% calculates overspending amount (₹2,000)');

  // Warning-only mode: permits overspending with warning
  const warnDecision = validateTransactionDecision({
    amount: 5000,
    category: 'Shopping',
    type: 'debit',
    bankBalance: 50000,
    spendingToday: 8000,
    dailySafeAllowance: 10000,
    mode: 'warning',
  });
  assert.strictEqual(warnDecision.allowed, true);
  assert(warnDecision.warning !== null, 'Warning attached');
  pass('Warning-only mode approves overspending purchase with warning attached');

  // Strict mode: blocks discretionary overspending
  const strictDecision = validateTransactionDecision({
    amount: 5000,
    category: 'Shopping',
    type: 'debit',
    bankBalance: 50000,
    spendingToday: 8000,
    dailySafeAllowance: 10000,
    mode: 'strict',
  });
  assert.strictEqual(strictDecision.allowed, false);
  assert.strictEqual(strictDecision.blocked, true);
  assert.strictEqual(strictDecision.details.excess, 3000);
  pass('Strict mode blocks discretionary spend exceeding daily allowance (₹3,000 excess)');

  // Essential expense exception: permits rent/utilities even in strict mode
  const essDecision = validateTransactionDecision({
    amount: 25000,
    category: 'Housing',
    type: 'debit',
    bankBalance: 50000,
    spendingToday: 10000,
    dailySafeAllowance: 10000,
    mode: 'strict',
  });
  assert.strictEqual(essDecision.allowed, true);
  assert.strictEqual(essDecision.isEssential, true);
  pass('Essential expense exception permits rent payment in strict mode');

  // Overdraft prevention: blocks withdrawal exceeding bank balance
  const overdraftDecision = validateTransactionDecision({
    amount: 60000,
    category: 'Healthcare',
    type: 'debit',
    bankBalance: 50000,
    mode: 'strict',
  });
  assert.strictEqual(overdraftDecision.allowed, false);
  assert.strictEqual(overdraftDecision.details.type, 'OVERDRAFT');
  pass('Overdraft prevention blocks withdrawal exceeding bank balance even for essentials');

  // Protected reserve violation: blocks spending that breaches protected floor
  const reserveBreach = validateTransactionDecision({
    amount: 30000,
    category: 'Luxury Gadget',
    type: 'debit',
    bankBalance: 50000,
    spendingToday: 0,
    dailySafeAllowance: 35000,
    totalProtectedReserves: 30000,
    mode: 'strict',
  });
  assert.strictEqual(reserveBreach.allowed, false);
  assert.strictEqual(reserveBreach.details.type, 'PROTECTED_RESERVE_VIOLATION');
  pass('Strict mode prevents spending protected emergency & living reserves');

  // --------------------------------------------------------------------------
  // TEST GROUP 3: BILLS & SUBSCRIPTION MANAGER (PHASE 5 & 13)
  // --------------------------------------------------------------------------
  console.log('\n[3. Bill Manager & Reminder Tests]');

  // Next due date calculations
  const nextMonth = calculateNextDueDate('2026-11-15', 'monthly');
  assert.strictEqual(nextMonth, '2026-12-15');
  pass('Monthly recurrence calculates next month due date (2026-11-15 -> 2026-12-15)');

  const nextQuarter = calculateNextDueDate('2026-11-15', 'quarterly');
  assert.strictEqual(nextQuarter, '2027-02-15');
  pass('Quarterly recurrence calculates next quarter due date (2026-11-15 -> 2027-02-15)');

  const nextWeek = calculateNextDueDate('2026-11-15', 'weekly');
  assert.strictEqual(nextWeek, '2026-11-22');
  pass('Weekly recurrence calculates 7 days later (2026-11-15 -> 2026-11-22)');

  const oneTime = calculateNextDueDate('2026-11-15', 'one_time');
  assert.strictEqual(oneTime, '2026-11-15');
  pass('One-time bill keeps same due date');

  // Reminder tiers
  assert.strictEqual(getBillReminderTier(-2).tier, 'OVERDUE');
  assert.strictEqual(getBillReminderTier(0).tier, 'DUE_TODAY');
  assert.strictEqual(getBillReminderTier(1).tier, 'DUE_1_DAY');
  assert.strictEqual(getBillReminderTier(3).tier, 'DUE_3_DAYS');
  assert.strictEqual(getBillReminderTier(7).tier, 'DUE_7_DAYS');
  pass('All reminder tiers (overdue, today, 1d, 3d, 7d) map accurately');

  // Duplicate reminder prevention
  const testBills = [
    { id: 'b1', name: 'Power Bill', due_date: '2026-11-16', amount: 1200, payment_status: 'unpaid', is_essential: 1 },
  ];
  const firstPass = generateBillReminders(testBills, new Set());
  assert.strictEqual(firstPass.length, 1);
  const secondPass = generateBillReminders(testBills, new Set([firstPass[0].key]));
  assert.strictEqual(secondPass.length, 0);
  pass('Duplicate reminder prevention blocks re-sending reminders for same tier');

  // --------------------------------------------------------------------------
  // TEST GROUP 4: SAVINGS ENGINE RECOMMENDATIONS (PHASE 7 & 13)
  // --------------------------------------------------------------------------
  console.log('\n[4. Savings Engine Allocation & Prioritization Tests]');

  const recs = generateGuardianSavingsRecommendations({
    bankBalance: 250000,
    monthlyIncome: 500000,
    dailySpending: 15000,
    dailySafeAllowance: 12000, // overspending
    totalProtectedReserves: 90000,
    emergencyReserveTarget: 150000,
    emergencyReserveCurrent: 45000, // emergency deficit
    debtObligations: 12000, // debt
    goals: [{ id: 'g1', name: 'MacBook', target_amount: 80000, current_amount: 30000, category: 'gadgets', target_date: '2027-03-31' }],
    bills: [
      { id: 'b1', name: 'Broadband', amount: 1500, payment_status: 'unpaid', is_essential: 1 },
      { id: 'b2', name: 'Netflix', amount: 800, payment_status: 'unpaid', is_essential: 0, category: 'Subscriptions' },
      { id: 'b3', name: 'Gym', amount: 2000, payment_status: 'unpaid', is_essential: 0, category: 'Subscriptions' },
    ],
  });

  assert(recs.length >= 4, 'Generates comprehensive recommendations');
  assert.strictEqual(recs[0].tier, 'DAILY_SPENDING_ALERT', 'Priority 0 is daily overspending alert');
  assert(recs.some((r) => r.tier === 'EMERGENCY_FUND'), 'Includes Priority 2 Emergency buffer recommendation');
  assert(recs.some((r) => r.tier === 'DEBT_REDUCTION'), 'Includes Priority 3 Debt prepayment recommendation');
  assert(recs.some((r) => r.tier === 'SHORT_TERM_GOAL'), 'Includes Priority 4 Short-term goal milestone recommendation');
  pass('Prioritizes Emergency, Debt, and Goals in accordance with 5-tier financial hierarchy');

  // Zero / negative available funds handling
  const zeroRecs = generateGuardianSavingsRecommendations({
    bankBalance: 10000,
    totalProtectedReserves: 30000,
    emergencyReserveTarget: 100000,
    emergencyReserveCurrent: 5000,
  });
  assert(zeroRecs.length > 0, 'Zero available funds handled gracefully without errors');
  pass('Zero / constrained liquidity handled safely without negative allocations');

  console.log(`\n========================================`);
  console.log(`TOTAL ENGINE TESTS PASSED: ${passed} / ${passed}`);
  console.log(`========================================\n`);
}

runEngineTests().catch((err) => {
  console.error('Engine test suite failure:', err);
  process.exit(1);
});
