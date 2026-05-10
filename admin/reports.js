/**
 * ============================================
 * reports.js - Reports & Export Module
 * Admin Dashboard - Trakindo Office Supplies
 * ============================================
 */

import { db } from '../firebase-config.js';
import {
    collection,
    query,
    orderBy,
    getDocs,
    where,
    Timestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

import { CONFIG } from './config.js';
import { getAllRequests, getAllItems } from './state.js';
import { showToast } from './ui.js';
import { $, debugLog, infoLog, errorLog, escapeHtml, generateFilename } from './utils.js';

// ============ DOM ELEMENTS ============

let elements = {};

function initElements() {
    elements = {
        // Report type buttons
        btnReportRequests: $('btn-report-requests'),
        btnReportStock: $('btn-report-stock'),

        // Filter sections
        requestsFilterSection: $('requests-filter-section'),
        stockFilterSection: $('stock-filter-section'),

        // Request filters
        startDate: $('start-date'),
        endDate: $('end-date'),
        statusFilter: $('status-filter'),
        filterBtn: $('filter-btn'),
        exportExcelBtn: $('export-excel-btn'),
        resetFilterBtn: $('resetFilterBtn'),

        // Stock filters
        stockStartDate: $('stock-start-date'),
        stockEndDate: $('stock-end-date'),
        applyStockFilterBtn: $('applyStockFilterBtn'),
        resetStockFilterBtn: $('resetStockFilterBtn'),

        // Quick export buttons
        exportRequestsBtn: $('exportRequestsBtn'),
        exportInventoryQuickBtn: $('exportInventoryQuickBtn'),
        exportStockBtn: $('exportStockBtn'),

        // Preview
        reportPreview: $('report-preview')
    };
}

// ============ STATE ============

let stockTransactions = [];

// ============ INITIALIZATION ============

/**
 * Initialize reports module
 */
export function initReports() {
    initElements();
    initReportTypeToggle();
    initRequestFilters();
    initStockFilters();
    initQuickExports();
    infoLog('Reports module initialized');
}

// ============ REPORT TYPE TOGGLE ============

function initReportTypeToggle() {
    const btnRequests = elements.btnReportRequests;
    const btnStock = elements.btnReportStock;

    if (btnRequests) {
        btnRequests.addEventListener('click', () => {
            btnRequests.classList.add('active');
            btnStock?.classList.remove('active');
            if (elements.requestsFilterSection) elements.requestsFilterSection.style.display = 'block';
            if (elements.stockFilterSection) elements.stockFilterSection.style.display = 'none';
        });
    }

    if (btnStock) {
        btnStock.addEventListener('click', () => {
            btnStock.classList.add('active');
            btnRequests?.classList.remove('active');
            if (elements.stockFilterSection) elements.stockFilterSection.style.display = 'block';
            if (elements.requestsFilterSection) elements.requestsFilterSection.style.display = 'none';
            loadStockTransactions();
        });
    }
}

// ============ REQUEST REPORT FILTERS ============

function initRequestFilters() {
    const today = new Date();
    const daysAgo = new Date(today);
    daysAgo.setDate(daysAgo.getDate() - CONFIG.reports.defaultDateRangeDays);

    if (elements.startDate) {
        elements.startDate.value = daysAgo.toISOString().split('T')[0];
    }
    if (elements.endDate) {
        elements.endDate.value = today.toISOString().split('T')[0];
    }

    if (elements.filterBtn) {
        elements.filterBtn.addEventListener('click', applyRequestFilter);
    }

    if (elements.exportExcelBtn) {
        elements.exportExcelBtn.addEventListener('click', exportFilteredRequests);
    }

    if (elements.resetFilterBtn) {
        elements.resetFilterBtn.addEventListener('click', () => {
            if (elements.startDate) elements.startDate.value = daysAgo.toISOString().split('T')[0];
            if (elements.endDate) elements.endDate.value = today.toISOString().split('T')[0];
            if (elements.statusFilter) elements.statusFilter.value = 'all';
            clearReportPreview();
        });
    }
}

// ============ STOCK REPORT FILTERS ============

function initStockFilters() {
    const today = new Date();
    const daysAgo = new Date(today);
    daysAgo.setDate(daysAgo.getDate() - CONFIG.reports.defaultDateRangeDays);

    if (elements.stockStartDate) {
        elements.stockStartDate.value = daysAgo.toISOString().split('T')[0];
    }
    if (elements.stockEndDate) {
        elements.stockEndDate.value = today.toISOString().split('T')[0];
    }

    if (elements.applyStockFilterBtn) {
        elements.applyStockFilterBtn.addEventListener('click', () => {
            loadStockTransactions();
        });
    }

    if (elements.resetStockFilterBtn) {
        elements.resetStockFilterBtn.addEventListener('click', () => {
            if (elements.stockStartDate) elements.stockStartDate.value = daysAgo.toISOString().split('T')[0];
            if (elements.stockEndDate) elements.stockEndDate.value = today.toISOString().split('T')[0];
            clearReportPreview();
        });
    }
}

// ============ QUICK EXPORTS ============

function initQuickExports() {
    if (elements.exportRequestsBtn) {
        elements.exportRequestsBtn.addEventListener('click', exportRequestsToExcel);
    }
    if (elements.exportInventoryQuickBtn) {
        elements.exportInventoryQuickBtn.addEventListener('click', () => {
            import('./inventory.js').then(mod => {
                if (mod.exportInventory) mod.exportInventory();
            }).catch(() => {
                showToast('Gagal memuat modul inventaris', 'error');
            });
        });
    }
    if (elements.exportStockBtn) {
        elements.exportStockBtn.addEventListener('click', exportStockTransactions);
    }
}

// ============ APPLY REQUEST FILTER ============

function applyRequestFilter() {
    const allRequests = getAllRequests();

    const startDateVal = elements.startDate?.value;
    const endDateVal = elements.endDate?.value;
    const statusVal = elements.statusFilter?.value || 'all';

    let filtered = [...allRequests];

    if (startDateVal) {
        const start = new Date(startDateVal);
        start.setHours(0, 0, 0, 0);
        filtered = filtered.filter(r => {
            const ts = getTimestamp(r.timestamp);
            return ts && ts >= start;
        });
    }

    if (endDateVal) {
        const end = new Date(endDateVal);
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter(r => {
            const ts = getTimestamp(r.timestamp);
            return ts && ts <= end;
        });
    }

    if (statusVal !== 'all') {
        filtered = filtered.filter(r => r.status === statusVal);
    }

    showRequestPreview(filtered);
}

/**
 * Show filtered request data in preview
 */
function showRequestPreview(filtered) {
    const preview = elements.reportPreview;
    if (!preview) return;

    if (filtered.length === 0) {
        preview.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i class="ph ph-magnifying-glass"></i></div>
                <h4>Tidak Ada Data</h4>
                <p>Tidak ditemukan data dengan filter yang dipilih</p>
            </div>
        `;
        return;
    }

    const pendingCount = filtered.filter(r => r.status === 'pending').length;
    const approvedCount = filtered.filter(r => r.status === 'approved').length;
    const rejectedCount = filtered.filter(r => r.status === 'rejected').length;
    const completedCount = filtered.filter(r => r.status === 'completed').length;

    preview.innerHTML = `
        <div class="report-summary">
            <p><strong>Ditemukan ${filtered.length} permintaan</strong></p>
            <div class="report-breakdown">
                <span class="status-badge status-pending">Pending: ${pendingCount}</span>
                <span class="status-badge status-approved">Approved: ${approvedCount}</span>
                <span class="status-badge status-rejected">Rejected: ${rejectedCount}</span>
                <span class="status-badge status-completed">Completed: ${completedCount}</span>
            </div>
        </div>
        <div class="table-container">
            <table class="modern-table">
                <thead>
                    <tr>
                        <th>No.</th>
                        <th>No. Request</th>
                        <th>Pemohon</th>
                        <th>Departemen</th>
                        <th>Status</th>
                        <th>Tanggal</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map((r, i) => `
                        <tr>
                            <td>${i + 1}</td>
                            <td>${escapeHtml(r.requestNumber || r.id.substring(0, 8).toUpperCase())}</td>
                            <td>${escapeHtml(r.requesterName || r.nama || '-')}</td>
                            <td>${escapeHtml(r.department || r.departemen || '-')}</td>
                            <td><span class="status-badge status-${r.status}">${escapeHtml(r.status || '-')}</span></td>
                            <td>${formatTimestamp(r.timestamp)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// ============ LOAD STOCK TRANSACTIONS ============

/**
 * Load stock transactions from Firestore
 */
export async function loadStockTransactions() {
    try {
        let q;
        const startDateVal = elements.stockStartDate?.value;
        const endDateVal = elements.stockEndDate?.value;

        if (startDateVal && endDateVal) {
            const start = new Date(startDateVal);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDateVal);
            end.setHours(23, 59, 59, 999);

            q = query(
                collection(db, CONFIG.collections.stockTransactions),
                where('timestamp', '>=', Timestamp.fromDate(start)),
                where('timestamp', '<=', Timestamp.fromDate(end)),
                orderBy('timestamp', 'desc')
            );
        } else {
            q = query(
                collection(db, CONFIG.collections.stockTransactions),
                orderBy('timestamp', 'desc')
            );
        }

        const snap = await getDocs(q);
        stockTransactions = [];
        snap.forEach(docSnap => {
            stockTransactions.push({ id: docSnap.id, ...docSnap.data() });
        });

        debugLog(`Loaded ${stockTransactions.length} stock transactions`);
        showStockPreview(stockTransactions);

    } catch (error) {
        errorLog('Error loading stock transactions:', error);

        if (error.code === 'failed-precondition') {
            showToast('Index database diperlukan. Buat composite index di Firebase Console.', 'warning', 5000);
        } else {
            showToast('Gagal memuat histori stok', 'error');
        }
    }
}

/**
 * Show stock transactions in preview
 */
function showStockPreview(transactions) {
    const preview = elements.reportPreview;
    if (!preview) return;

    if (transactions.length === 0) {
        preview.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i class="ph ph-stack"></i></div>
                <h4>Belum Ada Transaksi</h4>
                <p>Belum ada histori perubahan stok</p>
            </div>
        `;
        return;
    }

    // Count by type - handle multiple type values
    const inCount = transactions.filter(t => t.type === 'in' || t.type === 'add' || t.type === 'receipt').length;
    const outCount = transactions.filter(t => t.type === 'out').length;
    const adjCount = transactions.filter(t => t.type === 'edit' || (t.type !== 'in' && t.type !== 'out' && t.type !== 'add' && t.type !== 'receipt')).length;

    preview.innerHTML = `
        <div class="report-summary">
            <p><strong>Ditemukan ${transactions.length} transaksi stok</strong></p>
            <div class="report-breakdown">
                <span class="status-badge status-approved">Masuk: ${inCount}</span>
                <span class="status-badge status-rejected">Keluar: ${outCount}</span>
                <span class="status-badge status-pending">Penyesuaian: ${adjCount}</span>
            </div>
        </div>
        <div class="table-container">
            <table class="modern-table">
                <thead>
                    <tr>
                        <th>No.</th>
                        <th>Tanggal</th>
                        <th>Nama Barang</th>
                        <th>Tipe</th>
                        <th>Jumlah</th>
                        <th>Stok Sebelum</th>
                        <th>Stok Sesudah</th>
                        <th>Keterangan</th>
                    </tr>
                </thead>
                <tbody>
                    ${transactions.map((t, i) => {
                        const typeLabel = getTypeLabel(t.type);
                        const typeClass = getTypeClass(t.type);
                        return `
                            <tr>
                                <td>${i + 1}</td>
                                <td>${formatTimestamp(t.timestamp)}</td>
                                <td>${escapeHtml(t.itemName || '-')}</td>
                                <td><span class="status-badge status-${typeClass}">${typeLabel}</span></td>
                                <td>${t.quantity || t.addedQuantity || 0}</td>
                                <td>${t.previousStock ?? '-'}</td>
                                <td>${t.newStock ?? '-'}</td>
                                <td>${escapeHtml(t.reason || t.receiptNo || '-')}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Get display label for transaction type
 */
function getTypeLabel(type) {
    const labels = {
        'in': 'Masuk',
        'add': 'Tambah',
        'receipt': 'Penerimaan',
        'out': 'Keluar',
        'edit': 'Edit'
    };
    return labels[type] || 'Penyesuaian';
}

/**
 * Get CSS class for transaction type
 */
function getTypeClass(type) {
    if (type === 'in' || type === 'add' || type === 'receipt') return 'approved';
    if (type === 'out') return 'rejected';
    return 'pending';
}

// ============ EXPORT FUNCTIONS ============

/**
 * Export all requests to Excel
 */
export function exportRequestsToExcel() {
    if (typeof XLSX === 'undefined') {
        showToast('Library Excel (XLSX) belum dimuat. Refresh halaman.', 'error');
        return;
    }

    const allRequests = getAllRequests();

    if (allRequests.length === 0) {
        showToast('Tidak ada data permintaan untuk diexport', 'warning');
        return;
    }

    try {
        const data = allRequests.map((r, i) => ({
            'No': i + 1,
            'No. Request': r.requestNumber || r.id.substring(0, 8).toUpperCase(),
            'Pemohon': r.requesterName || r.nama || '-',
            'Departemen': r.department || r.departemen || '-',
            'Status': CONFIG.statuses[r.status]?.label || r.status || '-',
            'Tanggal': formatTimestamp(r.timestamp),
            'Items': (r.items || []).map(item =>
                `${item.itemName || item.name || item.nama}: ${item.quantity || item.jumlah} ${item.unit || item.satuan || 'pcs'}`
            ).join('; '),
            'Catatan': r.notes || r.catatan || '-'
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [
            { wch: 5 }, { wch: 15 }, { wch: 20 }, { wch: 20 },
            { wch: 12 }, { wch: 20 }, { wch: 40 }, { wch: 25 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Permintaan');
        XLSX.writeFile(wb, generateFilename('Permintaan', 'xlsx'));

        showToast(`Berhasil export ${data.length} permintaan ke Excel!`, 'success');
    } catch (error) {
        errorLog('Error exporting requests:', error);
        showToast('Gagal export data', 'error');
    }
}

/**
 * Export filtered requests
 */
function exportFilteredRequests() {
    exportRequestsToExcel();
}

/**
 * Export stock transactions to Excel
 */
export async function exportStockTransactions() {
    if (typeof XLSX === 'undefined') {
        showToast('Library Excel (XLSX) belum dimuat. Refresh halaman.', 'error');
        return;
    }

    try {
        if (stockTransactions.length === 0) {
            await loadStockTransactions();
        }

        if (stockTransactions.length === 0) {
            showToast('Tidak ada data histori stok untuk diexport', 'warning');
            return;
        }

        const data = stockTransactions.map((t, i) => ({
            'No': i + 1,
            'Tanggal': formatTimestamp(t.timestamp),
            'Nama Barang': t.itemName || '-',
            'Tipe': getTypeLabel(t.type),
            'Jumlah': t.quantity || t.addedQuantity || 0,
            'Stok Sebelum': t.previousStock ?? '-',
            'Stok Sesudah': t.newStock ?? '-',
            'Keterangan': t.reason || t.receiptNo || '-',
            'Oleh': t.changedBy || t.updatedBy || '-'
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [
            { wch: 5 }, { wch: 20 }, { wch: 25 }, { wch: 12 },
            { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 25 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Histori Stok');
        XLSX.writeFile(wb, generateFilename('Histori_Stok', 'xlsx'));

        showToast(`Berhasil export ${data.length} transaksi stok ke Excel!`, 'success');
    } catch (error) {
        errorLog('Error exporting stock transactions:', error);
        showToast('Gagal export histori stok', 'error');
    }
}

// ============ UTILITY HELPERS ============

/**
 * Get Date object from various timestamp formats
 */
function getTimestamp(timestamp) {
    if (!timestamp) return null;

    try {
        if (timestamp.toDate && typeof timestamp.toDate === 'function') {
            return timestamp.toDate();
        }
        if (timestamp.seconds && typeof timestamp.seconds === 'number') {
            return new Date(timestamp.seconds * 1000);
        }
        if (typeof timestamp === 'string') {
            const d = new Date(timestamp);
            return isNaN(d.getTime()) ? null : d;
        }
        if (timestamp instanceof Date) {
            return timestamp;
        }
    } catch (e) {
        errorLog('Error parsing timestamp:', e);
    }

    return null;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp) {
    const date = getTimestamp(timestamp);
    if (!date) return '-';

    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Clear report preview
 */
function clearReportPreview() {
    const preview = elements.reportPreview;
    if (preview) {
        preview.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="ph ph-clipboard"></i>
                </div>
                <h4>Belum Ada Filter</h4>
                <p>Pilih jenis laporan dan filter di atas untuk melihat data</p>
            </div>
        `;
    }
}

// ============ EXPORTS ============

export default {
    initReports,
    loadStockTransactions,
    exportRequestsToExcel,
    exportStockTransactions
};
