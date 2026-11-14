/**
 * transactions.js
 * Pure financial calculations, input validation, formatting utilities,
 * Add/Edit Transaction modal management, and Feature 3 (Transaction History view).
 */

import {
  getTransactions,
  getTransactionById,
  saveTransaction,
  updateTransaction,
  deleteTransaction,
} from './storage.js';

export const EXPENSE_CATEGORIES = [
  'Food',
  'Housing',
  'Transport',
  'Utilities',
  'Healthcare',
  'Entertainment',
  'Shopping',
  'Other',
];

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investments',
  'Gifts',
  'Other',
];

export const ALL_CATEGORIES = Array.from(
  new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])
);

export const CATEGORY_COLORS = {
  Food: '#8B5CF6',
  Housing: '#6D28D9',
  Transport: '#F59E0B',
  Utilities: '#A855F7',
  Healthcare: '#E11D48',
  Entertainment: '#7C3AED',
  Shopping: '#EC4899',
  Salary: '#16A34A',
  Freelance: '#059669',
  Investments: '#9333EA',
  Gifts: '#F43F5E',
  Other: '#94A3B8',
};

/* ==========================================================================
   Pure Formatting & Math Utilities
   ========================================================================== */

/**
 * Rounds currency numbers to 2 decimal places safely.
 * @param {number} value
 * @returns {number}
 */
export function roundCurrency(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * Formats a number as USD currency string.
 * @param {number} amount
 * @param {{ showPlus?: boolean }} [options]
 * @returns {string}
 */
export function formatCurrency(amount, options = {}) {
  const num = roundCurrency(amount);
  const absFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(num));

  if (num < 0) return `-${absFormatted}`;
  if (options.showPlus && num > 0) return `+${absFormatted}`;
  return absFormatted;
}

/**
 * Escapes HTML special characters to prevent XSS when rendering user strings.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formats YYYY-MM-DD cleanly without UTC timezone drift.
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(dateObj);
}

/**
 * Formats YYYY-MM into human-readable "November 2026" or "Nov 2026".
 * @param {string} monthKey
 * @param {'long' | 'short'} [style]
 * @returns {string}
 */
export function formatMonthLabel(monthKey, style = 'long') {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || '';
  const [y, m] = monthKey.split('-').map(Number);
  const dateObj = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat('en-US', {
    month: style,
    year: 'numeric',
  }).format(dateObj);
}

/**
 * Returns today's local date as YYYY-MM-DD.
 * @returns {string}
 */
export function getTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns current local month as YYYY-MM.
 * @returns {string}
 */
export function getCurrentMonthKey() {
  return getTodayDateString().slice(0, 7);
}

/* ==========================================================================
   Pure Financial Calculation Functions (Storage-Independent)
   ========================================================================== */

/**
 * Computes all-time totals dynamically from a list of transactions.
 * Total Balance = Total Income - Total Expenses.
 * @param {Array<object>} transactions
 */
export function calculateTotals(transactions) {
  let totalIncome = 0;
  let totalExpenses = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  for (const tx of transactions) {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      totalIncome += amt;
      incomeCount += 1;
    } else {
      totalExpenses += amt;
      expenseCount += 1;
    }
  }

  totalIncome = roundCurrency(totalIncome);
  totalExpenses = roundCurrency(totalExpenses);
  const totalBalance = roundCurrency(totalIncome - totalExpenses);

  return {
    totalBalance,
    totalIncome,
    totalExpenses,
    incomeCount,
    expenseCount,
    totalCount: transactions.length,
  };
}

/**
 * Computes income, expenses, and net savings for a specific YYYY-MM month.
 * @param {Array<object>} transactions
 * @param {string} monthKey
 */
export function calculateMonthlySummary(transactions, monthKey) {
  const monthlyTxs = transactions.filter((tx) => tx.date && tx.date.startsWith(monthKey));
  const totals = calculateTotals(monthlyTxs);
  return {
    monthKey,
    income: totals.totalIncome,
    expenses: totals.totalExpenses,
    savings: totals.totalBalance,
    incomeCount: totals.incomeCount,
    expenseCount: totals.expenseCount,
    count: monthlyTxs.length,
  };
}

/**
 * Computes category-wise breakdown for expenses (or income).
 * @param {Array<object>} transactions
 * @param {'expense' | 'income'} [type]
 * @returns {Array<{ category: string, total: number, percentage: number, count: number, color: string }>}
 */
export function getCategoryBreakdown(transactions, type = 'expense') {
  const filtered = transactions.filter((tx) => tx.type === type);
  const map = new Map();
  let grandTotal = 0;

  for (const tx of filtered) {
    const amt = Number(tx.amount) || 0;
    grandTotal += amt;
    const prev = map.get(tx.category) || { total: 0, count: 0 };
    map.set(tx.category, {
      total: prev.total + amt,
      count: prev.count + 1,
    });
  }

  grandTotal = roundCurrency(grandTotal);

  const items = Array.from(map.entries()).map(([category, data]) => {
    const total = roundCurrency(data.total);
    const percentage = grandTotal > 0 ? Math.round((total / grandTotal) * 1000) / 10 : 0;
    return {
      category,
      total,
      percentage,
      count: data.count,
      color: CATEGORY_COLORS[category] || '#64748B',
    };
  });

  items.sort((a, b) => b.total - a.total);
  return items;
}

/**
 * Computes monthly income vs expenses across N months ending at referenceMonthKey.
 * @param {Array<object>} transactions
 * @param {number} [monthsCount]
 * @param {string} [referenceMonthKey]
 */
export function getMonthlyTrend(transactions, monthsCount = 6, referenceMonthKey) {
  const ref = referenceMonthKey || getCurrentMonthKey();
  const [refYear, refMonth] = ref.split('-').map(Number);

  const months = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(refYear, refMonth - 1 - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const summary = calculateMonthlySummary(transactions, key);
    months.push({
      monthKey: key,
      label: new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(d),
      income: summary.income,
      expenses: summary.expenses,
      net: summary.savings,
    });
  }
  return months;
}

/**
 * Computes day-by-day expense totals for a specific YYYY-MM month.
 * @param {Array<object>} transactions
 * @param {string} monthKey
 */
export function getDailySpendingSeries(transactions, monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const dailyTotals = new Array(daysInMonth).fill(0);

  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.date || !tx.date.startsWith(monthKey)) continue;
    const dayNum = Number(tx.date.slice(8, 10));
    if (dayNum >= 1 && dayNum <= daysInMonth) {
      dailyTotals[dayNum - 1] += Number(tx.amount) || 0;
    }
  }

  return dailyTotals.map((total, idx) => ({
    day: idx + 1,
    label: String(idx + 1),
    total: roundCurrency(total),
  }));
}

/**
 * Filters and sorts transactions according to active filter criteria.
 * @param {Array<object>} transactions
 * @param {object} filters
 */
export function filterAndSortTransactions(transactions, filters = {}) {
  const search = String(filters.search || '').trim().toLowerCase();
  const category = filters.category || 'all';
  const type = filters.type || 'all';
  const month = filters.month || 'all';
  const sortBy = filters.sortBy || 'date-desc';

  const result = transactions.filter((tx) => {
    if (type !== 'all' && tx.type !== type) return false;
    if (category !== 'all' && tx.category !== category) return false;
    if (month !== 'all' && (!tx.date || !tx.date.startsWith(month))) return false;
    if (search) {
      const haystack = `${tx.title} ${tx.description} ${tx.category}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  result.sort((a, b) => {
    if (sortBy === 'date-asc') {
      return a.date.localeCompare(b.date) || a.title.localeCompare(b.title);
    }
    if (sortBy === 'amount-desc') {
      return b.amount - a.amount || b.date.localeCompare(a.date);
    }
    if (sortBy === 'amount-asc') {
      return a.amount - b.amount || b.date.localeCompare(a.date);
    }
    // Default: date-desc
    return b.date.localeCompare(a.date) || a.title.localeCompare(b.title);
  });

  return result;
}

/**
 * Validates Add/Edit transaction form fields.
 * @param {object} data
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validateTransactionInput(data) {
  const errors = {};

  const title = String(data.title || '').trim();
  if (!title) {
    errors.title = 'Please enter a transaction title.';
  } else if (title.length < 2) {
    errors.title = 'Title must be at least 2 characters.';
  }

  const amountNum = Number(data.amount);
  if (data.amount === '' || data.amount === null || data.amount === undefined) {
    errors.amount = 'Please enter an amount.';
  } else if (!Number.isFinite(amountNum) || amountNum <= 0) {
    errors.amount = 'Amount must be greater than $0.00.';
  } else if (amountNum > 100000000) {
    errors.amount = 'Amount exceeds maximum allowed limit.';
  }

  if (data.type !== 'income' && data.type !== 'expense') {
    errors.type = 'Invalid transaction type.';
  }

  const category = String(data.category || '').trim();
  if (!category) {
    errors.category = 'Please select a category.';
  }

  const date = String(data.date || '').trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.date = 'Please select a valid date.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/* ==========================================================================
   Transaction Modal Controller (Feature 2: Income & Expense Management)
   ========================================================================== */

let modalRefs = null;
let onMutateCallback = null;

/**
 * Populates category select options based on transaction type.
 * @param {HTMLSelectElement} selectEl
 * @param {'income' | 'expense'} type
 * @param {string} [selectedValue]
 */
function populateCategoryOptions(selectEl, type, selectedValue = '') {
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  selectEl.innerHTML = list
    .map(
      (cat) =>
        `<option value="${escapeHtml(cat)}" ${
          cat === selectedValue ? 'selected' : ''
        }>${escapeHtml(cat)}</option>`
    )
    .join('');

  if (selectedValue && !list.includes(selectedValue)) {
    selectEl.insertAdjacentHTML(
      'beforeend',
      `<option value="${escapeHtml(selectedValue)}" selected>${escapeHtml(selectedValue)}</option>`
    );
  }
}

/**
 * Clears inline validation errors in the transaction modal.
 */
function clearModalErrors() {
  if (!modalRefs) return;
  const fields = ['title', 'amount', 'category', 'date', 'description'];
  for (const field of fields) {
    const inputEl = modalRefs[field];
    const errEl = modalRefs[`err_${field}`];
    if (inputEl) inputEl.classList.remove('is-invalid');
    if (errEl) errEl.textContent = '';
  }
}

/**
 * Applies field-level validation error messages.
 * @param {Record<string, string>} errors
 */
function showModalErrors(errors) {
  if (!modalRefs) return;
  clearModalErrors();
  for (const [field, msg] of Object.entries(errors)) {
    const inputEl = modalRefs[field];
    const errEl = modalRefs[`err_${field}`];
    if (inputEl) inputEl.classList.add('is-invalid');
    if (errEl) errEl.textContent = msg;
  }
}

/**
 * Switches active transaction type inside the modal.
 * @param {'income' | 'expense'} type
 * @param {string} [preferredCategory]
 */
function setModalType(type, preferredCategory = '') {
  if (!modalRefs) return;
  modalRefs.typeInput.value = type;
  modalRefs.typeButtons.forEach((btn) => {
    const active = btn.dataset.txType === type;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  populateCategoryOptions(modalRefs.category, type, preferredCategory);
}

/**
 * Opens Add or Edit Transaction modal.
 * @param {object | null} [existingTx]
 * @param {{ defaultMonth?: string, defaultType?: 'income' | 'expense' }} [options]
 */
export function openTransactionModal(existingTx = null, options = {}) {
  if (!modalRefs) return;
  clearModalErrors();

  const isEdit = Boolean(existingTx && existingTx.id);
  modalRefs.modalTitle.textContent = isEdit ? 'Edit Transaction' : 'Add Transaction';
  modalRefs.submitBtn.textContent = isEdit ? 'Update Transaction' : 'Save Transaction';

  if (isEdit) {
    modalRefs.idInput.value = existingTx.id;
    setModalType(existingTx.type, existingTx.category);
    modalRefs.title.value = existingTx.title;
    modalRefs.amount.value = String(existingTx.amount);
    modalRefs.date.value = existingTx.date;
    modalRefs.description.value = existingTx.description || '';
  } else {
    const defaultType = options.defaultType === 'income' ? 'income' : 'expense';
    modalRefs.idInput.value = '';
    setModalType(defaultType);
    modalRefs.title.value = '';
    modalRefs.amount.value = '';
    modalRefs.description.value = '';

    // Default date inside activeMonth if different from current month, else today
    const today = getTodayDateString();
    if (options.defaultMonth && !today.startsWith(options.defaultMonth)) {
      modalRefs.date.value = `${options.defaultMonth}-01`;
    } else {
      modalRefs.date.value = today;
    }
  }

  modalRefs.overlay.hidden = false;
  modalRefs.title.focus();
}

export function closeTransactionModal() {
  if (!modalRefs) return;
  modalRefs.overlay.hidden = true;
}

/**
 * Initializes Add/Edit Transaction modal event listeners.
 * @param {{ onSave: Function, onToast: Function }} callbacks
 */
export function initTransactionModal(callbacks) {
  onMutateCallback = callbacks.onSave;

  const overlay = document.getElementById('transaction-modal');
  const form = document.getElementById('transaction-form');

  modalRefs = {
    overlay,
    form,
    modalTitle: document.getElementById('modal-title'),
    idInput: document.getElementById('tx-id'),
    typeInput: document.getElementById('tx-type'),
    typeButtons: Array.from(overlay.querySelectorAll('[data-tx-type]')),
    title: document.getElementById('tx-title'),
    amount: document.getElementById('tx-amount'),
    category: document.getElementById('tx-category'),
    date: document.getElementById('tx-date'),
    description: document.getElementById('tx-description'),
    err_title: document.getElementById('err-tx-title'),
    err_amount: document.getElementById('err-tx-amount'),
    err_category: document.getElementById('err-tx-category'),
    err_date: document.getElementById('err-tx-date'),
    err_description: document.getElementById('err-tx-description'),
    submitBtn: document.getElementById('btn-submit-tx'),
  };

  modalRefs.typeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setModalType(btn.dataset.txType);
    });
  });

  document.getElementById('btn-close-modal').addEventListener('click', closeTransactionModal);
  document.getElementById('btn-cancel-modal').addEventListener('click', closeTransactionModal);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeTransactionModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) {
      closeTransactionModal();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      type: modalRefs.typeInput.value,
      title: modalRefs.title.value.trim(),
      amount: modalRefs.amount.value,
      category: modalRefs.category.value,
      date: modalRefs.date.value,
      description: modalRefs.description.value.trim(),
    };

    const validation = validateTransactionInput(payload);
    if (!validation.valid) {
      showModalErrors(validation.errors);
      return;
    }

    const existingId = modalRefs.idInput.value;
    modalRefs.submitBtn.disabled = true;
    try {
      if (existingId) {
        await updateTransaction(existingId, payload);
        callbacks.onToast('Transaction updated.');
      } else {
        await saveTransaction(payload);
        callbacks.onToast(
          `${payload.type === 'income' ? 'Income' : 'Expense'} added to ledger.`
        );
      }
      closeTransactionModal();
      if (onMutateCallback) await onMutateCallback();
    } catch (err) {
      callbacks.onToast(err.message || 'Failed to save transaction', 'error');
    } finally {
      modalRefs.submitBtn.disabled = false;
    }
  });
}

/* ==========================================================================
   Feature 3: Transaction History View
   ========================================================================== */

/**
 * Renders the Transaction History view with search, filters, sorting, edit, and delete.
 * @param {HTMLElement} container
 * @param {object} appState
 * @param {object} actions
 */
export function renderTransactionsView(container, appState, actions) {
  const allTransactions = getTransactions();
  const filters = appState.txFilters;

  // Collect unique months available in data + active month
  const availableMonths = Array.from(
    new Set([
      appState.activeMonth,
      ...allTransactions.map((tx) => tx.date.slice(0, 7)).filter(Boolean),
    ])
  ).sort((a, b) => b.localeCompare(a));

  const filtered = filterAndSortTransactions(allTransactions, filters);
  const filteredTotals = calculateTotals(filtered);

  const hasActiveFilters =
    filters.search !== '' ||
    filters.category !== 'all' ||
    filters.type !== 'all' ||
    filters.month !== 'all';

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h2 class="view-heading">Transaction History</h2>
        <p class="view-subtitle">Search, filter, edit, and audit every income and expense record.</p>
      </div>
      <div class="segmented-control" role="group" aria-label="Filter by transaction type">
        <button type="button" class="segment-btn ${filters.type === 'all' ? 'is-active' : ''}" data-filter-type="all">All</button>
        <button type="button" class="segment-btn ${filters.type === 'income' ? 'is-active' : ''}" data-filter-type="income">Income</button>
        <button type="button" class="segment-btn ${filters.type === 'expense' ? 'is-active' : ''}" data-filter-type="expense">Expenses</button>
      </div>
    </div>

    <div class="card">
      <div class="toolbar-grid">
        <div class="search-input-wrap">
          <i data-lucide="search" class="search-icon" aria-hidden="true"></i>
          <input
            type="search"
            id="tx-search-input"
            class="form-input search-input"
            placeholder="Search title, category, or notes..."
            value="${escapeHtml(filters.search)}"
            aria-label="Search transactions"
          />
        </div>

        <select id="tx-filter-category" class="form-select" aria-label="Filter by category">
          <option value="all">All Categories</option>
          ${ALL_CATEGORIES.map(
            (cat) =>
              `<option value="${escapeHtml(cat)}" ${
                filters.category === cat ? 'selected' : ''
              }>${escapeHtml(cat)}</option>`
          ).join('')}
        </select>

        <select id="tx-filter-month" class="form-select" aria-label="Filter by month">
          <option value="all" ${filters.month === 'all' ? 'selected' : ''}>All Months</option>
          ${availableMonths
            .map(
              (m) =>
                `<option value="${escapeHtml(m)}" ${
                  filters.month === m ? 'selected' : ''
                }>${escapeHtml(formatMonthLabel(m, 'short'))}</option>`
            )
            .join('')}
        </select>

        <select id="tx-sort-select" class="form-select" aria-label="Sort transactions">
          <option value="date-desc" ${filters.sortBy === 'date-desc' ? 'selected' : ''}>Date: Newest First</option>
          <option value="date-asc" ${filters.sortBy === 'date-asc' ? 'selected' : ''}>Date: Oldest First</option>
          <option value="amount-desc" ${filters.sortBy === 'amount-desc' ? 'selected' : ''}>Amount: High to Low</option>
          <option value="amount-asc" ${filters.sortBy === 'amount-asc' ? 'selected' : ''}>Amount: Low to High</option>
        </select>

        ${
          hasActiveFilters
            ? `<button type="button" id="btn-clear-filters" class="btn btn-secondary btn-sm">Clear</button>`
            : `<span></span>`
        }
      </div>

      <div class="filter-summary-bar">
        <span>Showing <strong class="tabular-nums">${filtered.length}</strong> of <strong class="tabular-nums">${allTransactions.length}</strong> transactions</span>
        <div class="filter-summary-metrics">
          <span>Income: <strong class="tabular-nums" style="color: var(--status-income)">${formatCurrency(filteredTotals.totalIncome)}</strong></span>
          <span>Expenses: <strong class="tabular-nums">${formatCurrency(filteredTotals.totalExpenses)}</strong></span>
          <span>Net: <strong class="tabular-nums">${formatCurrency(filteredTotals.totalBalance, { showPlus: true })}</strong></span>
        </div>
      </div>

      ${
        filtered.length === 0
          ? renderTransactionsEmptyState(allTransactions.length === 0)
          : `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Transaction</th>
                <th>Category</th>
                <th>Type</th>
                <th class="text-right">Amount</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map((tx) => renderTransactionRow(tx)).join('')}
            </tbody>
          </table>
        </div>
      `
      }
    </div>
  `;

  // Bind Filter & Search Listeners
  const searchInput = container.querySelector('#tx-search-input');
  searchInput.addEventListener('input', (e) => {
    actions.updateTxFilters({ search: e.target.value }, { preserveFocusId: 'tx-search-input' });
  });

  container.querySelectorAll('[data-filter-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      actions.updateTxFilters({ type: btn.dataset.filterType });
    });
  });

  container.querySelector('#tx-filter-category').addEventListener('change', (e) => {
    actions.updateTxFilters({ category: e.target.value });
  });

  container.querySelector('#tx-filter-month').addEventListener('change', (e) => {
    actions.updateTxFilters({ month: e.target.value });
  });

  container.querySelector('#tx-sort-select').addEventListener('change', (e) => {
    actions.updateTxFilters({ sortBy: e.target.value });
  });

  const clearBtn = container.querySelector('#btn-clear-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      actions.updateTxFilters({
        search: '',
        category: 'all',
        type: 'all',
        month: 'all',
        sortBy: 'date-desc',
      });
    });
  }

  const emptyAddBtn = container.querySelector('#btn-empty-add-tx');
  if (emptyAddBtn) {
    emptyAddBtn.addEventListener('click', () => {
      openTransactionModal(null, { defaultMonth: appState.activeMonth });
    });
  }

  const emptyResetFiltersBtn = container.querySelector('#btn-empty-reset-filters');
  if (emptyResetFiltersBtn) {
    emptyResetFiltersBtn.addEventListener('click', () => {
      actions.updateTxFilters({
        search: '',
        category: 'all',
        type: 'all',
        month: 'all',
        sortBy: 'date-desc',
      });
    });
  }

  // Bind Edit & Delete Row Buttons
  container.querySelectorAll('[data-edit-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tx = getTransactionById(btn.dataset.editId);
      if (tx) openTransactionModal(tx);
    });
  });

  container.querySelectorAll('[data-delete-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tx = getTransactionById(btn.dataset.deleteId);
      if (!tx) return;
      actions.confirmAction({
        title: 'Delete Transaction',
        message: `Are you sure you want to delete "${tx.title}" (${formatCurrency(tx.amount)})? This action cannot be undone.`,
        confirmLabel: 'Delete',
        onConfirm: async () => {
          try {
            await deleteTransaction(tx.id);
            actions.showToast('Transaction deleted.');
            actions.refreshAll();
          } catch (err) {
            actions.showToast(err.message || 'Failed to delete transaction', 'error');
          }
        },
      });
    });
  });
}

function renderTransactionRow(tx) {
  const isIncome = tx.type === 'income';
  return `
    <tr>
      <td class="tx-date tabular-nums">${escapeHtml(formatDate(tx.date))}</td>
      <td>
        <div class="tx-title-cell">
          <span class="tx-title">${escapeHtml(tx.title)}</span>
          ${tx.description ? `<span class="tx-desc" title="${escapeHtml(tx.description)}">${escapeHtml(tx.description)}</span>` : ''}
        </div>
      </td>
      <td class="tx-category">${escapeHtml(tx.category)}</td>
      <td>
        <span class="tx-type-label ${isIncome ? 'is-income' : 'is-expense'}">
          <i data-lucide="${isIncome ? 'arrow-down-left' : 'arrow-up-right'}" aria-hidden="true"></i>
          <span>${isIncome ? 'Income' : 'Expense'}</span>
        </span>
      </td>
      <td class="text-right tx-amount tabular-nums ${isIncome ? 'is-income' : 'is-expense'}">
        ${isIncome ? '+' : '-'}${formatCurrency(tx.amount)}
      </td>
      <td class="text-right">
        <div class="row-actions">
          <button
            type="button"
            class="icon-btn"
            data-edit-id="${escapeHtml(tx.id)}"
            aria-label="Edit ${escapeHtml(tx.title)}"
            title="Edit"
          >
            <i data-lucide="pencil" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="icon-btn is-danger"
            data-delete-id="${escapeHtml(tx.id)}"
            aria-label="Delete ${escapeHtml(tx.title)}"
            title="Delete"
          >
            <i data-lucide="trash-2" aria-hidden="true"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
}

function renderTransactionsEmptyState(noDataAtAll) {
  if (noDataAtAll) {
    return `
      <div class="empty-state">
        <div class="empty-icon-wrap">
          <i data-lucide="receipt" aria-hidden="true"></i>
        </div>
        <h3 class="empty-title">No transactions recorded yet</h3>
        <p class="empty-desc">Start tracking your finances by adding your first income or expense entry.</p>
        <button type="button" id="btn-empty-add-tx" class="btn btn-primary btn-sm">
          <i data-lucide="plus" class="btn-icon" aria-hidden="true"></i>
          <span>Add First Transaction</span>
        </button>
      </div>
    `;
  }

  return `
    <div class="empty-state">
      <div class="empty-icon-wrap">
        <i data-lucide="filter-x" aria-hidden="true"></i>
      </div>
      <h3 class="empty-title">No matching transactions</h3>
      <p class="empty-desc">Try adjusting your search query, category, or month filters.</p>
      <button type="button" id="btn-empty-reset-filters" class="btn btn-secondary btn-sm">
        Reset Filters
      </button>
    </div>
  `;
}
