/**
 * Shared LivePanel page shell utilities.
 *
 * One implementation for every LivePanel template (file and directory):
 *  - theme persistence and toggling (both panels share one stored preference,
 *    'codexrLivePanelTheme'; charts restyle via CSS variables, no re-render);
 *  - the SSE connection status indicator (styles in panelShell.css);
 *  - transient notification toasts;
 *  - the DataTable registry (create once, update rows in place so live updates
 *    keep the user's search/sort state);
 *  - small shared formatters.
 *
 * Bundled by LivePanelParser ahead of each template's own script.
 */

// Theme management
function getStoredTheme() {
  try {
    return localStorage.getItem('codexrLivePanelTheme') || 'light';
  } catch (error) {
    console.warn('Failed to get stored theme:', error);
    return 'light';
  }
}

function setStoredTheme(theme) {
  try {
    localStorage.setItem('codexrLivePanelTheme', theme);
  } catch (error) {
    console.warn('Failed to store theme:', error);
  }
}

const THEME_ICON_SUN = '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg>';
const THEME_ICON_MOON = '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

// Inline SVG icons for the theme toggle. Using icons (not the words "Dark" /
// "Light") keeps the control compact and language-neutral; `stroke: currentColor`
// in the stylesheet colors them for whichever theme is active.
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    // In dark mode, offer the sun (switch to light); in light mode, the moon.
    themeToggle.innerHTML = theme === 'dark' ? THEME_ICON_SUN : THEME_ICON_MOON;
    themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
  }
  // Charts read their colors from CSS variables (charts.css), so switching the
  // body[data-theme] attribute restyles every chart with no re-render.
}

function toggleTheme() {
  const currentTheme = document.body.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
  setStoredTheme(newTheme);
}

function showSSEStatus(status) {
  let statusElement = document.getElementById('sse-status');
  if (!statusElement) {
    statusElement = document.createElement('div');
    statusElement.id = 'sse-status';
    statusElement.className = 'sse-status';
    document.body.appendChild(statusElement);
  }

  switch (status) {
    case 'connected':
      statusElement.textContent = 'Live Updates';
      statusElement.style.backgroundColor = '#10b981';
      statusElement.style.color = 'white';
      break;
    case 'error':
      statusElement.textContent = 'Disconnected';
      statusElement.style.backgroundColor = '#ef4444';
      statusElement.style.color = 'white';
      break;
  }
}

let sseStatusFlashTimer = null;

/**
 * Momentarily surface that fresh data arrived, then fall back to the steady
 * "Live Updates" indicator.
 */
function flashSSEStatus(message) {
  const statusElement = document.getElementById('sse-status');
  if (!statusElement) {
    return;
  }
  statusElement.textContent = message;
  statusElement.style.backgroundColor = '#3b82f6';
  statusElement.style.color = 'white';
  if (sseStatusFlashTimer) {
    clearTimeout(sseStatusFlashTimer);
  }
  sseStatusFlashTimer = setTimeout(() => {
    sseStatusFlashTimer = null;
    showSSEStatus('connected');
  }, 2500);
}

/**
 * Show update notification
 */
function showUpdateNotification() {
  showNotification('Analysis updated! Refreshing data...', '#3b82f6', 3000);
}

/**
 * Show reload completion notification
 */
function showReloadNotification() {
  showNotification('Data refreshed successfully!', '#10b981', 2000);
}

/**
 * Show a temporary notification
 */
function showNotification(message, backgroundColor = '#3b82f6', duration = 3000) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 50px;
    right: 10px;
    background: ${backgroundColor};
    color: white;
    padding: 10px 15px;
    border-radius: 4px;
    font-size: 14px;
    z-index: 1001;
    font-family: inherit;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Remove notification after specified duration
  setTimeout(() => {
    notification.remove();
  }, duration);
}

// ── Table registry ───────────────────────────────────────────────────────────
// Every list in this view is a shared DataTable. Instances are cached by mount
// id so live updates (SSE reloads, dependency refresh) re-render existing tables
// instead of rebuilding them and losing the user's current search/sort.
const dataTables = {};

function upsertDataTable(mountId, options, rows) {
  if (dataTables[mountId]) {
    dataTables[mountId].setRows(rows);
  } else {
    dataTables[mountId] = new DataTable(mountId, Object.assign({}, options, { rows: rows }));
  }
  return dataTables[mountId];
}

function formatRatio(value) {
  return `${((value || 0) * 100).toFixed(1)}%`;
}
