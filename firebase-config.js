// ============================================
// firebase-config.js - FIXED VERSION
// Office Supplies System - Trakindo
// Version: 1.1 - Enhanced timestamp handling
// ============================================

// Import Firebase SDK versi 12.4.0
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js";

// Konfigurasi Firebase untuk office-supplies-tu
const firebaseConfig = {
    apiKey: "AIzaSyD6nVXaVUq4TKtfz8MdqwAlEn6AqZl1Tp8",
    authDomain: "office-supplies-tu.firebaseapp.com",
    projectId: "office-supplies-tu",
    storageBucket: "office-supplies-tu.firebasestorage.app",
    messagingSenderId: "953307981115",
    appId: "1:953307981115:web:465392f858bc56ac22831e",
    measurementId: "G-3WXYD63T51"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const analytics = getAnalytics(app);

// ============ ENHANCED FORMAT DATE ============
// Handles multiple timestamp formats with fallback
export function formatDate(dateField) {
    if (!dateField) return 'N/A';
    
    try {
        let date;
        
        // Firestore Timestamp object with toDate method
        if (dateField?.toDate && typeof dateField.toDate === 'function') {
            date = dateField.toDate();
        }
        // Firestore Timestamp as plain object {seconds, nanoseconds}
        else if (dateField?.seconds && typeof dateField.seconds === 'number') {
            date = new Date(dateField.seconds * 1000);
        }
        // ISO string format
        else if (typeof dateField === 'string') {
            date = new Date(dateField);
        }
        // Already a Date object
        else if (dateField instanceof Date) {
            date = dateField;
        }
        // Fallback
        else {
            console.warn('Unknown date format:', dateField);
            return 'N/A';
        }
        
        // Validate date
        if (isNaN(date.getTime())) {
            console.warn('Invalid date value:', dateField);
            return 'N/A';
        }
        
        // Format to Indonesian locale
        return date.toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
    } catch (error) {
        console.error('Error formatting date:', error, dateField);
        return 'N/A';
    }
}

// ============ SHORT DATE FORMAT ============
// For compact display (e.g., "21 Nov 2025")
export function formatDateShort(dateField) {
    if (!dateField) return 'N/A';
    
    try {
        let date;
        
        if (dateField?.toDate) {
            date = dateField.toDate();
        } else if (dateField?.seconds) {
            date = new Date(dateField.seconds * 1000);
        } else if (typeof dateField === 'string') {
            date = new Date(dateField);
        } else if (dateField instanceof Date) {
            date = dateField;
        } else {
            return 'N/A';
        }
        
        if (isNaN(date.getTime())) return 'N/A';
        
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
        
    } catch (error) {
        console.error('Error formatting short date:', error);
        return 'N/A';
    }
}

// ============ RELATIVE TIME ============
// For activity feeds (e.g., "5 menit yang lalu")
export function formatRelativeTime(dateField) {
    if (!dateField) return 'N/A';
    
    try {
        let date;
        
        if (dateField?.toDate) {
            date = dateField.toDate();
        } else if (dateField?.seconds) {
            date = new Date(dateField.seconds * 1000);
        } else if (typeof dateField === 'string') {
            date = new Date(dateField);
        } else if (dateField instanceof Date) {
            date = dateField;
        } else {
            return 'N/A';
        }
        
        if (isNaN(date.getTime())) return 'N/A';
        
        const now = new Date();
        const diffMs = now - date;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffSecs < 60) return 'Baru saja';
        if (diffMins < 60) return `${diffMins} menit yang lalu`;
        if (diffHours < 24) return `${diffHours} jam yang lalu`;
        if (diffDays < 7) return `${diffDays} hari yang lalu`;
        
        return formatDateShort(dateField);
        
    } catch (error) {
        console.error('Error formatting relative time:', error);
        return 'N/A';
    }
}

// ============ EMAIL VALIDATION ============
export function validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim());
}

// ============ SANITIZE INPUT ============
// Prevent XSS attacks
export function sanitizeInput(input) {
    if (!input) return '';
    return String(input)
        .trim()
        .replace(/[<>]/g, '') // Remove HTML tags
        .substring(0, 500); // Limit length
}

// ============ FIRESTORE ERROR HANDLER ============
export function handleFirestoreError(error) {
    console.error('Firestore Error:', error);
    
    const errorMessages = {
        'permission-denied': 'Akses ditolak. Silakan login kembali.',
        'unavailable': 'Koneksi database bermasalah. Coba lagi.',
        'not-found': 'Data tidak ditemukan.',
        'already-exists': 'Data sudah ada.',
        'failed-precondition': 'Index database diperlukan. Hubungi admin.',
        'unauthenticated': 'Anda harus login terlebih dahulu.'
    };
    
    return errorMessages[error.code] || `Error: ${error.message}`;
}

// ============ LOG SYSTEM STATUS ============
console.log('✅ Firebase berhasil diinisialisasi untuk office-supplies-tu');
console.log('📊 Services ready:', {
    firestore: !!db,
    auth: !!auth,
    analytics: !!analytics
});

// Export all
export default {
    db,
    auth,
    analytics,
    formatDate,
    formatDateShort,
    formatRelativeTime,
    validateEmail,
    sanitizeInput,
    handleFirestoreError
};
