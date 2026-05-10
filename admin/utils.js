/**
 * ============================================
 * utils.js - Utility Functions
 * Admin Dashboard - Trakindo Office Supplies
 * ============================================
 */

import { CONFIG } from './config.js';

// ============ XSS PROTECTION ============

/**
 * Escape HTML to prevent XSS attacks
 * @param {*} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };
    
    return String(text).replace(/[&<>"'`=\/]/g, char => map[char]);
}

/**
 * Escape text for use in HTML attributes
 * @param {*} text - Text to escape
 * @returns {string} Escaped text safe for attributes
 */
export function escapeAttr(text) {
    if (text === null || text === undefined) return '';
    
    return String(text)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
}

// ============ DATE FORMATTING ============

/**
 * Safely format a date field from various formats
 * Handles Firestore Timestamp, plain objects, ISO strings, and Date objects
 * 
 * @param {*} dateField - Date in any format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string or '-' if invalid
 */
export function formatDateSafe(dateField, options = null) {
    if (!dateField) return '-';
    
    const defaultOptions = {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    
    try {
        let date;
        
        // Firestore Timestamp object with toDate()
        if (dateField?.toDate && typeof dateField.toDate === 'function') {
            date = dateField.toDate();
        }
        // Firestore Timestamp as plain object {seconds, nanoseconds}
        else if (dateField?.seconds && typeof dateField.seconds === 'number') {
            date = new Date(dateField.seconds * 1000);
        }
        // ISO string or date string
        else if (typeof dateField === 'string') {
            date = new Date(dateField);
        }
        // Already a Date object
        else if (dateField instanceof Date) {
            date = dateField;
        }
        // Number (timestamp in milliseconds)
        else if (typeof dateField === 'number') {
            date = new Date(dateField);
        }
        else {
            return '-';
        }
        
        // Validate the date
        if (isNaN(date.getTime())) {
            return '-';
        }
        
        return date.toLocaleDateString('id-ID', options || defaultOptions);
        
    } catch (error) {
        console.error('[Utils] Date format error:', error);
        return '-';
    }
}

/**
 * Extract Date object from various timestamp formats
 * @param {Object} item - Object with timestamp fields
 * @returns {Date} Date object (epoch if not found)
 */
export function getDateFromField(item) {
    if (!item) return new Date(0);
    
    // Try timestamp field first
    if (item.timestamp?.toDate) {
        return item.timestamp.toDate();
    }
    if (item.timestamp?.seconds) {
        return new Date(item.timestamp.seconds * 1000);
    }
    
    // Try createdAt field
    if (item.createdAt?.toDate) {
        return item.createdAt.toDate();
    }
    if (item.createdAt?.seconds) {
        return new Date(item.createdAt.seconds * 1000);
    }
    if (typeof item.createdAt === 'string') {
        return new Date(item.createdAt);
    }
    
    // Try createdAtISO field
    if (typeof item.createdAtISO === 'string') {
        return new Date(item.createdAtISO);
    }
    
    return new Date(0);
}

/**
 * Format date for date input value (YYYY-MM-DD)
 * @param {Date} date
 * @returns {string}
 */
export function formatDateForInput(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        date = new Date();
    }
    return date.toISOString().split('T')[0];
}

// ============ INPUT VALIDATION ============

/**
 * Sanitize item name - remove dangerous characters
 * @param {string} name - Raw item name
 * @returns {string} Sanitized name
 */
export function sanitizeItemName(name) {
    if (!name) return '';
    
    return String(name)
        .replace(/[<>"'`]/g, '') // Remove potentially dangerous chars
        .trim()
        .substring(0, CONFIG.validation.itemName.maxLength);
}

/**
 * Validate stock quantity
 * @param {*} value - Raw stock value
 * @returns {{valid: boolean, value: number, error: string|null}}
 */
export function validateStock(value) {
    const stock = parseInt(value, 10);
    
    if (isNaN(stock)) {
        return { valid: false, value: 0, error: 'Stok harus berupa angka' };
    }
    
    if (stock < 0) {
        return { valid: false, value: 0, error: 'Stok tidak boleh negatif' };
    }
    
    if (stock > CONFIG.stock.maxQuantity) {
        return { 
            valid: false, 
            value: 0, 
            error: `Stok maksimal ${CONFIG.stock.maxQuantity.toLocaleString()}` 
        };
    }
    
    return { valid: true, value: stock, error: null };
}

/**
 * Validate item name
 * @param {string} name - Item name to validate
 * @returns {{valid: boolean, value: string, error: string|null}}
 */
export function validateItemName(name) {
    const sanitized = sanitizeItemName(name);
    
    if (sanitized.length < CONFIG.validation.itemName.minLength) {
        return { 
            valid: false, 
            value: sanitized, 
            error: `Nama barang minimal ${CONFIG.validation.itemName.minLength} karakter` 
        };
    }
    
    return { valid: true, value: sanitized, error: null };
}

/**
 * Validate email format
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(String(email).trim());
}

// ============ STOCK STATUS ============

/**
 * Get stock status based on current stock and minimum
 * @param {number} stock - Current stock
 * @param {number} minStock - Minimum stock threshold
 * @returns {{status: string, class: string, emoji: string, text: string}}
 */
export function getStockStatus(stock, minStock = CONFIG.stock.lowThreshold) {
    if (stock <= CONFIG.stock.emptyThreshold) {
        return {
            status: 'empty',
            class: 'stock-danger',
            emoji: '❌',
            text: 'Habis'
        };
    }
    
    if (stock <= minStock) {
        return {
            status: 'low',
            class: 'stock-warning',
            emoji: '⚠️',
            text: `Tersisa ${stock}`
        };
    }
    
    return {
        status: 'normal',
        class: 'stock-normal',
        emoji: '✅',
        text: `Stok ${stock}`
    };
}

// ============ DEBOUNCE ============

/**
 * Create a debounced version of a function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = CONFIG.timing.debounceDelay) {
    let timeout;
    
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============ LOGGING ============

/**
 * Conditional debug logging
 * @param  {...any} args - Arguments to log
 */
export function debugLog(...args) {
    if (CONFIG.app.debug) {
        console.log('[DEBUG]', ...args);
    }
}

/**
 * Info logging
 * @param  {...any} args
 */
export function infoLog(...args) {
    console.log('[INFO]', ...args);
}

/**
 * Error logging (always logs)
 * @param  {...any} args
 */
export function errorLog(...args) {
    console.error('[ERROR]', ...args);
}

// ============ DOM HELPERS ============

/**
 * Safely get DOM element by ID
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
export function $(id) {
    return document.getElementById(id);
}

/**
 * Safely query selector
 * @param {string} selector - CSS selector
 * @param {HTMLElement} parent - Parent element (default: document)
 * @returns {HTMLElement|null}
 */
export function $$(selector, parent = document) {
    return parent.querySelector(selector);
}

/**
 * Safely query selector all
 * @param {string} selector - CSS selector
 * @param {HTMLElement} parent - Parent element (default: document)
 * @returns {NodeList}
 */
export function $$$(selector, parent = document) {
    return parent.querySelectorAll(selector);
}

// ============ EXPORT FOR CSV ============

/**
 * Download content as CSV file
 * @param {string} content - CSV content
 * @param {string} filename - File name
 */
export function downloadCSV(content, filename) {
    const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    infoLog(`File downloaded: ${filename}`);
}

/**
 * Generate filename with date
 * @param {string} prefix - Filename prefix
 * @param {string} extension - File extension (default: xlsx)
 * @returns {string}
 */
export function generateFilename(prefix, extension = 'xlsx') {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `${prefix}_${date}.${extension}`;
}

export default {
    escapeHtml,
    escapeAttr,
    formatDateSafe,
    getDateFromField,
    formatDateForInput,
    sanitizeItemName,
    validateStock,
    validateItemName,
    isValidEmail,
    getStockStatus,
    debounce,
    debugLog,
    infoLog,
    errorLog,
    $,
    $$,
    $$$,
    downloadCSV,
    generateFilename
};