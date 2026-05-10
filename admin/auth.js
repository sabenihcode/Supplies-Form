/**
 * ============================================
 * auth.js - Authentication Module
 * Admin Dashboard - Trakindo Office Supplies
 * ============================================
 */

import { auth } from '../firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import { CONFIG } from './config.js';
import { setCurrentUser, cleanupAllListeners } from './state.js';
import { showToast, setButtonLoading, showConfirm } from './ui.js';
import { $, debugLog, infoLog, errorLog, isValidEmail } from './utils.js';

// ============ DOM ELEMENTS ============

let elements = {};

/**
 * Initialize auth DOM elements
 */
function initElements() {
    elements = {
        loginContainer: $('login-container'),
        adminDashboard: $('admin-dashboard'),
        loginForm: $('login-form'),
        loginEmail: $('login-email'),
        loginPassword: $('login-password'),
        loginError: $('login-error'),
        loginBtn: $('loginBtn'),
        loginBtnText: $('login-btn-text'),
        loginSpinner: $('login-spinner'),
        logoutButton: $('logout-button'),
        adminName: $('admin-name'),
        adminEmail: $('admin-email')
    };
}

// ============ AUTH STATE LISTENER ============

/**
 * Callback for successful authentication
 * @type {Function|null}
 */
let onAuthenticatedCallback = null;

/**
 * Callback for logout
 * @type {Function|null}
 */
let onLogoutCallback = null;

/**
 * Initialize authentication module
 * @param {Object} callbacks - Callback functions
 * @param {Function} callbacks.onAuthenticated - Called when user is authenticated
 * @param {Function} callbacks.onLogout - Called when user logs out
 */
export function initAuth(callbacks = {}) {
    initElements();
    
    onAuthenticatedCallback = callbacks.onAuthenticated;
    onLogoutCallback = callbacks.onLogout;
    
    // Set up auth state listener
    onAuthStateChanged(auth, handleAuthStateChange);
    
    // Set up login form handler
    if (elements.loginForm) {
        elements.loginForm.addEventListener('submit', handleLogin);
    }
    
    // Set up logout handler
    if (elements.logoutButton) {
        elements.logoutButton.addEventListener('click', handleLogout);
    }
    
    // Password toggle
    initPasswordToggle();
    
    infoLog('Auth module initialized');
}

/**
 * Handle auth state changes
 * @param {Object|null} user - Firebase user object
 */
function handleAuthStateChange(user) {
    setCurrentUser(user);
    
    if (user) {
        infoLog(`Admin logged in: ${user.email}`);
        showDashboard(user);
        
        if (onAuthenticatedCallback) {
            onAuthenticatedCallback(user);
        }
    } else {
        infoLog('No user logged in');
        showLogin();
        
        if (onLogoutCallback) {
            onLogoutCallback();
        }
    }
}

// ============ LOGIN ============

/**
 * Handle login form submission
 * @param {Event} e - Submit event
 */
async function handleLogin(e) {
    e.preventDefault();
    
    // Clear previous errors
    if (elements.loginError) {
        elements.loginError.textContent = '';
    }
    
    const email = elements.loginEmail?.value?.trim();
    const password = elements.loginPassword?.value;
    
    // Validate inputs
    if (!email || !password) {
        showLoginError('Email dan password harus diisi');
        return;
    }
    
    if (!isValidEmail(email)) {
        showLoginError('Format email tidak valid');
        return;
    }
    
    // Show loading state
    setLoginLoading(true);
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        infoLog('Login successful');
        showToast('Login berhasil! Selamat datang Admin', 'success');
        
    } catch (error) {
        errorLog('Login error:', error);
        const errorMessage = getAuthErrorMessage(error.code);
        showLoginError(errorMessage);
        showToast(errorMessage, 'error');
        
    } finally {
        setLoginLoading(false);
    }
}

/**
 * Get user-friendly error message from Firebase auth error code
 * @param {string} code - Firebase error code
 * @returns {string} User-friendly error message
 */
function getAuthErrorMessage(code) {
    const messages = {
        'auth/invalid-email': 'Format email tidak valid!',
        'auth/user-disabled': 'Akun ini telah dinonaktifkan!',
        'auth/user-not-found': 'Email tidak terdaftar!',
        'auth/wrong-password': 'Password salah!',
        'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi dalam beberapa menit.',
        'auth/network-request-failed': 'Koneksi internet bermasalah!',
        'auth/invalid-credential': 'Email atau password salah!',
        'auth/invalid-login-credentials': 'Email atau password salah!'
    };
    
    return messages[code] || 'Terjadi kesalahan. Silakan coba lagi.';
}

/**
 * Show login error message
 * @param {string} message
 */
function showLoginError(message) {
    if (elements.loginError) {
        elements.loginError.textContent = message;
    }
}

/**
 * Set login button loading state
 * @param {boolean} loading
 */
function setLoginLoading(loading) {
    if (elements.loginBtnText) {
        elements.loginBtnText.style.display = loading ? 'none' : 'flex';
    }
    if (elements.loginSpinner) {
        elements.loginSpinner.style.display = loading ? 'flex' : 'none';
    }
    if (elements.loginBtn) {
        elements.loginBtn.disabled = loading;
    }
}

// ============ LOGOUT ============

/**
 * Handle logout
 */
async function handleLogout() {
    const confirmed = await showConfirm({
        title: 'Logout',
        message: 'Apakah Anda yakin ingin keluar?',
        confirmText: 'Ya, Logout',
        cancelText: 'Batal',
        type: 'question'
    });
    
    if (!confirmed) return;
    
    try {
        // Clean up listeners before signing out
        cleanupAllListeners();
        
        await signOut(auth);
        infoLog('Logout successful');
        showToast('Logout berhasil', 'success');
        
    } catch (error) {
        errorLog('Logout error:', error);
        showToast('Gagal logout. Silakan coba lagi.', 'error');
    }
}

// ============ UI HELPERS ============

/**
 * Show login screen
 */
function showLogin() {
    if (elements.loginContainer) {
        elements.loginContainer.style.display = 'flex';
    }
    if (elements.adminDashboard) {
        elements.adminDashboard.style.display = 'none';
    }
    
    // Clear form
    if (elements.loginForm) {
        elements.loginForm.reset();
    }
    if (elements.loginError) {
        elements.loginError.textContent = '';
    }
    
    // Clean up any existing listeners
    cleanupAllListeners();
}

/**
 * Show dashboard
 * @param {Object} user - Firebase user
 */
function showDashboard(user) {
    if (elements.loginContainer) {
        elements.loginContainer.style.display = 'none';
    }
    if (elements.adminDashboard) {
        elements.adminDashboard.style.display = 'block';
    }
    
    // Update user info in header
    updateUserInfo(user);
}

/**
 * Update user info display
 * @param {Object} user - Firebase user
 */
function updateUserInfo(user) {
    if (elements.adminName) {
        elements.adminName.textContent = user.displayName || 'Admin';
    }
    if (elements.adminEmail) {
        elements.adminEmail.textContent = user.email;
    }
}

/**
 * Initialize password visibility toggle
 */
function initPasswordToggle() {
    const toggleBtn = $('togglePassword');
    const passwordInput = elements.loginPassword;
    const eyeIcon = $('eyeIcon');
    
    if (toggleBtn && passwordInput && eyeIcon) {
        toggleBtn.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            eyeIcon.className = isPassword ? 'ph ph-eye-slash' : 'ph ph-eye';
        });
    }
}

// ============ EXPORTS ============

export {
    handleLogin,
    handleLogout
};

export default {
    initAuth
};