/* =========================================================
   Serenity Hub ADMIN DASHBOARD - CLIENT CONTROLLER
   Handles real-time preview, CRUD, server status, and auth
   ========================================================= */

// State
let allAnnouncements = [];
let currentApiUrl = `${window.location.origin}/api/announcements/latest`;
let dismissTimer = null;
let progressInterval = null;

// DOM Elements
const announcementForm = document.getElementById('announcementForm');
const editIdInput = document.getElementById('editAnnouncementId');
const messageInput = document.getElementById('announcementMessage');
const typeSelect = document.getElementById('announcementType');
const durationSelect = document.getElementById('announcementDuration');

const gameSelection = document.getElementById('gameSelection');
const customGameGroup = document.getElementById('customGameGroup');
const customGameInput = document.getElementById('customGameInput');
const gameTargetHint = document.getElementById('gameTargetHint');
const charCountSpan = document.getElementById('charCount');
const submitBtnText = document.getElementById('submitBtnText');
const formHeading = document.getElementById('formHeading');
const editingIndicator = document.getElementById('editingIndicator');
const editingIdText = document.getElementById('editingIdText');


// Preview Elements
const previewTitle = document.getElementById('previewTitle');
const previewMessage = document.getElementById('previewMessage');
const previewTypeBadge = document.getElementById('previewTypeBadge');
const previewDurationBadge = document.getElementById('previewDurationBadge');
const previewTargetTag = document.getElementById('previewTargetTag');
const popupProgressFill = document.getElementById('popupProgressFill');
const popupCard = document.getElementById('popupCard');

// Status Elements
const apiStatusPill = document.getElementById('apiStatusPill');
const apiStatusText = document.getElementById('apiStatusText');
const serverModeText = document.getElementById('serverModeText');
const latestIdBadge = document.getElementById('latestIdBadge');
const clientModeBadge = document.getElementById('clientModeBadge');
const apiUrlDisplay = document.getElementById('apiUrlDisplay');

// Auth Elements
const authStatusBadge = document.getElementById('authStatusBadge');
const authStatusText = document.getElementById('authStatusText');
const logoutBtn = document.getElementById('logoutBtn');
const authModal = document.getElementById('authModal');
const adminPasswordInput = document.getElementById('adminPasswordInput');
const authErrorMsg = document.getElementById('authErrorMsg');

// Telemetry Elements (Serenity Hub Style)
const statActiveNow = document.getElementById('statActiveNow');
const statExecutionsToday = document.getElementById('statExecutionsToday');
const statThisMonth = document.getElementById('statThisMonth');
const statAllTime = document.getElementById('statAllTime');
const telemetryUpdatedText = document.getElementById('telemetryUpdatedText');

// History Table
const historyTableBody = document.getElementById('historyTableBody');

// =========================================================
// INITIALIZATION
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkAuthStatus();
  updateLivePreview();
  fetchServerStatus();
  loadAnnouncements();
  fetchTelemetryStats();
  initWebChat();

  // Periodic telemetry poll every 5 seconds
  setInterval(fetchTelemetryStats, 5000);

  // Periodic server status poll every 15 seconds
  setInterval(fetchServerStatus, 15000);
});

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-US');
}

async function fetchTelemetryStats(manual = false) {
  try {
    const res = await fetch('/api/stats?_t=' + Date.now());
    if (!res.ok) throw new Error('Stats request failed');
    const data = await res.json();

    const activeCount = typeof data.activeNow === 'number' ? data.activeNow : 0;
    if (statActiveNow) statActiveNow.textContent = formatNumber(activeCount);
    if (statExecutionsToday) statExecutionsToday.textContent = formatNumber(data.executionsToday ?? 0);
    if (statThisMonth) statThisMonth.textContent = formatNumber(data.thisMonth ?? 0);
    if (statAllTime) statAllTime.textContent = formatNumber(data.allTime ?? 0);

    const webChatOnline = document.getElementById('webChatOnlineCount');
    if (webChatOnline) webChatOnline.textContent = `${formatNumber(activeCount)} online`;

    if (telemetryUpdatedText) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
      telemetryUpdatedText.textContent = `Updated: ${timeStr}`;
    }

    if (manual) {
      showToast('Telemetry statistics refreshed.', 'info');
    }
  } catch (err) {
    console.error('Error fetching telemetry stats:', err);
  }
}

function setupEventListeners() {
  // Real-time preview triggers
  messageInput.addEventListener('input', () => {
    charCountSpan.textContent = messageInput.value.length;
    updateLivePreview();
  });


  typeSelect.addEventListener('change', () => {
    updateLivePreview();
    startPreviewProgress();
  });
  durationSelect.addEventListener('change', () => {
    updateLivePreview();
    startPreviewProgress();
  });

  if (gameSelection) {
    gameSelection.addEventListener('change', handleGameSelectChange);
  }
}

function handleGameSelectChange() {
  const selected = gameSelection.value;
  
  if (selected === 'all') {
    customGameGroup.style.display = 'none';
    gameTargetHint.textContent = 'Sends this announcement to every player connected to the whole hub.';
  } else if (selected === 'Ride A Pet') {
    customGameGroup.style.display = 'none';
    gameTargetHint.textContent = 'Only players currently playing or running Ride A Pet will receive this.';
  } else if (selected === 'Escape Tsunami For Brainrots') {
    customGameGroup.style.display = 'none';
    gameTargetHint.textContent = 'Only players currently playing or running Escape Tsunami will receive this.';
  } else if (selected === 'custom') {
    customGameGroup.style.display = 'block';
    gameTargetHint.textContent = 'Only players running this custom game script will receive this.';
    customGameInput.focus();
  }

  updateLivePreview();
}

function handleCustomGameInput() {
  updateLivePreview();
}


// =========================================================
// LIVE PREVIEW CONTROLLER
// =========================================================

function updateLivePreview() {
  const message = (messageInput && messageInput.value.trim()) || 'Type a message above to see how it will appear inside Serenity Hub.';

  if (previewMessage) {
    previewMessage.textContent = message;
  }

  // Auto-update header and glowing accent based on selected Announcement Category
  const cat = (typeSelect && typeSelect.value) ? typeSelect.value.toLowerCase() : 'update';
  let titleText = 'Serenity Announcement';
  let accentColor = '#60a5fa';
  let borderGlow = 'rgba(0, 132, 255, 0.35)';

  if (cat === 'update') {
    titleText = 'Serenity Update';
    accentColor = '#38bdf8';
    borderGlow = 'rgba(0, 229, 255, 0.4)';
  } else if (cat === 'important') {
    titleText = 'Serenity Notice';
    accentColor = '#fbbf24';
    borderGlow = 'rgba(245, 158, 11, 0.4)';
  } else if (cat === 'warning') {
    titleText = 'Serenity Warning';
    accentColor = '#f87171';
    borderGlow = 'rgba(239, 68, 68, 0.45)';
  } else if (cat === 'maintenance') {
    titleText = 'Serenity Maintenance';
    accentColor = '#c084fc';
    borderGlow = 'rgba(168, 85, 247, 0.4)';
  } else {
    titleText = 'Serenity Announcement';
    accentColor = '#60a5fa';
    borderGlow = 'rgba(0, 132, 255, 0.35)';
  }

  if (previewTitle) {
    previewTitle.textContent = titleText;
    previewTitle.style.color = accentColor;
  }

  if (popupCard) {
    popupCard.style.boxShadow = `0 16px 40px rgba(0, 0, 0, 0.9), 0 0 24px ${borderGlow}`;
  }
}



function startPreviewProgress() {
  clearInterval(progressInterval);
  clearTimeout(dismissTimer);

  popupCard.style.opacity = '1';
  popupCard.style.transform = 'scale(1)';

  const durationVal = durationSelect.value;
  if (durationVal === 'persistent') {
    popupProgressFill.style.width = '100%';
    return;
  }

  const seconds = parseInt(durationVal, 10) || 10;
  const totalMs = seconds * 1000;
  const intervalMs = 50;
  let elapsed = 0;

  popupProgressFill.style.width = '100%';

  progressInterval = setInterval(() => {
    elapsed += intervalMs;
    const remainingRatio = Math.max(0, 1 - (elapsed / totalMs));
    popupProgressFill.style.width = `${remainingRatio * 100}%`;

    if (elapsed >= totalMs) {
      clearInterval(progressInterval);
    }
  }, intervalMs);
}

function simulateDismiss() {
  popupCard.style.transform = 'scale(0.95)';
  popupCard.style.opacity = '0.4';
  showToast('Preview dismissed. Click anywhere on form to restore.', 'info');

  setTimeout(() => {
    popupCard.style.transform = 'scale(1)';
    popupCard.style.opacity = '1';
    startPreviewProgress();
  }, 1800);
}

function handleGameSelectChange() {
  if (!gameSelection) return;
  const val = gameSelection.value;
  const opt = gameSelection.selectedOptions[0];
  const name = opt ? (opt.getAttribute('data-name') || opt.textContent) : val;

  if (val === 'custom') {
    if (customGameGroup) customGameGroup.style.display = 'block';
    if (gameTargetHint) gameTargetHint.textContent = 'Sends this announcement only to the custom module specified.';
    if (customGameInput) customGameInput.focus();
  } else if (val === 'all') {
    if (customGameGroup) customGameGroup.style.display = 'none';
    if (gameTargetHint) gameTargetHint.textContent = 'Sends this announcement to every player connected to Serenity Hub across all supported games.';
  } else {
    if (customGameGroup) customGameGroup.style.display = 'none';
    if (gameTargetHint) gameTargetHint.textContent = `Targeted only to players inside "${name}". Other games will ignore this broadcast.`;
  }
}

function scrollToPreview() {
  const preview = document.getElementById('previewSection');
  preview.scrollIntoView({ behavior: 'smooth' });
  startPreviewProgress();
}

// =========================================================
// SERVER STATUS & STATS
// =========================================================

async function fetchServerStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('API offline');
    const data = await res.json();

    apiStatusText.textContent = data.status || 'Online';
    apiStatusPill.className = 'pill pill-green';
    serverModeText.textContent = data.status || 'Online';
    
    if (data.latestAnnouncementId) {
      latestIdBadge.textContent = `ID ${data.latestAnnouncementId}`;
      latestIdBadge.title = data.latestAnnouncementTitle || '';
    } else {
      latestIdBadge.textContent = 'None Active';
    }

    clientModeBadge.textContent = data.clientMode || 'Local development mode';
    
    if (data.apiUrl) {
      currentApiUrl = data.apiUrl;
      apiUrlDisplay.textContent = data.apiUrl;
    }
  } catch (err) {
    apiStatusText.textContent = 'Offline';
    apiStatusPill.className = 'pill pill-warning';
    serverModeText.textContent = 'Unreachable';
    console.warn('[Status] Unable to reach backend:', err.message);
  }
}

function copyApiUrl() {
  const text = currentApiUrl || apiUrlDisplay.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyUrlBtn');
    const origHTML = btn.innerHTML;
    btn.innerHTML = `<span>COPIED!</span>`;
    showToast('Copied API URL to clipboard: ' + text, 'success');
    setTimeout(() => {
      btn.innerHTML = origHTML;
    }, 2000);
  }).catch(() => {
    // Fallback for older browsers
    const tempInput = document.createElement('input');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showToast('Copied API URL to clipboard', 'success');
  });
}

function copyLuaCode() {
  const code = document.getElementById('luaSnippetBlock').innerText;
  navigator.clipboard.writeText(code).then(() => {
    showToast('Copied Lua integration code to clipboard!', 'success');
  });
}

// =========================================================
// AUTHENTICATION MANAGEMENT
// =========================================================

function getSavedAdminPassword() {
  return sessionStorage.getItem('Serenity_admin_password') || '';
}

function checkAuthStatus() {
  const pass = getSavedAdminPassword();
  const loginGatewayView = document.getElementById('loginGatewayView');
  const adminDashboardView = document.getElementById('adminDashboardView');

  if (pass) {
    if (loginGatewayView) loginGatewayView.style.display = 'none';
    if (adminDashboardView) adminDashboardView.style.display = 'block';

    if (authStatusBadge) {
      authStatusBadge.className = 'auth-badge auth-unlocked';
      authStatusText.textContent = 'Admin Authorized';
    }
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
  } else {
    if (loginGatewayView) loginGatewayView.style.display = 'flex';
    if (adminDashboardView) adminDashboardView.style.display = 'none';

    if (authStatusBadge) {
      authStatusBadge.className = 'auth-badge auth-locked';
      authStatusText.textContent = 'Admin Key Required';
    }
    if (logoutBtn) logoutBtn.style.display = 'none';
    
    const input = document.getElementById('gatewayPasswordInput');
    if (input) setTimeout(() => input.focus(), 150);
  }
}

async function handleGatewayLogin(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('gatewayPasswordInput');
  const errorEl = document.getElementById('gatewayErrorMsg');
  const submitBtn = document.getElementById('gatewaySubmitBtn');
  const pass = input ? input.value.trim() : '';

  if (!pass) {
    if (errorEl) {
      errorEl.textContent = 'Please enter your administrator password.';
      errorEl.style.display = 'block';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>VERIFYING...</span>`;
  }

  try {
    const res = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      if (errorEl) {
        errorEl.textContent = data.error || 'Incorrect admin password. Please try again.';
        errorEl.style.display = 'block';
      }
      if (input) {
        input.select();
        input.focus();
      }
      return;
    }

    sessionStorage.setItem('Serenity_admin_password', pass);
    if (errorEl) errorEl.style.display = 'none';

    checkAuthStatus();
    fetchTelemetryStats();
    loadAnnouncements();
    showToast('Welcome to Serenity Hub Admin', 'success');
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = 'Unable to connect to backend server.';
      errorEl.style.display = 'block';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>ENTER ADMIN CONSOLE</span>
        <svg class="btn-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>`;
    }
  }
}

function openAuthModal() {
  authModal.classList.add('active');
  authErrorMsg.style.display = 'none';
  adminPasswordInput.value = getSavedAdminPassword();
  setTimeout(() => adminPasswordInput.focus(), 100);
}

function closeAuthModal() {
  authModal.classList.remove('active');
}

async function saveAdminPassword() {
  const pass = adminPasswordInput.value.trim();
  if (!pass) {
    authErrorMsg.textContent = 'Please enter a password.';
    authErrorMsg.style.display = 'block';
    return;
  }

  // Validate with backend
  try {
    const res = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      authErrorMsg.textContent = data.error || 'Invalid password. Check your .env file.';
      authErrorMsg.style.display = 'block';
      return;
    }

    sessionStorage.setItem('Serenity_admin_password', pass);
    checkAuthStatus();
    closeAuthModal();
    showToast('Administrator authorized successfully!', 'success');
  } catch (err) {
    authErrorMsg.textContent = 'Connection error checking password.';
    authErrorMsg.style.display = 'block';
  }
}

function logoutAdmin() {
  sessionStorage.removeItem('Serenity_admin_password');
  checkAuthStatus();
  showToast('Logged out of admin session.', 'info');
  const input = document.getElementById('gatewayPasswordInput');
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 150);
  }
}

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const pass = getSavedAdminPassword();
  if (pass) {
    headers['x-admin-password'] = pass;
  }
  return headers;
}

// =========================================================
// CRUD: ANNOUNCEMENTS
// =========================================================

async function loadAnnouncements() {
  try {
    const res = await fetch('/api/announcements');
    if (!res.ok) throw new Error('Failed to load announcements');
    const data = await res.json();
    allAnnouncements = data;
    if (historyTableBody) {
      renderHistoryTable(data);
    }
  } catch (err) {
    console.error('Error loading history:', err);
    if (historyTableBody) {
      historyTableBody.innerHTML = `<tr><td colspan="8" class="empty-state">Failed to load announcement history.</td></tr>`;
    }
  }
}

function renderHistoryTable(list) {
  if (!historyTableBody) return;
  if (!list || list.length === 0) {
    historyTableBody.innerHTML = `<tr><td colspan="8" class="empty-state">No announcements created yet. Send your first announcement above!</td></tr>`;
    return;
  }

  historyTableBody.innerHTML = list.map(item => {
    const dateFormatted = formatTimestamp(item.createdAt);
    const typeUpper = (item.type || 'announcement').toUpperCase();
    const typeClass = `badge-${(item.type || 'announcement').toLowerCase().replace(/\s+/g, '-')}`;
    
    let targetDisplay = '<span class="status-badge status-active" style="font-size:0.7rem;">🌐 All Games</span>';
    const mod = (item.targetModule || '').toLowerCase().trim();
    if (item.target === 'module' && item.targetModule && mod !== 'all' && mod !== 'everyone') {
      if (mod.includes('ride') || mod.includes('pet')) {
        targetDisplay = '<span class="status-badge" style="background: rgba(139,92,246,0.15); color: #c084fc; border: 1px solid rgba(139,92,246,0.3); font-size:0.7rem;">🐾 Ride A Pet</span>';
      } else if (mod.includes('tsunami') || mod.includes('brainrot')) {
        targetDisplay = '<span class="status-badge" style="background: rgba(59,130,246,0.15); color: #93c5fd; border: 1px solid rgba(59,130,246,0.3); font-size:0.7rem;">🌊 Escape Tsunami</span>';
      } else {
        targetDisplay = `<span class="status-badge" style="background: rgba(245,158,11,0.15); color: #fcd34d; border: 1px solid rgba(245,158,11,0.3); font-size:0.7rem;">🎮 ${escapeHtml(item.targetModule)}</span>`;
      }
    }

    const isActive = item.active === true;
    const statusBadge = isActive 
      ? `<span class="status-badge status-active"><span class="pill-dot"></span> Active</span>` 
      : `<span class="status-badge status-inactive">Inactive</span>`;

    const toggleBtnLabel = isActive ? 'Disable' : 'Enable';


    return `
      <tr data-id="${item.id}">
        <td><strong>#${item.id}</strong></td>
        <td><div class="announcement-row-msg" style="max-width: 340px; white-space: normal;" title="${escapeHtml(item.message)}">${escapeHtml(item.message)}</div></td>
        <td>${targetDisplay}</td>
        <td><span class="popup-type-badge ${typeClass}">${typeUpper}</span></td>
        <td><span style="font-size:0.75rem; color: var(--text-dim);">${dateFormatted}</span></td>
        <td>${statusBadge}</td>
        <td>
          <div class="table-actions">
            <button class="action-btn btn-toggle" onclick="toggleActive(${item.id}, ${isActive})">
              ${toggleBtnLabel}
            </button>
            <button class="action-btn btn-edit" onclick="editAnnouncement(${item.id})">
              Edit
            </button>
            <button class="action-btn btn-delete" onclick="deleteAnnouncement(${item.id})">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const message = messageInput.value.trim();
  const type = typeSelect.value;
  const duration = durationSelect.value;
  const selectedOpt = gameSelection ? gameSelection.selectedOptions[0] : null;
  const selectedVal = gameSelection ? gameSelection.value : 'all';

  let target = 'everyone';
  let targetModule = 'all';
  let targetPlaceId = '';

  if (selectedVal === 'all') {
    target = 'everyone';
    targetModule = 'all';
    targetPlaceId = '';
  } else if (selectedVal === 'custom') {
    target = 'module';
    targetModule = customGameInput ? customGameInput.value.trim() : 'all';
    targetPlaceId = '';
  } else {
    target = 'module';
    targetPlaceId = selectedVal; // Exact Roblox Place ID
    targetModule = selectedOpt ? (selectedOpt.getAttribute('data-name') || selectedVal) : selectedVal;
  }

  const editId = editIdInput.value;

  if (!message) {
    showToast('Please provide an announcement message.', 'error');
    return;
  }

  // Ensure user has admin password set
  if (!getSavedAdminPassword()) {
    openAuthModal();
    showToast('Please enter the administrator password to proceed.', 'info');
    return;
  }

  const finalTitle = type === 'update' 
    ? 'Serenity Update' 
    : (type === 'warning' ? 'Serenity Warning' : (type === 'important' ? 'Serenity Notice' : 'Serenity Announcement'));

  const payload = {
    title: finalTitle,
    message,
    type,
    duration,
    target,
    targetModule,
    targetPlaceId
  };


  try {
    let res;
    if (editId) {
      // PATCH update
      res = await fetch(`/api/announcements/${editId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
    } else {
      // POST create
      res = await fetch('/api/announcements', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
    }

    const data = await res.json();

    if (res.status === 401) {
      openAuthModal();
      showToast('Admin password incorrect or session expired.', 'error');
      return;
    }

    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to save announcement.', 'error');
      return;
    }

    showToast(editId ? `Announcement #${editId} updated!` : 'Announcement broadcasted live!', 'success');
    resetForm();
    loadAnnouncements();
    fetchServerStatus();
  } catch (err) {
    console.error('Submit error:', err);
    showToast('Network error while saving announcement.', 'error');
  }
}

function editAnnouncement(id) {
  const item = allAnnouncements.find(a => a.id === id);
  if (!item) return;

  editIdInput.value = item.id;
  messageInput.value = item.message;
  typeSelect.value = item.type || 'announcement';
  durationSelect.value = item.duration === 0 ? 'persistent' : String(item.duration);


  // Set gameSelection
  const mod = (item.targetModule || '').trim();
  if (!mod || mod.toLowerCase() === 'all' || item.target === 'everyone') {
    gameSelection.value = 'all';
  } else if (mod === 'Ride A Pet') {
    gameSelection.value = 'Ride A Pet';
  } else if (mod === 'Escape Tsunami For Brainrots') {
    gameSelection.value = 'Escape Tsunami For Brainrots';
  } else {
    gameSelection.value = 'custom';
    customGameInput.value = mod;
  }
  handleGameSelectChange();

  charCountSpan.textContent = item.message.length;
  formHeading.textContent = `Edit Announcement #${item.id}`;
  submitBtnText.textContent = 'UPDATE ANNOUNCEMENT';
  editingIdText.textContent = item.id;
  editingIndicator.style.display = 'inline-flex';

  updateLivePreview();
  startPreviewProgress();

  // Scroll to form
  document.querySelector('.form-panel').scrollIntoView({ behavior: 'smooth' });
}


async function toggleActive(id, currentActive) {
  if (!getSavedAdminPassword()) {
    openAuthModal();
    showToast('Admin authorization required to toggle announcement.', 'info');
    return;
  }

  try {
    const res = await fetch(`/api/announcements/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ active: !currentActive })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to toggle status.', 'error');
      return;
    }

    showToast(`Announcement #${id} is now ${!currentActive ? 'Active' : 'Disabled'}.`, 'success');
    loadAnnouncements();
    fetchServerStatus();
  } catch (err) {
    showToast('Network error toggling status.', 'error');
  }
}

async function deleteAnnouncement(id) {
  if (!confirm(`Are you sure you want to permanently delete announcement #${id}?`)) {
    return;
  }

  if (!getSavedAdminPassword()) {
    openAuthModal();
    showToast('Admin authorization required to delete announcement.', 'info');
    return;
  }

  try {
    const res = await fetch(`/api/announcements/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to delete announcement.', 'error');
      return;
    }

    showToast(`Announcement #${id} deleted successfully.`, 'info');
    if (editIdInput.value === String(id)) {
      resetForm();
    }
    loadAnnouncements();
    fetchServerStatus();
  } catch (err) {
    showToast('Network error deleting announcement.', 'error');
  }
}

async function sendTestAnnouncement() {
  if (!getSavedAdminPassword()) {
    openAuthModal();
    showToast('Please enter the admin password first to send a test announcement.', 'info');
    return;
  }

  const testPayload = {
    title: 'Serenity Hub',
    message: 'Live announcement system successfully connected!',
    type: 'announcement',
    target: 'everyone',
    targetModule: null,
    minimumHubVersion: null,
    duration: 10,
    active: true
  };

  try {
    const res = await fetch('/api/announcements', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(testPayload)
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to send test announcement.', 'error');
      return;
    }

    showToast('Test announcement broadcasted successfully!', 'success');
    loadAnnouncements();
    fetchServerStatus();

    // Populate preview with the test values
    messageInput.value = testPayload.message;
    typeSelect.value = testPayload.type;
    durationSelect.value = '10';
    if (gameSelection) gameSelection.value = 'all';
    charCountSpan.textContent = testPayload.message.length;
    updateLivePreview();
    startPreviewProgress();
  } catch (err) {
    showToast('Failed to connect to server for test announcement.', 'error');
  }
}


function resetForm() {
  editIdInput.value = '';
  announcementForm.reset();
  charCountSpan.textContent = '0';
  formHeading.textContent = 'Create Announcement';
  submitBtnText.textContent = 'SEND ANNOUNCEMENT';
  editingIndicator.style.display = 'none';
  typeSelect.value = 'update';
  durationSelect.value = '15';
  if (gameSelection) {
    gameSelection.value = 'all';
    customGameGroup.style.display = 'none';
    customGameInput.value = '';
    gameTargetHint.textContent = 'Sends this announcement to every player connected to the whole hub.';
  }
  updateLivePreview();
}


// =========================================================
// UTILITY FUNCTIONS
// =========================================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
  toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function formatTimestamp(isoStr) {
  if (!isoStr) return '--';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (_) {
    return isoStr;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ==============================================================================
// WEB GLOBAL CHAT CONTROLLER (SENA / DISCORD DARK STYLE)
// ==============================================================================

let currentWebChatRoom = 'general';
let webChatMessagesList = [];
let webChatLastMessageId = 0;
let webChatSearchQuery = '';

const WebChatRoomLangMap = {
  general: 'en',
  indonesian: 'id',
  philippines: 'tl',
  vietnam: 'vi',
  brazilian: 'pt'
};

function initWebChat() {
  fetchWebChatMessages();
  setInterval(fetchWebChatMessages, 2500);
}

async function fetchWebChatMessages() {
  try {
    const res = await fetch(`/api/chat/messages?after=${webChatLastMessageId}&limit=50&_t=${Date.now()}`);
    if (!res.ok) return;
    const data = await res.json();

    if (data.success && Array.isArray(data.messages) && data.messages.length > 0) {
      let hasNew = false;
      for (const msg of data.messages) {
        if (!webChatMessagesList.some(m => m.id === msg.id)) {
          webChatMessagesList.push(msg);
          if (msg.id > webChatLastMessageId) {
            webChatLastMessageId = msg.id;
          }
          hasNew = true;
        }
      }

      if (hasNew) {
        renderWebChatMessages();
      }
    }
  } catch (err) {
    console.warn('WebChat poll error:', err.message);
  }
}

function selectWebChatRoom(roomId) {
  currentWebChatRoom = roomId;

  // Update room pill active states
  const pills = document.querySelectorAll('.rooms-scroll-list .room-pill');
  pills.forEach(pill => {
    if (pill.getAttribute('data-room') === roomId) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });

  renderWebChatMessages();
}

function scrollWebChatRooms(direction) {
  const container = document.getElementById('webChatRoomsList');
  if (container) {
    container.scrollBy({ left: direction * 120, behavior: 'smooth' });
  }
}

function handleWebChatSearch() {
  const input = document.getElementById('webChatSearch');
  webChatSearchQuery = input ? input.value.trim().toLowerCase() : '';
  renderWebChatMessages();
}

function insertWebChatMention() {
  const input = document.getElementById('webChatInput');
  if (input) {
    input.value += '@';
    input.focus();
  }
}

async function sendWebChatMessage() {
  const input = document.getElementById('webChatInput');
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  const adminPass = getSavedAdminPassword() || 'SerenityAdmin2026!';

  const payload = {
    userId: '1',
    username: 'Owner',
    displayName: 'Chris',
    gameName: 'Web Dashboard',
    room: currentWebChatRoom,
    message: text,
    role: 'Owner',
    adminPassword: adminPass
  };

  input.value = '';

  try {
    const res = await fetch('/api/chat/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': adminPass
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      fetchWebChatMessages();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to deliver message', 'error');
    }
  } catch (err) {
    console.error('Error sending web chat message:', err);
    showToast('Failed to connect to chat server', 'error');
  }
}

function formatWebChatMentions(text) {
  if (!text) return '';
  const escaped = escapeHtml(text);
  return escaped.replace(/(@[a-zA-Z0-9_]+)/g, '<span class="mention-tag">$1</span>');
}

function renderWebChatMessages() {
  const container = document.getElementById('webChatMessages');
  if (!container) return;

  const langKey = WebChatRoomLangMap[currentWebChatRoom] || 'en';
  const q = webChatSearchQuery;

  // Assign aesthetic pastel colors
  const nameColors = [
    '#73ebaf', // mint green
    '#ff9bc3', // soft pink
    '#91d7ff', // light cyan
    '#ffd77d', // soft amber
    '#c3a5ff'  // soft violet
  ];

  const filtered = webChatMessagesList.filter(msg => {
    let displayTxt = msg.message || '';
    if (msg.translations && msg.translations[langKey]) {
      displayTxt = msg.translations[langKey];
    }

    if (!q) return true;
    const txtLower = displayTxt.toLowerCase();
    const userLower = (msg.displayName || msg.username || '').toLowerCase();
    const gameLower = (msg.gameName || '').toLowerCase();
    return txtLower.includes(q) || userLower.includes(q) || gameLower.includes(q);
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="webchat-empty-state">No messages in this channel yet. Say hi!</div>';
    return;
  }

  let html = '';
  for (const msg of filtered) {
    const isOwner = msg.isAdmin || msg.role === 'Owner';
    const isAdmin = msg.role === 'Admin';
    const isSystem = msg.system === true;

    // Avatar URL: Roblox Headshot or Serenity Logo
    let avatarSrc = 'serenity_logo_v2.png';
    if (!isSystem && !isOwner && msg.userId && msg.userId !== '0' && msg.userId !== '1') {
      avatarSrc = `https://www.roblox.com/headshot-thumbnail/image?userId=${msg.userId}&width=48&height=48&format=png`;
    }

    const uName = escapeHtml(msg.displayName || msg.username || 'Anonymous');
    const gameTag = escapeHtml(msg.gameName || 'Roblox Player');
    const timeStr = escapeHtml(msg.time || '');

    // Dynamic translation
    let displayMessage = msg.message || '';
    let isTranslated = false;

    if (msg.translations && msg.translations[langKey]) {
      const trans = msg.translations[langKey];
      if (trans && trans !== msg.message) {
        displayMessage = trans;
        isTranslated = true;
      }
    }

    const colorIdx = Math.abs(msg.id) % nameColors.length;
    const nameColor = isOwner ? '#ffd700' : nameColors[colorIdx];

    let badgeHtml = '';
    if (isOwner) {
      badgeHtml = '<span class="webmsg-badge-owner">OWNER</span>';
    } else if (isAdmin) {
      badgeHtml = '<span class="webmsg-badge-admin">ADMIN</span>';
    } else if (isSystem) {
      badgeHtml = '<span class="webmsg-badge-system">SYSTEM</span>';
    }

    const transHtml = isTranslated ? '<span class="webmsg-trans-tag">(translated)</span>' : '';

    html += `
      <div class="webmsg-row" id="webmsg-${msg.id}">
        <img src="${avatarSrc}" alt="${uName}" class="webmsg-avatar" onerror="this.src='serenity_logo_v2.png'">
        <div class="webmsg-content">
          <div class="webmsg-header">
            ${badgeHtml}
            <span class="webmsg-name" style="color: ${nameColor};">${uName}</span>
            <span class="webmsg-gametag">${gameTag}</span>
            <span class="webmsg-time">&bull; ${timeStr}</span>
            ${transHtml}
          </div>
          <div class="webmsg-text">${formatWebChatMentions(displayMessage)}</div>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;

  // Auto-scroll to bottom
  container.scrollTop = container.scrollHeight;
}

