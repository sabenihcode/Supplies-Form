/**
 * ============================================
 * requests.js - Request Management Module
 * Admin Dashboard - Trakindo Office Supplies
 * FIXED: Field names match actual Firestore data
 * ============================================
 */

import { db } from '../firebase-config.js';
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    doc,
    updateDoc,
    getDoc,
    getDocs,
    addDoc,
    where,
    limit,
    writeBatch,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

import { CONFIG } from './config.js';
import {
    getCurrentUser,
    setAllRequests,
    getAllRequests,
    getCurrentFilter,
    setCurrentFilter,
    addUnsubscribe
} from './state.js';
import { showToast, showConfirm, showPrompt } from './ui.js';
import { $, debugLog, infoLog, errorLog, escapeHtml, debounce } from './utils.js';

// ============ DOM ELEMENTS ============

let elements = {};

function initElements() {
    elements = {
        pendingRequests: $('pending-requests'),
        requestsSkeletonLoader: $('requestsSkeletonLoader'),
        searchRequests: $('search-requests'),
        clearSearchRequests: $('clearSearchRequests'),
        pendingCount: $('pending-count'),
        todayCount: $('today-count'),
        requestsBadge: $('requests-badge'),
        notifBadge: $('notif-badge'),
        refreshRequestsBtn: $('refreshRequestsBtn'),
        refreshBtn: $('refreshBtn')
    };
}

// ============ INITIALIZATION ============

export function initRequests() {
    initElements();
    initFilterChips();
    initSearchRequests();
    initRefreshButton();
    infoLog('Requests module initialized');
}

// ============ LOAD REQUESTS ============

export function loadRequests() {
    const container = elements.pendingRequests;
    if (!container) return;

    try {
        const q = query(
            collection(db, CONFIG.collections.requests),
            orderBy('timestamp', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const requests = [];
            snapshot.forEach(docSnap => {
                requests.push({ id: docSnap.id, ...docSnap.data() });
            });

            setAllRequests(requests);
            debugLog(`Loaded ${requests.length} requests`);
            updateRequestStats();
            renderRequests();
        }, (error) => {
            errorLog('Error loading requests:', error);
            showToast('Gagal memuat data permintaan', 'error');

            const skeleton = elements.requestsSkeletonLoader;
            if (skeleton) skeleton.remove();

            if (container) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">
                            <i class="ph ph-warning-circle"></i>
                        </div>
                        <h4>Gagal Memuat Data</h4>
                        <p>${escapeHtml(error.message || 'Terjadi kesalahan')}</p>
                        <button class="btn-primary btn-sm" onclick="window.refreshRequests()">
                            <i class="ph ph-arrows-clockwise"></i>
                            <span>Coba Lagi</span>
                        </button>
                    </div>
                `;
            }
        });

        addUnsubscribe(unsubscribe);
    } catch (error) {
        errorLog('Error setting up requests listener:', error);
    }
}

// ============ RENDER REQUESTS ============

function renderRequests() {
    const container = elements.pendingRequests;
    if (!container) return;

    const skeleton = elements.requestsSkeletonLoader;
    if (skeleton) skeleton.remove();

    const allRequests = getAllRequests();
    const currentFilter = getCurrentFilter();
    let filtered = [...allRequests];

    // Apply status filter
    if (currentFilter !== 'all') {
        filtered = filtered.filter(r => r.status === currentFilter);
    }

    // Apply search - ✅ FIXED field names
    const searchInput = elements.searchRequests;
    if (searchInput && searchInput.value.trim()) {
        const searchTerm = searchInput.value.toLowerCase().trim();
        filtered = filtered.filter(r => {
            return (r.requestNumber || '').toLowerCase().includes(searchTerm) ||
                   (r.requesterName || '').toLowerCase().includes(searchTerm) ||
                   (r.requesterDept || '').toLowerCase().includes(searchTerm) ||
                   (r.requesterEmail || '').toLowerCase().includes(searchTerm) ||
                   (r.id || '').toLowerCase().includes(searchTerm);
        });
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="ph ph-clipboard"></i>
                </div>
                <h4>Tidak Ada Permintaan</h4>
                <p>${currentFilter !== 'all'
                    ? 'Tidak ada permintaan dengan filter "' + escapeHtml(currentFilter) + '"'
                    : 'Belum ada permintaan masuk'}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(req => createRequestCard(req)).join('');
}

// ============ CREATE REQUEST CARD ============
// ✅ FIXED: All field names match actual Firestore data

function createRequestCard(req) {
    const status = req.status || 'pending';
    const statusConfig = CONFIG.statuses[status] || CONFIG.statuses.pending;

    const statusIcons = {
        pending: 'clock',
        approved: 'check-circle',
        rejected: 'x-circle',
        completed: 'check-square'
    };

    // Format timestamp
    let dateStr = '-';
    let timeStr = '';
    try {
        let timestamp = null;
        if (req.timestamp?.toDate && typeof req.timestamp.toDate === 'function') {
            timestamp = req.timestamp.toDate();
        } else if (req.timestamp?.seconds) {
            timestamp = new Date(req.timestamp.seconds * 1000);
        }

        if (timestamp && !isNaN(timestamp.getTime())) {
            dateStr = timestamp.toLocaleDateString('id-ID', {
                day: '2-digit', month: 'short', year: 'numeric'
            });
            timeStr = timestamp.toLocaleTimeString('id-ID', {
                hour: '2-digit', minute: '2-digit'
            });
        }
    } catch (e) {
        errorLog('Error formatting date:', e);
    }

    // ✅ FIXED: requestedItems (bukan items)
    const items = req.requestedItems || req.items || [];
    
    const itemsHtml = items.length > 0
        ? items.map(item => `
            <div class="request-item-row">
                <span class="item-name">${escapeHtml(item.itemName || item.name || '-')}</span>
                <span class="item-qty">${item.quantity || 0} ${escapeHtml(item.unit || 'pcs')}</span>
            </div>
        `).join('')
        : '<p class="no-items">Tidak ada detail item</p>';

    // Actions based on status
    let actionsHtml = '';
    if (status === 'pending') {
        actionsHtml = `
            <div class="request-actions">
                <button class="btn-success btn-sm" onclick="window._requestActions.approve('${req.id}')">
                    <i class="ph ph-check"></i>
                    <span>Setujui</span>
                </button>
                <button class="btn-danger btn-sm" onclick="window._requestActions.reject('${req.id}')">
                    <i class="ph ph-x"></i>
                    <span>Tolak</span>
                </button>
            </div>
        `;
    } else if (status === 'approved') {
        actionsHtml = `
            <div class="request-actions">
                <button class="btn-primary btn-sm" onclick="window._requestActions.complete('${req.id}')">
                    <i class="ph ph-check-square"></i>
                    <span>Tandai Selesai</span>
                </button>
            </div>
        `;
    }

    const rejectionNote = (status === 'rejected' && req.rejectionReason) ? `
        <div class="request-notes rejection">
            <i class="ph ph-warning"></i>
            <span>Alasan: ${escapeHtml(req.rejectionReason)}</span>
        </div>
    ` : '';

    const notes = req.notes ? `
        <div class="request-notes">
            <i class="ph ph-note"></i>
            <span>${escapeHtml(req.notes)}</span>
        </div>
    ` : '';

    // ✅ FIXED: requesterDept (bukan department/departemen)
    return `
        <div class="request-card glass-card" data-status="${status}" data-id="${req.id}">
            <div class="request-header">
                <div class="request-number">
                    <i class="ph ph-hash"></i>
                    <span>${escapeHtml(req.requestNumber || req.id.substring(0, 8).toUpperCase())}</span>
                </div>
                <span class="status-badge status-${status}">
                    <i class="ph ph-${statusIcons[status] || 'circle'}"></i>
                    ${statusConfig.label}
                </span>
            </div>

            <div class="request-info">
                <div class="info-row">
                    <i class="ph ph-user"></i>
                    <span>${escapeHtml(req.requesterName || 'Unknown')}</span>
                </div>
                <div class="info-row">
                    <i class="ph ph-buildings"></i>
                    <span>${escapeHtml(req.requesterDept || '-')}</span>
                </div>
                <div class="info-row">
                    <i class="ph ph-envelope"></i>
                    <span>${escapeHtml(req.requesterEmail || '-')}</span>
                </div>
                <div class="info-row">
                    <i class="ph ph-calendar"></i>
                    <span>${dateStr}${timeStr ? ' • ' + timeStr : ''}</span>
                </div>
            </div>

            <div class="request-items">
                <h4>Item yang diminta:</h4>
                ${itemsHtml}
            </div>

            ${notes}
            ${rejectionNote}
            ${actionsHtml}
        </div>
    `;
}

// ============ REQUEST ACTIONS ============

async function approveRequest(requestId) {
    const confirmed = await showConfirm({
        title: 'Setujui Permintaan',
        message: 'Apakah Anda yakin ingin menyetujui permintaan ini?',
        confirmText: 'Ya, Setujui',
        type: 'success'
    });

    if (!confirmed) return;

    try {
        const user = getCurrentUser();
        await updateDoc(doc(db, CONFIG.collections.requests, requestId), {
            status: 'approved',
            approvedAt: serverTimestamp(),
            approvedBy: user?.email || 'admin'
        });
        showToast('Permintaan disetujui!', 'success');
    } catch (error) {
        errorLog('Error approving request:', error);
        showToast('Gagal menyetujui permintaan', 'error');
    }
}

async function rejectRequest(requestId) {
    const reason = await showPrompt({
        title: 'Tolak Permintaan',
        message: 'Masukkan alasan penolakan:',
        placeholder: 'Alasan penolakan...',
        required: false
    });

    if (reason === null || reason === undefined) return;

    try {
        const user = getCurrentUser();
        await updateDoc(doc(db, CONFIG.collections.requests, requestId), {
            status: 'rejected',
            rejectedAt: serverTimestamp(),
            rejectedBy: user?.email || 'admin',
            rejectionReason: reason || 'Tidak ada alasan'
        });
        showToast('Permintaan ditolak', 'warning');
    } catch (error) {
        errorLog('Error rejecting request:', error);
        showToast('Gagal menolak permintaan', 'error');
    }
}

// ✅ FIXED: completeRequest with correct field names
async function completeRequest(requestId) {
    const confirmed = await showConfirm({
        title: 'Selesaikan Permintaan',
        message: 'Tandai permintaan ini sebagai selesai? Stok barang akan dikurangi otomatis.',
        confirmText: 'Ya, Selesaikan',
        type: 'success'
    });

    if (!confirmed) return;

    try {
        const reqDoc = await getDoc(doc(db, CONFIG.collections.requests, requestId));
        if (!reqDoc.exists()) {
            showToast('Permintaan tidak ditemukan', 'error');
            return;
        }

        const reqData = reqDoc.data();
        
        // ✅ FIXED: requestedItems (bukan items)
        const items = reqData.requestedItems || reqData.items || [];
        
        const user = getCurrentUser();
        const batch = writeBatch(db);

        // Update request status
        batch.update(doc(db, CONFIG.collections.requests, requestId), {
            status: 'completed',
            completedAt: serverTimestamp(),
            completedBy: user?.email || 'admin'
        });

        // Reduce stock for each item
        for (const item of items) {
            const itemName = item.itemName || item.name || '';
            const qty = parseInt(item.quantity || 0);

            if (itemName && qty > 0) {
                const itemQuery = query(
                    collection(db, CONFIG.collections.items),
                    where('itemName', '==', itemName),
                    limit(1)
                );
                const itemSnap = await getDocs(itemQuery);

                if (!itemSnap.empty) {
                    const itemDoc = itemSnap.docs[0];
                    const currentStock = itemDoc.data().stock || 0;
                    const newStock = Math.max(0, currentStock - qty);

                    batch.update(doc(db, CONFIG.collections.items, itemDoc.id), {
                        stock: newStock,
                        lastUpdated: serverTimestamp(),
                        updatedBy: user?.email || 'admin'
                    });

                    // Log stock transaction
                    const transactionRef = doc(collection(db, CONFIG.collections.stockTransactions));
                    batch.set(transactionRef, {
                        itemId: itemDoc.id,
                        itemName: itemName,
                        type: 'out',
                        quantity: qty,
                        previousStock: currentStock,
                        newStock: newStock,
                        unit: item.unit || 'pcs',
                        reason: `Request #${reqData.requestNumber || requestId.substring(0, 8)}`,
                        // ✅ FIXED: correct field names
                        requester: reqData.requesterName || '-',
                        department: reqData.requesterDept || '-',
                        requestId: requestId,
                        changedBy: user?.email || 'admin',
                        timestamp: serverTimestamp()
                    });
                } else {
                    infoLog(`Item not found in inventory: ${itemName}`);
                }
            }
        }

        await batch.commit();
        showToast('Permintaan selesai! Stok telah diperbarui.', 'success');
    } catch (error) {
        errorLog('Error completing request:', error);
        showToast('Gagal menyelesaikan permintaan: ' + error.message, 'error');
    }
}

// Expose actions to window
window._requestActions = {
    approve: approveRequest,
    reject: rejectRequest,
    complete: completeRequest
};

// ============ FILTER CHIPS ============

function initFilterChips() {
    const chips = document.querySelectorAll('.filter-chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            setCurrentFilter(chip.dataset.filter);
            renderRequests();
        });
    });
}

// ============ SEARCH ============

function initSearchRequests() {
    const searchInput = elements.searchRequests;
    const clearBtn = elements.clearSearchRequests;

    if (searchInput) {
        const debouncedRender = debounce(() => renderRequests(), CONFIG.timing.debounceDelay);
        searchInput.addEventListener('input', debouncedRender);
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                renderRequests();
            }
        });
    }
}

// ============ REFRESH ============

function initRefreshButton() {
    const refreshBtn = elements.refreshRequestsBtn;
    const globalRefreshBtn = elements.refreshBtn;

    const doRefresh = () => {
        showToast('Memuat ulang data...', 'info', 1500);
        loadRequests();
    };

    if (refreshBtn) refreshBtn.addEventListener('click', doRefresh);
    if (globalRefreshBtn) globalRefreshBtn.addEventListener('click', doRefresh);
}

// ============ STATS ============

function updateRequestStats() {
    const allRequests = getAllRequests();
    const pendingCount = allRequests.filter(r => r.status === 'pending').length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = allRequests.filter(r => {
        try {
            let ts = null;
            if (r.timestamp?.toDate && typeof r.timestamp.toDate === 'function') {
                ts = r.timestamp.toDate();
            } else if (r.timestamp?.seconds) {
                ts = new Date(r.timestamp.seconds * 1000);
            }
            return ts && ts >= today;
        } catch {
            return false;
        }
    }).length;

    const setEl = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setEl('pending-count', pendingCount);
    setEl('today-count', todayCount);
    setEl('requests-badge', pendingCount);

    const notifBadge = document.getElementById('notif-badge');
    if (notifBadge) {
        notifBadge.textContent = pendingCount;
        notifBadge.style.display = pendingCount > 0 ? 'flex' : 'none';
    }
}

export function forceRefreshPendingCount() {
    updateRequestStats();
    infoLog('Pending count refreshed');
}

// ============ EXPORTS ============

export {
    renderRequests,
    approveRequest,
    rejectRequest,
    completeRequest,
    updateRequestStats
};

export default {
    initRequests,
    loadRequests,
    forceRefreshPendingCount
};
