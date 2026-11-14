/**
 * bank-service.js
 * API Client for SpendWise Smart Bank Connect (Demo Bank Simulation).
 * Handles communication with backend banking endpoints and data formatting.
 */

function resolveApiBase() {
  if (typeof window !== 'undefined' && window.location) {
    if (window.location.protocol === 'file:') {
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

/**
 * Formats a number into Indian Rupee currency format (e.g., ₹1,50,000.00).
 * @param {number} amount
 * @param {{ showPlus?: boolean, compact?: boolean }} [options]
 * @returns {string}
 */
export function formatINR(amount, options = {}) {
  const num = Number(amount) || 0;
  const absFormatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(num));

  if (num < 0) return `-${absFormatted}`;
  if (options.showPlus && num > 0) return `+${absFormatted}`;
  return absFormatted;
}

export async function fetchBankAccount() {
  const res = await fetch(`${API_BASE}/bank/account`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to fetch bank account`);
  }
  const body = await res.json();
  return body.data;
}

export async function toggleBankConnection() {
  const res = await fetch(`${API_BASE}/bank/account/toggle`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to toggle connection`);
  }
  const body = await res.json();
  return body;
}

export async function refreshBankAccount() {
  const res = await fetch(`${API_BASE}/bank/account/refresh`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to refresh account`);
  }
  const body = await res.json();
  return body.data;
}

export async function fetchBankTransactions(filters = {}) {
  const params = new URLSearchParams();
  if (filters.type && filters.type !== 'all') params.append('type', filters.type);
  if (filters.search) params.append('search', filters.search);
  if (filters.limit) params.append('limit', filters.limit);

  const url = `${API_BASE}/bank/transactions${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to fetch bank transactions`);
  }
  const body = await res.json();
  return body.data;
}

export async function createBankTransaction(payload) {
  const res = await fetch(`${API_BASE}/bank/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to execute transaction`);
  }
  const body = await res.json();
  return body;
}

export async function fetchBankSettings() {
  const res = await fetch(`${API_BASE}/bank/settings`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to fetch bank settings`);
  }
  const body = await res.json();
  return body.data;
}

export async function updateBankSettings(payload) {
  const res = await fetch(`${API_BASE}/bank/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to update settings`);
  }
  const body = await res.json();
  return body.data;
}

export async function fetchGoals() {
  const res = await fetch(`${API_BASE}/bank/goals`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to fetch goals`);
  }
  const body = await res.json();
  return body.data;
}

export async function createGoal(payload) {
  const res = await fetch(`${API_BASE}/bank/goals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to create goal`);
  }
  const body = await res.json();
  return body.data;
}

export async function updateGoal(id, payload) {
  const res = await fetch(`${API_BASE}/bank/goals/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to update goal`);
  }
  const body = await res.json();
  return body.data;
}

export async function deleteGoal(id) {
  const res = await fetch(`${API_BASE}/bank/goals/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to delete goal`);
  }
  return true;
}

export async function importBankTxToSpendWise(bankTxId) {
  const res = await fetch(`${API_BASE}/bank/import-to-spendwise`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bank_tx_id: bankTxId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to import transaction`);
  }
  const body = await res.json();
  return body;
}

export async function fetchDismissedAlerts() {
  const res = await fetch(`${API_BASE}/bank/dismissed-alerts`);
  if (!res.ok) return [];
  const body = await res.json().catch(() => ({ data: [] }));
  return body.data || [];
}

export async function dismissAlert(alertId) {
  const res = await fetch(`${API_BASE}/bank/dismiss-alert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alert_id: alertId }),
  });
  return res.ok;
}
