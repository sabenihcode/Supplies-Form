// ============================================
// app.js - Office Supplies Request System
// Form-First Experience
// Version 4.0 - Adapted from v3.1
// PRESERVED: Firebase logic, transaction, data structure
// CHANGED: DOM references to match new HTML v4.0
// ============================================

import { db } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    orderBy,
    limit,
    serverTimestamp,
    doc,
    runTransaction
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

console.log('🚀 App.js v4.0 loaded');
console.log('📊 Firebase DB:', db ? '✅ Connected' : '❌ Not Connected');

// ============ STATE MANAGEMENT ============
// ✅ PRESERVED: Same state structure as v3.1
let currentStep = 1;
let cartItems = new Map();
let allItems = [];
let currentFilter = 'all';

// ============ WAIT FOR DOM ============
document.addEventListener('DOMContentLoaded', () => {
    console.log('📦 DOM Content Loaded - Initializing...');
    
    setTimeout(() => {
        initializeApp();
    }, 100);
});

// ============ INITIALIZE APP ============
function initializeApp() {
    console.log('🔧 Starting initialization...');
    
    // 🔄 CHANGED: Updated critical element IDs to match new HTML
    const criticalElements = {
        requestForm: 'requestForm',       // ✅ Same
        itemsList: 'itemsList',           // 🔄 Was: itemsGrid
        skeletonLoader: 'skeletonLoader', // ✅ Same
        summaryList: 'summaryList',       // 🔄 Was: cartItems
        toastStack: 'toastStack'          // 🔄 Was: toastContainer
    };
    
    let allFound = true;
    for (const [name, id] of Object.entries(criticalElements)) {
        const el = document.getElementById(id);
        if (!el) {
            console.error(`❌ Critical element not found: #${id}`);
            allFound = false;
        } else {
            console.log(`✅ Found: #${id}`);
        }
    }
    
    if (!allFound) {
        console.error('❌ Some critical elements missing. Check HTML structure.');
        showError('Terjadi kesalahan. Silakan refresh halaman.');
        return;
    }
    
    // 🔄 CHANGED: Removed dashboard-only functions
    // ❌ setGreeting();      → Removed (no greeting element)
    // ❌ loadStats();        → Removed (no stats cards)
    // ❌ loadPopularItems(); → Removed (no popular card)
    // ❌ loadRecentActivity(); → Removed (no activity card)
    
    loadTheme();
    setupEventListeners();
    loadItems();
    
    console.log('✅ App v4.0 initialized successfully');
}

// ============ SHOW ERROR ============
// 🔄 CHANGED: Uses #toastStack instead of #toastContainer
function showError(message) {
    const container = document.getElementById('toastStack');
    if (container) {
        const toast = document.createElement('div');
        toast.className = 'toast-msg error';
        toast.innerHTML = `
            <div class="toast-dot"></div>
            <span class="toast-text">${message}</span>
        `;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('out');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }
}

// ============ THEME MANAGEMENT ============
// ✅ PRESERVED: Same logic, updated icon IDs
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

// 🔄 CHANGED: Icon IDs updated
function updateThemeIcon(theme) {
    const lightIcon = document.getElementById('iconLight');   // 🔄 Was: themeLight
    const darkIcon = document.getElementById('iconDark');     // 🔄 Was: themeDark
    
    if (lightIcon && darkIcon) {
        lightIcon.style.display = theme === 'dark' ? 'none' : 'block';
        darkIcon.style.display = theme === 'dark' ? 'block' : 'none';
    }
}

// ============ EVENT LISTENERS SETUP ============
// 🔄 CHANGED: Updated selectors to match new HTML structure
function setupEventListeners() {
    console.log('⚙️ Setting up event listeners...');
    
    // Theme toggle - ✅ Same ID
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // 🔄 CHANGED: Step navigation - specific button IDs instead of data attributes
    const toStep2 = document.getElementById('toStep2');
    if (toStep2) {
        toStep2.addEventListener('click', () => {
            if (validateStep(1)) {
                goToStep(2);
                showToast('success', 'Tersimpan', 'Data diri berhasil disimpan');
            }
        });
    }
    
    const toStep3 = document.getElementById('toStep3');
    if (toStep3) {
        toStep3.addEventListener('click', () => {
            if (validateStep(2)) {
                goToStep(3);
            }
        });
    }
    
    const backToStep1 = document.getElementById('backToStep1');
    if (backToStep1) {
        backToStep1.addEventListener('click', () => goToStep(1));
    }
    
    const backToStep2 = document.getElementById('backToStep2');
    if (backToStep2) {
        backToStep2.addEventListener('click', () => goToStep(2));
    }
    
    // 🔄 CHANGED: Edit buttons use data-goto instead of data-edit
    document.querySelectorAll('.btn-edit[data-goto]').forEach(btn => {
        btn.addEventListener('click', () => {
            const step = parseInt(btn.dataset.goto);
            goToStep(step);
        });
    });
    
    // Search - ✅ Same IDs
    const searchInput = document.getElementById('searchItems');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
    
    const clearBtn = document.getElementById('clearSearch');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearSearch);
    }
    
    // 🔄 CHANGED: Filter chips use .chip instead of .filter-btn
    document.querySelectorAll('.chip').forEach(btn => {
        btn.addEventListener('click', () => handleFilter(btn));
    });
    
    const resetBtn = document.getElementById('resetFilter');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetFilters);
    }
    
    // ❌ REMOVED: reviewCartBtn (no longer exists)
    
    // Form submit - ✅ Same
    const form = document.getElementById('requestForm');
    if (form) {
        form.addEventListener('submit', handleSubmit);
    }
    
    // 🔄 CHANGED: Modal buttons updated
    const newRequestBtn = document.getElementById('newRequestBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const overlay = document.getElementById('overlay');  // 🔄 Was: modalBackdrop
    
    if (newRequestBtn) {
        newRequestBtn.addEventListener('click', () => {
            closeModal();
            resetForm();
        });
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }
    
    if (overlay) {
        overlay.addEventListener('click', closeModal);
    }
    
    // Scroll handling - ✅ Same
    window.addEventListener('scroll', handleScroll);
    
    const backToTop = document.getElementById('backToTop');
    if (backToTop) {
        backToTop.addEventListener('click', scrollToTop);
    }
    
    // ❌ REMOVED: fabCart (no longer exists in new HTML)
    
    // 🆕 NEW: Help popover
    const fabHelp = document.getElementById('fabHelp');
    const helpPopover = document.getElementById('helpPopover');
    const helpClose = document.getElementById('helpClose');
    
    if (fabHelp) {
        fabHelp.addEventListener('click', (e) => {
            e.stopPropagation();
            if (helpPopover) helpPopover.classList.toggle('active');
        });
    }
    
    if (helpClose) {
        helpClose.addEventListener('click', () => {
            if (helpPopover) helpPopover.classList.remove('active');
        });
    }
    
    // Close help popover on outside click
    document.addEventListener('click', (e) => {
        if (helpPopover?.classList.contains('active')) {
            if (!fabHelp?.contains(e.target) && !helpPopover?.contains(e.target)) {
                helpPopover.classList.remove('active');
            }
        }
    });
    
    // 🆕 NEW: Summary toggle (collapse/expand cart summary)
    const toggleSummary = document.getElementById('toggleSummary');
    if (toggleSummary) {
        toggleSummary.addEventListener('click', () => {
            const summaryBody = document.getElementById('summaryBody');
            const toggleIcon = document.getElementById('summaryToggleIcon');
            if (summaryBody) summaryBody.classList.toggle('collapsed');
            if (toggleIcon) {
                const isCollapsed = summaryBody?.classList.contains('collapsed');
                toggleIcon.className = isCollapsed ? 'ph ph-caret-down' : 'ph ph-caret-up';
            }
        });
    }
    
    // 🆕 NEW: Step labels clickable (go back only)
    document.querySelectorAll('.step-label').forEach(label => {
        label.addEventListener('click', () => {
            const targetStep = parseInt(label.dataset.step);
            if (targetStep < currentStep) {
                goToStep(targetStep);
            }
        });
    });
    
    // 🆕 NEW: Agreement checkbox enables submit button
    const agreement = document.getElementById('agreement');
    const submitBtn = document.getElementById('submitBtn');
    if (agreement && submitBtn) {
        agreement.addEventListener('change', () => {
            submitBtn.disabled = !agreement.checked;
        });
    }
    
    // 🆕 NEW: Escape key to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (helpPopover?.classList.contains('active')) {
                helpPopover.classList.remove('active');
            }
            const successModal = document.getElementById('successModal');
            if (successModal?.classList.contains('active')) {
                closeModal();
            }
        }
    });
    
    // 🆕 NEW: Real-time field validation on blur
    initFieldValidation();
    
    console.log('✅ Event listeners ready');
}

// ============ 🆕 NEW: FIELD VALIDATION (Real-time) ============
function initFieldValidation() {
    const fields = [
        { id: 'nama', errorId: 'namaError', type: 'required' },
        { id: 'departemen', errorId: 'deptError', type: 'required' },
        { id: 'email', errorId: 'emailError', type: 'email' }
    ];
    
    fields.forEach(field => {
        const el = document.getElementById(field.id);
        if (!el) return;
        
        el.addEventListener('blur', () => {
            validateSingleField(el, field.errorId, field.type);
        });
        
        el.addEventListener('input', () => {
            if (el.classList.contains('error')) {
                el.classList.remove('error');
                const errorEl = document.getElementById(field.errorId);
                if (errorEl) {
                    errorEl.textContent = '';
                    errorEl.classList.remove('show');
                }
            }
        });
    });
}

function validateSingleField(el, errorId, type) {
    const value = el.value.trim();
    const errorEl = document.getElementById(errorId);
    
    if (type === 'required' && !value) {
        el.classList.add('error');
        el.classList.remove('valid');
        if (errorEl) {
            errorEl.textContent = 'Field ini wajib diisi';
            errorEl.classList.add('show');
        }
        return false;
    }
    
    if (type === 'email') {
        if (!value) {
            el.classList.add('error');
            el.classList.remove('valid');
            if (errorEl) {
                errorEl.textContent = 'Email wajib diisi';
                errorEl.classList.add('show');
            }
            return false;
        }
        if (!value.includes('@')) {
            el.classList.add('error');
            el.classList.remove('valid');
            if (errorEl) {
                errorEl.textContent = 'Format email tidak valid';
                errorEl.classList.add('show');
            }
            return false;
        }
    }
    
    el.classList.remove('error');
    el.classList.add('valid');
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.remove('show');
    }
    return true;
}

// ============ STEP NAVIGATION ============
// 🔄 CHANGED: Selectors updated for new HTML
function goToStep(step) {
    // 🔄 Was: .form-step → Now: .step-panel
    document.querySelectorAll('.step-panel').forEach(s => {
        s.classList.remove('active');
    });
    
    const targetStep = document.querySelector(`.step-panel[data-step="${step}"]`);
    if (targetStep) {
        targetStep.classList.add('active');
        // Re-trigger animation
        targetStep.style.animation = 'none';
        targetStep.offsetHeight;
        targetStep.style.animation = '';
    }
    
    // 🔄 Was: .progress-step → Now: .step-label
    document.querySelectorAll('.step-label').forEach(p => {
        const stepNum = parseInt(p.dataset.step);
        p.classList.remove('active', 'completed');
        
        if (stepNum === step) {
            p.classList.add('active');
        } else if (stepNum < step) {
            p.classList.add('completed');
        }
    });
    
    // 🆕 NEW: Update progress bar fill
    const stepFill = document.getElementById('stepFill');
    if (stepFill) {
        const percent = (step / 3) * 100;
        stepFill.style.width = `${percent}%`;
    }
    
    // 🆕 NEW: Update hero text contextually
    updateHeroText(step);
    
    currentStep = step;
    
    if (step === 3) {
        updateReviewSection();
    }
    
    // 🆕 NEW: Update step 2 button state
    if (step === 2) {
        updateStep2NextButton();
    }
    
    // Smooth scroll to form
    const formStage = document.querySelector('.form-stage');
    if (formStage) {
        setTimeout(() => {
            formStage.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
}

// 🆕 NEW: Contextual hero text
function updateHeroText(step) {
    const heroTitle = document.getElementById('heroTitle');
    const heroDesc = document.getElementById('heroDesc');
    const heroBadgeText = document.getElementById('heroBadgeText');
    
    const heroData = {
        1: {
            badge: 'Langkah 1 dari 3',
            title: 'Ajukan Kebutuhan<br><span class="text-gradient">Alat Tulis Kantor</span>',
            desc: 'Isi form di bawah ini untuk mengajukan permintaan alat tulis kantor. Proses cepat, estimasi 2-3 hari kerja.'
        },
        2: {
            badge: 'Langkah 2 dari 3',
            title: 'Pilih Barang<br><span class="text-gradient">yang Dibutuhkan</span>',
            desc: 'Cari dan tambahkan barang ke daftar pengajuan Anda. Atur jumlah sesuai kebutuhan.'
        },
        3: {
            badge: 'Langkah Terakhir',
            title: 'Satu Langkah Lagi<br><span class="text-gradient">Sebelum Dikirim!</span>',
            desc: 'Periksa kembali data dan barang yang diajukan. Pastikan semua sudah benar sebelum mengirim.'
        }
    };
    
    const data = heroData[step];
    if (!data) return;
    
    if (heroBadgeText) heroBadgeText.textContent = data.badge;
    if (heroTitle) heroTitle.innerHTML = data.title;
    if (heroDesc) heroDesc.textContent = data.desc;
}

// 🆕 NEW: Enable/disable step 2 next button based on cart
function updateStep2NextButton() {
    const toStep3 = document.getElementById('toStep3');
    if (toStep3) {
        toStep3.disabled = cartItems.size === 0;
    }
}

// ============ VALIDATION ============
// 🔄 CHANGED: Field IDs updated to match new HTML
function validateStep(step) {
    if (step === 1) {
        const name = document.getElementById('nama');           // 🔄 Was: requesterName
        const dept = document.getElementById('departemen');     // 🔄 Was: requesterDept
        const email = document.getElementById('email');         // 🔄 Was: requesterEmail
        
        let valid = true;
        
        if (!name?.value.trim()) {
            showToast('error', 'Error', 'Nama lengkap harus diisi');
            showFieldError(name, 'namaError', 'Nama wajib diisi');
            name?.focus();
            valid = false;
        } else {
            clearFieldError(name, 'namaError');
        }
        
        if (!dept?.value) {
            if (valid) {
                showToast('error', 'Error', 'Departemen harus dipilih');
                dept?.focus();
            }
            showFieldError(dept, 'deptError', 'Pilih departemen');
            valid = false;
        } else {
            clearFieldError(dept, 'deptError');
        }
        
        if (!email?.value.includes('@')) {
            if (valid) {
                showToast('error', 'Error', 'Email tidak valid');
                email?.focus();
            }
            showFieldError(email, 'emailError', 'Format email tidak valid');
            valid = false;
        } else {
            clearFieldError(email, 'emailError');
        }
        
        return valid;
    }
    
    if (step === 2) {
        if (cartItems.size === 0) {
            showToast('warning', 'Peringatan', 'Pilih minimal 1 barang');
            return false;
        }
        return true;
    }
    
    return true;
}

// 🆕 NEW: Field error helpers
function showFieldError(input, errorId, message) {
    if (input) {
        input.classList.add('error');
        input.classList.remove('valid');
    }
    const errorEl = document.getElementById(errorId);
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
    }
}

function clearFieldError(input, errorId) {
    if (input) {
        input.classList.remove('error');
    }
    const errorEl = document.getElementById(errorId);
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.remove('show');
    }
}

// ============ LOAD ITEMS ============
// ✅ PRESERVED: Same Firebase logic, field names (itemName, stock, unit)
// 🔄 CHANGED: Renders to #itemsList instead of #itemsGrid
async function loadItems() {
    console.log('📦 Loading items from Firestore...');
    
    const itemsList = document.getElementById('itemsList');      // 🔄 Was: itemsGrid
    const skeletonLoader = document.getElementById('skeletonLoader');
    
    if (!itemsList) {
        console.error('❌ itemsList element not found!');
        return;
    }
    
    try {
        if (skeletonLoader) {
            skeletonLoader.style.display = 'flex';  // 🔄 Changed from 'grid' to 'flex' (column layout)
        }
        
        itemsList.innerHTML = '';
        
        if (!db) {
            throw new Error('Database not initialized');
        }
        
        const itemsRef = collection(db, 'items');
        const q = query(itemsRef, orderBy('itemName'));  // ✅ PRESERVED: orderBy('itemName')
        const snapshot = await getDocs(q);
        
        console.log(`📊 Fetched ${snapshot.size} items from Firestore`);
        
        if (skeletonLoader) {
            skeletonLoader.style.display = 'none';
        }
        
        allItems = [];
        
        if (snapshot.empty) {
            console.warn('⚠️ No items found in database');
            showNoResults();
            return;
        }
        
        snapshot.forEach(doc => {
            const item = { id: doc.id, ...doc.data() };
            allItems.push(item);
        });
        
        console.log('✅ Items loaded:', allItems.length);
        renderItems(allItems);
        
    } catch (error) {
        console.error('❌ Error loading items:', error);
        
        if (skeletonLoader) {
            skeletonLoader.style.display = 'none';
        }
        
        showToast('error', 'Error', 'Gagal memuat daftar barang: ' + error.message);
    }
}

// ============ RENDER ITEMS ============
// 🔄 CHANGED: Row-based layout instead of card grid
function renderItems(items) {
    const itemsList = document.getElementById('itemsList');  // 🔄 Was: itemsGrid
    if (!itemsList) return;
    
    itemsList.innerHTML = '';
    
    if (items.length === 0) {
        showNoResults();
        return;
    }
    
    hideNoResults();
    
    items.forEach(item => {
        const row = createItemRow(item);  // 🔄 Was: createItemCard
        itemsList.appendChild(row);
    });
    
    console.log(`✅ Rendered ${items.length} items`);
}

// 🔄 CHANGED: createItemCard → createItemRow (row-based design)
function createItemRow(item) {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.dataset.itemId = item.id;
    
    // ✅ PRESERVED: Same stock logic
    let stockClass = 'available';
    let stockText = `Stok ${item.stock}`;
    
    if (item.stock === 0) {
        stockClass = 'out';
        stockText = 'Habis';
    } else if (item.stock <= 5) {
        stockClass = 'low';
        stockText = `Sisa ${item.stock}`;
    }
    
    const inCart = cartItems.has(item.id);
    if (inCart) row.classList.add('in-cart');
    
    const currentQty = inCart ? cartItems.get(item.id).qty : 0;
    
    row.innerHTML = `
        <div class="item-icon">
            <i class="ph ph-package"></i>
        </div>
        <div class="item-info">
            <div class="item-name" title="${item.itemName}">${item.itemName}</div>
            <div class="item-meta">
                <span class="stock-badge ${stockClass}">${stockText}</span>
                <span class="item-unit">${item.unit || 'pcs'}</span>
            </div>
        </div>
        <div class="qty-group">
            <button type="button" 
                    class="qty-btn" 
                    data-action="decrease" 
                    data-id="${item.id}"
                    ${currentQty <= 0 ? 'disabled' : ''}
                    aria-label="Kurangi ${item.itemName}">−</button>
            <span class="qty-val" id="qty-${item.id}">${currentQty}</span>
            <button type="button" 
                    class="qty-btn" 
                    data-action="increase" 
                    data-id="${item.id}" 
                    data-max="${item.stock}"
                    ${item.stock <= 0 ? 'disabled' : ''}
                    aria-label="Tambah ${item.itemName}">+</button>
        </div>
    `;
    
    // 🔄 CHANGED: Event listeners instead of inline onclick
    row.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            const id = btn.dataset.id;
            
            if (action === 'increase') {
                const max = parseInt(btn.dataset.max);
                handleIncrease(id, item.itemName, item.unit || 'pcs', max);
            } else {
                handleDecrease(id, item.itemName);
            }
        });
    });
    
    return row;
}

// ============ QUANTITY CONTROLS ============
// 🔄 CHANGED: Combined increase/decrease with auto cart management
function handleIncrease(itemId, itemName, unit, maxStock) {
    const qtyDisplay = document.getElementById(`qty-${itemId}`);
    if (!qtyDisplay) return;
    
    let current = parseInt(qtyDisplay.textContent) || 0;
    
    if (current >= maxStock) {
        showToast('warning', 'Batas Stok', `Maksimal ${maxStock} item`);
        return;
    }
    
    current++;
    qtyDisplay.textContent = current;
    
    // Auto-update cart
    if (cartItems.has(itemId)) {
        cartItems.get(itemId).qty = current;
    } else {
        cartItems.set(itemId, {
            name: itemName,
            qty: current,
            unit: unit,
            maxStock: maxStock
        });
        showToast('success', 'Ditambahkan', `${itemName} ditambahkan ke daftar`);
    }
    
    // Update row visual
    const row = document.querySelector(`.item-row[data-item-id="${itemId}"]`);
    if (row) row.classList.add('in-cart');
    
    // Update decrease button
    const decreaseBtn = row?.querySelector('[data-action="decrease"]');
    if (decreaseBtn) decreaseBtn.disabled = false;
    
    updateCartUI();
}

function handleDecrease(itemId, itemName) {
    const qtyDisplay = document.getElementById(`qty-${itemId}`);
    if (!qtyDisplay) return;
    
    let current = parseInt(qtyDisplay.textContent) || 0;
    
    if (current <= 0) return;
    
    current--;
    qtyDisplay.textContent = current;
    
    if (current === 0) {
        cartItems.delete(itemId);
        
        const row = document.querySelector(`.item-row[data-item-id="${itemId}"]`);
        if (row) row.classList.remove('in-cart');
        
        // Disable decrease button
        const decreaseBtn = row?.querySelector('[data-action="decrease"]');
        if (decreaseBtn) decreaseBtn.disabled = true;
        
        showToast('info', 'Dihapus', `${itemName} dihapus dari daftar`);
    } else {
        if (cartItems.has(itemId)) {
            cartItems.get(itemId).qty = current;
        }
    }
    
    updateCartUI();
}

// ✅ PRESERVED for compatibility
window.increaseQty = function(itemId, maxStock) {
    const item = allItems.find(i => i.id === itemId);
    if (item) {
        handleIncrease(itemId, item.itemName, item.unit || 'pcs', maxStock);
    }
}

window.decreaseQty = function(itemId) {
    const item = allItems.find(i => i.id === itemId);
    if (item) {
        handleDecrease(itemId, item.itemName);
    }
}

window.addToCart = function(itemId, itemName, unit, maxStock) {
    // Legacy compatibility - redirect to new flow
    const qtyDisplay = document.getElementById(`qty-${itemId}`);
    const qty = parseInt(qtyDisplay?.textContent) || 0;
    
    if (qty === 0) {
        handleIncrease(itemId, itemName, unit, maxStock);
    }
}

// ============ CART UI UPDATE ============
// 🔄 CHANGED: Updates inline summary instead of sidebar cart
function updateCartUI() {
    const count = cartItems.size;
    let totalQty = 0;
    cartItems.forEach(item => totalQty += item.qty);
    
    // 🔄 CHANGED: Summary elements instead of cart elements
    const summaryCount = document.getElementById('summaryCount');
    const summaryTotal = document.getElementById('summaryTotal');
    const selectionSummary = document.getElementById('selectionSummary');
    
    if (summaryCount) summaryCount.textContent = count;
    if (summaryTotal) summaryTotal.textContent = totalQty;
    
    if (count === 0) {
        if (selectionSummary) {
            selectionSummary.style.display = 'none';
            selectionSummary.classList.remove('has-items');
        }
    } else {
        if (selectionSummary) {
            selectionSummary.style.display = 'block';
            selectionSummary.classList.add('has-items');
        }
        renderSummaryItems();
    }
    
    // Update step 2 next button
    updateStep2NextButton();
}

// 🔄 CHANGED: renderCartItems → renderSummaryItems
function renderSummaryItems() {
    const summaryList = document.getElementById('summaryList');  // 🔄 Was: cartItems
    if (!summaryList) return;
    
    summaryList.innerHTML = '';
    
    cartItems.forEach((item, itemId) => {
        const li = document.createElement('li');
        li.className = 'summary-item';
        li.innerHTML = `
            <span class="summary-item-name">${item.name}</span>
            <div class="summary-item-right">
                <span class="summary-item-qty">×${item.qty} ${item.unit}</span>
                <button type="button" 
                        class="summary-item-remove" 
                        data-remove="${itemId}"
                        aria-label="Hapus ${item.name}">
                    <i class="ph ph-x"></i>
                </button>
            </div>
        `;
        
        // Remove button event
        li.querySelector('.summary-item-remove').addEventListener('click', () => {
            window.removeFromCart(itemId);
        });
        
        summaryList.appendChild(li);
    });
}

// ✅ PRESERVED: removeFromCart
window.removeFromCart = function(itemId) {
    cartItems.delete(itemId);
    
    // 🔄 CHANGED: .item-row instead of .item-card
    const row = document.querySelector(`.item-row[data-item-id="${itemId}"]`);
    if (row) {
        row.classList.remove('in-cart');
        const qtyDisplay = row.querySelector('.qty-val');
        if (qtyDisplay) qtyDisplay.textContent = '0';
        const decreaseBtn = row.querySelector('[data-action="decrease"]');
        if (decreaseBtn) decreaseBtn.disabled = true;
    }
    
    updateCartUI();
    showToast('info', 'Dihapus', 'Item dihapus dari daftar');
}

// ============ SEARCH & FILTER ============
// 🔄 CHANGED: clearBtn selector updated
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase().trim();
    
    const clearBtn = document.getElementById('clearSearch');
    if (clearBtn) {
        clearBtn.classList.toggle('show', !!searchTerm);  // 🔄 Changed from style.display to classList
    }
    
    filterAndRenderItems(searchTerm, currentFilter);
}

function clearSearch() {
    const searchInput = document.getElementById('searchItems');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    
    const clearBtn = document.getElementById('clearSearch');
    if (clearBtn) clearBtn.classList.remove('show');  // 🔄 Changed
    
    filterAndRenderItems('', currentFilter);
}

// 🔄 CHANGED: .chip instead of .filter-btn
function handleFilter(btn) {
    document.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    currentFilter = btn.dataset.filter;
    
    const searchInput = document.getElementById('searchItems');
    const searchTerm = searchInput?.value.toLowerCase().trim() || '';
    
    filterAndRenderItems(searchTerm, currentFilter);
}

function resetFilters() {
    const searchInput = document.getElementById('searchItems');
    if (searchInput) searchInput.value = '';
    
    const clearBtn = document.getElementById('clearSearch');
    if (clearBtn) clearBtn.classList.remove('show');
    
    // 🔄 CHANGED: .chip instead of .filter-btn
    document.querySelectorAll('.chip').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === 'all');
    });
    
    currentFilter = 'all';
    renderItems(allItems);
}

// ✅ PRESERVED: Same filter logic
function filterAndRenderItems(searchTerm, filter) {
    let filtered = [...allItems];
    
    if (searchTerm) {
        filtered = filtered.filter(item => 
            item.itemName.toLowerCase().includes(searchTerm)
        );
    }
    
    switch (filter) {
        case 'available':
            filtered = filtered.filter(item => item.stock > 5);
            break;
        case 'low':
            filtered = filtered.filter(item => item.stock > 0 && item.stock <= 5);
            break;
    }
    
    renderItems(filtered);
}

// 🔄 CHANGED: Updated selectors
function showNoResults() {
    const noResults = document.getElementById('noResults');
    const itemsList = document.getElementById('itemsList');
    
    if (noResults) noResults.style.display = 'flex';
    if (itemsList) itemsList.style.display = 'none';
}

function hideNoResults() {
    const noResults = document.getElementById('noResults');
    const itemsList = document.getElementById('itemsList');
    
    if (noResults) noResults.style.display = 'none';
    if (itemsList) itemsList.style.display = 'flex';  // 🔄 Changed from 'grid' to 'flex' (column)
}

// ============ REVIEW SECTION ============
// 🔄 CHANGED: Field IDs and HTML structure updated
function updateReviewSection() {
    const reviewUserInfo = document.getElementById('reviewUserInfo');
    const reviewItems = document.getElementById('reviewItems');
    const reviewTotal = document.getElementById('reviewTotal');
    
    if (reviewUserInfo) {
        const name = document.getElementById('nama');           // 🔄 Was: requesterName
        const dept = document.getElementById('departemen');     // 🔄 Was: requesterDept
        const email = document.getElementById('email');         // 🔄 Was: requesterEmail
        const ext = document.getElementById('telepon');         // 🔄 Was: requesterExt
        
        // 🔄 CHANGED: review-data-row instead of review-row
        let html = `
            <div class="review-data-row">
                <span class="review-data-label">Nama</span>
                <span class="review-data-value">${name?.value || '-'}</span>
            </div>
            <div class="review-data-row">
                <span class="review-data-label">Departemen</span>
                <span class="review-data-value">${dept?.value || '-'}</span>
            </div>
            <div class="review-data-row">
                <span class="review-data-label">Email</span>
                <span class="review-data-value">${email?.value || '-'}</span>
            </div>
        `;
        
        if (ext?.value?.trim()) {
            html += `
                <div class="review-data-row">
                    <span class="review-data-label">Telepon</span>
                    <span class="review-data-value">${ext.value}</span>
                </div>
            `;
        }
        
        reviewUserInfo.innerHTML = html;
    }
    
    if (reviewItems) {
        reviewItems.innerHTML = '';
        let total = 0;
        
        cartItems.forEach((item, itemId) => {
            total += item.qty;
            
            const li = document.createElement('li');
            // 🔄 CHANGED: review-item-row instead of review-item
            li.className = 'review-item-row';
            li.innerHTML = `
                <span class="review-item-name">${item.name}</span>
                <span class="review-item-qty">×${item.qty} ${item.unit}</span>
            `;
            reviewItems.appendChild(li);
        });
        
        if (reviewTotal) reviewTotal.textContent = total;
    }
}

// ============ FORM SUBMISSION ============
// ✅ PRESERVED: Same Firebase logic, transaction, data structure
// 🔄 CHANGED: Only DOM element IDs updated
async function handleSubmit(e) {
    e.preventDefault();
    
    // 🔄 CHANGED: #agreement instead of #agreeTerms
    const agreeTerms = document.getElementById('agreement');
    if (!agreeTerms?.checked) {
        showToast('error', 'Error', 'Harap centang persetujuan');
        return;
    }
    
    const submitBtn = document.getElementById('submitBtn');
    // 🔄 CHANGED: .submit-content / .submit-loading instead of .btn-content / .btn-loading
    const btnContent = submitBtn?.querySelector('.submit-content');
    const btnLoading = submitBtn?.querySelector('.submit-loading');
    
    if (btnContent) btnContent.style.display = 'none';
    if (btnLoading) btnLoading.style.display = 'inline-flex';  // 🔄 Changed from 'flex'
    if (submitBtn) submitBtn.disabled = true;
    
    try {
        // ✅ PRESERVED: Same request number generation
        const requestNumber = await generateRequestNumber();
        
        // ✅ PRESERVED: Same items structure
        const items = [];
        cartItems.forEach((item, itemId) => {
            items.push({
                itemId: itemId,
                itemName: item.name,
                quantity: item.qty,
                unit: item.unit
            });
        });
        
        // 🔄 CHANGED: New field IDs
        const name = document.getElementById('nama');           // 🔄 Was: requesterName
        const dept = document.getElementById('departemen');     // 🔄 Was: requesterDept
        const email = document.getElementById('email');         // 🔄 Was: requesterEmail
        const ext = document.getElementById('telepon');         // 🔄 Was: requesterExt
        const notes = document.getElementById('catatan');       // 🔄 Was: requestNotes
        
        // ✅ PRESERVED: EXACT same data structure as v3.1
        const requestData = {
            requestNumber: requestNumber,
            requesterName: name?.value.trim(),
            requesterDept: dept?.value,
            requesterEmail: email?.value.trim(),
            requesterExt: ext?.value.trim() || '',
            requestedItems: items,
            notes: notes?.value.trim() || '',
            status: 'pending',
            
            // ✅ PRESERVED: ALL THREE timestamp fields for compatibility
            timestamp: serverTimestamp(),
            createdAt: serverTimestamp(),
            createdAtISO: new Date().toISOString()
        };
        
        console.log('📤 Submitting request data:', {
            requestNumber,
            itemCount: items.length,
            hasTimestamp: true
        });
        
        // ✅ PRESERVED: Same Firestore collection
        await addDoc(collection(db, 'requests'), requestData);
        
        console.log('✅ Request submitted successfully:', requestNumber);
        
        const requestNumberEl = document.getElementById('requestNumber');
        if (requestNumberEl) requestNumberEl.textContent = requestNumber;
        
        showModal();
        // ❌ REMOVED: loadStats(); (no stats in new UI)
        
    } catch (error) {
        console.error('❌ Error submitting request:', error);
        showToast('error', 'Error', 'Gagal mengirim request: ' + error.message);
    } finally {
        if (btnContent) btnContent.style.display = 'inline-flex';
        if (btnLoading) btnLoading.style.display = 'none';
        if (submitBtn) submitBtn.disabled = false;
    }
}

// ============ REQUEST NUMBER GENERATOR ============
// ✅ PRESERVED: 100% identical to v3.1
async function generateRequestNumber() {
    try {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        
        const datePrefix = `${dd}${mm}${yyyy}`;
        const todayFormat = `${yyyy}${mm}${dd}`;
        
        const counterRef = doc(db, 'counters', 'requests');
        
        const requestNumber = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            
            let nextNumber = 1;
            
            if (counterDoc.exists()) {
                const data = counterDoc.data();
                if (data.lastDate === todayFormat) {
                    nextNumber = (data.lastNumber || 0) + 1;
                }
            }
            
            transaction.set(counterRef, {
                lastDate: todayFormat,
                lastNumber: nextNumber,
                lastUpdated: serverTimestamp()
            });
            
            return `${datePrefix}${String(nextNumber).padStart(3, '0')}`;
        });
        
        return requestNumber;
        
    } catch (error) {
        console.error('Error generating request number:', error);
        return `REQ-${Date.now()}`;
    }
}

// ============ MODAL FUNCTIONS ============
// 🔄 CHANGED: #overlay instead of #modalBackdrop
function showModal() {
    const overlay = document.getElementById('overlay');          // 🔄 Was: modalBackdrop
    const modal = document.getElementById('successModal');
    
    if (overlay) overlay.classList.add('active');
    if (modal) modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const overlay = document.getElementById('overlay');          // 🔄 Was: modalBackdrop
    const modal = document.getElementById('successModal');
    
    if (overlay) overlay.classList.remove('active');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
}

// ============ RESET FORM ============
// 🔄 CHANGED: Updated selectors
function resetForm() {
    const form = document.getElementById('requestForm');
    if (form) form.reset();
    
    cartItems.clear();
    updateCartUI();
    
    // 🔄 CHANGED: .item-row instead of .item-card
    document.querySelectorAll('.item-row.in-cart').forEach(row => {
        row.classList.remove('in-cart');
    });
    
    // 🔄 CHANGED: .qty-val instead of .qty-display
    document.querySelectorAll('.qty-val').forEach(el => {
        el.textContent = '0';
    });
    
    // 🆕 NEW: Clear validation states
    document.querySelectorAll('.field-input').forEach(input => {
        input.classList.remove('valid', 'error');
    });
    document.querySelectorAll('.field-error').forEach(el => {
        el.textContent = '';
        el.classList.remove('show');
    });
    
    // Reset submit button
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.disabled = true;
    
    goToStep(1);
    loadItems();
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============ TOAST NOTIFICATIONS ============
// 🔄 CHANGED: New toast structure matching CSS
function showToast(type, title, message) {
    const container = document.getElementById('toastStack');  // 🔄 Was: toastContainer
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    
    // 🔄 CHANGED: Simplified toast structure
    toast.innerHTML = `
        <div class="toast-dot"></div>
        <span class="toast-text">${title}: ${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Max 5 toasts
    const toasts = container.querySelectorAll('.toast-msg');
    if (toasts.length > 5) {
        toasts[0].remove();
    }
    
    setTimeout(() => {
        toast.classList.add('out');
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 300);
    }, 4000);
}

// ============ SCROLL HANDLING ============
// ✅ PRESERVED: Same logic
function handleScroll() {
    const backToTop = document.getElementById('backToTop');
    
    if (backToTop) {
        if (window.scrollY > 300) {
            backToTop.classList.add('show');
        } else {
            backToTop.classList.remove('show');
        }
    }
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

console.log('📱 App.js v4.0 fully loaded - Form-First Experience');
