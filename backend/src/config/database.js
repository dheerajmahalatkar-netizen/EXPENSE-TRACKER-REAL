const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const dotenv = require('dotenv');

// Resolve path to backend folder (.env is in backend/)
const backendRoot = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(backendRoot, '.env') });

const dbRelativePath = process.env.DATABASE_PATH || 'database/expense-tracker.db';
const dbPath = path.isAbsolute(dbRelativePath)
  ? dbRelativePath
  : path.resolve(backendRoot, dbRelativePath);

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Automatically apply schema on start
const schemaPath = path.resolve(backendRoot, 'database/schema.sql');
if (fs.existsSync(schemaPath)) {
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
}

// Automatically seed initial sample records if database has 0 transactions
function seedSampleDataIfEmpty() {
  try {
    const row = db.prepare('SELECT COUNT(*) as count FROM transactions').get();
    if (row && row.count === 0) {
      const now = new Date();
      const getMonthKey = (offset) => {
        const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
      };

      const m0 = getMonthKey(0);
      const m1 = getMonthKey(-1);
      const m2 = getMonthKey(-2);
      const m3 = getMonthKey(-3);
      const m4 = getMonthKey(-4);
      const m5 = getMonthKey(-5);

      const todayDay = Math.min(now.getDate(), 28);
      const day = (d) => String(Math.max(1, Math.min(d, todayDay))).padStart(2, '0');

      const sampleTransactions = [
        // Current Month (m0)
        { title: 'Monthly Salary', amount: 4850, category: 'Salary', type: 'income', date: `${m0}-01`, description: 'Primary payroll deposit' },
        { title: 'Apartment Rent', amount: 1450, category: 'Housing', type: 'expense', date: `${m0}-02`, description: 'Monthly lease payment' },
        { title: 'Grocery Shopping', amount: 184.5, category: 'Food', type: 'expense', date: `${m0}-${day(4)}`, description: 'Weekly groceries and produce' },
        { title: 'Electric & Fiber Internet', amount: 142.8, category: 'Utilities', type: 'expense', date: `${m0}-${day(6)}`, description: 'Monthly power and broadband bill' },
        { title: 'UI Consulting Milestone', amount: 750, category: 'Freelance', type: 'income', date: `${m0}-${day(8)}`, description: 'Client design system audit' },
        { title: 'Transit & Fuel', amount: 96.4, category: 'Transport', type: 'expense', date: `${m0}-${day(9)}`, description: 'Commuter pass and fuel refill' },
        { title: 'Fresh Market & Coffee', amount: 128.25, category: 'Food', type: 'expense', date: `${m0}-${day(11)}`, description: 'Household pantry restock' },
        { title: 'Dental Checkup', amount: 165, category: 'Healthcare', type: 'expense', date: `${m0}-${day(12)}`, description: 'Routine cleaning and co-pay' },
        { title: 'Winter Desk Lamp', amount: 88.9, category: 'Shopping', type: 'expense', date: `${m0}-${day(13)}`, description: 'Home office lighting upgrade' },

        // Previous Month (m1)
        { title: 'Monthly Salary', amount: 4850, category: 'Salary', type: 'income', date: `${m1}-01`, description: 'Primary payroll deposit' },
        { title: 'Apartment Rent', amount: 1450, category: 'Housing', type: 'expense', date: `${m1}-02`, description: 'Monthly lease payment' },
        { title: 'Supermarket Run', amount: 342.15, category: 'Food', type: 'expense', date: `${m1}-09`, description: 'Groceries and household staples' },
        { title: 'Utilities Bundle', amount: 151.4, category: 'Utilities', type: 'expense', date: `${m1}-12`, description: 'Water, electric, and internet' },
        { title: 'City Metro & Rideshare', amount: 118.0, category: 'Transport', type: 'expense', date: `${m1}-17`, description: 'Monthly commuting expenses' },
        { title: 'Concert & Streaming', amount: 134.5, category: 'Entertainment', type: 'expense', date: `${m1}-22`, description: 'Live event tickets and subscriptions' },

        // m2
        { title: 'Monthly Salary', amount: 4850, category: 'Salary', type: 'income', date: `${m2}-01`, description: 'Primary payroll deposit' },
        { title: 'Dividend Payout', amount: 320, category: 'Investments', type: 'income', date: `${m2}-15`, description: 'Quarterly index fund distribution' },
        { title: 'Apartment Rent', amount: 1450, category: 'Housing', type: 'expense', date: `${m2}-02`, description: 'Monthly lease payment' },
        { title: 'Groceries & Dining', amount: 410.8, category: 'Food', type: 'expense', date: `${m2}-14`, description: 'Monthly food and dining out' },
        { title: 'Running Shoes & Gear', amount: 195.0, category: 'Shopping', type: 'expense', date: `${m2}-19`, description: 'Apparel replacement' },
        { title: 'Utilities', amount: 138.6, category: 'Utilities', type: 'expense', date: `${m2}-20`, description: 'Electric and fiber internet' },

        // m3
        { title: 'Monthly Salary', amount: 4700, category: 'Salary', type: 'income', date: `${m3}-01`, description: 'Primary payroll deposit' },
        { title: 'Apartment Rent', amount: 1450, category: 'Housing', type: 'expense', date: `${m3}-02`, description: 'Monthly lease payment' },
        { title: 'Food & Groceries', amount: 389.2, category: 'Food', type: 'expense', date: `${m3}-11`, description: 'Weekly supermarket orders' },
        { title: 'Car Maintenance & Fuel', amount: 274.5, category: 'Transport', type: 'expense', date: `${m3}-18`, description: 'Tire rotation and fuel' },
        { title: 'Utilities', amount: 146.0, category: 'Utilities', type: 'expense', date: `${m3}-21`, description: 'Monthly utilities' },

        // m4
        { title: 'Monthly Salary', amount: 4700, category: 'Salary', type: 'income', date: `${m4}-01`, description: 'Primary payroll deposit' },
        { title: 'Freelance Advisory', amount: 600, category: 'Freelance', type: 'income', date: `${m4}-16`, description: 'Workshop facilitation' },
        { title: 'Apartment Rent', amount: 1450, category: 'Housing', type: 'expense', date: `${m4}-02`, description: 'Monthly lease payment' },
        { title: 'Groceries', amount: 360.4, category: 'Food', type: 'expense', date: `${m4}-10`, description: 'Monthly groceries' },
        { title: 'Weekend Cinema & Books', amount: 112.0, category: 'Entertainment', type: 'expense', date: `${m4}-24`, description: 'Leisure and reading' },

        // m5
        { title: 'Monthly Salary', amount: 4700, category: 'Salary', type: 'income', date: `${m5}-01`, description: 'Primary payroll deposit' },
        { title: 'Apartment Rent', amount: 1450, category: 'Housing', type: 'expense', date: `${m5}-02`, description: 'Monthly lease payment' },
        { title: 'Groceries & Produce', amount: 332.9, category: 'Food', type: 'expense', date: `${m5}-13`, description: 'Household food budget' },
        { title: 'Pharmacy & Clinic', amount: 145.0, category: 'Healthcare', type: 'expense', date: `${m5}-20`, description: 'Annual checkup and prescriptions' },
      ];

      const insert = db.prepare(
        'INSERT INTO transactions (title, amount, category, type, date, description) VALUES (?, ?, ?, ?, ?, ?)'
      );
      const insertMany = db.transaction((txs) => {
        for (const tx of txs) {
          insert.run(tx.title, tx.amount, tx.category, tx.type, tx.date, tx.description);
        }
      });
      insertMany(sampleTransactions);

      const bCount = db.prepare('SELECT COUNT(*) as count FROM monthly_budgets').get();
      if (bCount && bCount.count === 0) {
        const [curYear, curMonth] = m0.split('-').map(Number);
        db.prepare('INSERT INTO monthly_budgets (month, year, amount) VALUES (?, ?, ?)').run(curMonth, curYear, 2600);
      }
    }
  } catch (e) {
    console.error('Initial sample seeding warning:', e);
  }
}

seedSampleDataIfEmpty();

function seedDemoBankIfEmpty() {
  try {
    const accRow = db.prepare("SELECT COUNT(*) as count FROM bank_accounts WHERE id = 'demo_acc_4821'").get();
    if (!accRow || accRow.count === 0) {
      // 1. Create Demo Account
      db.prepare(`
        INSERT INTO bank_accounts (id, bank_name, account_holder, account_type, account_number, currency, initial_balance, is_connected, last_synced_at)
        VALUES ('demo_acc_4821', 'SpendWise Demo Bank', 'Demo User', 'Savings Account', 'XXXX XXXX 4821', 'INR', 150000.00, 1, datetime('now'))
      `).run();

      // 2. Create Bank Settings & Risk Profile
      db.prepare(`
        INSERT INTO bank_settings (account_id, min_savings_balance, monthly_spending_limit, emergency_fund_target, monthly_savings_target, monthly_income, essential_monthly_expenses, debt_obligations, risk_preference, upcoming_commitments)
        VALUES ('demo_acc_4821', 25000, 40000, 100000, 20000, 75000, 35000, 0, 'moderate', 10000)
      `).run();

      // 3. Create Pre-populated Financial Goals
      const insertGoal = db.prepare(`
        INSERT INTO financial_goals (id, account_id, name, target_amount, current_amount, target_date, category)
        VALUES (?, 'demo_acc_4821', ?, ?, ?, ?, ?)
      `);

      insertGoal.run('goal_emergency_fund', 'Emergency Safety Reserve', 100000, 45000, '2027-06-30', 'emergency');
      insertGoal.run('goal_new_laptop', 'MacBook / Tech Upgrade', 80000, 32000, '2027-03-31', 'gadgets');
      insertGoal.run('goal_travel_himalayas', 'Annual Family Travel', 30000, 14000, '2026-12-31', 'travel');
      insertGoal.run('goal_business_capital', 'Small Business Seed Capital', 200000, 25000, '2027-12-31', 'business');

      // 4. Create Initial Bank Transactions
      const now = new Date();
      const getMonthKey = (offset) => {
        const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
      };
      const m0 = getMonthKey(0);
      const m1 = getMonthKey(-1);
      const todayDay = Math.min(now.getDate(), 28);
      const day = (d) => String(Math.max(1, Math.min(d, todayDay))).padStart(2, '0');

      const bankTxs = [
        // Current Month (m0)
        { id: 'btx_m0_1', type: 'credit', amount: 75000, category: 'Salary', description: 'Monthly Corporate Payroll - TechCorp Pvt Ltd', date: `${m0}-01`, ref: 'REF-20261101-7712' },
        { id: 'btx_m0_2', type: 'debit', amount: 22000, category: 'Housing', description: 'Apartment Monthly Lease Transfer', date: `${m0}-03`, ref: 'REF-20261103-9124' },
        { id: 'btx_m0_3', type: 'debit', amount: 4850, category: 'Food & Groceries', description: 'Organic Market & Superstore Grocery Refill', date: `${m0}-${day(5)}`, ref: 'REF-20261105-1823' },
        { id: 'btx_m0_4', type: 'debit', amount: 2400, category: 'Utilities', description: 'Broadband Fiber & Electric Power Bill Payment', date: `${m0}-${day(7)}`, ref: 'REF-20261107-4401' },
        { id: 'btx_m0_5', type: 'credit', amount: 18000, category: 'Freelance & Consulting', description: 'Direct Deposit: UX Design Consulting Milestone', date: `${m0}-${day(9)}`, ref: 'REF-20261109-6330' },
        { id: 'btx_m0_6', type: 'debit', amount: 3500, category: 'Healthcare', description: 'Annual Health & Dental Insurance Premium', date: `${m0}-${day(11)}`, ref: 'REF-20261111-8812' },
        { id: 'btx_m0_7', type: 'debit', amount: 2150, category: 'Shopping', description: 'Home Office Ergonomic Accessories', date: `${m0}-${day(12)}`, ref: 'REF-20261112-5509' },

        // Previous Month (m1)
        { id: 'btx_m1_1', type: 'credit', amount: 75000, category: 'Salary', description: 'Monthly Corporate Payroll - TechCorp Pvt Ltd', date: `${m1}-01`, ref: 'REF-20261001-3829' },
        { id: 'btx_m1_2', type: 'debit', amount: 22000, category: 'Housing', description: 'Apartment Monthly Lease Transfer', date: `${m1}-03`, ref: 'REF-20261003-4912' },
        { id: 'btx_m1_3', type: 'debit', amount: 5600, category: 'Food & Groceries', description: 'Monthly Supermarket Household Provisions', date: `${m1}-10`, ref: 'REF-20261010-7201' },
        { id: 'btx_m1_4', type: 'debit', amount: 2350, category: 'Utilities', description: 'Broadband Fiber & Electric Power Bill Payment', date: `${m1}-14`, ref: 'REF-20261014-6104' },
        { id: 'btx_m1_5', type: 'debit', amount: 3200, category: 'Shopping', description: 'Apparel & Seasonal Wardrobe Purchase', date: `${m1}-20`, ref: 'REF-20261020-1193' },
      ];

      const insertBankTx = db.prepare(`
        INSERT INTO bank_transactions (id, account_id, type, amount, category, description, date, reference_no)
        VALUES (?, 'demo_acc_4821', ?, ?, ?, ?, ?, ?)
      `);

      for (const tx of bankTxs) {
        insertBankTx.run(tx.id, tx.type, tx.amount, tx.category, tx.description, tx.date, tx.ref);
      }

      console.log('SpendWise Demo Bank seeded successfully with initial account, goals, and transactions.');
    }
  } catch (err) {
    console.error('Demo Bank seeding warning:', err);
  }
}

seedDemoBankIfEmpty();

function seedMoneyGuardianIfEmpty() {
  try {
    // 1. Check if guardian_settings exists
    const row = db.prepare("SELECT COUNT(*) as count FROM guardian_settings WHERE account_id = 'demo_acc_4821'").get();
    if (!row || row.count === 0) {
      db.prepare(`
        INSERT INTO guardian_settings (account_id, monthly_income, daily_allowance_carryover, spending_control_mode, daily_spending_cap, emergency_reserve_target)
        VALUES ('demo_acc_4821', 500000.00, 1, 'strict', 12000.00, 150000.00)
      `).run();
    }

    // 2. Seed Protected Reserves if empty
    const resCount = db.prepare("SELECT COUNT(*) as count FROM protected_reserves WHERE account_id = 'demo_acc_4821'").get();
    if (!resCount || resCount.count === 0) {
      const insertReserve = db.prepare(`
        INSERT INTO protected_reserves (id, account_id, category, name, monthly_amount, notes)
        VALUES (?, 'demo_acc_4821', ?, ?, ?, ?)
      `);

      const reserves = [
        { id: 'res_housing', cat: 'housing', name: 'Housing & Rent', amt: 25000, notes: 'Apartment monthly lease & maintenance' },
        { id: 'res_healthcare', cat: 'healthcare', name: 'Healthcare & Medical', amt: 6000, notes: 'Family prescription & diagnostic buffer' },
        { id: 'res_insurance', cat: 'insurance', name: 'Insurance Premiums', amt: 4000, notes: 'Term life and health insurance policies' },
        { id: 'res_food', cat: 'food_essentials', name: 'Food Essentials', amt: 12000, notes: 'Essential pantry staples & fresh produce' },
        { id: 'res_utilities', cat: 'utilities', name: 'Utilities & Connectivity', amt: 5000, notes: 'Electricity, piped gas, and high-speed fiber' },
        { id: 'res_education', cat: 'education', name: 'Education & Learning', amt: 8000, notes: 'Tuition fees, textbooks, skill courses' },
        { id: 'res_loans', cat: 'loans', name: 'Loan Repayments / EMIs', amt: 15000, notes: 'Car loan and scheduled debt retirement' },
        { id: 'res_emergency', cat: 'emergency', name: 'Emergency Liquid Reserve', amt: 25000, notes: 'Minimum guaranteed bank cash cushion' },
      ];

      for (const r of reserves) {
        insertReserve.run(r.id, r.cat, r.name, r.amt, r.notes);
      }
    }

    // 3. Seed Bills & Subscriptions if empty
    const billCount = db.prepare("SELECT COUNT(*) as count FROM bills_subscriptions WHERE account_id = 'demo_acc_4821'").get();
    if (!billCount || billCount.count === 0) {
      const now = new Date();
      const formatOffsetDate = (days) => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const insertBill = db.prepare(`
        INSERT INTO bills_subscriptions (id, account_id, name, category, amount, due_date, recurrence, payment_status, is_essential)
        VALUES (?, 'demo_acc_4821', ?, ?, ?, ?, ?, ?, ?)
      `);

      const sampleBills = [
        { id: 'bill_rent', name: 'Apartment Lease & Society Maintenance', cat: 'Housing', amt: 22000, due: formatOffsetDate(5), rec: 'monthly', status: 'unpaid', ess: 1 },
        { id: 'bill_electric', name: 'State Electricity Power Grid', cat: 'Utilities', amt: 2400, due: formatOffsetDate(2), rec: 'monthly', status: 'unpaid', ess: 1 },
        { id: 'bill_broadband', name: 'Airtel Xstream Fiber Broadband', cat: 'Utilities', amt: 1299, due: formatOffsetDate(7), rec: 'monthly', status: 'unpaid', ess: 1 },
        { id: 'bill_health_ins', name: 'HDFC Ergo Health Suraksha EMI', cat: 'Insurance', amt: 3500, due: formatOffsetDate(12), rec: 'monthly', status: 'unpaid', ess: 1 },
        { id: 'bill_car_loan', name: 'Vehicle Auto Loan EMI', cat: 'Loans & EMIs', amt: 8500, due: formatOffsetDate(15), rec: 'monthly', status: 'unpaid', ess: 1 },
        { id: 'bill_netflix', name: 'Netflix Premium & Spotify Family', cat: 'Subscriptions', amt: 1148, due: formatOffsetDate(3), rec: 'monthly', status: 'unpaid', ess: 0 },
        { id: 'bill_software', name: 'Cloud Software & Developer Tools', cat: 'Subscriptions', amt: 2400, due: formatOffsetDate(8), rec: 'monthly', status: 'unpaid', ess: 0 },
        { id: 'bill_gym', name: 'Cult.fit Elite Annual Pass Installment', cat: 'Subscriptions', amt: 2500, due: formatOffsetDate(18), rec: 'monthly', status: 'unpaid', ess: 0 },
      ];

      for (const b of sampleBills) {
        insertBill.run(b.id, b.name, b.cat, b.amt, b.due, b.rec, b.status, b.ess);
      }
    }

    // 4. Seed Guardian Notifications if empty
    const notifCount = db.prepare("SELECT COUNT(*) as count FROM guardian_notifications WHERE account_id = 'demo_acc_4821'").get();
    if (!notifCount || notifCount.count === 0) {
      const insertNotif = db.prepare(`
        INSERT INTO guardian_notifications (id, account_id, title, description, amount, severity, type, is_read, reference_id)
        VALUES (?, 'demo_acc_4821', ?, ?, ?, ?, ?, ?, ?)
      `);

      insertNotif.run(
        'notif_welcome',
        'Money Guardian Protection Active',
        'Money Guardian is actively monitoring transactions, calculating daily allowance, and enforcing strict spending limits.',
        null,
        'info',
        'info',
        0,
        null
      );
      insertNotif.run(
        'notif_bill_due_soon',
        'Upcoming Bill: State Electricity Power Grid',
        'Bill of ₹2,400.00 is due in 2 days. Funds have been protected in your Essential Reserves.',
        2400,
        'warning',
        'bill_reminder',
        0,
        'bill_electric'
      );
      insertNotif.run(
        'notif_salary_deposit',
        'Deposit Received: Corporate Payroll',
        '₹75,000.00 deposited into SpendWise Demo Bank. Ledger updated.',
        75000,
        'success',
        'deposit',
        0,
        'btx_m0_1'
      );
    }
  } catch (err) {
    console.error('Money Guardian seeding warning:', err);
  }
}

seedMoneyGuardianIfEmpty();

module.exports = db;
