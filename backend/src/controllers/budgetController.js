const db = require('../config/database');

// GET /api/budgets/:year/:month
function getBudgetByMonth(req, res, next) {
  try {
    const year = Number(req.params.year);
    const month = Number(req.params.month);

    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      return res.status(400).json({ success: false, error: 'Invalid year. Must be a 4-digit year.' });
    }

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ success: false, error: 'Invalid month. Must be between 1 and 12.' });
    }

    const stmt = db.prepare('SELECT id, month, year, amount, created_at FROM monthly_budgets WHERE year = ? AND month = ?');
    const row = stmt.get(year, month);

    if (!row) {
      return res.status(404).json({ success: false, error: 'Budget not found for this month' });
    }

    res.status(200).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

// POST /api/budgets
function createBudget(req, res, next) {
  try {
    const { year, month, amount } = req.body;

    const yearNum = Number(year);
    if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 2100) {
      return res.status(400).json({ success: false, error: 'Invalid year. Must be a 4-digit year.' });
    }

    const monthNum = Number(month);
    if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ success: false, error: 'Invalid month. Must be an integer between 1 and 12.' });
    }

    const amt = Number(amount);
    if (amount === undefined || amount === null || !Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ success: false, error: 'Amount must be a number greater than 0' });
    }

    // Check for existing budget for that month
    const existingStmt = db.prepare('SELECT id FROM monthly_budgets WHERE year = ? AND month = ?');
    const existing = existingStmt.get(yearNum, monthNum);
    if (existing) {
      return res.status(409).json({ success: false, error: 'Budget for this month already exists' });
    }

    const cleanAmount = Math.round(amt * 100) / 100;
    const insertStmt = db.prepare('INSERT INTO monthly_budgets (month, year, amount) VALUES (?, ?, ?)');
    const info = insertStmt.run(monthNum, yearNum, cleanAmount);

    const getStmt = db.prepare('SELECT id, month, year, amount, created_at FROM monthly_budgets WHERE id = ?');
    const newRecord = getStmt.get(info.lastInsertRowid);

    res.status(201).json({ success: true, data: newRecord });
  } catch (err) {
    next(err);
  }
}

// PUT /api/budgets/:id
function updateBudget(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid ID. Must be a positive integer.' });
    }

    const checkStmt = db.prepare('SELECT id, month, year, amount, created_at FROM monthly_budgets WHERE id = ?');
    const existing = checkStmt.get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Budget not found' });
    }

    const { amount, year, month } = req.body;
    const amt = Number(amount);
    if (amount === undefined || amount === null || !Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ success: false, error: 'Amount must be a number greater than 0' });
    }

    let targetYear = existing.year;
    let targetMonth = existing.month;

    if (year !== undefined) {
      const yearNum = Number(year);
      if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 2100) {
        return res.status(400).json({ success: false, error: 'Invalid year. Must be a 4-digit year.' });
      }
      targetYear = yearNum;
    }

    if (month !== undefined) {
      const monthNum = Number(month);
      if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
        return res.status(400).json({ success: false, error: 'Invalid month. Must be between 1 and 12.' });
      }
      targetMonth = monthNum;
    }

    // Check uniqueness if year or month changed
    if (targetYear !== existing.year || targetMonth !== existing.month) {
      const conflictStmt = db.prepare('SELECT id FROM monthly_budgets WHERE year = ? AND month = ? AND id != ?');
      const conflict = conflictStmt.get(targetYear, targetMonth, id);
      if (conflict) {
        return res.status(409).json({ success: false, error: 'Budget for this month already exists' });
      }
    }

    const cleanAmount = Math.round(amt * 100) / 100;
    const updateStmt = db.prepare('UPDATE monthly_budgets SET month = ?, year = ?, amount = ? WHERE id = ?');
    updateStmt.run(targetMonth, targetYear, cleanAmount, id);

    const getStmt = db.prepare('SELECT id, month, year, amount, created_at FROM monthly_budgets WHERE id = ?');
    const updatedRecord = getStmt.get(id);

    res.status(200).json({ success: true, data: updatedRecord });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getBudgetByMonth,
  createBudget,
  updateBudget,
};
