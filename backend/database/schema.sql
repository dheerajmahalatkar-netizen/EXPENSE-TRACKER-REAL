CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  date TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS monthly_budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (year, month)
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);

-- ============================================================================
-- SPENDWISE SMART BANK CONNECT TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY,
  bank_name TEXT NOT NULL DEFAULT 'SpendWise Demo Bank',
  account_holder TEXT NOT NULL DEFAULT 'Demo User',
  account_type TEXT NOT NULL DEFAULT 'Savings Account',
  account_number TEXT NOT NULL DEFAULT 'XXXX XXXX 4821',
  currency TEXT NOT NULL DEFAULT 'INR',
  initial_balance REAL NOT NULL DEFAULT 150000.00,
  is_connected INTEGER NOT NULL DEFAULT 1,
  last_synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount REAL NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'completed',
  source TEXT NOT NULL DEFAULT 'simulation',
  reference_no TEXT NOT NULL UNIQUE,
  FOREIGN KEY (account_id) REFERENCES bank_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_bank_tx_account ON bank_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_bank_tx_date ON bank_transactions(date);
CREATE INDEX IF NOT EXISTS idx_bank_tx_type ON bank_transactions(type);

CREATE TABLE IF NOT EXISTS bank_settings (
  account_id TEXT PRIMARY KEY,
  min_savings_balance REAL NOT NULL DEFAULT 25000,
  monthly_spending_limit REAL NOT NULL DEFAULT 40000,
  emergency_fund_target REAL NOT NULL DEFAULT 100000,
  monthly_savings_target REAL NOT NULL DEFAULT 20000,
  monthly_income REAL NOT NULL DEFAULT 75000,
  essential_monthly_expenses REAL NOT NULL DEFAULT 35000,
  debt_obligations REAL NOT NULL DEFAULT 0,
  risk_preference TEXT NOT NULL DEFAULT 'moderate',
  upcoming_commitments REAL NOT NULL DEFAULT 10000,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES bank_accounts(id)
);

CREATE TABLE IF NOT EXISTS financial_goals (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  target_amount REAL NOT NULL CHECK (target_amount > 0),
  current_amount REAL NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  target_date TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES bank_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_goals_account ON financial_goals(account_id);

CREATE TABLE IF NOT EXISTS dismissed_alerts (
  alert_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  dismissed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- MONEY GUARDIAN — FINANCIAL CONTROL SYSTEM TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS guardian_settings (
  account_id TEXT PRIMARY KEY,
  monthly_income REAL NOT NULL DEFAULT 500000.00 CHECK (monthly_income >= 0),
  daily_allowance_carryover INTEGER NOT NULL DEFAULT 1 CHECK (daily_allowance_carryover IN (0, 1)),
  spending_control_mode TEXT NOT NULL DEFAULT 'strict' CHECK (spending_control_mode IN ('warning', 'strict')),
  daily_spending_cap REAL NOT NULL DEFAULT 12000.00 CHECK (daily_spending_cap >= 0),
  emergency_reserve_target REAL NOT NULL DEFAULT 150000.00 CHECK (emergency_reserve_target >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES bank_accounts(id)
);

CREATE TABLE IF NOT EXISTS bills_subscriptions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  due_date TEXT NOT NULL,
  recurrence TEXT NOT NULL DEFAULT 'monthly' CHECK (recurrence IN ('monthly', 'quarterly', 'annual', 'weekly', 'one_time')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'overdue')),
  is_essential INTEGER NOT NULL DEFAULT 1 CHECK (is_essential IN (0, 1)),
  last_paid_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES bank_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_bills_account ON bills_subscriptions(account_id);
CREATE INDEX IF NOT EXISTS idx_bills_due_date ON bills_subscriptions(due_date);

CREATE TABLE IF NOT EXISTS protected_reserves (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  category TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  monthly_amount REAL NOT NULL DEFAULT 0 CHECK (monthly_amount >= 0),
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES bank_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_reserves_account ON protected_reserves(account_id);

CREATE TABLE IF NOT EXISTS guardian_notifications (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical', 'success')),
  type TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  reference_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES bank_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_notif_account ON guardian_notifications(account_id);
CREATE INDEX IF NOT EXISTS idx_notif_created ON guardian_notifications(created_at);
