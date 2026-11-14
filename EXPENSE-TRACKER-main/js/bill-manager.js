/**
 * bill-manager.js
 * Bill and Subscription Manager for SpendWise Money Guardian.
 *
 * Implements:
 * 1. Tracking of recurring bills and subscriptions.
 * 2. Reminder schedule: 7 days, 3 days, 1 day before due date, on due date, overdue.
 * 3. Prevention of duplicate reminders for the same period.
 * 4. Upcoming bills aggregation and committed funds calculation.
 * 5. Automatic next due date generation upon payment.
 */

/**
 * Calculates days remaining until bill due date (negative if overdue).
 * @param {string} dueDateStr - YYYY-MM-DD
 * @returns {number} Days difference
 */
export function getDaysUntilDue(dueDateStr) {
  if (!dueDateStr) return 0;
  const [y, m, d] = dueDateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = target.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Evaluates the reminder tier for a bill based on due date distance.
 * @param {number} diffDays
 * @returns {object|null} Reminder definition or null
 */
export function getBillReminderTier(diffDays) {
  if (diffDays < 0) {
    return {
      tier: 'OVERDUE',
      label: 'Overdue',
      badgeClass: 'badge-critical',
      severity: 'critical',
      daysAgo: Math.abs(diffDays),
      message: `Overdue by ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'day' : 'days'}!`,
    };
  }

  if (diffDays === 0) {
    return {
      tier: 'DUE_TODAY',
      label: 'Due Today',
      badgeClass: 'badge-critical',
      severity: 'critical',
      message: 'Due today! Please confirm payment.',
    };
  }

  if (diffDays === 1) {
    return {
      tier: 'DUE_1_DAY',
      label: 'Due Tomorrow',
      badgeClass: 'badge-warning',
      severity: 'warning',
      message: 'Due tomorrow! Funds should be ready.',
    };
  }

  if (diffDays <= 3) {
    return {
      tier: 'DUE_3_DAYS',
      label: `Due in ${diffDays} Days`,
      badgeClass: 'badge-warning',
      severity: 'warning',
      message: `Due in ${diffDays} days.`,
    };
  }

  if (diffDays <= 7) {
    return {
      tier: 'DUE_7_DAYS',
      label: `Due in ${diffDays} Days`,
      badgeClass: 'badge-info',
      severity: 'info',
      message: `Due in ${diffDays} days.`,
    };
  }

  return {
    tier: 'UPCOMING',
    label: `Due in ${diffDays} Days`,
    badgeClass: 'badge-neutral',
    severity: 'info',
    message: `Due on schedule.`,
  };
}

/**
 * Generates non-duplicate reminder notifications for an active bill list.
 * @param {Array<object>} bills
 * @param {Set<string>|Array<string>} [dismissedOrSentKeys]
 * @returns {Array<object>}
 */
export function generateBillReminders(bills, dismissedOrSentKeys = new Set()) {
  const sentKeys = dismissedOrSentKeys instanceof Set ? dismissedOrSentKeys : new Set(dismissedOrSentKeys);
  const reminders = [];

  for (const bill of bills) {
    if (bill.payment_status === 'paid') continue;

    const diffDays = getDaysUntilDue(bill.due_date);
    const tier = getBillReminderTier(diffDays);
    if (!tier || tier.tier === 'UPCOMING') continue;

    const reminderKey = `bill_${bill.id}_${tier.tier}_${bill.due_date}`;
    if (sentKeys.has(reminderKey)) continue;

    reminders.push({
      key: reminderKey,
      billId: bill.id,
      billName: bill.name,
      category: bill.category,
      amount: bill.amount,
      dueDate: bill.due_date,
      diffDays,
      tier: tier.tier,
      severity: tier.severity,
      badgeClass: tier.badgeClass,
      title: `${bill.name}: ${tier.label}`,
      message: `Bill of ₹${Number(bill.amount).toLocaleString('en-IN')} for ${bill.name} is ${tier.message}`,
      isEssential: bill.is_essential === 1,
    });
  }

  // Sort: Overdue first, then due today, 1 day, etc.
  return reminders.sort((a, b) => a.diffDays - b.diffDays);
}

/**
 * Calculates next due date for recurring bills.
 * @param {string} currentDueDateStr - YYYY-MM-DD
 * @param {string} recurrence - 'weekly', 'monthly', 'quarterly', 'annual', 'one_time'
 * @returns {string} Next due date (YYYY-MM-DD)
 */
export function calculateNextDueDate(currentDueDateStr, recurrence = 'monthly') {
  if (recurrence === 'one_time') return currentDueDateStr;
  const [y, m, d] = currentDueDateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);

  if (recurrence === 'weekly') {
    date.setDate(date.getDate() + 7);
  } else if (recurrence === 'monthly') {
    date.setMonth(date.getMonth() + 1);
  } else if (recurrence === 'quarterly') {
    date.setMonth(date.getMonth() + 3);
  } else if (recurrence === 'annual') {
    date.setFullYear(date.getFullYear() + 1);
  }

  const nextY = date.getFullYear();
  const nextM = String(date.getMonth() + 1).padStart(2, '0');
  const nextD = String(date.getDate()).padStart(2, '0');
  return `${nextY}-${nextM}-${nextD}`;
}

/**
 * Aggregates summary statistics for bills.
 * @param {Array<object>} bills
 * @returns {object}
 */
export function calculateBillsSummary(bills) {
  let totalCommitted = 0;
  let essentialTotal = 0;
  let discretionaryTotal = 0;
  let unpaidCount = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let dueWithin7DaysAmount = 0;
  let dueWithin7DaysCount = 0;

  for (const b of bills) {
    const isUnpaid = b.payment_status === 'unpaid' || b.payment_status === 'overdue';
    if (!isUnpaid) continue;

    const amt = Number(b.amount) || 0;
    const diff = getDaysUntilDue(b.due_date);

    totalCommitted += amt;
    unpaidCount++;

    if (b.is_essential === 1) {
      essentialTotal += amt;
    } else {
      discretionaryTotal += amt;
    }

    if (diff < 0) {
      overdueCount++;
      overdueAmount += amt;
    } else if (diff <= 7) {
      dueWithin7DaysCount++;
      dueWithin7DaysAmount += amt;
    }
  }

  return {
    totalCommitted: Math.round(totalCommitted * 100) / 100,
    essentialTotal: Math.round(essentialTotal * 100) / 100,
    discretionaryTotal: Math.round(discretionaryTotal * 100) / 100,
    unpaidCount,
    overdueCount,
    overdueAmount: Math.round(overdueAmount * 100) / 100,
    dueWithin7DaysCount,
    dueWithin7DaysAmount: Math.round(dueWithin7DaysAmount * 100) / 100,
  };
}
