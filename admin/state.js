/**
 * ============================================
 * state.js - Shared State Management
 * Admin Dashboard - Trakindo Office Supplies
 * ============================================
 */

/**
 * @typedef {Object} AdminState
 * @property {Object|null} currentUser - Currently logged in user
 * @property {Array} allRequests - All loaded requests
 * @property {Array} allItems - All inventory items
 * @property {string} currentFilter - Current request filter
 * @property {string} currentTab - Current active tab
 * @property {Array} unsubscribeFunctions - Firestore listener cleanup functions
 * @property {boolean} isLoading - Global loading state
 */

/** @type {AdminState} */
const state = {
    currentUser: null,
    allRequests: [],
    allItems: [],
    currentFilter: 'all',
    currentTab: 'requests',
    unsubscribeFunctions: [],
    isLoading: false
};

/**
 * Get current state (read-only copy)
 * @returns {AdminState}
 */
export function getState() {
    return { ...state };
}

/**
 * Get current user
 * @returns {Object|null}
 */
export function getCurrentUser() {
    return state.currentUser;
}

/**
 * Set current user
 * @param {Object|null} user
 */
export function setCurrentUser(user) {
    state.currentUser = user;
}

/**
 * Get all requests
 * @returns {Array}
 */
export function getAllRequests() {
    return [...state.allRequests];
}

/**
 * Set all requests
 * @param {Array} requests
 */
export function setAllRequests(requests) {
    state.allRequests = [...requests];
}

/**
 * Get all items
 * @returns {Array}
 */
export function getAllItems() {
    return [...state.allItems];
}

/**
 * Set all items
 * @param {Array} items
 */
export function setAllItems(items) {
    state.allItems = [...items];
}

/**
 * Get current filter
 * @returns {string}
 */
export function getCurrentFilter() {
    return state.currentFilter;
}

/**
 * Set current filter
 * @param {string} filter
 */
export function setCurrentFilter(filter) {
    state.currentFilter = filter;
}

/**
 * Get current tab
 * @returns {string}
 */
export function getCurrentTab() {
    return state.currentTab;
}

/**
 * Set current tab
 * @param {string} tab
 */
export function setCurrentTab(tab) {
    state.currentTab = tab;
}

/**
 * Add unsubscribe function for cleanup
 * @param {Function} fn
 */
export function addUnsubscribe(fn) {
    if (typeof fn === 'function') {
        state.unsubscribeFunctions.push(fn);
    }
}

/**
 * Cleanup all Firestore listeners
 */
export function cleanupAllListeners() {
    console.log(`[State] Cleaning up ${state.unsubscribeFunctions.length} listeners...`);
    
    state.unsubscribeFunctions.forEach(fn => {
        try {
            fn();
        } catch (e) {
            console.error('[State] Error cleaning up listener:', e);
        }
    });
    
    state.unsubscribeFunctions = [];
    state.allRequests = [];
    state.allItems = [];
    
    console.log('[State] All listeners cleaned up');
}

/**
 * Set loading state
 * @param {boolean} loading
 */
export function setLoading(loading) {
    state.isLoading = loading;
}

/**
 * Get loading state
 * @returns {boolean}
 */
export function isLoading() {
    return state.isLoading;
}

export default state;