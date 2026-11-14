const db = require('../config/database');

const DEMO_ACCOUNT_ID = 'demo_acc_4821';

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

// GET /api/bank/account
function getAccountSummary(req, res, next) {
  try {
    const account = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(DEMO_ACCOUNT_ID);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Demo bank account not found' });
    }

    const balance = calculateAccountBalance(DEMO_ACCOUNT_ID);

    // Current month stats
    const now = new Date();
    const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const monthStats = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS deposits_month,
        COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) AS withdrawals_month,
        COUNT(*) AS total_month_txs
      FROM bank_transactions
      WHERE account_id = ? AND date LIKE ?
    `).get(DEMO_ACCOUNT_ID, `${curMonthKey}%`);

    res.status(200).json({
      success: true,
      data: {
        ...account,
        balance,
        depositsThisMonth: Math.round(monthStats.deposits_month * 100) / 100,
        withdrawalsThisMonth: Math.round(monthStats.withdrawals_month * 100) / 100,
        totalMonthTxs: monthStats.total_month_txs,
        currentMonthKey: curMonthKey,
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/bank/account/toggle
function toggleConnection(req, res, next) {
  try {
    const account = db.prepare('SELECT is_connected FROM bank_accounts WHERE id = ?').get(DEMO_ACCOUNT_ID);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Demo account not found' });
    }

    const newStatus = account.is_connected === 1 ? 0 : 1;
    db.prepare("UPDATE bank_accounts SET is_connected = ?, last_synced_at = datetime('now') WHERE id = ?")
      .run(newStatus, DEMO_ACCOUNT_ID);

    res.status(200).json({
      success: true,
      message: newStatus === 1 ? 'Demo Bank account reconnected' : 'Demo Bank account disconnected',
      isConnected: Boolean(newStatus),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/bank/account/refresh
function refreshAccount(req, res, next) {
  try {
    db.prepare("UPDATE bank_accounts SET last_synced_at = datetime('now') WHERE id = ?").run(DEMO_ACCOUNT_ID);
    getAccountSummary(req, res, next);
  } catch (err) {
    next(err);
  }
}

// GET /api/bank/transactions
function getBankTransactions(req, res, next) {
  try {
    const { type, search, limit } = req.query;

    let query = 'SELECT * FROM bank_transactions WHERE account_id = ?';
    const params = [DEMO_ACCOUNT_ID];

    if (type && (type === 'credit' || type === 'debit')) {
      query += ' AND type = ?';
      params.push(type);
    }

    if (search && String(search).trim() !== '') {
      query += ' AND (description LIKE ? OR category LIKE ? OR reference_no LIKE ?)';
      const term = `%${String(search).trim()}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY date DESC, timestamp DESC';

    if (limit && Number.isInteger(Number(limit)) && Number(limit) > 0) {
      query += ' LIMIT ?';
      params.push(Number(limit));
    }

    const rows = db.prepare(query).all(...params);
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// POST /api/bank/transactions
function createBankTransaction(req, res, next) {
  try {
    const { type, amount, category, description, date } = req.body;

    if (type !== 'credit' && type !== 'debit') {
      return res.status(400).json({ success: false, error: 'Transaction type must be either "credit" or "debit"' });
    }

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Transaction amount must be a number greater than 0' });
    }

    if (!category || String(category).trim() === '') {
      return res.status(400).json({ success: false, error: 'Category is required' });
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'Valid date in YYYY-MM-DD format is required' });
    }

    const currentBalance = calculateAccountBalance(DEMO_ACCOUNT_ID);

    // Overdraft check: Never permit a withdrawal greater than available balance
    if (type === 'debit' && numAmount > currentBalance) {
      return res.status(400).json({
        success: false,
        error: `Transaction declined: Insufficient account balance. Available balance is ₹${currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}, but requested withdrawal is ₹${numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`,
      });
    }

    const cleanAmount = Math.round(numAmount * 100) / 100;
    const cleanDesc = description ? String(description).trim() : `${category} transaction`;
    const cleanCategory = String(category).trim();

    const uniqueId = `btx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const datePart = date.replace(/-/g, '');
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    const referenceNo = `REF-${datePart}-${randomPart}`;

    db.prepare(`
      INSERT INTO bank_transactions (id, account_id, type, amount, category, description, date, reference_no, status, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', 'simulation')
    `).run(uniqueId, DEMO_ACCOUNT_ID, type, cleanAmount, cleanCategory, cleanDesc, date, referenceNo);

    // Update account last synced
    db.prepare("UPDATE bank_accounts SET last_synced_at = datetime('now') WHERE id = ?").run(DEMO_ACCOUNT_ID);

    const newBalance = calculateAccountBalance(DEMO_ACCOUNT_ID);
    const createdTx = db.prepare('SELECT * FROM bank_transactions WHERE id = ?').get(uniqueId);

    res.status(201).json({
      success: true,
      data: createdTx,
      updatedBalance: newBalance,
      message: `${type === 'credit' ? 'Deposit' : 'Withdrawal'} of ₹${cleanAmount.toLocaleString('en-IN')} successfully processed.`,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/bank/settings
function getSettings(req, res, next) {
  try {
    let settings = db.prepare('SELECT * FROM bank_settings WHERE account_id = ?').get(DEMO_ACCOUNT_ID);
    if (!settings) {
      db.prepare(`
        INSERT INTO bank_settings (account_id, min_savings_balance, monthly_spending_limit, emergency_fund_target, monthly_savings_target, monthly_income, essential_monthly_expenses, debt_obligations, risk_preference, upcoming_commitments)
        VALUES (?, 25000, 40000, 100000, 20000, 75000, 35000, 0, 'moderate', 10000)
      `).run(DEMO_ACCOUNT_ID);
      settings = db.prepare('SELECT * FROM bank_settings WHERE account_id = ?').get(DEMO_ACCOUNT_ID);
    }

    res.status(200).json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
}

// PUT /api/bank/settings
function updateSettings(req, res, next) {
  try {
    const {
      min_savings_balance,
      monthly_spending_limit,
      emergency_fund_target,
      monthly_savings_target,
      monthly_income,
      essential_monthly_expenses,
      debt_obligations,
      risk_preference,
      upcoming_commitments,
    } = req.body;

    const current = db.prepare('SELECT * FROM bank_settings WHERE account_id = ?').get(DEMO_ACCOUNT_ID) || {};

    const cleanNum = (val, fallback) => (Number.isFinite(Number(val)) && Number(val) >= 0 ? Number(val) : fallback);
    const validRisk = ['conservative', 'moderate', 'growth'].includes(risk_preference) ? risk_preference : (current.risk_preference || 'moderate');

    const updated = {
      min_savings_balance: cleanNum(min_savings_balance, current.min_savings_balance ?? 25000),
      monthly_spending_limit: cleanNum(monthly_spending_limit, current.monthly_spending_limit ?? 40000),
      emergency_fund_target: cleanNum(emergency_fund_target, current.emergency_fund_target ?? 100000),
      monthly_savings_target: cleanNum(monthly_savings_target, current.monthly_savings_target ?? 20000),
      monthly_income: cleanNum(monthly_income, current.monthly_income ?? 75000),
      essential_monthly_expenses: cleanNum(essential_monthly_expenses, current.essential_monthly_expenses ?? 35000),
      debt_obligations: cleanNum(debt_obligations, current.debt_obligations ?? 0),
      upcoming_commitments: cleanNum(upcoming_commitments, current.upcoming_commitments ?? 10000),
      risk_preference: validRisk,
    };

    db.prepare(`
      UPDATE bank_settings SET
        min_savings_balance = ?,
        monthly_spending_limit = ?,
        emergency_fund_target = ?,
        monthly_savings_target = ?,
        monthly_income = ?,
        essential_monthly_expenses = ?,
        debt_obligations = ?,
        upcoming_commitments = ?,
        risk_preference = ?,
        updated_at = datetime('now')
      WHERE account_id = ?
    `).run(
      updated.min_savings_balance,
      updated.monthly_spending_limit,
      updated.emergency_fund_target,
      updated.monthly_savings_target,
      updated.monthly_income,
      updated.essential_monthly_expenses,
      updated.debt_obligations,
      updated.upcoming_commitments,
      updated.risk_preference,
      DEMO_ACCOUNT_ID
    );

    const saved = db.prepare('SELECT * FROM bank_settings WHERE account_id = ?').get(DEMO_ACCOUNT_ID);
    res.status(200).json({ success: true, data: saved, message: 'Banking settings updated successfully' });
  } catch (err) {
    next(err);
  }
}

// GET /api/bank/goals
function getGoals(req, res, next) {
  try {
    const goals = db.prepare('SELECT * FROM financial_goals WHERE account_id = ? ORDER BY target_date ASC').all(DEMO_ACCOUNT_ID);
    res.status(200).json({ success: true, data: goals });
  } catch (err) {
    next(err);
  }
}

// POST /api/bank/goals
function createGoal(req, res, next) {
  try {
    const { name, target_amount, current_amount, target_date, category } = req.body;

    if (!name || String(name).trim() === '') {
      return res.status(400).json({ success: false, error: 'Goal name is required' });
    }

    const targetNum = Number(target_amount);
    if (!Number.isFinite(targetNum) || targetNum <= 0) {
      return res.status(400).json({ success: false, error: 'Target amount must be a number greater than 0' });
    }

    const currentNum = Number(current_amount) || 0;
    if (currentNum < 0) {
      return res.status(400).json({ success: false, error: 'Current saved amount cannot be negative' });
    }

    if (!target_date || !/^\d{4}-\d{2}-\d{2}$/.test(target_date)) {
      return res.status(400).json({ success: false, error: 'Valid target date in YYYY-MM-DD format is required' });
    }

    const goalId = `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const cat = category ? String(category).trim() : 'general';

    db.prepare(`
      INSERT INTO financial_goals (id, account_id, name, target_amount, current_amount, target_date, category)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(goalId, DEMO_ACCOUNT_ID, String(name).trim(), targetNum, currentNum, target_date, cat);

    const newGoal = db.prepare('SELECT * FROM financial_goals WHERE id = ?').get(goalId);
    res.status(201).json({ success: true, data: newGoal, message: 'Goal created successfully' });
  } catch (err) {
    next(err);
  }
}

// PUT /api/bank/goals/:id
function updateGoal(req, res, next) {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM financial_goals WHERE id = ? AND account_id = ?').get(id, DEMO_ACCOUNT_ID);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Goal not found' });
    }

    const { name, target_amount, current_amount, target_date, category } = req.body;

    const updatedName = name ? String(name).trim() : existing.name;
    const updatedTarget = Number.isFinite(Number(target_amount)) && Number(target_amount) > 0 ? Number(target_amount) : existing.target_amount;
    const updatedCurrent = Number.isFinite(Number(current_amount)) && Number(current_amount) >= 0 ? Number(current_amount) : existing.current_amount;
    const updatedDate = target_date && /^\d{4}-\d{2}-\d{2}$/.test(target_date) ? target_date : existing.target_date;
    const updatedCategory = category ? String(category).trim() : existing.category;

    db.prepare(`
      UPDATE financial_goals SET
        name = ?,
        target_amount = ?,
        current_amount = ?,
        target_date = ?,
        category = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(updatedName, updatedTarget, updatedCurrent, updatedDate, updatedCategory, id);

    const updated = db.prepare('SELECT * FROM financial_goals WHERE id = ?').get(id);
    res.status(200).json({ success: true, data: updated, message: 'Goal updated successfully' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/bank/goals/:id
function deleteGoal(req, res, next) {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM financial_goals WHERE id = ? AND account_id = ?').get(id, DEMO_ACCOUNT_ID);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Goal not found' });
    }

    db.prepare('DELETE FROM financial_goals WHERE id = ?').run(id);
    res.status(200).json({ success: true, message: 'Goal deleted successfully' });
  } catch (err) {
    next(err);
  }
}

// POST /api/bank/import-to-spendwise
function importToSpendWise(req, res, next) {
  try {
    const { bank_tx_id } = req.body;
    if (!bank_tx_id) {
      return res.status(400).json({ success: false, error: 'Bank transaction ID is required' });
    }

    const bankTx = db.prepare('SELECT * FROM bank_transactions WHERE id = ?').get(bank_tx_id);
    if (!bankTx) {
      return res.status(404).json({ success: false, error: 'Bank transaction not found' });
    }

    // Duplicate detection using stable reference number in description
    const refTag = `[Demo Bank Ref: ${bankTx.reference_no}]`;
    const duplicate = db.prepare('SELECT id FROM transactions WHERE description LIKE ?').get(`%${bankTx.reference_no}%`);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: `Transaction already imported into SpendWise (ID #${duplicate.id}). Duplicate import prevented.`,
      });
    }

    const type = bankTx.type === 'credit' ? 'income' : 'expense';
    const categoryMap = {
      Salary: 'Salary',
      'Freelance & Consulting': 'Freelance',
      Housing: 'Housing',
      'Food & Groceries': 'Food',
      Utilities: 'Utilities',
      Healthcare: 'Healthcare',
      Shopping: 'Shopping',
    };
    const mappedCategory = categoryMap[bankTx.category] || (type === 'income' ? 'Other' : 'Other');
    const description = `${bankTx.description} ${refTag}`;

    const insertStmt = db.prepare(`
      INSERT INTO transactions (title, amount, category, type, date, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = insertStmt.run(bankTx.category, bankTx.amount, mappedCategory, type, bankTx.date, description);
    const newTx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(info.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: newTx,
      message: `Transaction successfully imported to SpendWise ledger as ${type.toUpperCase()}.`,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/bank/dismissed-alerts
function getDismissedAlerts(req, res, next) {
  try {
    const rows = db.prepare('SELECT alert_id FROM dismissed_alerts WHERE account_id = ?').all(DEMO_ACCOUNT_ID);
    res.status(200).json({ success: true, data: rows.map((r) => r.alert_id) });
  } catch (err) {
    next(err);
  }
}

// POST /api/bank/dismiss-alert
function dismissAlert(req, res, next) {
  try {
    const { alert_id } = req.body;
    if (!alert_id) {
      return res.status(400).json({ success: false, error: 'Alert ID is required' });
    }

    db.prepare('INSERT OR IGNORE INTO dismissed_alerts (alert_id, account_id) VALUES (?, ?)').run(alert_id, DEMO_ACCOUNT_ID);
    res.status(200).json({ success: true, message: 'Alert dismissed' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAccountSummary,
  toggleConnection,
  refreshAccount,
  getBankTransactions,
  createBankTransaction,
  getSettings,
  updateSettings,
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  importToSpendWise,
  getDismissedAlerts,
  dismissAlert,
};
