// Achievement Watcher — Game Bar widget JS
// Connects to the service WS, renders unlock toasts, acks notifications.

'use strict';

/** @type {{ port: number; token: string } | null} */
let config = null;

/** @type {WebSocket | null} */
let ws = null;

let reconnectTimer = null;

const container = document.getElementById('toast-container');

// ── Config from C# host (PostWebMessageAsJson) ────────────────────────────────

window.chrome.webview.addEventListener('message', (event) => {
  try {
    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    if (data && typeof data.token === 'string' && typeof data.port === 'number') {
      config = { port: data.port, token: data.token };
      connect();
    }
  } catch (err) {
    console.error('[widget] Failed to parse config message:', err);
  }
});

// ── WebSocket connection ──────────────────────────────────────────────────────

function connect() {
  if (!config) return;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  ws = new WebSocket(`ws://127.0.0.1:${config.port}`);

  ws.addEventListener('open', () => {
    console.log('[widget] WS connected');
    ws.send(JSON.stringify({ type: 'client:identify', role: 'widget', token: config.token }));
    ws.send(JSON.stringify({ type: 'state:request' }));
  });

  ws.addEventListener('message', (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    handleMessage(msg);
  });

  ws.addEventListener('close', () => {
    console.log('[widget] WS closed — reconnecting in 5s');
    ws = null;
    reconnectTimer = setTimeout(connect, 5000);
  });

  ws.addEventListener('error', (err) => {
    console.error('[widget] WS error:', err);
  });
}

// ── Message handling ──────────────────────────────────────────────────────────

/** @param {any} msg */
function handleMessage(msg) {
  switch (msg.type) {
    case 'state:sync': {
      const pending = Array.isArray(msg.pending) ? msg.pending : [];
      if (pending.length > 5) {
        // Show summary toast for first + N others
        const first = pending[0];
        const rest = pending.length - 1;
        showSummaryToast(first, rest);
        // Ack all
        for (const item of pending) {
          ack(item.id);
        }
      } else {
        // Show toasts 200ms apart
        pending.forEach((item, i) => {
          setTimeout(() => {
            showToast(item);
            ack(item.id);
          }, i * 200);
        });
      }
      break;
    }

    case 'achievement:unlock': {
      showToast(msg);
      ack(msg.id);
      break;
    }

    // schema:update not needed in widget
  }
}

/** @param {string} id */
function ack(id) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'notification:ack', id }));
  }
}

// ── Toast rendering ───────────────────────────────────────────────────────────

/** @param {any} item */
function showToast(item) {
  const toast = document.createElement('div');
  toast.className = 'aw-toast';

  const iconHtml = item.iconUrl
    ? `<img class="aw-toast-icon" src="${esc(item.iconUrl)}" alt="" onerror="this.style.display='none'" />`
    : `<div class="aw-toast-icon-placeholder">&#x1F3C6;</div>`;

  toast.innerHTML = `
    ${iconHtml}
    <div class="aw-toast-body">
      <div class="aw-toast-label">Achievement Unlocked</div>
      <div class="aw-toast-name">${esc(item.achievementName || item.achievementId)}</div>
      ${item.achievementDesc ? `<div class="aw-toast-desc">${esc(item.achievementDesc)}</div>` : ''}
      <div class="aw-toast-game">${esc(item.gameTitle)}</div>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('aw-out');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

/**
 * @param {any} first
 * @param {number} rest
 */
function showSummaryToast(first, rest) {
  const name = first.achievementName || first.achievementId;
  const toast = document.createElement('div');
  toast.className = 'aw-toast';

  const iconHtml = first.iconUrl
    ? `<img class="aw-toast-icon" src="${esc(first.iconUrl)}" alt="" onerror="this.style.display='none'" />`
    : `<div class="aw-toast-icon-placeholder">&#x1F3C6;</div>`;

  toast.innerHTML = `
    ${iconHtml}
    <div class="aw-toast-body">
      <div class="aw-toast-label">Achievements Unlocked</div>
      <div class="aw-toast-name">${esc(name)} + ${rest} other${rest !== 1 ? 's' : ''}</div>
      <div class="aw-toast-game">${esc(first.gameTitle)}</div>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('aw-out');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

/** @param {string} s */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
