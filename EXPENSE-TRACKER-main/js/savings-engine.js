/**
 * savings-engine.js
 * Intelligent Savings & Allocation Guidance Engine for SpendWise Money Guardian.
 *
 * Implements:
 * 1. 5-Tier Allocation Priorities:
 *    - Priority 1: Essential Expenses
 *    - Priority 2: Emergency Reserve
 *    - Priority 3: High-Interest Debt Repayment
 *    - Priority 4: Short-Term Financial Goals
 *    - Priority 5: Long-Term Savings and Wealth Education
 * 2. Real-time recommendation generator with 5 fintech explanation points.
 * 3. Purely educational simulations without automatic market orders.
 */

/**
 * Generates personalized financial recommendations and actionable advice.
 * @param {object} params
 * @param {number} params.bankBalance - Current verified bank balance
 * @param {number} params.monthlyIncome - Configured monthly income
 * @param {number} params.dailySpending - Total debits today
 * @param {number} params.dailySafeAllowance - Safe daily spending allowance
 * @param {number} params.totalProtectedReserves - Total essential + emergency reserves
 * @param {number} params.emergencyReserveTarget - Emergency reserve target (e.g. 150000)
 * @param {number} params.emergencyReserveCurrent - Amount currently saved in emergency goal
 * @param {number} params.debtObligations - Monthly debt/EMI commitments
 * @param {Array<object>} params.goals - User's active savings goals
 * @param {Array<object>} params.bills - Active bills and subscriptions
 * @returns {Array<object>} List of prioritized savings recommendations
 */
export function generateGuardianSavingsRecommendations({
  bankBalance = 0,
  monthlyIncome = 500000,
  dailySpending = 0,
  dailySafeAllowance = 12000,
  totalProtectedReserves = 0,
  emergencyReserveTarget = 150000,
  emergencyReserveCurrent = 45000,
  debtObligations = 0,
  goals = [],
  bills = [],
}) {
  const recommendations = [];

  const balance = Math.max(0, Number(bankBalance) || 0);
  const emergencyTarget = Math.max(1, Number(emergencyReserveTarget) || 150000);
  const emergencySaved = Math.max(0, Number(emergencyReserveCurrent) || 0);
  const emergencyDeficit = Math.max(0, emergencyTarget - emergencySaved);

  const unpaidBillsTotal = bills
    .filter((b) => b.payment_status === 'unpaid' || b.payment_status === 'overdue')
    .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  // Available uncommitted capital
  const availableCapital = Math.max(0, balance - totalProtectedReserves - unpaidBillsTotal);

  // Subscription audit
  const subscriptionBills = bills.filter(
    (b) => (b.category && b.category.toLowerCase().includes('subscript')) || b.is_essential === 0
  );
  const totalSubscriptionMonthly = subscriptionBills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  // 1. PRIORITY 1: ESSENTIAL EXPENSES & BILLS REMINDER
  if (unpaidBillsTotal > 0) {
    recommendations.push({
      priority: 1,
      tier: 'ESSENTIALS',
      badge: 'Priority 1 · Essential Obligations',
      badgeClass: 'badge-critical',
      icon: 'shield-alert',
      category: 'Upcoming Essential Obligations',
      suggestedAmount: unpaidBillsTotal,
      whatToDo: `Keep ₹${unpaidBillsTotal.toLocaleString('en-IN')} segregated in your bank balance to cover upcoming bills and subscriptions.`,
      whySuggested: `You have ${bills.filter((b) => b.payment_status !== 'paid').length} active bills totaling ₹${unpaidBillsTotal.toLocaleString('en-IN')}. Ensuring liquidity prevents late fees and service interruptions.`,
      goalSupported: 'Debt-Free Operations & Continuous Essential Services',
      risks: 'Low risk. Keeping funds in your liquid savings account ensures zero market fluctuation.',
      restrictions: 'Do not allocate these funds to discretionary purchases or illiquid instruments until payments clear.',
    });
  }

  // 2. PRIORITY 2: EMERGENCY SAFETY RESERVE
  if (emergencyDeficit > 0) {
    const suggestedReserveAllocation = Math.min(
      emergencyDeficit,
      Math.max(5000, Math.round(availableCapital * 0.4))
    );

    recommendations.push({
      priority: 2,
      tier: 'EMERGENCY_FUND',
      badge: 'Priority 2 · Emergency Buffer',
      badgeClass: 'badge-warning',
      icon: 'shield-check',
      category: 'Emergency Safety Reserve',
      suggestedAmount: suggestedReserveAllocation,
      whatToDo: `Prioritize directing ₹${suggestedReserveAllocation.toLocaleString('en-IN')} into your liquid Emergency Reserve.`,
      whySuggested: `Your emergency reserve is currently ₹${emergencySaved.toLocaleString('en-IN')} out of your ₹${emergencyTarget.toLocaleString('en-IN')} milestone (₹${emergencyDeficit.toLocaleString('en-IN')} deficit). Financial planners recommend 3–6 months of essential living expenses.`,
      goalSupported: 'Emergency Safety Reserve',
      risks: 'Very low risk. Funds should reside in high-yield savings or overnight liquid deposits.',
      restrictions: 'Emergency funds must remain accessible within 24 hours and must not be used for lifestyle purchases.',
    });
  }

  // 3. PRIORITY 3: HIGH-INTEREST DEBT REPAYMENT
  if (debtObligations > 0) {
    recommendations.push({
      priority: 3,
      tier: 'DEBT_REDUCTION',
      badge: 'Priority 3 · Debt Management',
      badgeClass: 'badge-caution',
      icon: 'credit-card',
      category: 'Debt Principal Prepayment',
      suggestedAmount: debtObligations,
      whatToDo: `Ensure scheduled monthly EMI payments of ₹${debtObligations.toLocaleString('en-IN')} are fulfilled on time, and consider pre-paying high-cost obligations.`,
      whySuggested: `Debt service charges compound over time. Reducing principal early yields an effective guaranteed return equivalent to the loan interest rate.`,
      goalSupported: 'Debt Retirement & Credit Health',
      risks: 'Ensure prepayment does not incur excessive bank foreclosure penalties.',
      restrictions: 'Always prioritize high-interest debt (e.g. credit cards or personal loans) over low-cost secured loans.',
    });
  }

  // 4. PRIORITY 4: SHORT-TERM FINANCIAL GOALS
  const activeShortTermGoals = goals.filter(
    (g) => g.category !== 'emergency' && (Number(g.current_amount) || 0) < (Number(g.target_amount) || 0)
  );

  if (activeShortTermGoals.length > 0 && availableCapital > 0) {
    const primaryGoal = activeShortTermGoals[0];
    const goalRemaining = Math.max(0, Number(primaryGoal.target_amount) - Number(primaryGoal.current_amount));
    const alloc = Math.min(goalRemaining, Math.max(2000, Math.round(availableCapital * 0.3)));

    recommendations.push({
      priority: 4,
      tier: 'SHORT_TERM_GOAL',
      badge: 'Priority 4 · Goal Milestone',
      badgeClass: 'badge-progress',
      icon: 'target',
      category: primaryGoal.name,
      suggestedAmount: alloc,
      whatToDo: `Allocate ₹${alloc.toLocaleString('en-IN')} toward "${primaryGoal.name}".`,
      whySuggested: `This goal is ₹${(Number(primaryGoal.current_amount) || 0).toLocaleString('en-IN')} funded out of ₹${(Number(primaryGoal.target_amount) || 0).toLocaleString('en-IN')} (Target Date: ${primaryGoal.target_date}). Regular milestone funding maintains momentum without borrowing.`,
      goalSupported: primaryGoal.name,
      risks: 'Low to moderate. For goals with a horizon under 2 years, prefer Recurring Deposits (RD) or Short-Term Debt Funds.',
      restrictions: 'Keep goal savings segregated so they are not accidentally drawn down for daily retail purchases.',
    });
  }

  // 5. PRIORITY 5: LONG-TERM SAVINGS & WEALTH EDUCATION
  if (availableCapital > 10000 && emergencyDeficit <= emergencyTarget * 0.5) {
    const longTermAlloc = Math.round(availableCapital * 0.25);
    recommendations.push({
      priority: 5,
      tier: 'WEALTH_EDUCATION',
      badge: 'Priority 5 · Long-Term Growth',
      badgeClass: 'badge-success',
      icon: 'trending-up',
      category: 'Broad Market Index & Mutual Funds (SIP)',
      suggestedAmount: longTermAlloc,
      whatToDo: `Consider allocating ₹${longTermAlloc.toLocaleString('en-IN')} into systematic long-term wealth assets (e.g. Nifty 50 Index Funds or Balanced Advantage Funds).`,
      whySuggested: `You have secured your primary emergency safety net and upcoming bills. Systematic monthly investing harnesses compound growth to outpace inflation.`,
      goalSupported: 'Long-Term Financial Independence & Retirement',
      risks: 'Market risk applies. Equities fluctuate in the short term and require an investment horizon of 5+ years.',
      restrictions: 'Educational financial simulation only. No live brokerage trades or guarantees of capital preservation.',
    });
  }

  // 6. SUBSCRIPTION OPTIMIZATION CHECK
  if (totalSubscriptionMonthly > 2000) {
    recommendations.push({
      priority: 6,
      tier: 'EXPENSE_AUDIT',
      badge: 'Habit Optimization',
      badgeClass: 'badge-neutral',
      icon: 'scissors',
      category: 'Recurring Subscription Audit',
      suggestedAmount: totalSubscriptionMonthly,
      whatToDo: `Review your ${subscriptionBills.length} recurring subscriptions costing ₹${totalSubscriptionMonthly.toLocaleString('en-IN')}/month.`,
      whySuggested: `Recurring digital services often persist unnoticed. Pruning unused streaming apps or memberships could save up to ₹${(totalSubscriptionMonthly * 12).toLocaleString('en-IN')} annually.`,
      goalSupported: 'Cashflow Optimization',
      risks: 'None.',
      restrictions: 'Cancel or pause subscriptions directly with service providers.',
    });
  }

  // 7. DAILY OVERSPENDING WARNING RECOMMENDATION
  if (dailySpending > dailySafeAllowance) {
    const overage = dailySpending - dailySafeAllowance;
    recommendations.unshift({
      priority: 0,
      tier: 'DAILY_SPENDING_ALERT',
      badge: 'Action Needed · Overspending',
      badgeClass: 'badge-critical',
      icon: 'alert-triangle',
      category: 'Daily Spending Discipline',
      suggestedAmount: overage,
      whatToDo: `Pause non-essential discretionary purchases for the rest of today.`,
      whySuggested: `You have spent ₹${dailySpending.toLocaleString('en-IN')} today, exceeding your daily safe allowance of ₹${dailySafeAllowance.toLocaleString('en-IN')} by ₹${overage.toLocaleString('en-IN')}. Restricting discretionary expenses preserves tomorrow's allowance.`,
      goalSupported: 'Spending Guardrails & Monthly Budget Retention',
      risks: 'Risk of draining reserved emergency funds if overspending persists.',
      restrictions: 'Allow only emergency and essential bill payments today.',
    });
  }

  return recommendations;
}
