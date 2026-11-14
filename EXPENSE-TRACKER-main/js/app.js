/**
 * app.js
 * Application Entry Point & State Orchestrator
 * Coordinates navigation, global month context, modal confirmations,
 * toast notifications, CSV export, and view rendering across modules.
 */

import {
  migrateFromLocalStorageIfNeeded,
  syncFromBackend,
  seedInitialData,
  getTransactions,
  getLastError,
} from './storage.js';
import {
  getCurrentMonthKey,
  initTransactionModal,
  openTransactionModal,
  renderTransactionsView,
  escapeHtml,
} from './transactions.js';
import { renderDashboardView } from './dashboard.js';
import { renderAnalyticsView } from './analytics.js';
import { renderBudgetView } from './budget.js';
import { renderBankView } from './bank-view.js';
import {
  renderGuardianDashboard,
  renderBillsView,
  renderSavingsGoalsView,
  renderSettingsView,
  openGuardianSettingsModal,
} from './money-guardian.js';
import { renderHomepage } from './homepage.js';
import { initNotificationCenter, refreshNotificationCenter } from './notification-manager.js';
import { init3DEffects } from './interactive-3d.js';

const VIEW_TITLES = {
  home: 'SPEND WISE',
  dashboard: 'Dashboard',
  transactions: 'Transactions',
  analytics: 'Analytics',
  budget: 'Budget',
  bank: 'Smart Bank Connect',
  guardian: 'Money Guardian',
  bills: 'Bills & Subscriptions',
  goals: 'Savings Goals',
  settings: 'Settings',
};

const appState = {
  activeView: 'home',
  activeMonth: getCurrentMonthKey(),
  dashboardChartMode: 'daily',
  analyticsPeriod: '6m',
  txFilters: {
    search: '',
    category: 'all',
    type: 'all',
    month: 'all',
    sortBy: 'date-desc',
  },
};

let isLoadingData = false;

/* ==========================================================================
   Toast Notifications & Confirmation Modal
   ========================================================================== */

function showToast(message, variant = 'default') {
  const region = document.getElementById('toast-region');
  if (!region) return;

  const toast = document.createElement('div');
  toast.className = `toast ${variant === 'error' ? 'is-error' : ''}`;
  toast.innerHTML = `
    <i data-lucide="${variant === 'error' ? 'alert-circle' : 'check'}" aria-hidden="true"></i>
    <span>${escapeHtml(message)}</span>
  `;

  region.appendChild(toast);
  refreshIcons();

  setTimeout(() => {
    toast.remove();
  }, 3200);
}

let pendingConfirmCallback = null;

function initConfirmModal() {
  const overlay = document.getElementById('confirm-modal');
  const acceptBtn = document.getElementById('btn-accept-confirm');
  const cancelBtn = document.getElementById('btn-cancel-confirm');
  const closeBtn = document.getElementById('btn-close-confirm');

  const close = () => {
    overlay.hidden = true;
    pendingConfirmCallback = null;
  };

  cancelBtn.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  acceptBtn.addEventListener('click', () => {
    const fn = pendingConfirmCallback;
    close();
    if (typeof fn === 'function') fn();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) close();
  });
}

function confirmAction({ title, message, confirmLabel = 'Confirm', onConfirm }) {
  const overlay = document.getElementById('confirm-modal');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  document.getElementById('btn-accept-confirm').textContent = confirmLabel;
  pendingConfirmCallback = onConfirm;
  overlay.hidden = false;
  document.getElementById('btn-accept-confirm').focus();
}

/* ==========================================================================
   Lucide Icon Hydration
   ========================================================================== */

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

/* ==========================================================================
   View Rendering & Navigation
   ========================================================================== */

const actions = {
  async navigate(viewName) {
    if (!VIEW_TITLES[viewName]) return;
    appState.activeView = viewName;
    if (window.location.hash !== '#' + viewName) {
      window.location.hash = '#' + viewName;
    }
    closeMobileSidebar();
    renderApp();
    if (viewName === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  },

  setDashboardChartMode(mode) {
    appState.dashboardChartMode = mode === 'trend' ? 'trend' : 'daily';
    renderActiveView();
  },

  setAnalyticsPeriod(period) {
    appState.analyticsPeriod = period;
    renderActiveView();
  },

  updateTxFilters(partial, options = {}) {
    appState.txFilters = { ...appState.txFilters, ...partial };
    renderActiveView();

    // Restore focus and cursor position during live search typing
    if (options.preserveFocusId) {
      const el = document.getElementById(options.preserveFocusId);
      if (el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    }
  },

  async refreshAll() {
    try {
      await syncFromBackend(appState.activeMonth);
      await refreshNotificationCenter();
    } catch (err) {
      console.warn('Sync warning:', err);
    }
    renderActiveView();
  },

  showToast,
  confirmAction,
};

function renderActiveView() {
  const panels = {
    home: document.getElementById('view-home'),
    dashboard: document.getElementById('view-dashboard'),
    transactions: document.getElementById('view-transactions'),
    analytics: document.getElementById('view-analytics'),
    budget: document.getElementById('view-budget'),
    bank: document.getElementById('view-bank'),
    guardian: document.getElementById('view-guardian'),
    bills: document.getElementById('view-bills'),
    goals: document.getElementById('view-goals'),
    settings: document.getElementById('view-settings'),
  };

  // Toggle home-view full width styling on body
  if (appState.activeView === 'home') {
    document.body.classList.add('is-home-view');
  } else {
    document.body.classList.remove('is-home-view');
  }

  for (const [name, el] of Object.entries(panels)) {
    if (!el) continue;
    const isActive = name === appState.activeView;
    el.hidden = !isActive;
    el.classList.toggle('is-active', isActive);
  }

  const activeContainer = panels[appState.activeView];
  if (!activeContainer) return;

  if (appState.activeView === 'home') {
    renderHomepage(activeContainer, appState, actions);
    return;
  }

  if (isLoadingData) {
    activeContainer.innerHTML = `
      <div class="card" style="margin-top: 24px;">
        <div class="empty-state">
          <div class="empty-icon-wrap">
            <i data-lucide="loader" aria-hidden="true"></i>
          </div>
          <h3 class="empty-title">Loading financial records...</h3>
          <p class="empty-desc">Connecting to backend server.</p>
        </div>
      </div>
    `;
    refreshIcons();
    return;
  }

  if (appState.activeView === 'dashboard') {
    renderDashboardView(activeContainer, appState, actions);
  } else if (appState.activeView === 'transactions') {
    renderTransactionsView(activeContainer, appState, actions);
  } else if (appState.activeView === 'analytics') {
    renderAnalyticsView(activeContainer, appState, actions);
  } else if (appState.activeView === 'budget') {
    renderBudgetView(activeContainer, appState, actions);
  } else if (appState.activeView === 'bank') {
    renderBankView(activeContainer, appState, actions);
  } else if (appState.activeView === 'guardian') {
    renderGuardianDashboard(activeContainer, appState, actions);
  } else if (appState.activeView === 'bills') {
    renderBillsView(activeContainer, appState, actions);
  } else if (appState.activeView === 'goals') {
    renderSavingsGoalsView(activeContainer, appState, actions);
  } else if (appState.activeView === 'settings') {
    renderSettingsView(activeContainer, appState, actions);
  }

  // Display backend connection error banner if backend is unreachable
  const errorMsg = getLastError();
  if (errorMsg) {
    const errorBanner = `
      <div class="alert-banner is-exceeded" role="alert" style="margin-bottom: 20px;">
        <i data-lucide="alert-circle" aria-hidden="true"></i>
        <div>
          <div class="alert-title">Backend Connection Error</div>
          <div class="alert-desc">${escapeHtml(errorMsg)}. Make sure the Node.js server is running on http://localhost:3000.</div>
        </div>
      </div>
    `;
    activeContainer.insertAdjacentHTML('afterbegin', errorBanner);
  }

  refreshIcons();
}

function renderApp() {
  // Update sidebar active state
  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    const active = btn.dataset.view === appState.activeView;
    btn.classList.toggle('is-active', active);
    if (active) {
      btn.setAttribute('aria-current', 'page');
    } else {
      btn.removeAttribute('aria-current');
    }
  });

  // Update topbar title
  const topbarTitle = document.getElementById('topbar-title');
  if (topbarTitle) {
    topbarTitle.textContent = VIEW_TITLES[appState.activeView] || 'Dashboard';
  }

  // Sync month picker
  const monthInput = document.getElementById('global-month-picker');
  if (monthInput && monthInput.value !== appState.activeMonth) {
    monthInput.value = appState.activeMonth;
  }

  renderActiveView();
}

/* ==========================================================================
   Month Stepper & Mobile Drawer Controls
   ========================================================================== */

async function shiftMonth(delta) {
  const [y, m] = appState.activeMonth.split('-').map(Number);
  const next = new Date(y, m - 1 + delta, 1);
  appState.activeMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  try {
    await syncFromBackend(appState.activeMonth);
  } catch (err) {
    console.warn('Sync failed on month shift:', err);
  }
  renderApp();
}

function openMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const menuBtn = document.getElementById('btn-mobile-menu');
  sidebar.classList.add('is-open');
  backdrop.hidden = false;
  menuBtn.setAttribute('aria-expanded', 'true');
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const menuBtn = document.getElementById('btn-mobile-menu');
  sidebar.classList.remove('is-open');
  backdrop.hidden = true;
  menuBtn.setAttribute('aria-expanded', 'false');
}

/* ==========================================================================
   CSV Export Utility
   ========================================================================== */

function exportTransactionsCSV() {
  const txs = getTransactions();
  if (txs.length === 0) {
    showToast('No transactions available to export.', 'error');
    return;
  }

  const headers = ['ID', 'Title', 'Amount', 'Category', 'Type', 'Date', 'Description'];
  const csvEscape = (val) => {
    const str = String(val ?? '');
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = txs.map((tx) =>
    [tx.id, tx.title, tx.amount, tx.category, tx.type, tx.date, tx.description]
      .map(csvEscape)
      .join(',')
  );

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `clearledger-transactions-${appState.activeMonth}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`Exported ${txs.length} transactions to CSV.`);
}

/* ==========================================================================
   Bootstrap
   ========================================================================== */

async function bootstrap() {
  initConfirmModal();
  initTransactionModal({
    onSave: async () => {
      try {
        await syncFromBackend(appState.activeMonth);
      } catch (err) {
        console.warn('Sync failed after save:', err);
      }
      renderActiveView();
    },
    onToast: showToast,
  });

  // Navigation listeners
  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      actions.navigate(btn.dataset.view);
    });
  });

  // Topbar primary CTA
  document.getElementById('btn-open-add-modal').addEventListener('click', () => {
    openTransactionModal(null, { defaultMonth: appState.activeMonth });
  });

  // Month navigation
  const monthInput = document.getElementById('global-month-picker');
  monthInput.value = appState.activeMonth;
  monthInput.addEventListener('change', async (e) => {
    if (e.target.value && /^\d{4}-\d{2}$/.test(e.target.value)) {
      appState.activeMonth = e.target.value;
      try {
        await syncFromBackend(appState.activeMonth);
      } catch (err) {
        console.warn('Sync failed on month picker change:', err);
      }
      renderApp();
    }
  });

  document.getElementById('btn-prev-month').addEventListener('click', () => shiftMonth(-1));
  document.getElementById('btn-next-month').addEventListener('click', () => shiftMonth(1));

  // Mobile sidebar toggle
  document.getElementById('btn-mobile-menu').addEventListener('click', () => {
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar.classList.contains('is-open')) {
      closeMobileSidebar();
    } else {
      openMobileSidebar();
    }
  });
  document.getElementById('sidebar-backdrop').addEventListener('click', closeMobileSidebar);

  // Sidebar Data Tools
  document.getElementById('btn-export-csv').addEventListener('click', exportTransactionsCSV);
  document.getElementById('btn-restore-demo').addEventListener('click', () => {
    confirmAction({
      title: 'Reset Sample Data',
      message:
        'This will populate the database with sample starter transactions.',
      confirmLabel: 'Reset Data',
      onConfirm: async () => {
        try {
          await seedInitialData(true);
          appState.activeMonth = getCurrentMonthKey();
          await syncFromBackend(appState.activeMonth);
          showToast('Sample dataset restored.');
          renderApp();
        } catch (err) {
          showToast(err.message || 'Failed to populate sample data', 'error');
        }
      },
    });
  });

  // Initialize Notification Center & 3D Interactive Engine
  initNotificationCenter(actions);
  init3DEffects();

  // URL Hash Routing Support
  window.addEventListener('hashchange', () => {
    const rawHash = window.location.hash.replace(/^#/, '');
    if (VIEW_TITLES[rawHash] && rawHash !== appState.activeView) {
      actions.navigate(rawHash);
    }
  });

  const initialHash = window.location.hash.replace(/^#/, '');
  if (VIEW_TITLES[initialHash]) {
    appState.activeView = initialHash;
  } else {
    appState.activeView = 'home';
  }

  // Initial Data Sync & One-time LocalStorage Migration
  isLoadingData = true;
  renderLoadingState();

  try {
    const migration = await migrateFromLocalStorageIfNeeded();
    if (migration.migrated && migration.txCount > 0) {
      showToast(`Imported ${migration.txCount} transactions from LocalStorage.`);
    }

    // Sync active month data from API
    const synced = await syncFromBackend(appState.activeMonth);

    // If database is completely empty on very first launch, seed sample dataset once
    if (synced.transactions.length === 0) {
      await seedInitialData(true);
      await syncFromBackend(appState.activeMonth);
    }
  } catch (err) {
    console.error('Bootstrap data initialization failed:', err);
    showToast('Could not connect to backend server. Make sure it is running.', 'error');
  } finally {
    isLoadingData = false;
    renderApp();
  }
}

function renderLoadingState() {
  const panels = {
    dashboard: document.getElementById('view-dashboard'),
    transactions: document.getElementById('view-transactions'),
    analytics: document.getElementById('view-analytics'),
    budget: document.getElementById('view-budget'),
  };
  const activeContainer = panels[appState.activeView];
  if (!activeContainer) return;

  activeContainer.innerHTML = `
    <div class="card" style="margin-top: 24px;">
      <div class="empty-state">
        <div class="empty-icon-wrap">
          <i data-lucide="loader" aria-hidden="true"></i>
        </div>
        <h3 class="empty-title">Loading financial records...</h3>
        <p class="empty-desc">Connecting to backend database.</p>
      </div>
    </div>
  `;
  refreshIcons();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
