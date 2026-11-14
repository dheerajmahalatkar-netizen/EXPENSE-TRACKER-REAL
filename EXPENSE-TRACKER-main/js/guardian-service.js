/**
 * guardian-service.js
 * API Client for SpendWise Money Guardian.
 * Connects frontend views to backend Guardian intelligence endpoints.
 */

import { formatINR } from './bank-service.js';

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

export { formatINR };

export async function fetchGuardianSummary() {
  const res = await fetch(`${API_BASE}/guardian/summary`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to fetch Guardian summary`);
  }
  const body = await res.json();
  return body.data;
}

export async function fetchGuardianSettings() {
  const res = await fetch(`${API_BASE}/guardian/settings`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to fetch Guardian settings`);
  }
  const body = await res.json();
  return body.data;
}

export async function updateGuardianSettings(payload) {
  const res = await fetch(`${API_BASE}/guardian/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to update Guardian settings`);
  }
  return await res.json();
}

export async function fetchProtectedReserves() {
  const res = await fetch(`${API_BASE}/guardian/reserves`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to fetch protected reserves`);
  }
  const body = await res.json();
  return body.data;
}

export async function updateProtectedReserve(id, payload) {
  const res = await fetch(`${API_BASE}/guardian/reserves/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to update protected reserve`);
  }
  return await res.json();
}

export async function fetchBills() {
  const res = await fetch(`${API_BASE}/guardian/bills`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to fetch bills`);
  }
  const body = await res.json();
  return body.data;
}

export async function createBill(payload) {
  const res = await fetch(`${API_BASE}/guardian/bills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to create bill`);
  }
  return await res.json();
}

export async function updateBill(id, payload) {
  const res = await fetch(`${API_BASE}/guardian/bills/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to update bill`);
  }
  return await res.json();
}

export async function deleteBill(id) {
  const res = await fetch(`${API_BASE}/guardian/bills/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to delete bill`);
  }
  return await res.json();
}

export async function payBill(id) {
  const res = await fetch(`${API_BASE}/guardian/bills/${encodeURIComponent(id)}/pay`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to process bill payment`);
  }
  return await res.json();
}

export async function preCheckTransaction(payload) {
  const res = await fetch(`${API_BASE}/guardian/transactions/pre-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to pre-check transaction`);
  }
  return await res.json();
}

export async function executeGuardedTransaction(payload) {
  const res = await fetch(`${API_BASE}/guardian/transactions/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    const error = new Error(body.error || `HTTP ${res.status}: Transaction blocked`);
    error.blocked = body.blocked;
    error.remainingDailyAllowance = body.remainingDailyAllowance;
    error.excess = body.excess;
    throw error;
  }
  return body;
}

export async function fetchNotifications(limit = 40) {
  const res = await fetch(`${API_BASE}/guardian/notifications?limit=${limit}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to fetch notifications`);
  }
  const body = await res.json();
  return body.data;
}

export async function markNotificationAsRead(id) {
  const res = await fetch(`${API_BASE}/guardian/notifications/${encodeURIComponent(id)}/read`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to mark notification as read`);
  }
  return await res.json();
}

export async function markAllNotificationsAsRead() {
  const res = await fetch(`${API_BASE}/guardian/notifications/read-all`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to mark all notifications as read`);
  }
  return await res.json();
}
