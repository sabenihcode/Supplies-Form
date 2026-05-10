/**
 * ============================================
 * inventory.js - Inventory Management Module
 * Admin Dashboard - Trakindo Office Supplies
 * ============================================
 */

import { db } from '../firebase-config.js';
import { 
    collection, 
    onSnapshot, 
    query, 
    orderBy,
    doc, 
    addDoc,
    updateDoc, 
    deleteDoc,
    getDoc,
    getDocs,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

import { CONFIG } from './config.js';
import { getCurrentUser, getAllItems, setAllItems, addUnsubscribe } from './state.js';
import { showToast, showConfirm, showPrompt, showLoading, showEmptyState, showErrorState } from './ui.js';
import { 
    escapeHtml, 
    escapeAttr, 
    validateItemName, 
    validateStock, 
    getStockStatus,
    $,
    $$$,
    debugLog, 
    infoLog, 
    errorLog,
    downloadCSV,
    generateFilename
} from './utils.js';

// ============ DOM ELEMENTS ============

let elements = {};

function initElements() {
    elements = {
        inventoryList: $('inventory-list'),
        addItemForm: $('add-item-form'),
        lowStockCount: $('low-stock-count'),
        totalItemsCount: $('total-items-count'),
        normalItemsCount: $('normal-items-count'),
        lowItemsCount: $('low-items-count'),
        emptyItemsCount: $('empty-items-count'),
        searchInput: $('search-inventory'),
        skeletonLoader: $('inventorySkeletonLoader')
    };
}

// ============ INITIALIZATION ============

/**
 * Initialize inventory module
 */
export function initInventory() {
    initElements();
    setupEventListeners();
    infoLog('Inventory module initialized');
}

function setupEventListeners() {
    // Add item form
    if (elements.addItemForm) {
        elements.addItemForm.addEventListener('submit', handleAddItem);
    }
    
    // Search input
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', (e) => {
            searchInventory(e.target.value);
        });
    }
    
    // Clear search
    const clearBtn = $('clearSearchInventory');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (elements.searchInput) {
                elements.searchInput.value = '';
                renderInventory(getAllItems());
            }
        });
    }
    
    // Export button
    const exportBtn = $('exportInventoryBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportInventory);
    }
}

// ============ LOAD INVENTORY ============

/**
 * Load inventory from Firestore
 */
export function loadInventory() {
    debugLog('Loading inventory...');
    
    if (!elements.inventoryList) {
        elements.inventoryList = $('inventory-list');
    }
    
    if (!elements.inventoryList) {
        errorLog('inventoryList container not found');
        return;
    }
    
    showLoading(elements.inventoryList, 'Memuat inventaris...');
    
    const q = query(
        collection(db, CONFIG.collections.items), 
        orderBy('itemName')
    );
    
    const unsubscribe = onSnapshot(q, 
        (snapshot) => {
            const items = [];
            
            snapshot.forEach(doc => {
                items.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            setAllItems(items);
            renderInventory(items);
            updateInventoryStats(items);
            
            debugLog(`Loaded ${items.length} inventory items`);
        },
        (error) => {
            errorLog('Error loading inventory:', error);
            showErrorState(elements.inventoryList, error.message, loadInventory);
        }
    );
    
    addUnsubscribe(unsubscribe);
}

// ============ RENDER INVENTORY ============

/**
 * Render inventory items
 * @param {Array} items - Array of item objects
 */
function renderInventory(items) {
    if (!elements.inventoryList) return;
    
    if (items.length === 0) {
        showEmptyState(elements.inventoryList, {
            icon: 'package',
            title: 'Belum Ada Barang',
            message: 'Gunakan form di atas untuk menambahkan barang baru'
        });
        return;
    }
    
    elements.inventoryList.innerHTML = '';
    
    items.forEach(item => {
        const card = createInventoryCard(item.id, item);
        elements.inventoryList.appendChild(card);
    });
}

/**
 * Create inventory card element
 * @param {string} id - Item document ID
 * @param {Object} item - Item data
 * @returns {HTMLElement}
 */
function createInventoryCard(id, item) {
    const card = document.createElement('div');
    card.className = 'inventory-card';
    card.dataset.itemId = id;
    
    const stock = parseInt(item.stock) || 0;
    const minStock = parseInt(item.minStock) || CONFIG.stock.lowThreshold;
    const stockStatus = getStockStatus(stock, minStock);
    
    const safeItemName = escapeHtml(item.itemName || '');
    const safeUnit = escapeHtml(item.unit || 'pcs');
    
    card.innerHTML = `
        <div class="inventory-card-header">
            <h4><i class="ph ph-package"></i> ${safeItemName}</h4>
            <span class="stock-badge ${stockStatus.class}">
                ${stockStatus.emoji} ${stockStatus.text}
            </span>
        </div>
        <div class="inventory-card-body">
            <div class="stock-info">
                <span class="stock-value">${stock} ${safeUnit}</span>
                <span class="stock-min">Min: ${minStock} ${safeUnit}</span>
            </div>
        </div>
        <div class="inventory-card-actions">
            <div class="add-stock-form">
                <input 
                    type="number" 
                    id="add-stock-${id}" 
                    min="1" 
                    placeholder="Jumlah"
                    class="add-stock-input"
                >
                <button 
                    type="button" 
                    class="btn-primary btn-sm btn-add-stock"
                    data-item-id="${escapeAttr(id)}"
                    data-item-name="${escapeAttr(item.itemName)}"
                >
                    <i class="ph ph-plus"></i> Tambah
                </button>
            </div>
            <div class="card-action-buttons">
                <button 
                    type="button" 
                    class="btn-secondary btn-sm btn-edit-item"
                    data-item-id="${escapeAttr(id)}"
                >
                    <i class="ph ph-pencil"></i>
                </button>
                <button 
                    type="button" 
                    class="btn-danger btn-sm btn-delete-item"
                    data-item-id="${escapeAttr(id)}"
                    data-item-name="${escapeAttr(item.itemName)}"
                >
                    <i class="ph ph-trash"></i>
                </button>
            </div>
        </div>
    `;
    
    // Event listeners
    const addStockBtn = card.querySelector('.btn-add-stock');
    addStockBtn?.addEventListener('click', () => {
        addStock(id, item.itemName, item.unit || 'pcs');
    });
    
    const deleteBtn = card.querySelector('.btn-delete-item');
    deleteBtn?.addEventListener('click', () => {
        deleteItem(id, item.itemName);
    });
    
    const editBtn = card.querySelector('.btn-edit-item');
    editBtn?.addEventListener('click', () => {
        editItem(id, item);
    });
    
    return card;
}

// ============ ADD ITEM ============

/**
 * Handle add item form submission
 * @param {Event} e - Submit event
 */
async function handleAddItem(e) {
    e.preventDefault();
    
    const itemNameInput = $('itemName');
    const stockInput = $('itemStock');
    const unitInput = $('itemUnit');
    const minStockInput = $('itemMinStock');
    
    // Validate item name
    const nameValidation = validateItemName(itemNameInput?.value);
    if (!nameValidation.valid) {
        showToast(nameValidation.error, 'warning');
        itemNameInput?.focus();
        return;
    }
    
    // Validate stock
    const stockValidation = validateStock(stockInput?.value);
    if (!stockValidation.valid) {
        showToast(stockValidation.error, 'warning');
        stockInput?.focus();
        return;
    }
    
    // Validate min stock
    const minStockValidation = validateStock(minStockInput?.value);
    if (!minStockValidation.valid) {
        showToast('Minimum stok tidak valid', 'warning');
        minStockInput?.focus();
        return;
    }
    
    const itemData = {
        itemName: nameValidation.value,
        stock: stockValidation.value,
        unit: (unitInput?.value || 'pcs').trim().substring(0, 20),
        minStock: minStockValidation.value || CONFIG.stock.lowThreshold,
        createdAt: serverTimestamp(),
        createdBy: getCurrentUser()?.email || 'admin'
    };
    
    try {
        await addDoc(collection(db, CONFIG.collections.items), itemData);
        
        infoLog(`Item added: ${itemData.itemName}`);
        showToast(`"${itemData.itemName}" berhasil ditambahkan!`, 'success');
        
        // Reset form
        elements.addItemForm.reset();
        
    } catch (error) {
        errorLog('Error adding item:', error);
        showToast('Gagal menambahkan barang!', 'error');
    }
}

// ============ ADD STOCK ============

/**
 * Add stock to an item
 * @param {string} itemId - Item document ID
 * @param {string} itemName - Item name for display
 * @param {string} unit - Item unit
 */
async function addStock(itemId, itemName, unit) {
    const input = $(`add-stock-${itemId}`);
    const addQty = parseInt(input?.value) || 0;
    
    if (addQty <= 0) {
        showToast('Masukkan jumlah yang valid (minimal 1)', 'warning');
        input?.focus();
        return;
    }
    
    const confirmed = await showConfirm({
        title: 'Tambah Stok',
        message: `Tambah ${addQty} ${unit} untuk "${itemName}"?`,
        confirmText: 'Ya, Tambahkan',
        type: 'question'
    });
    
    if (!confirmed) return;
    
    try {
        const itemRef = doc(db, CONFIG.collections.items, itemId);
        const itemDoc = await getDoc(itemRef);
        
        if (!itemDoc.exists()) {
            showToast('Barang tidak ditemukan!', 'error');
            return;
        }
        
        const currentStock = itemDoc.data().stock || 0;
        const newStock = currentStock + addQty;
        
        await updateDoc(itemRef, {
            stock: newStock,
            lastUpdated: serverTimestamp(),
            updatedBy: getCurrentUser()?.email || 'admin'
        });
        
        // Log transaction
        await logStockTransaction({
            itemId,
            itemName,
            type: 'add',
            quantity: addQty,
            previousStock: currentStock,
            newStock,
            unit
        });
        
        infoLog(`Stock added: ${itemName} +${addQty}`);
        showToast(`Stok "${itemName}" berhasil ditambah ${addQty}! Total: ${newStock}`, 'success');
        
        if (input) input.value = '';
        
    } catch (error) {
        errorLog('Error adding stock:', error);
        showToast('Gagal menambah stok!', 'error');
    }
}

/**
 * Log stock transaction
 * @param {Object} data - Transaction data
 */
async function logStockTransaction(data) {
    try {
        await addDoc(collection(db, CONFIG.collections.stockTransactions), {
            ...data,
            changedBy: getCurrentUser()?.email || 'admin',
            timestamp: serverTimestamp()
        });
    } catch (error) {
        errorLog('Failed to log stock transaction:', error);
    }
}

// ============ EDIT ITEM ============

/**
 * Edit item (opens modal or inline edit)
 * @param {string} itemId - Item document ID
 * @param {Object} item - Current item data
 */
async function editItem(itemId, item) {
    const newStock = await showPrompt({
        title: `Edit Stok: ${item.itemName}`,
        message: `Stok saat ini: ${item.stock} ${item.unit}`,
        placeholder: 'Masukkan stok baru',
        defaultValue: String(item.stock),
        required: true
    });
    
    if (newStock === null) return;
    
    const stockValidation = validateStock(newStock);
    if (!stockValidation.valid) {
        showToast(stockValidation.error, 'warning');
        return;
    }
    
    try {
        const itemRef = doc(db, CONFIG.collections.items, itemId);
        const previousStock = item.stock;
        
        await updateDoc(itemRef, {
            stock: stockValidation.value,
            lastUpdated: serverTimestamp(),
            updatedBy: getCurrentUser()?.email || 'admin'
        });
        
        // Log transaction
        await logStockTransaction({
            itemId,
            itemName: item.itemName,
            type: 'edit',
            quantity: stockValidation.value - previousStock,
            previousStock,
            newStock: stockValidation.value,
            unit: item.unit || 'pcs'
        });
        
        infoLog(`Stock edited: ${item.itemName} ${previousStock} → ${stockValidation.value}`);
        showToast(`Stok "${item.itemName}" berhasil diubah!`, 'success');
        
    } catch (error) {
        errorLog('Error editing item:', error);
        showToast('Gagal mengubah stok!', 'error');
    }
}

// ============ DELETE ITEM ============

/**
 * Delete an item
 * @param {string} itemId - Item document ID
 * @param {string} itemName - Item name for display
 */
async function deleteItem(itemId, itemName) {
    // First confirmation
    const confirmed = await showConfirm({
        title: 'Hapus Barang?',
        message: `Apakah Anda yakin ingin menghapus "${itemName}"?\n\nTindakan ini TIDAK DAPAT dibatalkan!`,
        confirmText: 'Ya, Hapus',
        cancelText: 'Batal',
        type: 'danger'
    });
    
    if (!confirmed) return;
    
    // Second confirmation with typing
    const confirmText = await showPrompt({
        title: 'Konfirmasi Penghapusan',
        message: `Ketik "HAPUS" untuk mengkonfirmasi penghapusan "${itemName}":`,
        placeholder: 'HAPUS',
        required: true
    });
    
    if (confirmText !== 'HAPUS') {
        showToast('Penghapusan dibatalkan', 'info');
        return;
    }
    
    try {
        await deleteDoc(doc(db, CONFIG.collections.items, itemId));
        
        infoLog(`Item deleted: ${itemName}`);
        showToast(`"${itemName}" berhasil dihapus!`, 'success');
        
    } catch (error) {
        errorLog('Error deleting item:', error);
        showToast('Gagal menghapus barang!', 'error');
    }
}

// ============ SEARCH ============

/**
 * Search inventory
 * @param {string} term - Search term
 */
export function searchInventory(term) {
    const searchTerm = term.toLowerCase().trim();
    const allItems = getAllItems();
    
    if (!searchTerm) {
        renderInventory(allItems);
        return;
    }
    
    const filtered = allItems.filter(item => 
        item.itemName?.toLowerCase().includes(searchTerm)
    );
    
    renderInventory(filtered);
    debugLog(`Inventory search: ${filtered.length} matches`);
}

// ============ UPDATE STATS ============

/**
 * Update inventory statistics
 * @param {Array} items - All items
 */
function updateInventoryStats(items) {
    let normal = 0, low = 0, empty = 0;
    
    items.forEach(item => {
        const stock = item.stock || 0;
        const minStock = item.minStock || CONFIG.stock.lowThreshold;
        
        if (stock <= CONFIG.stock.emptyThreshold) {
            empty++;
        } else if (stock <= minStock) {
            low++;
        } else {
            normal++;
        }
    });
    
    if (elements.normalItemsCount) elements.normalItemsCount.textContent = normal;
    if (elements.lowItemsCount) elements.lowItemsCount.textContent = low;
    if (elements.emptyItemsCount) elements.emptyItemsCount.textContent = empty;
    if (elements.lowStockCount) elements.lowStockCount.textContent = low + empty;
    if (elements.totalItemsCount) elements.totalItemsCount.textContent = items.length;
}

// ============ EXPORT ============

/**
 * Export inventory to CSV
 */
export async function exportInventory() {
    try {
        showToast('Memproses export...', 'info');
        
        const items = getAllItems();
        
        if (items.length === 0) {
            showToast('Tidak ada data untuk di-export!', 'warning');
            return;
        }
        
        // Build CSV content
        let csv = 'Nama Barang,Stok Saat Ini,Satuan,Minimum Stok,Status,Keterangan\n';
        
        items.forEach(item => {
            const stock = item.stock || 0;
            const minStock = item.minStock || CONFIG.stock.lowThreshold;
            const status = getStockStatus(stock, minStock);
            
            let keterangan = 'Stok mencukupi';
            if (status.status === 'empty') keterangan = 'Perlu pengadaan segera!';
            else if (status.status === 'low') keterangan = `Stok di bawah minimum (min: ${minStock})`;
            
            csv += `"${item.itemName || ''}",${stock},"${item.unit || 'pcs'}",${minStock},"${status.text}","${keterangan}"\n`;
        });
        
        downloadCSV(csv, generateFilename('inventory', 'csv'));
        showToast(`${items.length} barang berhasil di-export!`, 'success');
        
    } catch (error) {
        errorLog('Export error:', error);
        showToast('Gagal export data!', 'error');
    }
}

// ============ EXPORTS ============

export default {
    initInventory,
    loadInventory,
    searchInventory,
    exportInventory
};