const db = require('../config/database');

const DEMO_ACCOUNT_ID = 'demo_acc_4821';

// Essential category mapping for exceptions
const ESSENTIAL_CATEGORIES = [
  'housing',
  'utilities',
  'healthcare',
  'insurance',
  'food & groceries',
  'food essentials',
  'education',
  'loans & emis',
  'loan repayments',
];

function isCategoryEssential(category) {
  if (!category) return false;
  const c = category.toLowerCase().trim();
  return ESSENTIAL_CATEGORIES.some((ec) => c.includes(ec) || ec.includes(c));
}

function getDaysInMonth(year, month) {
  // month is 1-indexed (1 = Jan, 12 = Dec)
  return new Date(year, month, 0).getDate();
}

function calculateAccountBalance(accountId) {
  const account = db.prepare('SELECT initial_balance FROM bank_accounts WHERE id = ?').get(accountId);
  if (!account) return 0;

  const sums = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS total_credits,
      COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) AS total_debits
    FROM bank_transactions
    WHERE account_id = ?
  `).get(accountId);

  const balance = account.initial_balance + sums.total_credits - sums.total_debits;
  return Math.round(balance * 100) / 100;
}

/**
 * Calculates daily income metrics, daily safe spending allowance,
 * protected funds, and current spending pace.
 */
function computeFinancialIntelligence(accountId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const todayDay = now.getDate();
  const daysInMonth = getDaysInMonth(year, month);
  const remainingDays = Math.max(1, daysInMonth - todayDay + 1);

  const curMonthKey = `${year}-${String(month).padStart(2, '0')}`;
  const todayKey = `${curMonthKey}-${String(todayDay).padStart(2, '0')}`;

  // 1. Fetch Guardian Settings
  let settings = db.prepare('SELECT * FROM guardian_settings WHERE account_id = ?').get(accountId);
  if (!settings) {
    db.prepare(`
      INSERT INTO guardian_settings (account_id, monthly_income, daily_allowance_carryover, spending_control_mode, daily_spending_cap, emergency_reserve_target)
      VALUES (?, 500000.00, 1, 'strict', 12000.00, 150000.00)
    `).run(accountId);
    settings = db.prepare('SELECT * FROM guardian_settings WHERE account_id = ?').get(accountId);
  }

  // 2. Fetch Bank Settings (debt obligations, etc.)
  const bankSettings = db.prepare('SELECT * FROM bank_settings WHERE account_id = ?').get(accountId) || {
    debt_obligations: 0,
    monthly_spending_limit: 40000,
  };

  // 3. Fetch Protected Reserves Total
  const reserves = db.prepare('SELECT * FROM protected_reserves WHERE account_id = ?').all(accountId);
  const totalProtectedReserves = reserves.reduce((sum, r) => sum + (Number(r.monthly_amount) || 0), 0);

  // 4. Daily Income Benchmark (Phase 2 - A)
  // Monthly income / Number of calendar days in selected month
  const monthlyIncome = Number(settings.monthly_income) || 500000;
  const dailyIncomeBenchmark = Math.round((monthlyIncome / daysInMonth) * 100) / 100;

  // 5. Total Spent this month from transactions
  const monthTxStats = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS deposits_month,
      COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) AS withdrawals_month
    FROM bank_transactions
    WHERE account_id = ? AND date LIKE ?
  `).get(accountId, `${curMonthKey}%`);

  const depositsThisMonth = Math.round(monthTxStats.deposits_month * 100) / 100;
  const withdrawalsThisMonth = Math.round(monthTxStats.withdrawals_month * 100) / 100;

  // Today's spending
  const todayTxStats = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS deposits_today,
      COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) AS withdrawals_today
    FROM bank_transactions
    WHERE account_id = ? AND date = ?
  `).get(accountId, todayKey);

  const spendingToday = Math.round(todayTxStats.withdrawals_today * 100) / 100;
  const depositsToday = Math.round(todayTxStats.deposits_today * 100) / 100;

  // Spent before today this month
  const spendingBeforeToday = Math.max(0, withdrawalsThisMonth - spendingToday);

  // 6. Daily Safe Spending Allowance (Phase 2 - B)
  // Monthly income - Essential obligations - Debt commitments - Planned savings/emergency
  const debtObligations = Number(bankSettings.debt_obligations) || 0;
  const totalProtectedMonthlyObligations = totalProtectedReserves + debtObligations;
  const discretionaryMonthlyBudget = Math.max(0, monthlyIncome - totalProtectedMonthlyObligations);

  // Base daily allowance
  const baseDailyAllowance = Math.round((discretionaryMonthlyBudget / daysInMonth) * 100) / 100;

  // Carryover calculation
  let dailySafeAllowance;
  if (settings.daily_allowance_carryover === 1) {
    // Remaining discretionary budget divided by remaining days
    const remainingDiscretionaryBudget = Math.max(0, discretionaryMonthlyBudget - spendingBeforeToday);
    dailySafeAllowance = Math.round((remainingDiscretionaryBudget / remainingDays) * 100) / 100;
  } else {
    dailySafeAllowance = baseDailyAllowance;
  }

  // Ensure daily cap if configured and positive
  if (settings.daily_spending_cap > 0 && dailySafeAllowance > settings.daily_spending_cap) {
    dailySafeAllowance = settings.daily_spending_cap;
  }

  // Today's remaining allowance
  const remainingDailyAllowance = Math.max(0, Math.round((dailySafeAllowance - spendingToday) * 100) / 100);
  const dailyOverspendingAmount = Math.max(0, Math.round((spendingToday - dailySafeAllowance) * 100) / 100);
  const dailyConsumptionPct = dailySafeAllowance > 0
    ? Math.round((spendingToday / dailySafeAllowance) * 100)
    : 100;

  // 7. Monthly spending pace & projection
  // Projected month-end spending based on actual pace
  const dailyAvgSoFar = todayDay > 0 ? withdrawalsThisMonth / todayDay : 0;
  const projectedMonthEndSpending = Math.round(dailyAvgSoFar * daysInMonth * 100) / 100;

  // 8. Bills & Subscriptions Commitments
  const bills = db.prepare('SELECT * FROM bills_subscriptions WHERE account_id = ?').all(accountId);
  const unpaidBills = bills.filter((b) => b.payment_status === 'unpaid' || b.payment_status === 'overdue');
  const totalUnpaidBillsAmount = unpaidBills.reduce((sum, b) => sum + Number(b.amount), 0);

  // Upcoming in next 7 days
  const future7Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  const future7DaysStr = future7Days.toISOString().slice(0, 10);
  const upcomingBillsNext7Days = unpaidBills.filter((b) => b.due_date <= future7DaysStr);
  const upcomingBillsNext7DaysAmount = upcomingBillsNext7Days.reduce((sum, b) => sum + Number(b.amount), 0);

  // 9. Current Bank Balance & Available Discretionary Balance
  const bankBalance = calculateAccountBalance(accountId);
  const totalCommittedExpenses = totalProtectedReserves + totalUnpaidBillsAmount;
  const availableBalance = Math.max(0, Math.round((bankBalance - totalCommittedExpenses) * 100) / 100);

  // 10. Spending Status Threshold (Phase 3)
  let dailySpendingStatus = 'healthy';
  let spendingAlertMessage = null;

  if (dailyConsumptionPct >= 100) {
    dailySpendingStatus = 'overspending';
    spendingAlertMessage = `Daily limit reached! You have spent ₹${spendingToday.toLocaleString('en-IN')}, exceeding your safe daily allowance of ₹${dailySafeAllowance.toLocaleString('en-IN')} by ₹${dailyOverspendingAmount.toLocaleString('en-IN')}.`;
  } else if (dailyConsumptionPct >= 80) {
    dailySpendingStatus = 'caution';
    spendingAlertMessage = `Spending caution: 80%+ consumed. ₹${remainingDailyAllowance.toLocaleString('en-IN')} remains for today.`;
  } else if (dailyConsumptionPct >= 50) {
    dailySpendingStatus = 'progress';
    spendingAlertMessage = `Spending progress: 50% of today's safe allowance used.`;
  }

  return {
    year,
    month,
    todayDay,
    daysInMonth,
    remainingDays,
    todayKey,
    curMonthKey,
    monthlyIncome,
    dailyIncomeBenchmark,
    totalProtectedReserves,
    debtObligations,
    totalProtectedMonthlyObligations,
    discretionaryMonthlyBudget,
    baseDailyAllowance,
    dailySafeAllowance,
    spendingToday,
    depositsToday,
    spendingBeforeToday,
    remainingDailyAllowance,
    dailyOverspendingAmount,
    dailyConsumptionPct,
    dailySpendingStatus,
    spendingAlertMessage,
    depositsThisMonth,
    withdrawalsThisMonth,
    projectedMonthEndSpending,
    totalUnpaidBillsAmount,
    upcomingBillsNext7DaysCount: upcomingBillsNext7Days.length,
    upcomingBillsNext7DaysAmount,
    bankBalance,
    totalCommittedExpenses,
    availableBalance,
    spendingControlMode: settings.spending_control_mode,
    dailyAllowanceCarryover: settings.daily_allowance_carryover,
    dailySpendingCap: settings.daily_spending_cap,
    emergencyReserveTarget: settings.emergency_reserve_target,
  };
}

// GET /api/guardian/summary
function getGuardianSummary(req, res, next) {
  try {
    const intel = computeFinancialIntelligence(DEMO_ACCOUNT_ID);
    const unreadCountRow = db.prepare(
      'SELECT COUNT(*) as count FROM guardian_notifications WHERE account_id = ? AND is_read = 0'
    ).get(DEMO_ACCOUNT_ID);

    res.status(200).json({
      success: true,
      data: {
        ...intel,
        unreadNotificationsCount: unreadCountRow ? unreadCountRow.count : 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/guardian/settings
function getGuardianSettings(req, res, next) {
  try {
    const settings = db.prepare('SELECT * FROM guardian_settings WHERE account_id = ?').get(DEMO_ACCOUNT_ID);
    res.status(200).json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
}

// PUT /api/guardian/settings
function updateGuardianSettings(req, res, next) {
  try {
    const {
      monthly_income,
      daily_allowance_carryover,
      spending_control_mode,
      daily_spending_cap,
      emergency_reserve_target,
    } = req.body;

    const current = db.prepare('SELECT * FROM guardian_settings WHERE account_id = ?').get(DEMO_ACCOUNT_ID);
    if (!current) {
      return res.status(404).json({ success: false, error: 'Settings record not found' });
    }

    const updatedIncome = monthly_income !== undefined ? Number(monthly_income) : current.monthly_income;
    const updatedCarryover = daily_allowance_carryover !== undefined ? (daily_allowance_carryover ? 1 : 0) : current.daily_allowance_carryover;
    const updatedMode = spending_control_mode === 'warning' ? 'warning' : 'strict';
    const updatedCap = daily_spending_cap !== undefined ? Number(daily_spending_cap) : current.daily_spending_cap;
    const updatedEmergency = emergency_reserve_target !== undefined ? Number(emergency_reserve_target) : current.emergency_reserve_target;

    db.prepare(`
      UPDATE guardian_settings
      SET monthly_income = ?, daily_allowance_carryover = ?, spending_control_mode = ?, daily_spending_cap = ?, emergency_reserve_target = ?, updated_at = datetime('now')
      WHERE account_id = ?
    `).run(updatedIncome, updatedCarryover, updatedMode, updatedCap, updatedEmergency, DEMO_ACCOUNT_ID);

    const updated = db.prepare('SELECT * FROM guardian_settings WHERE account_id = ?').get(DEMO_ACCOUNT_ID);
    res.status(200).json({ success: true, message: 'Money Guardian settings updated successfully', data: updated });
  } catch (err) {
    next(err);
  }
}

// GET /api/guardian/reserves
function getProtectedReserves(req, res, next) {
  try {
    const reserves = db.prepare('SELECT * FROM protected_reserves WHERE account_id = ? ORDER BY monthly_amount DESC').all(DEMO_ACCOUNT_ID);

    // Calculate spent amount this month per reserve category
    const now = new Date();
    const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const enriched = reserves.map((r) => {
      // Find debits this month matching category name or keywords
      const spentRow = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) AS spent
        FROM bank_transactions
        WHERE account_id = ? AND type = 'debit' AND date LIKE ? AND (
          LOWER(category) LIKE ? OR LOWER(category) LIKE ? OR LOWER(description) LIKE ?
        )
      `).get(DEMO_ACCOUNT_ID, `${curMonthKey}%`, `%${r.category.toLowerCase()}%`, `%${r.name.toLowerCase()}%`, `%${r.name.toLowerCase()}%`);

      const spent = Math.round((spentRow ? spentRow.spent : 0) * 100) / 100;
      const remaining = Math.max(0, Math.round((r.monthly_amount - spent) * 100) / 100);

      return {
        ...r,
        spent_amount: spent,
        remaining_amount: remaining,
        is_depleted: spent >= r.monthly_amount && r.monthly_amount > 0,
      };
    });

    res.status(200).json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
}

// PUT /api/guardian/reserves/:id
function updateProtectedReserve(req, res, next) {
  try {
    const { id } = req.params;
    const { monthly_amount, notes } = req.body;

    const reserve = db.prepare('SELECT * FROM protected_reserves WHERE id = ? AND account_id = ?').get(id, DEMO_ACCOUNT_ID);
    if (!reserve) {
      return res.status(404).json({ success: false, error: 'Protected reserve category not found' });
    }

    const amt = monthly_amount !== undefined ? Number(monthly_amount) : reserve.monthly_amount;
    const n = notes !== undefined ? notes : reserve.notes;

    db.prepare(`
      UPDATE protected_reserves
      SET monthly_amount = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ? AND account_id = ?
    `).run(amt, n, id, DEMO_ACCOUNT_ID);

    const updated = db.prepare('SELECT * FROM protected_reserves WHERE id = ?').get(id);
    res.status(200).json({ success: true, message: 'Protected reserve updated', data: updated });
  } catch (err) {
    next(err);
  }
}

// GET /api/guardian/bills
function getBills(req, res, next) {
  try {
    const bills = db.prepare('SELECT * FROM bills_subscriptions WHERE account_id = ? ORDER BY due_date ASC').all(DEMO_ACCOUNT_ID);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const enriched = bills.map((b) => {
      const dueDate = new Date(b.due_date);
      const todayDate = new Date(todayStr);
      const diffTime = dueDate.getTime() - todayDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let reminderStatus = 'upcoming';
      if (diffDays < 0) reminderStatus = 'overdue';
      else if (diffDays === 0) reminderStatus = 'due_today';
      else if (diffDays === 1) reminderStatus = 'due_tomorrow';
      else if (diffDays <= 3) reminderStatus = 'due_3_days';
      else if (diffDays <= 7) reminderStatus = 'due_7_days';

      return {
        ...b,
        diff_days: diffDays,
        reminder_status: reminderStatus,
        is_overdue: diffDays < 0 && b.payment_status !== 'paid',
      };
    });

    res.status(200).json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
}

// POST /api/guardian/bills
function createBill(req, res, next) {
  try {
    const { name, category, amount, due_date, recurrence, is_essential } = req.body;
    if (!name || !category || !amount || !due_date) {
      return res.status(400).json({ success: false, error: 'Name, category, amount, and due_date are required' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Amount must be greater than zero' });
    }

    const id = `bill_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const rec = recurrence || 'monthly';
    const ess = is_essential ? 1 : 0;

    db.prepare(`
      INSERT INTO bills_subscriptions (id, account_id, name, category, amount, due_date, recurrence, payment_status, is_essential)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'unpaid', ?)
    `).run(id, DEMO_ACCOUNT_ID, name.trim(), category.trim(), numAmount, due_date, rec, ess);

    const created = db.prepare('SELECT * FROM bills_subscriptions WHERE id = ?').get(id);
    res.status(201).json({ success: true, message: 'Bill created successfully', data: created });
  } catch (err) {
    next(err);
  }
}

// PUT /api/guardian/bills/:id
function updateBill(req, res, next) {
  try {
    const { id } = req.params;
    const { name, category, amount, due_date, recurrence, is_essential, payment_status } = req.body;

    const bill = db.prepare('SELECT * FROM bills_subscriptions WHERE id = ? AND account_id = ?').get(id, DEMO_ACCOUNT_ID);
    if (!bill) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    const updatedName = name ? name.trim() : bill.name;
    const updatedCategory = category ? category.trim() : bill.category;
    const updatedAmount = amount !== undefined ? Number(amount) : bill.amount;
    const updatedDueDate = due_date || bill.due_date;
    const updatedRecurrence = recurrence || bill.recurrence;
    const updatedEssential = is_essential !== undefined ? (is_essential ? 1 : 0) : bill.is_essential;
    const updatedStatus = payment_status || bill.payment_status;

    db.prepare(`
      UPDATE bills_subscriptions
      SET name = ?, category = ?, amount = ?, due_date = ?, recurrence = ?, is_essential = ?, payment_status = ?, updated_at = datetime('now')
      WHERE id = ? AND account_id = ?
    `).run(updatedName, updatedCategory, updatedAmount, updatedDueDate, updatedRecurrence, updatedEssential, updatedStatus, id, DEMO_ACCOUNT_ID);

    const updated = db.prepare('SELECT * FROM bills_subscriptions WHERE id = ?').get(id);
    res.status(200).json({ success: true, message: 'Bill updated successfully', data: updated });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/guardian/bills/:id
function deleteBill(req, res, next) {
  try {
    const { id } = req.params;
    const bill = db.prepare('SELECT * FROM bills_subscriptions WHERE id = ? AND account_id = ?').get(id, DEMO_ACCOUNT_ID);
    if (!bill) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    db.prepare('DELETE FROM bills_subscriptions WHERE id = ? AND account_id = ?').run(id, DEMO_ACCOUNT_ID);
    res.status(200).json({ success: true, message: `Bill "${bill.name}" deleted successfully` });
  } catch (err) {
    next(err);
  }
}

// Helper: Calculate next due date for recurring bills
function computeNextDueDate(currentDueDateStr, recurrence) {
  const [y, m, d] = currentDueDateStr.split('-').map(Number);
  const cur = new Date(y, m - 1, d);

  if (recurrence === 'weekly') {
    cur.setDate(cur.getDate() + 7);
  } else if (recurrence === 'monthly') {
    cur.setMonth(cur.getMonth() + 1);
  } else if (recurrence === 'quarterly') {
    cur.setMonth(cur.getMonth() + 3);
  } else if (recurrence === 'annual') {
    cur.setFullYear(cur.getFullYear() + 1);
  } else {
    return currentDueDateStr;
  }

  const nextY = cur.getFullYear();
  const nextM = String(cur.getMonth() + 1).padStart(2, '0');
  const nextD = String(cur.getDate()).padStart(2, '0');
  return `${nextY}-${nextM}-${nextD}`;
}

// POST /api/guardian/bills/:id/pay
function payBill(req, res, next) {
  try {
    const { id } = req.params;
    const bill = db.prepare('SELECT * FROM bills_subscriptions WHERE id = ? AND account_id = ?').get(id, DEMO_ACCOUNT_ID);
    if (!bill) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }

    const currentBalance = calculateAccountBalance(DEMO_ACCOUNT_ID);
    if (bill.amount > currentBalance) {
      return res.status(400).json({
        success: false,
        error: `Insufficient bank balance (₹${currentBalance.toLocaleString('en-IN')}) to pay bill of ₹${bill.amount.toLocaleString('en-IN')}`,
      });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const txId = `btx_bill_${Date.now()}`;
    const refNo = `REF-BILL-${Date.now().toString().slice(-6)}`;

    // Run within SQLite transaction
    const executePayment = db.transaction(() => {
      // 1. Record bank debit
      db.prepare(`
        INSERT INTO bank_transactions (id, account_id, type, amount, category, description, date, reference_no, status, source)
        VALUES (?, ?, 'debit', ?, ?, ?, ?, ?, 'completed', 'bill_payment')
      `).run(txId, DEMO_ACCOUNT_ID, bill.amount, bill.category, `Bill Payment: ${bill.name}`, todayStr, refNo);

      // 2. Update bill recurrence or status
      if (bill.recurrence === 'one_time') {
        db.prepare(`
          UPDATE bills_subscriptions
          SET payment_status = 'paid', last_paid_date = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(todayStr, id);
      } else {
        const nextDue = computeNextDueDate(bill.due_date, bill.recurrence);
        db.prepare(`
          UPDATE bills_subscriptions
          SET due_date = ?, last_paid_date = ?, payment_status = 'unpaid', updated_at = datetime('now')
          WHERE id = ?
        `).run(nextDue, todayStr, id);
      }

      // 3. Insert notification
      const notifId = `notif_pay_${Date.now()}`;
      db.prepare(`
        INSERT INTO guardian_notifications (id, account_id, title, description, amount, severity, type, is_read, reference_id)
        VALUES (?, ?, 'Bill Paid Successfully', ?, ?, 'success', 'expense', 0, ?)
      `).run(
        notifId,
        DEMO_ACCOUNT_ID,
        `₹${bill.amount.toLocaleString('en-IN')} paid for ${bill.name}. Next due: ${bill.recurrence !== 'one_time' ? computeNextDueDate(bill.due_date, bill.recurrence) : 'Completed'}.`,
        bill.amount,
        txId
      );
    });

    executePayment();

    const updatedBill = db.prepare('SELECT * FROM bills_subscriptions WHERE id = ?').get(id);
    const newBalance = calculateAccountBalance(DEMO_ACCOUNT_ID);

    res.status(200).json({
      success: true,
      message: `Bill "${bill.name}" marked as paid. Bank balance is now ₹${newBalance.toLocaleString('en-IN')}.`,
      data: {
        bill: updatedBill,
        transactionId: txId,
        newBalance,
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/guardian/transactions/pre-check
function preCheckTransaction(req, res, next) {
  try {
    const { amount, category, type } = req.body;
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid positive amount is required' });
    }

    const intel = computeFinancialIntelligence(DEMO_ACCOUNT_ID);
    const isCredit = type === 'credit';
    const isEssential = isCategoryEssential(category);

    if (isCredit) {
      return res.status(200).json({
        success: true,
        allowed: true,
        isCredit: true,
        reason: 'Deposits increase available balance and are always permitted.',
      });
    }

    // Debit transaction checks:
    // 1. Overdraft check
    if (numAmount > intel.bankBalance) {
      return res.status(200).json({
        success: true,
        allowed: false,
        blocked: true,
        reason: `Overdraft Prevention: Purchase of ₹${numAmount.toLocaleString('en-IN')} exceeds current bank balance (₹${intel.bankBalance.toLocaleString('en-IN')}).`,
        details: { bankBalance: intel.bankBalance, shortfall: numAmount - intel.bankBalance },
      });
    }

    // 2. Essential expense exception
    if (isEssential) {
      return res.status(200).json({
        success: true,
        allowed: true,
        isEssential: true,
        reason: `Essential Expense Exception: "${category}" is classified as an essential obligation and is authorized against your reserved funds.`,
      });
    }

    // 3. Discretionary spending checks in Strict Mode
    if (intel.spendingControlMode === 'strict') {
      // Check A: Daily Safe Allowance violation
      const potentialTodaySpending = intel.spendingToday + numAmount;
      if (potentialTodaySpending > intel.dailySafeAllowance) {
        const excess = potentialTodaySpending - intel.dailySafeAllowance;
        return res.status(200).json({
          success: true,
          allowed: false,
          blocked: true,
          reason: `Daily Allowance Exceeded: Transaction of ₹${numAmount.toLocaleString('en-IN')} exceeds your remaining daily allowance (₹${intel.remainingDailyAllowance.toLocaleString('en-IN')}) by ₹${excess.toLocaleString('en-IN')}.`,
          details: {
            remainingAllowance: intel.remainingDailyAllowance,
            excess,
            dailySafeAllowance: intel.dailySafeAllowance,
          },
        });
      }

      // Check B: Protected Funds Violation
      const balanceAfterTx = intel.bankBalance - numAmount;
      if (balanceAfterTx < intel.totalProtectedReserves) {
        const breachAmount = intel.totalProtectedReserves - balanceAfterTx;
        return res.status(200).json({
          success: true,
          allowed: false,
          blocked: true,
          reason: `Protected Reserve Violation: This withdrawal would breach your protected essential and emergency reserves (₹${intel.totalProtectedReserves.toLocaleString('en-IN')} protected).`,
          details: {
            protectedReserves: intel.totalProtectedReserves,
            balanceAfterTx,
            breachAmount,
          },
        });
      }
    }

    // In Warning mode (or strict within bounds)
    const wouldExceedDaily = intel.spendingToday + numAmount > intel.dailySafeAllowance;
    return res.status(200).json({
      success: true,
      allowed: true,
      warning: wouldExceedDaily
        ? `Warning: This transaction will exceed your safe daily allowance by ₹${(intel.spendingToday + numAmount - intel.dailySafeAllowance).toLocaleString('en-IN')}.`
        : null,
      reason: 'Transaction passes spending guard parameters.',
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/guardian/transactions/execute
function executeGuardedTransaction(req, res, next) {
  try {
    const { amount, category, description, type, date } = req.body;
    const numAmount = Number(amount);
    if (!type || !['credit', 'debit'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Valid transaction type (credit or debit) required' });
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Amount must be greater than zero' });
    }

    const intel = computeFinancialIntelligence(DEMO_ACCOUNT_ID);
    const isCredit = type === 'credit';
    const isEssential = isCategoryEssential(category);

    // If debit, validate spending guard rules
    if (!isCredit) {
      // 1. Overdraft check
      if (numAmount > intel.bankBalance) {
        // Record blocked notification
        const notifId = `notif_block_${Date.now()}`;
        db.prepare(`
          INSERT INTO guardian_notifications (id, account_id, title, description, amount, severity, type, is_read)
          VALUES (?, ?, 'Transaction Blocked: Overdraft Attempt', ?, ?, 'critical', 'blocked', 0)
        `).run(
          notifId,
          DEMO_ACCOUNT_ID,
          `Withdrawal of ₹${numAmount.toLocaleString('en-IN')} blocked. Current balance is only ₹${intel.bankBalance.toLocaleString('en-IN')}.`,
          numAmount
        );

        return res.status(400).json({
          success: false,
          blocked: true,
          error: `Transaction blocked: Withdrawal of ₹${numAmount.toLocaleString('en-IN')} exceeds current bank balance (₹${intel.bankBalance.toLocaleString('en-IN')}).`,
        });
      }

      // 2. Strict Mode Checks for Discretionary Spending
      if (intel.spendingControlMode === 'strict' && !isEssential) {
        const potentialTodaySpending = intel.spendingToday + numAmount;
        if (potentialTodaySpending > intel.dailySafeAllowance) {
          const excess = potentialTodaySpending - intel.dailySafeAllowance;
          const notifId = `notif_block_${Date.now()}`;
          const reasonMsg = `Transaction blocked. You have only ₹${intel.remainingDailyAllowance.toLocaleString('en-IN')} remaining in your daily spending allowance (exceeded by ₹${excess.toLocaleString('en-IN')}).`;

          db.prepare(`
            INSERT INTO guardian_notifications (id, account_id, title, description, amount, severity, type, is_read)
            VALUES (?, ?, 'Transaction Blocked: Daily Limit Exceeded', ?, ?, 'critical', 'blocked', 0)
          `).run(notifId, DEMO_ACCOUNT_ID, reasonMsg, numAmount);

          return res.status(403).json({
            success: false,
            blocked: true,
            error: reasonMsg,
            remainingDailyAllowance: intel.remainingDailyAllowance,
            excess,
          });
        }

        const balanceAfterTx = intel.bankBalance - numAmount;
        if (balanceAfterTx < intel.totalProtectedReserves) {
          const notifId = `notif_block_${Date.now()}`;
          const reasonMsg = `Transaction blocked. Spending would violate your protected emergency & essential reserve of ₹${intel.totalProtectedReserves.toLocaleString('en-IN')}.`;

          db.prepare(`
            INSERT INTO guardian_notifications (id, account_id, title, description, amount, severity, type, is_read)
            VALUES (?, ?, 'Transaction Blocked: Protected Reserve Breach', ?, ?, 'critical', 'blocked', 0)
          `).run(notifId, DEMO_ACCOUNT_ID, reasonMsg, numAmount);

          return res.status(403).json({
            success: false,
            blocked: true,
            error: reasonMsg,
          });
        }
      }
    }

    // Permitted: Execute transaction
    const txId = `btx_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const txDate = date || new Date().toISOString().slice(0, 10);
    const refNo = `REF-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    const finalDesc = description ? description.trim() : `${isCredit ? 'Deposit' : 'Payment'} for ${category || 'General'}`;

    db.prepare(`
      INSERT INTO bank_transactions (id, account_id, type, amount, category, description, date, reference_no, status, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', 'simulation')
    `).run(txId, DEMO_ACCOUNT_ID, type, numAmount, category || 'Other', finalDesc, txDate, refNo);

    const newBalance = calculateAccountBalance(DEMO_ACCOUNT_ID);

    // Notify user of successful transaction
    const notifTitle = isCredit ? 'Deposit Confirmed' : 'Expense Completed';
    const notifDesc = isCredit
      ? `₹${numAmount.toLocaleString('en-IN')} deposited. Your new bank balance is ₹${newBalance.toLocaleString('en-IN')}.`
      : `₹${numAmount.toLocaleString('en-IN')} spent on ${category || 'expense'}. Your remaining bank balance is ₹${newBalance.toLocaleString('en-IN')}.`;

    const notifId = `notif_tx_${Date.now()}`;
    db.prepare(`
      INSERT INTO guardian_notifications (id, account_id, title, description, amount, severity, type, is_read, reference_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(notifId, DEMO_ACCOUNT_ID, notifTitle, notifDesc, numAmount, isCredit ? 'success' : 'info', isCredit ? 'deposit' : 'expense', txId);

    const createdTx = db.prepare('SELECT * FROM bank_transactions WHERE id = ?').get(txId);

    res.status(201).json({
      success: true,
      message: notifDesc,
      data: {
        transaction: createdTx,
        newBalance,
        notificationText: notifDesc,
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/guardian/notifications
function getNotifications(req, res, next) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const notifs = db.prepare(`
      SELECT * FROM guardian_notifications
      WHERE account_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(DEMO_ACCOUNT_ID, limit);

    const unreadCountRow = db.prepare(
      'SELECT COUNT(*) as count FROM guardian_notifications WHERE account_id = ? AND is_read = 0'
    ).get(DEMO_ACCOUNT_ID);

    res.status(200).json({
      success: true,
      data: {
        unreadCount: unreadCountRow ? unreadCountRow.count : 0,
        notifications: notifs,
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/guardian/notifications/:id/read
function markNotificationAsRead(req, res, next) {
  try {
    const { id } = req.params;
    db.prepare('UPDATE guardian_notifications SET is_read = 1 WHERE id = ? AND account_id = ?').run(id, DEMO_ACCOUNT_ID);
    res.status(200).json({ success: true, message: 'Notification marked as read' });
  } catch (err) {
    next(err);
  }
}

// POST /api/guardian/notifications/read-all
function markAllNotificationsAsRead(req, res, next) {
  try {
    db.prepare('UPDATE guardian_notifications SET is_read = 1 WHERE account_id = ?').run(DEMO_ACCOUNT_ID);
    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  computeFinancialIntelligence,
  getGuardianSummary,
  getGuardianSettings,
  updateGuardianSettings,
  getProtectedReserves,
  updateProtectedReserve,
  getBills,
  createBill,
  updateBill,
  deleteBill,
  payBill,
  preCheckTransaction,
  executeGuardedTransaction,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
