const db = require('../config/database');

function isValidDate(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return (
    dateObj.getFullYear() === y &&
    dateObj.getMonth() === m - 1 &&
    dateObj.getDate() === d
  );
}

function validateTransactionPayload(body) {
  const { title, amount, category, type, date, description } = body;

  if (title === undefined || title === null || String(title).trim() === '') {
    return 'Title is required';
  }

  const amt = Number(amount);
  if (amount === undefined || amount === null || !Number.isFinite(amt) || amt <= 0) {
    return 'Amount must be a number greater than 0';
  }

  if (category === undefined || category === null || String(category).trim() === '') {
    return 'Category is required';
  }

  if (type !== 'income' && type !== 'expense') {
    return 'Type must be either "income" or "expense"';
  }

  if (!isValidDate(date)) {
    return 'Date must be a valid date in YYYY-MM-DD format';
  }

  return null;
}

// GET /api/transactions
function getAllTransactions(req, res, next) {
  try {
    const stmt = db.prepare(
      'SELECT id, title, amount, category, type, date, description, created_at FROM transactions ORDER BY date DESC, id DESC'
    );
    const rows = stmt.all();
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/transactions/:id
function getTransactionById(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid ID. Must be a positive integer.' });
    }

    const stmt = db.prepare(
      'SELECT id, title, amount, category, type, date, description, created_at FROM transactions WHERE id = ?'
    );
    const row = stmt.get(id);

    if (!row) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    res.status(200).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

// POST /api/transactions
function createTransaction(req, res, next) {
  try {
    const error = validateTransactionPayload(req.body);
    if (error) {
      return res.status(400).json({ success: false, error });
    }

    const { title, amount, category, type, date, description } = req.body;
    const cleanTitle = String(title).trim();
    const cleanAmount = Math.round(Number(amount) * 100) / 100;
    const cleanCategory = String(category).trim();
    const cleanDesc = description !== undefined && description !== null ? String(description).trim() : null;

    const stmt = db.prepare(
      'INSERT INTO transactions (title, amount, category, type, date, description) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const info = stmt.run(cleanTitle, cleanAmount, cleanCategory, type, date, cleanDesc);

    const getStmt = db.prepare(
      'SELECT id, title, amount, category, type, date, description, created_at FROM transactions WHERE id = ?'
    );
    const newRecord = getStmt.get(info.lastInsertRowid);

    res.status(201).json({ success: true, data: newRecord });
  } catch (err) {
    next(err);
  }
}

// PUT /api/transactions/:id
function updateTransaction(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid ID. Must be a positive integer.' });
    }

    const checkStmt = db.prepare('SELECT id FROM transactions WHERE id = ?');
    const existing = checkStmt.get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    const error = validateTransactionPayload(req.body);
    if (error) {
      return res.status(400).json({ success: false, error });
    }

    const { title, amount, category, type, date, description } = req.body;
    const cleanTitle = String(title).trim();
    const cleanAmount = Math.round(Number(amount) * 100) / 100;
    const cleanCategory = String(category).trim();
    const cleanDesc = description !== undefined && description !== null ? String(description).trim() : null;

    const updateStmt = db.prepare(
      'UPDATE transactions SET title = ?, amount = ?, category = ?, type = ?, date = ?, description = ? WHERE id = ?'
    );
    updateStmt.run(cleanTitle, cleanAmount, cleanCategory, type, date, cleanDesc, id);

    const getStmt = db.prepare(
      'SELECT id, title, amount, category, type, date, description, created_at FROM transactions WHERE id = ?'
    );
    const updatedRecord = getStmt.get(id);

    res.status(200).json({ success: true, data: updatedRecord });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/transactions/:id
function deleteTransaction(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid ID. Must be a positive integer.' });
    }

    const checkStmt = db.prepare('SELECT id FROM transactions WHERE id = ?');
    const existing = checkStmt.get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    const deleteStmt = db.prepare('DELETE FROM transactions WHERE id = ?');
    deleteStmt.run(id);

    res.status(200).json({ success: true, message: 'Transaction deleted successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};
