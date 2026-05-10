/**
 * ============================================
 * config.js - Centralized Configuration
 * Admin Dashboard - Trakindo Office Supplies
 * ============================================
 */

export const CONFIG = {
    // App Info
    app: {
        name: 'Trakindo Office Supplies Admin',
        version: '4.0.0',
        debug: true // Set to false in production
    },

    // Firebase Collections
    collections: {
        requests: 'requests',
        items: 'items',
        stockTransactions: 'stockTransactions',
        counters: 'counters'
    },

    // Pagination
    pagination: {
        requestsPerPage: 50,
        inventoryPerPage: 100,
        transactionsPerPage: 100,
        maxExportRows: 10000
    },

    // Stock Thresholds
    stock: {
        lowThreshold: 5,      // Items with stock <= this are "low"
        emptyThreshold: 0,    // Items with stock <= this are "empty"
        maxQuantity: 999999   // Maximum allowed stock value
    },

    // UI Timings (ms)
    timing: {
        toastDuration: 4000,
        debounceDelay: 300,
        refreshDelay: 500,
        animationDuration: 300
    },

    // Report Defaults
    reports: {
        defaultDateRangeDays: 30
    },

    // Validation Rules
    validation: {
        itemName: {
            minLength: 2,
            maxLength: 100
        },
        unit: {
            maxLength: 20
        },
        notes: {
            maxLength: 500
        }
    },

    // Status Configuration
    statuses: {
        pending: {
            label: 'Tertunda',
            emoji: '⏳',
            color: '#F59E0B',
            class: 'status-pending'
        },
        approved: {
            label: 'Disetujui',
            emoji: '✅',
            color: '#10B981',
            class: 'status-approved'
        },
        rejected: {
            label: 'Ditolak',
            emoji: '❌',
            color: '#EF4444',
            class: 'status-rejected'
        },
        completed: {
            label: 'Selesai',
            emoji: '✔️',
            color: '#6366F1',
            class: 'status-completed'
        }
    }
};

/**
 * Get status configuration by status key
 * @param {string} status - Status key (pending, approved, etc.)
 * @returns {Object} Status configuration object
 */
export function getStatusConfig(status) {
    return CONFIG.statuses[status] || {
        label: status,
        emoji: '❓',
        color: '#6B7280',
        class: 'status-unknown'
    };
}

export default CONFIG;