/**
 * smart-allocation.js
 * Phase 6 & 7: Intelligent Money Allocation Engine & Action Center.
 * Computes available money, evaluates financial reserves and debts,
 * and recommends dynamic, risk-tailored educational allocations.
 */

import { formatINR } from './bank-service.js';

/**
 * Calculates Available Money for Allocation according to strict fintech safety rules.
 * @param {object} params
 * @param {number} params.balance - Current verified bank balance
 * @param {number} params.minBalance - User-defined minimum savings balance
 * @param {number} params.emergencyTarget - Emergency reserve target
 * @param {number} params.upcomingCommitments - Committed expenses due soon
 * @param {number} params.emergencyFundSaved - Amount already earmarked for emergency fund
 * @returns {{
 *   balance: number,
 *   protectedReserve: number,
 *   upcomingCommitments: number,
 *   minSavingsFloor: number,
 *   availableMoney: number,
 *   isLiquidityConstrained: boolean,
 *   explanation: string
 * }}
 */
export function calculateAvailableMoney({
  balance = 0,
  minBalance = 25000,
  emergencyTarget = 100000,
  upcomingCommitments = 10000,
  emergencyFundSaved = 0,
}) {
  const verifiedBalance = Math.max(0, Number(balance) || 0);
  const minFloor = Math.max(0, Number(minBalance) || 0);
  const commitments = Math.max(0, Number(upcomingCommitments) || 0);
  const targetEmergency = Math.max(0, Number(emergencyTarget) || 0);
  const currentEmergency = Math.max(0, Number(emergencyFundSaved) || 0);

  // Prevent double-counting: the protected emergency reserve is the portion
  // of the emergency fund target that is still unfunded, but capped to what the account holds
  const emergencyDeficit = Math.max(0, targetEmergency - currentEmergency);
  const protectedEmergency = Math.min(verifiedBalance, Math.max(minFloor, emergencyDeficit * 0.4));

  // Available money calculation:
  // Available = Verified Balance - Protected Reserve - Committed Expenses
  const rawAvailable = verifiedBalance - protectedEmergency - commitments;
  const availableMoney = Math.max(0, Math.round(rawAvailable * 100) / 100);
  const isLiquidityConstrained = rawAvailable <= 0;

  let explanation = '';
  if (isLiquidityConstrained) {
    explanation = `Your available money is ${formatINR(0)}. With a balance of ${formatINR(verifiedBalance)}, safety reserves (${formatINR(protectedEmergency)}) and upcoming commitments (${formatINR(commitments)}) must take priority. Focus on capital protection and liquidity.`;
  } else {
    explanation = `You have ${formatINR(availableMoney)} in uncommitted available capital after safeguarding ${formatINR(protectedEmergency)} in emergency buffer and ${formatINR(commitments)} in committed upcoming bills.`;
  }

  return {
    balance: verifiedBalance,
    protectedReserve: protectedEmergency,
    upcomingCommitments: commitments,
    minSavingsFloor: minFloor,
    availableMoney,
    isLiquidityConstrained,
    explanation,
  };
}

/**
 * Generates dynamic educational allocations and detailed recommendations.
 * @param {object} params
 * @param {number} params.availableMoney - Total uncommitted funds
 * @param {object} params.settings - User bank settings and preferences
 * @param {Array<object>} params.goals - User financial goals
 * @param {number} params.currentBalance - Verified bank balance
 * @returns {object} Full allocation analysis and categorized recommendations
 */
export function generateAllocationStrategy({
  availableMoney = 0,
  settings = {},
  goals = [],
  currentBalance = 0,
}) {
  const available = Math.max(0, Number(availableMoney) || 0);
  const risk = ['conservative', 'moderate', 'growth'].includes(settings.risk_preference)
    ? settings.risk_preference
    : 'moderate';

  const debt = Math.max(0, Number(settings.debt_obligations) || 0);
  const emergencyTarget = Math.max(0, Number(settings.emergency_fund_target) || 100000);

  // Find emergency goal if any
  const emergencyGoal = goals.find((g) => g.category === 'emergency' || g.name.toLowerCase().includes('emergency'));
  const emergencySaved = emergencyGoal ? Number(emergencyGoal.current_amount) || 0 : 0;
  const isEmergencyUnderfunded = emergencySaved < emergencyTarget * 0.8;

  // Base Weights by Risk Preference
  let weights = {
    emergency: 0.35,
    shortTermFD: 0.30,
    debtReduction: 0.00,
    personalGoals: 0.25,
    longTermGrowth: 0.10,
  };

  if (risk === 'conservative') {
    weights = {
      emergency: 0.40,
      shortTermFD: 0.35,
      debtReduction: 0.00,
      personalGoals: 0.20,
      longTermGrowth: 0.05,
    };
  } else if (risk === 'growth') {
    weights = {
      emergency: 0.20,
      shortTermFD: 0.15,
      debtReduction: 0.00,
      personalGoals: 0.25,
      longTermGrowth: 0.40,
    };
  }

  // If user has outstanding debt, reallocate 20% to Debt Acceleration
  if (debt > 0) {
    const debtShare = Math.min(0.25, Math.max(0.15, debt / (available * 2 || 1)));
    weights.debtReduction = debtShare;
    weights.shortTermFD = Math.max(0.05, weights.shortTermFD - debtShare * 0.6);
    weights.longTermGrowth = Math.max(0.05, weights.longTermGrowth - debtShare * 0.4);
  }

  // If Emergency Fund is severely underfunded (<50%), boost Emergency allocation
  if (isEmergencyUnderfunded) {
    const boost = 0.15;
    weights.emergency += boost;
    weights.longTermGrowth = Math.max(0.05, weights.longTermGrowth - boost);
  }

  // Normalize weights to sum exactly to 1.0
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(weights)) {
    weights[k] = weights[k] / totalWeight;
  }

  // Calculate suggested amounts
  const suggestedEmergency = Math.round(available * weights.emergency);
  const suggestedShortTerm = Math.round(available * weights.shortTermFD);
  const suggestedDebt = Math.round(available * weights.debtReduction);
  const suggestedGoals = Math.round(available * weights.personalGoals);
  const suggestedGrowth = available - (suggestedEmergency + suggestedShortTerm + suggestedDebt + suggestedGoals);

  // Recommendations with 7-Point Fintech Explanations
  const recommendations = [
    {
      id: 'rec_emergency',
      categoryKey: 'emergency',
      category: 'Emergency Safety Reserve',
      icon: 'shield-check',
      badge: 'High Priority',
      badgeClass: 'badge-critical',
      percentage: Math.round(weights.emergency * 100),
      amount: Math.max(0, suggestedEmergency),
      whatToDo: 'Direct this portion into your high-liquidity emergency safety reserve.',
      whySuggested: `Your emergency fund target is ${formatINR(emergencyTarget)}. Maintaining 3-6 months of essential living expenses shields you from unforeseen life events without forcing premature asset sales.`,
      goalSupported: 'Financial resilience and catastrophe prevention.',
      risks: 'Extremely low risk. Primary consideration is keeping pace with inflation.',
      liquidity: 'Immediate. Keep in liquid savings account or instant-access sweep-in FD.',
      considerations: 'Ensure funds are accessible 24/7 without lock-in penalties.',
    },
    {
      id: 'rec_short_term',
      categoryKey: 'shortTermFD',
      category: 'Fixed & Recurring Deposit (FD/RD)',
      icon: 'landmark',
      badge: 'Guaranteed Returns',
      badgeClass: 'badge-info',
      percentage: Math.round(weights.shortTermFD * 100),
      amount: Math.max(0, suggestedShortTerm),
      whatToDo: 'Deploy into safe, capital-protected term deposits (6 to 12 months duration).',
      whySuggested: 'Fixed Deposits offer guaranteed capital safety and predictable interest earnings for near-term commitments over 6 to 18 months.',
      goalSupported: 'Capital preservation and planned medium-term purchases.',
      risks: 'Zero capital loss risk in scheduled commercial banks. Premature withdrawal may incur a 0.5%–1% interest reduction penalty.',
      liquidity: 'T+1 business day withdrawal upon request.',
      considerations: 'Compare annual interest compounding and choose cumulative vs monthly payout based on tax bracket.',
    },
    ...(suggestedDebt > 0
      ? [
          {
            id: 'rec_debt',
            categoryKey: 'debtReduction',
            category: 'High-Interest Debt Prepayment',
            icon: 'badge-percent',
            badge: 'Guaranteed Return',
            badgeClass: 'badge-warning',
            percentage: Math.round(weights.debtReduction * 100),
            amount: Math.max(0, suggestedDebt),
            whatToDo: 'Prepay outstanding credit card balances or high-interest personal loans.',
            whySuggested: `You have ${formatINR(debt)} in outstanding liabilities. Eliminating an 18%-36% annual interest charge is mathematically equivalent to achieving a guaranteed, tax-free return equal to that interest rate.`,
            goalSupported: 'Debt-free solvency and cash flow restoration.',
            risks: 'None. Every rupee of debt repaid eliminates future interest drag.',
            liquidity: 'Permanent liability reduction; money cannot be re-withdrawn.',
            considerations: 'Confirm loan prepayment terms with the lender to ensure no foreclosure fees apply.',
          },
        ]
      : []),
    {
      id: 'rec_personal_goals',
      categoryKey: 'personalGoals',
      category: 'Personal Financial Goals',
      icon: 'target',
      badge: 'Goal Progress',
      badgeClass: 'badge-primary',
      percentage: Math.round(weights.personalGoals * 100),
      amount: Math.max(0, suggestedGoals),
      whatToDo: 'Distribute across your active goal buckets (tech, education, travel, or business capital).',
      whySuggested: goals.length > 0
        ? `You have ${goals.length} active financial targets. Consistent periodic contributions accelerate achieving your milestones on schedule.`
        : 'Set dedicated milestones for future purchases to eliminate the temptation of unbudgeted discretionary spending.',
      goalSupported: goals.length > 0 ? goals.map((g) => g.name).slice(0, 2).join(', ') : 'Personal milestones.',
      risks: 'Depends on where goal money is parked. Keep short-term targets in liquid instruments.',
      liquidity: 'Configurable according to your milestone target dates.',
      considerations: 'Assign higher monthly allocations to goals maturing within the next 3 to 6 months.',
    },
    {
      id: 'rec_long_term',
      categoryKey: 'longTermGrowth',
      category: 'Long-Term Wealth Education (Index & Mutual Funds)',
      icon: 'trending-up',
      badge: `${risk.toUpperCase()} Profile`,
      badgeClass: 'badge-success',
      percentage: Math.round(weights.longTermGrowth * 100),
      amount: Math.max(0, suggestedGrowth),
      whatToDo: 'Explore disciplined, long-horizon investing in diversified equity index funds or mutual funds.',
      whySuggested: `For a ${risk} investor with an investment horizon beyond 5 years, diversified index funds historically beat consumer inflation through the power of compounding.`,
      goalSupported: 'Long-term wealth creation, retirement, and inflation beating.',
      risks: 'High volatility in the short run. Capital can fluctuate during market downturns. Never invest money needed within 3 years.',
      liquidity: 'Redeemable in T+2 business days, but premature redemption during market dips can crystallize temporary paper losses.',
      considerations: 'Understand asset allocation, rupee-cost averaging via SIP, and personal risk tolerance before entering markets.',
    },
  ];

  return {
    availableMoney: available,
    riskPreference: risk,
    weights,
    recommendations,
  };
}

/**
 * Produces contextual messages and priority financial action advice for the Action Center.
 * @param {object} params
 * @returns {{ headline: string, message: string, bannerClass: string, icon: string, actionLabel: string, actionView?: string }}
 */
export function getSmartActionCenterContext({
  balance = 0,
  minBalance = 25000,
  spendingLimit = 40000,
  withdrawalsThisMonth = 0,
  emergencyTarget = 100000,
  emergencySaved = 0,
  savingsTarget = 20000,
  netSavingsThisMonth = 0,
  debt = 0,
}) {
  if (balance < minBalance) {
    return {
      headline: 'Immediate Liquidity Protection Required',
      message: `Your bank balance of ${formatINR(balance)} is below your safety threshold of ${formatINR(minBalance)}. Pause non-essential withdrawals and avoid making any investment allocations until your cash buffer is restored.`,
      bannerClass: 'action-critical',
      icon: 'alert-octagon',
      actionLabel: 'Replenish Account Balance',
    };
  }

  if (spendingLimit > 0 && withdrawalsThisMonth > spendingLimit) {
    return {
      headline: 'Monthly Spending Cap Exceeded',
      message: `You have withdrawn ${formatINR(withdrawalsThisMonth)} this month against your target limit of ${formatINR(spendingLimit)}. Review discretionary categories and defer non-urgent shopping.`,
      bannerClass: 'action-critical',
      icon: 'alert-triangle',
      actionLabel: 'Audit Recent Debits',
    };
  }

  if (debt > 0) {
    return {
      headline: 'Prioritize High-Interest Debt Repayment',
      message: `You have ${formatINR(debt)} in outstanding debt obligations. Prepaying high-cost liabilities yields a guaranteed financial return equal to the interest saved.`,
      bannerClass: 'action-warning',
      icon: 'badge-percent',
      actionLabel: 'Review Debt Allocation',
    };
  }

  if (emergencyTarget > 0 && emergencySaved < emergencyTarget * 0.75) {
    return {
      headline: 'Build Your Emergency Safety Reserve',
      message: `Your emergency reserve has reached ${formatINR(emergencySaved)} of your ${formatINR(emergencyTarget)} target. Channel available surplus to complete your foundation before expanding market exposure.`,
      bannerClass: 'action-warning',
      icon: 'shield-alert',
      actionLabel: 'Boost Emergency Fund',
    };
  }

  if (savingsTarget > 0 && netSavingsThisMonth >= savingsTarget) {
    return {
      headline: 'Monthly Savings Target Achieved! 🎉',
      message: `Outstanding discipline! You have retained ${formatINR(netSavingsThisMonth)} net savings this month. You are in a prime financial position to deploy capital toward long-term goals.`,
      bannerClass: 'action-success',
      icon: 'check-circle-2',
      actionLabel: 'Explore Allocation Plan',
    };
  }

  return {
    headline: 'Healthy Financial Trajectory',
    message: 'Your bank balance is robust, spending is on track, and emergency buffers are active. Review the suggested allocation below to optimize your surplus cash.',
    bannerClass: 'action-healthy',
    icon: 'sparkles',
    actionLabel: 'View Allocation Plan',
  };
}
