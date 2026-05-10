/**
 * ============================================
 * receipt.js - Goods Receiving Module
 * Admin Dashboard - Trakindo Office Supplies
 * ============================================
 */

import { db } from '../firebase-config.js';
import { 
    collection, 
    getDocs, 
    query, 
    where,
    doc,
    updateDoc,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

import { CONFIG } from './config.js';
import { getCurrentUser } from './state.js';
import { showToast, showConfirm } from './ui.js';
import { 
    escapeHtml, 
    formatDateForInput,
    validateStock,
    $,
    debugLog, 
    infoLog, 
    errorLog 
} from './utils.js';

// ============ STATE ============

let receiptRows = [];
let itemDatalist = [];

// ============ DOM ELEMENTS ============

let elements = {};

function initElements() {
    elements = {
        receiptNo: $('receipt-no'),
        receiptSupplier: $('receipt-supplier'),
        receiptDate: $('receipt-date'),
        receiptItems: $('receipt-items'),
        receiptEmpty: $('receipt-empty'),
        itemDatalist: $('item-datalist')
    };
}

// ============ INITIALIZATION ============

/**
 * Initialize receipt module
 */
export function initReceipt() {
    initElements();
    setupEventListeners();
    setDefaultDate();
    loadItemDatalist();
    infoLog('Receipt module initialized');
}

function setupEventListeners() {
    // Add row button
    const addRowBtn = $('addReceiptRowBtn');
    if (addRowBtn) {
        addRowBtn.addEventListener('click', addReceiptRow);
    }
    
    // Save receipt button
    const saveBtn = $('saveReceiptBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveReceipt);
    }
}

/**
 * Set default receipt date to today
 */
function setDefaultDate() {
    if (elements.receiptDate) {
        elements.receiptDate.value = formatDateForInput(new Date());
    }
}

/**
 * Load item names for autocomplete
 */
async function loadItemDatalist() {
    try {
        const snapshot = await getDocs(collection(db, CONFIG.collections.items));
        
        itemDatalist = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            itemDatalist.push({
                id: doc.id,
                name: data.itemName,
                unit: data.unit || 'pcs'
            });
        });
        
        // Update datalist element
        if (elements.itemDatalist) {
            elements.itemDatalist.innerHTML = itemDatalist
                .map(item => `<option value="${escapeHtml(item.name)}">`)
                .join('');
        }
        
        debugLog(`Loaded ${itemDatalist.length} items for datalist`);
        
    } catch (error) {
        errorLog('Error loading item datalist:', error);
    }
}

// ============ RECEIPT ROW MANAGEMENT ============

/**
 * Add a new receipt row
 */
export function addReceiptRow() {
    if (!elements.receiptItems) {
        elements.receiptItems = $('receipt-items');
    }
    
    if (!elements.receiptItems) return;
    
    // Hide empty state
    if (elements.receiptEmpty) {
        elements.receiptEmpty.style.display = 'none';
    }
    
    const rowId = Date.now();
    
    const row = document.createElement('tr');
    row.dataset.rowId = rowId;
    row.innerHTML = `
        <td>
            <input 
                type="text" 
                list="item-datalist" 
                placeholder="Ketik atau pilih barang" 
                class="receipt-item-name"
                required
            >
        </td>
        <td>
            <input 
                type="number" 
                min="1" 
                value="1" 
                class="receipt-item-qty"
                required
            >
        </td>
        <td>
            <input 
                type="text" 
                value="pcs" 
                class="receipt-item-unit"
                required
            >
        </td>
        <td class="action-cell">
            <button type="button" class="btn-danger btn-sm btn-remove-row">
                <i class="ph ph-trash"></i>
            </button>
        </td>
    `;
    
    // Remove row handler
    const removeBtn = row.querySelector('.btn-remove-row');
    removeBtn?.addEventListener('click', () => {
        row.remove();
        updateEmptyState();
    });
    
    // Auto-fill unit when item is selected
    const itemInput = row.querySelector('.receipt-item-name');
    const unitInput = row.querySelector('.receipt-item-unit');
    
    itemInput?.addEventListener('change', () => {
        const itemName = itemInput.value.trim();
        const matchedItem = itemDatalist.find(i => i.name.toLowerCase() === itemName.toLowerCase());
        if (matchedItem && unitInput) {
            unitInput.value = matchedItem.unit;
        }
    });
    
    elements.receiptItems.appendChild(row);
}

/**
 * Update empty state visibility
 */
function updateEmptyState() {
    const rows = elements.receiptItems?.querySelectorAll('tr');
    if (elements.receiptEmpty) {
        elements.receiptEmpty.style.display = (!rows || rows.length === 0) ? 'flex' : 'none';
    }
}

// ============ SAVE RECEIPT ============

/**
 * Save receipt and update stock
 */
export async function saveReceipt() {
    if (!elements.receiptItems) return;
    
    const rows = elements.receiptItems.querySelectorAll('tr');
    
    if (rows.length === 0) {
        showToast('Tambahkan minimal 1 barang!', 'warning');
        return;
    }
    
    // Collect and validate items
    const items = [];
    let hasError = false;
    
    rows.forEach((row, index) => {
        const nameInput = row.querySelector('.receipt-item-name');
        const qtyInput = row.querySelector('.receipt-item-qty');
        const unitInput = row.querySelector('.receipt-item-unit');
        
        const name = nameInput?.value?.trim() || '';
        const qtyValidation = validateStock(qtyInput?.value);
        const unit = unitInput?.value?.trim() || 'pcs';
        
        if (!name) {
            showToast(`Baris ${index + 1}: Nama barang harus diisi!`, 'error');
            nameInput?.focus();
            hasError = true;
            return;
        }
        
        if (!qtyValidation.valid || qtyValidation.value <= 0) {
            showToast(`Baris ${index + 1}: Jumlah harus lebih dari 0!`, 'error');
            qtyInput?.focus();
            hasError = true;
            return;
        }
        
        items.push({
            itemName: name,
            quantity: qtyValidation.value,
            unit: unit
        });
    });
    
    if (hasError) return;
    
    // Confirm
    const confirmed = await showConfirm({
        title: 'Simpan Penerimaan?',
        message: `${items.length} item akan ditambahkan ke stok. Lanjutkan?`,
        confirmText: 'Ya, Simpan',
        type: 'question'
    });
    
    if (!confirmed) return;
    
    // Process receipt
    try {
        let successCount = 0;
        let errorItems = [];
        
        for (const item of items) {
            // Find item by name
            const q = query(
                collection(db, CONFIG.collections.items), 
                where('itemName', '==', item.itemName)
            );
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                errorItems.push(item.itemName);
                continue;
            }
            
            // Update stock
            for (const docSnap of snapshot.docs) {
                const itemRef = doc(db, CONFIG.collections.items, docSnap.id);
                const currentStock = docSnap.data().stock || 0;
                const newStock = currentStock + item.quantity;
                
                await updateDoc(itemRef, {
                    stock: newStock,
                    lastUpdated: serverTimestamp()
                });
                
                // Log transaction
                await addDoc(collection(db, CONFIG.collections.stockTransactions), {
                    itemId: docSnap.id,
                    itemName: item.itemName,
                    type: 'receipt',
                    addedQuantity: item.quantity,
                    previousStock: currentStock,
                    newStock: newStock,
                    unit: item.unit,
                    receiptNo: elements.receiptNo?.value || '',
                    supplier: elements.receiptSupplier?.value || '',
                    changedBy: getCurrentUser()?.email || 'admin',
                    timestamp: serverTimestamp()
                });
                
                successCount++;
            }
        }
        
        // Show results
        if (errorItems.length > 0) {
            showToast(`${errorItems.length} barang tidak ditemukan: ${errorItems.join(', ')}`, 'warning');
        }
        
        if (successCount > 0) {
            infoLog(`Receipt saved: ${successCount} items`);
            showToast(`${successCount} item berhasil ditambahkan ke stok!`, 'success');
            
            // Reset form
            resetReceiptForm();
        }
        
    } catch (error) {
        errorLog('Error saving receipt:', error);
        showToast('Gagal menyimpan penerimaan barang!', 'error');
    }
}

/**
 * Reset receipt form
 */
function resetReceiptForm() {
    if (elements.receiptNo) elements.receiptNo.value = '';
    if (elements.receiptSupplier) elements.receiptSupplier.value = '';
    if (elements.receiptItems) elements.receiptItems.innerHTML = '';
    if (elements.receiptEmpty) elements.receiptEmpty.style.display = 'flex';
    setDefaultDate();
}

// ============ EXPOSE TO WINDOW ============

// For backward compatibility with inline event handlers
window.addReceiptRow = addReceiptRow;
window.saveReceipt = saveReceipt;

// ============ EXPORTS ============

export default {
    initReceipt,
    addReceiptRow,
    saveReceipt
};