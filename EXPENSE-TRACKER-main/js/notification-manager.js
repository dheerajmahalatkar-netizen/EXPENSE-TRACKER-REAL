/**
 * notification-manager.js
 * Centralized In-App Notification Center for SpendWise Money Guardian.
 *
 * Implements:
 * 1. Topbar notification bell icon with dynamic unread count badge.
 * 2. Notification dropdown drawer showing alerts, bill reminders, blocked attempts, and deposits.
 * 3. Mark as read & Mark all as read actions.
 * 4. Automatic badge updating and in-app feedback.
 */

import { fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead } from './guardian-service.js';
import { escapeHtml } from './transactions.js';

let cachedNotifications = [];
let unreadCount = 0;
let isDropdownOpen = false;

export async function refreshNotificationCenter() {
  try {
    const data = await fetchNotifications(30);
    cachedNotifications = data.notifications || [];
    unreadCount = data.unreadCount || 0;
    updateBadge();
    if (isDropdownOpen) {
      renderDropdownContent();
    }
  } catch (err) {
    console.warn('Failed to refresh notifications:', err);
  }
}

export function initNotificationCenter(actions) {
  const toggleBtn = document.getElementById('btn-notifications-toggle');
  const dropdown = document.getElementById('notif-dropdown');
  if (!toggleBtn || !dropdown) return;

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isDropdownOpen = !isDropdownOpen;
    dropdown.hidden = !isDropdownOpen;
    if (isDropdownOpen) {
      renderDropdownContent(actions);
    }
  });

  document.addEventListener('click', (e) => {
    if (isDropdownOpen && !dropdown.contains(e.target) && !toggleBtn.contains(e.target)) {
      isDropdownOpen = false;
      dropdown.hidden = true;
    }
  });

  // Initial fetch
  refreshNotificationCenter();
}

function updateBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;

  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

function renderDropdownContent(actions) {
  const dropdown = document.getElementById('notif-dropdown');
  if (!dropdown) return;

  dropdown.innerHTML = `
    <div class="notif-header">
      <div class="notif-title-row">
        <h4 class="notif-header-title">Notification Center</h4>
        ${unreadCount > 0 ? `<span class="notif-unread-pill">${unreadCount} Unread</span>` : ''}
      </div>
      <div class="notif-header-actions">
        ${
          unreadCount > 0
            ? `<button type="button" id="btn-mark-all-read" class="btn-text-action" title="Mark all as read">Mark all read</button>`
            : ''
        }
      </div>
    </div>

    <div class="notif-list-body">
      ${
        cachedNotifications.length === 0
          ? `
        <div class="empty-state notif-empty">
          <i data-lucide="bell-off" aria-hidden="true"></i>
          <p class="empty-desc">No notifications yet. You're completely up to date!</p>
        </div>
      `
          : cachedNotifications
              .map((n) => {
                const icon =
                  n.severity === 'critical'
                    ? 'alert-octagon'
                    : n.severity === 'warning'
                    ? 'alert-triangle'
                    : n.severity === 'success'
                    ? 'check-circle'
                    : 'info';

                const timeStr = n.created_at
                  ? new Date(n.created_at.replace(' ', 'T')).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Just now';

                return `
              <div class="notif-item ${n.is_read ? 'is-read' : 'is-unread'} severity-${escapeHtml(n.severity)}" data-notif-id="${escapeHtml(n.id)}">
                <div class="notif-icon-box">
                  <i data-lucide="${icon}" aria-hidden="true"></i>
                </div>
                <div class="notif-main">
                  <div class="notif-item-top">
                    <span class="notif-item-title">${escapeHtml(n.title)}</span>
                    <span class="notif-item-time tabular-nums">${timeStr}</span>
                  </div>
                  <p class="notif-item-desc">${escapeHtml(n.description)}</p>
                </div>
                ${
                  !n.is_read
                    ? `<button type="button" class="btn-mark-single-read icon-btn" data-notif-id="${escapeHtml(n.id)}" title="Mark as read"><i data-lucide="check" aria-hidden="true"></i></button>`
                    : ''
                }
              </div>
            `;
              })
              .join('')
      }
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // Bind mark all read
  dropdown.querySelector('#btn-mark-all-read')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await markAllNotificationsAsRead();
      cachedNotifications.forEach((n) => (n.is_read = 1));
      unreadCount = 0;
      updateBadge();
      renderDropdownContent(actions);
      if (actions && actions.showToast) actions.showToast('All notifications marked as read.');
    } catch (err) {
      if (actions && actions.showToast) actions.showToast(err.message, 'error');
    }
  });

  // Bind single mark read
  dropdown.querySelectorAll('.btn-mark-single-read').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.notifId;
      if (!id) return;
      try {
        await markNotificationAsRead(id);
        const item = cachedNotifications.find((n) => n.id === id);
        if (item) item.is_read = 1;
        unreadCount = Math.max(0, unreadCount - 1);
        updateBadge();
        renderDropdownContent(actions);
      } catch (err) {
        if (actions && actions.showToast) actions.showToast(err.message, 'error');
      }
    });
  });
}
