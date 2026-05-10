/**
 * ============================================
 * ui.js - UI Components
 * Toast, Modal, Loading States
 * Admin Dashboard - Trakindo Office Supplies
 * ============================================
 */

import { CONFIG } from './config.js';
import { escapeHtml, $ } from './utils.js';

// ============ DOM CACHE ============

const DOM = {
    initialized: false,
    toastContainer: null,
    modalBackdrop: null,
    confirmModal: null,
    confirmModalIcon: null,
    confirmModalTitle: null,
    confirmModalMessage: null,
    confirmOkBtn: null,
    confirmCancelBtn: null,
    editStockModal: null
};

/**
 * Initialize DOM references
 * Call this after DOMContentLoaded
 */
export function initUI() {
    if (DOM.initialized) return;
    
    DOM.toastContainer = $('toastContainer');
    DOM.modalBackdrop = $('modalBackdrop');
    DOM.confirmModal = $('confirmModal');
    DOM.confirmModalIcon = $('confirmModalIcon');
    DOM.confirmModalTitle = $('confirmModalTitle');
    DOM.confirmModalMessage = $('confirmModalMessage');
    DOM.confirmOkBtn = $('confirmOkBtn');
    DOM.confirmCancelBtn = $('confirmCancelBtn');
    DOM.editStockModal = $('editStockModal');
    
    // Inject animation styles if not present
    injectStyles();
    
    DOM.initialized = true;
    console.log('[UI] Initialized');
}

/**
 * Inject required CSS animations
 */
function injectStyles() {
    if (document.getElementById('admin-ui-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'admin-ui-styles';
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes scaleIn {
            from { transform: translate(-50%, -50%) scale(0.9); opacity: 0; }
            to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .toast-animate-in { animation: slideInRight 0.3s ease forwards; }
        .toast-animate-out { animation: slideOutRight 0.3s ease forwards; }
        
        .modal-backdrop.active { animation: fadeIn 0.2s ease forwards; }
        .modal.active .modal-content { animation: scaleIn 0.3s ease forwards; }
        
        .spinner-circle {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid var(--brand, #ffaf10);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
    `;
    document.head.appendChild(style);
}

// ============ TOAST NOTIFICATIONS ============

/**
 * Toast type configuration
 */
const TOAST_CONFIG = {
    success: { icon: 'check-circle', color: '#10B981' },
    error: { icon: 'x-circle', color: '#EF4444' },
    warning: { icon: 'warning', color: '#F59E0B' },
    info: { icon: 'info', color: '#3B82F6' }
};

/**
 * Show a toast notification
 * @param {string} message - Toast message
 * @param {('success'|'error'|'warning'|'info')} type - Toast type
 * @param {number} duration - Duration in ms (optional)
 */
export function showToast(message, type = 'info', duration = CONFIG.timing.toastDuration) {
    if (!DOM.toastContainer) {
        DOM.toastContainer = $('toastContainer');
    }
    
    if (!DOM.toastContainer) {
        console.warn('[UI] Toast container not found, using alert fallback');
        alert(`${type.toUpperCase()}: ${message}`);
        return;
    }
    
    const config = TOAST_CONFIG[type] || TOAST_CONFIG.info;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} toast-animate-in`;
    toast.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 300px;
        max-width: 500px;
        background: var(--surface-1, white);
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.15);
        border-left: 4px solid ${config.color};
        margin-bottom: 10px;
    `;
    
    toast.innerHTML = `
        <i class="ph ph-${config.icon}" style="font-size: 24px; color: ${config.color}; flex-shrink: 0;"></i>
        <span style="flex: 1; color: var(--text-1, #000); font-weight: 500; word-break: break-word;">
            ${escapeHtml(message)}
        </span>
        <button class="toast-close" style="
            background: none; 
            border: none; 
            cursor: pointer; 
            padding: 4px; 
            color: var(--text-3, #999);
            flex-shrink: 0;
        ">
            <i class="ph ph-x" style="font-size: 20px;"></i>
        </button>
    `;
    
    // Close button handler
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn?.addEventListener('click', () => removeToast(toast));
    
    DOM.toastContainer.appendChild(toast);
    
    // Limit max toasts
    const toasts = DOM.toastContainer.querySelectorAll('.toast');
    if (toasts.length > 5) {
        removeToast(toasts[0]);
    }
    
    // Auto remove
    setTimeout(() => removeToast(toast), duration);
}

/**
 * Remove a toast with animation
 * @param {HTMLElement} toast
 */
function removeToast(toast) {
    if (!toast || !toast.parentNode) return;
    
    toast.classList.remove('toast-animate-in');
    toast.classList.add('toast-animate-out');
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, CONFIG.timing.animationDuration);
}

// ============ CONFIRM MODAL ============

/** @type {Function|null} */
let confirmResolve = null;

/**
 * Show confirmation modal
 * Replaces native confirm()
 * 
 * @param {Object} options - Modal options
 * @param {string} options.title - Modal title
 * @param {string} options.message - Modal message
 * @param {string} options.confirmText - Confirm button text
 * @param {string} options.cancelText - Cancel button text
 * @param {('question'|'warning'|'danger'|'success')} options.type - Modal type
 * @returns {Promise<boolean>} Resolves to true if confirmed
 * 
 * @example
 * const confirmed = await showConfirm({
 *   title: 'Hapus Item?',
 *   message: 'Tindakan ini tidak dapat dibatalkan.',
 *   type: 'danger'
 * });
 */
export function showConfirm(options = {}) {
    const {
        title = 'Konfirmasi',
        message = 'Apakah Anda yakin?',
        confirmText = 'Ya, Lanjutkan',
        cancelText = 'Batal',
        type = 'question'
    } = options;
    
    return new Promise((resolve) => {
        if (!DOM.confirmModal || !DOM.modalBackdrop) {
            // Fallback to native confirm
            resolve(confirm(message));
            return;
        }
        
        confirmResolve = resolve;
        
        // Set content
        if (DOM.confirmModalTitle) {
            DOM.confirmModalTitle.textContent = title;
        }
        if (DOM.confirmModalMessage) {
            DOM.confirmModalMessage.textContent = message;
        }
        
        // Set icon based on type
        const icons = {
            question: 'question',
            warning: 'warning',
            danger: 'trash',
            success: 'check-circle'
        };
        
        if (DOM.confirmModalIcon) {
            DOM.confirmModalIcon.innerHTML = `<i class="ph ph-${icons[type] || 'question'}"></i>`;
            DOM.confirmModalIcon.className = `modal-icon ${type}`;
        }
        
        // Set button texts
        if (DOM.confirmOkBtn) {
            DOM.confirmOkBtn.innerHTML = `<i class="ph ph-check"></i><span>${escapeHtml(confirmText)}</span>`;
        }
        if (DOM.confirmCancelBtn) {
            DOM.confirmCancelBtn.innerHTML = `<i class="ph ph-x"></i><span>${escapeHtml(cancelText)}</span>`;
        }
        
        // Show modal
        DOM.modalBackdrop.classList.add('active');
        DOM.confirmModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Setup listeners
        const handleConfirm = () => {
            closeConfirmModal();
            resolve(true);
        };
        
        const handleCancel = () => {
            closeConfirmModal();
            resolve(false);
        };
        
        const handleKeydown = (e) => {
            if (e.key === 'Escape') handleCancel();
            if (e.key === 'Enter') handleConfirm();
        };
        
        // Remove old listeners and add new
        DOM.confirmOkBtn?.removeEventListener('click', handleConfirm);
        DOM.confirmCancelBtn?.removeEventListener('click', handleCancel);
        DOM.modalBackdrop?.removeEventListener('click', handleCancel);
        document.removeEventListener('keydown', handleKeydown);
        
        DOM.confirmOkBtn?.addEventListener('click', handleConfirm, { once: true });
        DOM.confirmCancelBtn?.addEventListener('click', handleCancel, { once: true });
        DOM.modalBackdrop?.addEventListener('click', handleCancel, { once: true });
        document.addEventListener('keydown', handleKeydown, { once: true });
        
        // Focus confirm button
        DOM.confirmOkBtn?.focus();
    });
}

/**
 * Close confirm modal
 */
function closeConfirmModal() {
    if (DOM.modalBackdrop) DOM.modalBackdrop.classList.remove('active');
    if (DOM.confirmModal) DOM.confirmModal.classList.remove('active');
    document.body.style.overflow = '';
}

// ============ PROMPT MODAL ============

/**
 * Show prompt modal
 * Replaces native prompt()
 * 
 * @param {Object} options - Prompt options
 * @param {string} options.title - Modal title
 * @param {string} options.message - Modal message
 * @param {string} options.placeholder - Input placeholder
 * @param {string} options.defaultValue - Default input value
 * @param {boolean} options.required - Whether input is required
 * @param {string} options.type - Input type (text, number, etc)
 * @returns {Promise<string|null>} Resolves to input value or null if cancelled
 */
export function showPrompt(options = {}) {
    const {
        title = 'Input',
        message = '',
        placeholder = '',
        defaultValue = '',
        required = false,
        type = 'text'
    } = options;
    
    return new Promise((resolve) => {
        const modal = $('promptModal');
        const backdrop = $('modalBackdrop');
        const input = $('promptModalInput');
        const errorEl = $('promptModalError');
        
        if (!modal || !backdrop || !input) {
            // Fallback to native prompt
            const result = prompt(`${title}\n\n${message}`, defaultValue);
            
            if (required && (!result || result.trim() === '')) {
                resolve(null);
                return;
            }
            
            resolve(result);
            return;
        }
        
        // Set content
        const titleEl = $('promptModalTitle');
        const messageEl = $('promptModalMessage');
        
        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;
        
        // Configure input
        input.type = type;
        input.placeholder = placeholder;
        input.value = defaultValue;
        if (errorEl) errorEl.textContent = '';
        
        // Show modal
        backdrop.classList.add('active');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Focus input after animation
        setTimeout(() => input.focus(), 100);
        
        // Handlers
        const cleanup = () => {
            backdrop.classList.remove('active');
            modal.classList.remove('active');
            document.body.style.overflow = '';
            
            // Remove listeners
            okBtn?.removeEventListener('click', handleOk);
            cancelBtn?.removeEventListener('click', handleCancel);
            closeBtn?.removeEventListener('click', handleCancel);
            backdrop?.removeEventListener('click', handleCancel);
            document.removeEventListener('keydown', handleKeydown);
        };
        
        const handleOk = () => {
            const value = input.value.trim();
            
            if (required && !value) {
                if (errorEl) errorEl.textContent = 'Field ini wajib diisi';
                input.focus();
                return;
            }
            
            cleanup();
            resolve(value || null);
        };
        
        const handleCancel = () => {
            cleanup();
            resolve(null);
        };
        
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                handleCancel();
            } else if (e.key === 'Enter') {
                handleOk();
            }
        };
        
        // Get buttons
        const okBtn = $('promptOkBtn');
        const cancelBtn = $('promptCancelBtn');
        const closeBtn = $('closePromptModal');
        
        // Attach listeners
        okBtn?.addEventListener('click', handleOk);
        cancelBtn?.addEventListener('click', handleCancel);
        closeBtn?.addEventListener('click', handleCancel);
        backdrop?.addEventListener('click', handleCancel);
        document.addEventListener('keydown', handleKeydown);
    });
}

// ============ LOADING STATES ============

/**
 * Create loading skeleton HTML
 * @param {number} count - Number of skeleton items
 * @returns {string} HTML string
 */
export function createSkeletonLoader(count = 3) {
    let html = '<div class="skeleton-grid">';
    
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-card">
                <div class="skeleton skeleton-header"></div>
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text short"></div>
                <div class="skeleton skeleton-btn"></div>
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

/**
 * Show loading state in a container
 * @param {HTMLElement|string} container - Container element or ID
 * @param {string} message - Loading message
 */
export function showLoading(container, message = 'Memuat data...') {
    const el = typeof container === 'string' ? $(container) : container;
    if (!el) return;
    
    el.innerHTML = `
        <div class="loading-state" style="text-align: center; padding: 40px;">
            <div class="spinner-circle" style="margin: 0 auto 15px;"></div>
            <p style="color: var(--text-2, #666);">${escapeHtml(message)}</p>
        </div>
    `;
}

/**
 * Show empty state in a container
 * @param {HTMLElement|string} container - Container element or ID
 * @param {Object} options - Empty state options
 */
export function showEmptyState(container, options = {}) {
    const {
        icon = 'clipboard',
        title = 'Tidak Ada Data',
        message = 'Belum ada data untuk ditampilkan',
        action = null // { text: 'Add', onClick: fn }
    } = options;
    
    const el = typeof container === 'string' ? $(container) : container;
    if (!el) return;
    
    let actionHTML = '';
    if (action) {
        actionHTML = `
            <button class="btn-primary empty-state-action" style="margin-top: 15px;">
                ${escapeHtml(action.text)}
            </button>
        `;
    }
    
    el.innerHTML = `
        <div class="empty-state" style="text-align: center; padding: 40px;">
            <div style="
                width: 80px; 
                height: 80px; 
                background: var(--surface-2, #f5f5f5); 
                border-radius: 50%; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                margin: 0 auto 20px;
            ">
                <i class="ph ph-${icon}" style="font-size: 32px; color: var(--text-3, #999);"></i>
            </div>
            <h4 style="margin-bottom: 8px; color: var(--text-1, #333);">${escapeHtml(title)}</h4>
            <p style="color: var(--text-3, #999);">${escapeHtml(message)}</p>
            ${actionHTML}
        </div>
    `;
    
    // Attach action handler if provided
    if (action?.onClick) {
        const btn = el.querySelector('.empty-state-action');
        btn?.addEventListener('click', action.onClick);
    }
}

/**
 * Show error state in a container
 * @param {HTMLElement|string} container - Container element or ID
 * @param {string} message - Error message
 * @param {Function} onRetry - Retry callback
 */
export function showErrorState(container, message, onRetry = null) {
    const el = typeof container === 'string' ? $(container) : container;
    if (!el) return;
    
    let retryHTML = '';
    if (onRetry) {
        retryHTML = `
            <button class="btn-primary error-retry-btn" style="margin-top: 15px;">
                <i class="ph ph-arrows-clockwise"></i>
                Coba Lagi
            </button>
        `;
    }
    
    el.innerHTML = `
        <div class="error-state" style="text-align: center; padding: 40px;">
            <div style="
                width: 80px; 
                height: 80px; 
                background: #FEE2E2; 
                border-radius: 50%; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                margin: 0 auto 20px;
            ">
                <i class="ph ph-warning-circle" style="font-size: 32px; color: #EF4444;"></i>
            </div>
            <h4 style="margin-bottom: 8px; color: var(--text-1, #333);">Terjadi Kesalahan</h4>
            <p style="color: var(--text-3, #999);">${escapeHtml(message)}</p>
            ${retryHTML}
        </div>
    `;
    
    if (onRetry) {
        const btn = el.querySelector('.error-retry-btn');
        btn?.addEventListener('click', onRetry);
    }
}

// ============ BUTTON LOADING STATE ============

/**
 * Set button to loading state
 * @param {HTMLElement|string} button - Button element or ID
 * @param {boolean} loading - Loading state
 * @param {string} loadingText - Text to show while loading
 */
export function setButtonLoading(button, loading, loadingText = 'Memproses...') {
    const btn = typeof button === 'string' ? $(button) : button;
    if (!btn) return;
    
    const content = btn.querySelector('.btn-content');
    const spinner = btn.querySelector('.btn-loading');
    
    if (loading) {
        btn.disabled = true;
        if (content) content.style.display = 'none';
        if (spinner) {
            spinner.style.display = 'flex';
        } else {
            // Create inline spinner
            btn.dataset.originalContent = btn.innerHTML;
            btn.innerHTML = `
                <div class="spinner" style="
                    width: 16px; 
                    height: 16px; 
                    border: 2px solid rgba(0,0,0,0.2); 
                    border-top-color: currentColor; 
                    border-radius: 50%; 
                    animation: spin 0.8s linear infinite;
                "></div>
                <span>${escapeHtml(loadingText)}</span>
            `;
        }
    } else {
        btn.disabled = false;
        if (content) content.style.display = 'flex';
        if (spinner) {
            spinner.style.display = 'none';
        } else if (btn.dataset.originalContent) {
            btn.innerHTML = btn.dataset.originalContent;
            delete btn.dataset.originalContent;
        }
    }
}

// ============ EXPORTS ============

export default {
    initUI,
    showToast,
    showConfirm,
    showPrompt,
    createSkeletonLoader,
    showLoading,
    showEmptyState,
    showErrorState,
    setButtonLoading

};
