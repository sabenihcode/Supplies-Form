/**
 * ============================================
 * index.js - Admin Dashboard Entry Point
 * Admin Dashboard - Trakindo Office Supplies
 * Version 4.0.0
 * ============================================
 */

// ============ IMPORTS ============

import { CONFIG } from './config.js';
import { cleanupAllListeners } from './state.js';
import { initUI, showToast } from './ui.js';
import { initAuth } from './auth.js';
import { initRequests, loadRequests, forceRefreshPendingCount } from './requests.js';
import { initInventory, loadInventory, searchInventory, exportInventory } from './inventory.js';
import { initReports, loadStockTransactions, exportRequestsToExcel, exportStockTransactions } from './reports.js';
import { initReceipt, addReceiptRow, saveReceipt } from './receipt.js';
import { $, debugLog, infoLog, errorLog } from './utils.js';

// ============ INITIALIZATION ============

/**
 * Initialize the admin dashboard
 */
function initApp() {
    infoLog(`Admin Dashboard v${CONFIG.app.version} initializing...`);
    
    // Initialize UI components
    initUI();
    
    // Initialize authentication with callbacks
    initAuth({
        onAuthenticated: handleAuthenticated,
        onLogout: handleLogout
    });
    
    // Initialize theme
    initTheme();
    
    // Initialize other UI elements
    initTabSwitching();
    initBackToTop();
    initUserMenu();
    
    infoLog('Admin Dashboard initialized');
    
    // Log available debug commands
    if (CONFIG.app.debug) {
        console.log('');
        console.log('🔧 Debug commands available:');
        console.log('   - window.debugAdmin.forceRefresh()');
        console.log('   - window.debugAdmin.getState()');
        console.log('   - window.debugAdmin.exportRequests()');
        console.log('');
    }
}

/**
 * Handle successful authentication
 * @param {Object} user - Firebase user
 */
function handleAuthenticated(user) {
    infoLog(`Dashboard loading for: ${user.email}`);
    
    // Clean up any existing listeners
    cleanupAllListeners();
    
    // Initialize modules
    initRequests();
    initInventory();
    initReports();
    initReceipt();
    
    // Load data
    loadRequests();
    loadInventory();
}

/**
 * Handle logout
 */
function handleLogout() {
    debugLog('User logged out, cleaning up...');
    cleanupAllListeners();
}

// ============ THEME ============

function initTheme() {
    const savedTheme = localStorage.getItem('admin-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    
    const themeToggle = $('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('admin-theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const lightIcon = $('themeLight');
    const darkIcon = $('themeDark');
    
    if (lightIcon) lightIcon.style.display = theme === 'dark' ? 'none' : 'block';
    if (darkIcon) darkIcon.style.display = theme === 'dark' ? 'block' : 'none';
}

// ============ TAB SWITCHING ============

function initTabSwitching() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.dataset.tab;
            switchTab(targetTab);
        });
    });
}

function switchTab(tabName) {
    // Update button states
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
    
    // Trigger tab-specific actions
    if (tabName === 'inventory') {
        // Refresh inventory stats
    } else if (tabName === 'receipt') {
        // Load item datalist
        import('./receipt.js').then(mod => mod.default);
    }
}

// ============ BACK TO TOP ============

function initBackToTop() {
    const backToTopBtn = $('backToTop');
    
    if (!backToTopBtn) return;
    
    window.addEventListener('scroll', () => {
        backToTopBtn.classList.toggle('show', window.scrollY > 300);
    }, { passive: true });
    
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ============ USER MENU ============

function initUserMenu() {
    const userMenuBtn = $('userMenuBtn');
    const dropdown = $('user-dropdown');
    
    if (!userMenuBtn || !dropdown) return;
    
    userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-menu')) {
            dropdown.classList.remove('show');
        }
    });
}

// ============ DEBUG EXPORTS ============

if (CONFIG.app.debug) {
    window.debugAdmin = {
        forceRefresh: forceRefreshPendingCount,
        getState: () => {
            import('./state.js').then(mod => console.log(mod.getState()));
        },
        exportRequests: exportRequestsToExcel,
        exportInventory: exportInventory,
        exportStock: exportStockTransactions,
        loadStockTransactions: loadStockTransactions,
        searchInventory: searchInventory
    };
}

// ============ GLOBAL FUNCTIONS (Backward Compatibility) ============

// These are exposed for any remaining inline handlers
window.addReceiptRow = addReceiptRow;
window.saveReceipt = saveReceipt;
window.refreshRequests = loadRequests;

// ============ START APP ============

document.addEventListener('DOMContentLoaded', initApp);

// ============ EXPORTS ============

export {
    initApp,
    switchTab
};