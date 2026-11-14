/**
 * storage.js
 * Centralized Data Persistence Layer.
 * Connects the frontend to the Node.js + Express + SQLite REST API.
 * Maintains local memory caches for instant synchronous rendering
 * and handles one-time migration from legacy LocalStorage.
 */

// Resolve API base URL dynamically to handle direct access (port 3000) or Live Server / dev server ports
function resolveApiBase() {
  if (typeof window !== 'undefined' && window.location) {
    if (window.location.protocol === 'file:') {
      console.warn('ClearLedger: Browsers do not allow API fetch on file://. Please start the backend server and open http://localhost:3000');
      return 'http://localhost:3000/api';
    }
    const port = window.location.port;
    if (port && port !== '3000') {
      const hostname = window.location.hostname || 'localhost';
      return `http://${hostname}:3000/api`;
    }
  }
  return '/api';
}

const API_BASE = resolveApiBase();

const LEGACY_STORAGE_KEYS = {
  TRANSACTIONS: 'clearledger_transactions_v1',
  BUDGET: 'clearledger_budget_v1',
  INITIALIZED: 'clearledger_initialized_v1',
  MIGRATED: 'clearledger_migrated_to_db_v1',
};

// In-memory cache synced with backend API
let cachedTransactions = [];
let cachedBudgets = {}; // key: `${year}-${month}` -> budget object
let defaultBudgetLimit = 2600;
let lastError = null;

export function getLastError() {
  return lastError;
}

export function setLastError(msg) {
  lastError = msg;
}

export function clearLastError() {
  lastError = null;
}

/**
 * Generates a fallback ID for optimistic UI operations.
 * @returns {string}
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `tx_${crypto.randomUUID()}`;
  }
  return `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Normalizes a transaction record to guarantee schema consistency.
 * @param {object} raw
 * @returns {object}
 */
export function normalizeTransaction(raw) {
  return {
    id: raw.id,
    title: String(raw.title || '').trim(),
    amount: Math.round(Number(raw.amount) * 100) / 100,
    category: String(raw.category || 'Other').trim(),
    type: raw.type === 'income' ? 'income' : 'expense',
    date: String(raw.date || '').slice(0, 10),
    description: String(raw.description || '').trim(),
    created_at: raw.created_at || '',
  };
}

/**
 * Helper to format YYYY-MM relative to today's date + monthOffset.
 * @param {number} monthOffset
 * @returns {string} YYYY-MM
 */
function getRelativeMonthKey(monthOffset = 0) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Builds realistic starter dataset anchored around current calendar month.
 * @returns {{ transactions: Array<object>, budget: object }}
 */
export function createSampleDataset() {
  const m0 = getRelativeMonthKey(0);
  const m1 = getRelativeMonthKey(-1);
  const m2 = getRelativeMonthKey(-2);
  const m3 = getRelativeMonthKey(-3);
  const m4 = getRelativeMonthKey(-4);
  const m5 = getRelativeMonthKey(-5);

  const todayDay = Math.min(new Date().getDate(), 28);
  const day = (d) => String(Math.max(1, Math.min(d, todayDay))).padStart(2, '0');

  const transactions = [
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

  const budget = {
    defaultLimit: 2600,
    overrides: {},
    updatedAt: new Date().toISOString().slice(0, 10),
  };

  return { transactions, budget };
}

/**
 * Performs a one-time migration from LocalStorage to the SQLite database via API.
 * Never deletes original LocalStorage data; leaves it as a safe backup.
 * @returns {Promise<{ migrated: boolean, txCount: number, budgetCount: number }>}
 */
export async function migrateFromLocalStorageIfNeeded() {
  const isMigrated = window.localStorage.getItem(LEGACY_STORAGE_KEYS.MIGRATED) === 'true';
  if (isMigrated) {
    return { migrated: false, txCount: 0, budgetCount: 0 };
  }

  let txCount = 0;
  let budgetCount = 0;

  // Read existing LocalStorage transactions
  let localTxs = [];
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEYS.TRANSACTIONS);
    if (raw) localTxs = JSON.parse(raw);
  } catch (e) {
    console.warn('Could not parse local transactions:', e);
  }

  // Read existing LocalStorage budget
  let localBudget = null;
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEYS.BUDGET);
    if (raw) localBudget = JSON.parse(raw);
  } catch (e) {
    console.warn('Could not parse local budget:', e);
  }

  // Check current backend transactions count
  let checkRes;
  try {
    checkRes = await fetch(`${API_BASE}/transactions`);
  } catch (err) {
    lastError = 'Cannot reach backend server. Please make sure the server is running on http://localhost:3000';
    throw err;
  }

  if (!checkRes.ok) {
    throw new Error(`Failed to contact backend API: HTTP ${checkRes.status}`);
  }
  const checkData = await checkRes.json();
  const currentDbTxs = checkData.data || [];

  // If backend database is empty and LocalStorage had records, import them
  if (currentDbTxs.length === 0 && Array.isArray(localTxs) && localTxs.length > 0) {
    for (const tx of localTxs) {
      try {
        const res = await fetch(`${API_BASE}/transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: tx.title || 'Untitled',
            amount: Number(tx.amount) || 0.01,
            category: tx.category || 'Other',
            type: tx.type === 'income' ? 'income' : 'expense',
            date: tx.date || new Date().toISOString().slice(0, 10),
            description: tx.description || '',
          }),
        });
        if (res.ok) txCount++;
      } catch (err) {
        console.error('Error migrating transaction:', err);
      }
    }
  }

  // Import budget configuration if present
  if (localBudget && typeof localBudget === 'object') {
    if (localBudget.overrides && typeof localBudget.overrides === 'object') {
      for (const [monthKey, amt] of Object.entries(localBudget.overrides)) {
        if (/^\d{4}-\d{2}$/.test(monthKey) && Number(amt) > 0) {
          const [y, m] = monthKey.split('-').map(Number);
          try {
            const res = await fetch(`${API_BASE}/budgets`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ year: y, month: m, amount: Number(amt) }),
            });
            if (res.ok) budgetCount++;
          } catch (err) {
            console.error('Error migrating budget override:', err);
          }
        }
      }
    }
  }

  // Mark migration as complete
  window.localStorage.setItem(LEGACY_STORAGE_KEYS.MIGRATED, 'true');
  console.log(`Migration complete: ${txCount} transactions and ${budgetCount} budgets imported to SQLite.`);
  return { migrated: true, txCount, budgetCount };
}

/**
 * Synchronizes the local memory cache with the backend REST API.
 * @param {string} [monthKey] - Active reporting month (YYYY-MM)
 */
export async function syncFromBackend(monthKey) {
  try {
    lastError = null;
    const txRes = await fetch(`${API_BASE}/transactions`);
    if (!txRes.ok) {
      throw new Error(`Failed to load transactions: HTTP ${txRes.status}`);
    }
    const txData = await txRes.json();
    cachedTransactions = Array.isArray(txData.data) ? txData.data.map(normalizeTransaction) : [];

    // Fetch budget for the active month if provided
    if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
      const [y, m] = monthKey.split('-').map(Number);
      const budgetRes = await fetch(`${API_BASE}/budgets/${y}/${m}`);
      if (budgetRes.ok) {
        const bData = await budgetRes.json();
        cachedBudgets[`${y}-${m}`] = bData.data;
      } else if (budgetRes.status === 404) {
        delete cachedBudgets[`${y}-${m}`];
      }
    }

    return { transactions: cachedTransactions, budgets: cachedBudgets };
  } catch (err) {
    lastError = err.message || 'Cannot reach backend server';
    console.error('syncFromBackend error:', err);
    throw err;
  }
}

/**
 * Seeds initial demo data if database is empty or when forced.
 * @param {boolean} force
 */
export async function seedInitialData(force = false) {
  if (force) {
    const sample = createSampleDataset();
    for (const tx of sample.transactions) {
      await fetch(`${API_BASE}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: tx.title,
          amount: tx.amount,
          category: tx.category,
          type: tx.type,
          date: tx.date,
          description: tx.description,
        }),
      });
    }
  }
}

/**
 * Retrieves all transactions from memory cache (synced with SQLite).
 * @returns {Array<object>}
 */
export function getTransactions() {
  return cachedTransactions;
}

/**
 * Retrieves a single transaction by ID.
 * @param {string|number} id
 * @returns {object|null}
 */
export function getTransactionById(id) {
  return cachedTransactions.find((tx) => String(tx.id) === String(id)) || null;
}

/**
 * Persists a new transaction through the REST API.
 * @param {object} payload
 * @returns {Promise<object>}
 */
export async function saveTransaction(payload) {
  const cleanPayload = {
    title: String(payload.title || '').trim(),
    amount: Math.round(Number(payload.amount) * 100) / 100,
    category: String(payload.category || 'Other').trim(),
    type: payload.type === 'income' ? 'income' : 'expense',
    date: String(payload.date || '').slice(0, 10),
    description: String(payload.description || '').trim(),
  };

  const res = await fetch(`${API_BASE}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cleanPayload),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `HTTP ${res.status}: Failed to create transaction`);
  }

  const result = await res.json();
  const created = normalizeTransaction(result.data);
  cachedTransactions.unshift(created);
  return created;
}

/**
 * Updates an existing transaction through the REST API.
 * @param {string|number} id
 * @param {object} updates
 * @returns {Promise<object>}
 */
export async function updateTransaction(id, updates) {
  const cleanPayload = {
    title: String(updates.title || '').trim(),
    amount: Math.round(Number(updates.amount) * 100) / 100,
    category: String(updates.category || 'Other').trim(),
    type: updates.type === 'income' ? 'income' : 'expense',
    date: String(updates.date || '').slice(0, 10),
    description: String(updates.description || '').trim(),
  };

  const res = await fetch(`${API_BASE}/transactions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cleanPayload),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `HTTP ${res.status}: Failed to update transaction`);
  }

  const result = await res.json();
  const updated = normalizeTransaction(result.data);
  const idx = cachedTransactions.findIndex((tx) => String(tx.id) === String(id));
  if (idx !== -1) {
    cachedTransactions[idx] = updated;
  }
  return updated;
}

/**
 * Deletes a transaction by ID through the REST API.
 * @param {string|number} id
 * @returns {Promise<boolean>}
 */
export async function deleteTransaction(id) {
  const res = await fetch(`${API_BASE}/transactions/${id}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `HTTP ${res.status}: Failed to delete transaction`);
  }

  cachedTransactions = cachedTransactions.filter((tx) => String(tx.id) !== String(id));
  return true;
}

/**
 * Clears all transactions (testing/reset helper).
 */
export function clearAllTransactions() {
  cachedTransactions = [];
}

/**
 * Retrieves the full budget configuration object.
 * @returns {{ defaultLimit: number, overrides: Record<string, number>, updatedAt: string }}
 */
export function getBudgetConfig() {
  const overrides = {};
  for (const [key, b] of Object.entries(cachedBudgets)) {
    if (b && b.amount) {
      overrides[key] = b.amount;
    }
  }
  return {
    defaultLimit: defaultBudgetLimit,
    overrides,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
}

/**
 * Returns the active monthly budget limit for a given YYYY-MM key.
 * @param {string} monthKey
 * @returns {{ limit: number, isOverride: boolean, defaultLimit: number, updatedAt: string, id?: number }}
 */
export function getBudget(monthKey) {
  if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
    const [y, m] = monthKey.split('-').map(Number);
    const existing = cachedBudgets[`${y}-${m}`];
    if (existing && Number(existing.amount) > 0) {
      return {
        id: existing.id,
        limit: Number(existing.amount),
        isOverride: true,
        defaultLimit: defaultBudgetLimit,
        updatedAt: existing.created_at || new Date().toISOString().slice(0, 10),
      };
    }
  }

  return {
    limit: defaultBudgetLimit,
    isOverride: false,
    defaultLimit: defaultBudgetLimit,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
}

/**
 * Saves monthly budget information to the database via REST API.
 * @param {number} amount
 * @param {string} monthKey
 * @param {boolean} applyAsDefault
 * @returns {Promise<object>} Updated budget config
 */
export async function saveBudget(amount, monthKey, applyAsDefault = true) {
  const cleanAmount = Math.round(Number(amount) * 100) / 100;
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error('Invalid month key format');
  }

  const [y, m] = monthKey.split('-').map(Number);
  const existing = cachedBudgets[`${y}-${m}`];

  if (applyAsDefault) {
    defaultBudgetLimit = cleanAmount;
  }

  let savedRecord = null;
  if (existing && existing.id) {
    // Update existing budget row
    const res = await fetch(`${API_BASE}/budgets/${existing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: cleanAmount }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `HTTP ${res.status}: Failed to update budget`);
    }
    const result = await res.json();
    savedRecord = result.data;
  } else {
    // Create new budget row
    const res = await fetch(`${API_BASE}/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: y, month: m, amount: cleanAmount }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `HTTP ${res.status}: Failed to create budget`);
    }
    const result = await res.json();
    savedRecord = result.data;
  }

  cachedBudgets[`${y}-${m}`] = savedRecord;
  return getBudget(monthKey);
}
