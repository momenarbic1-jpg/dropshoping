/**
 * suppliers.js - Supplier Management
 * Full CRUD, product linkage count, supplier details with associated products.
 */

const SuppliersState = {
  suppliers: [],
  editingId: null
};

async function loadSuppliers() {
  const tbody = document.querySelector('#suppliers-table tbody');

  try {
    const res = await api('GET', '/api/suppliers');
    if (res.success) {
      SuppliersState.suppliers = res.data || [];
      renderSuppliersTable();
    } else {
      showToast(res.error || 'فشل تحميل بيانات الموردين', 'error');
    }
  } catch (err) {
    console.error('loadSuppliers error:', err);
    showToast('حدث خطأ أثناء تحميل بيانات الموردين', 'error');
  }
}

function renderSuppliersTable() {
  const tbody = document.querySelector('#suppliers-table tbody');
  if (!tbody) return;

  const suppliers = SuppliersState.suppliers;
  if (!suppliers || suppliers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <i class="fas fa-truck"></i>
          <p>لا يوجد موردين مسجلين حتى الآن</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = suppliers.map(s => `
    <tr>
      <td><strong>${escapeHtml(s.name)}</strong></td>
      <td dir="ltr" class="text-right">${escapeHtml(s.phone || '-')}</td>
      <td>${escapeHtml(s.email || '-')}</td>
      <td><span class="status-badge badge-processing">${s.product_count || 0} منتج</span></td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-sm btn-icon btn-secondary" onclick="viewSupplierDetails(${s.id})" title="عرض التفاصيل والمنتجات">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn btn-sm btn-icon btn-secondary" onclick="openSupplierModal(${s.id})" title="تعديل">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-icon btn-danger" onclick="deleteSupplier(${s.id})" title="حذف">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ========================
// Supplier Modal (Add / Edit)
// ========================

async function openSupplierModal(supplierId) {
  const form = document.getElementById('supplier-form');
  const title = document.getElementById('supplier-modal-title');
  const idField = document.getElementById('supplier-id');

  if (form) form.reset();
  if (idField) idField.value = '';
  SuppliersState.editingId = null;

  if (supplierId) {
    SuppliersState.editingId = supplierId;
    if (title) title.textContent = 'تعديل بيانات المورد';

    try {
      const res = await api('GET', '/api/suppliers/' + supplierId);
      if (res.success && res.data) {
        const s = res.data;
        if (idField) idField.value = s.id;
        document.getElementById('supplier-name').value = s.name || '';
        document.getElementById('supplier-phone').value = s.phone || '';
        document.getElementById('supplier-email').value = s.email || '';
        document.getElementById('supplier-address').value = s.address || '';
        document.getElementById('supplier-notes').value = s.notes || '';
      }
    } catch (err) {
      showToast('خطأ في تحميل بيانات المورد', 'error');
    }
  } else {
    SuppliersState.editingId = null;
    if (title) title.textContent = 'إضافة مورد جديد';
  }

  openModal('supplier-modal');
}

async function saveSupplier() {
  const name = document.getElementById('supplier-name').value.trim();
  const phone = document.getElementById('supplier-phone').value.trim();
  const email = document.getElementById('supplier-email').value.trim();
  const address = document.getElementById('supplier-address').value.trim();
  const notes = document.getElementById('supplier-notes').value.trim();

  if (!name) {
    showToast('يرجى إدخال اسم المورد', 'warning');
    return;
  }

  const payload = { name, phone, email, address, notes };
  const saveBtn = document.getElementById('save-supplier-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
  }

  try {
    let res;
    if (SuppliersState.editingId) {
      res = await api('PUT', '/api/suppliers/' + SuppliersState.editingId, payload);
    } else {
      res = await api('POST', '/api/suppliers', payload);
    }

    if (res.success) {
      showToast(SuppliersState.editingId ? 'تم تحديث المورد بنجاح' : 'تم إضافة المورد بنجاح', 'success');
      closeModal('supplier-modal');
      loadSuppliers();
    } else {
      showToast(res.error || 'فشل حفظ بيانات المورد', 'error');
    }
  } catch (err) {
    showToast('حدث خطأ أثناء حفظ بيانات المورد', 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ المورد';
    }
  }
}

function deleteSupplier(id) {
  showConfirm('هل أنت متأكد من رغبتك في حذف هذا المورد؟', async function () {
    try {
      const res = await api('DELETE', '/api/suppliers/' + id);
      if (res.success) {
        showToast('تم حذف المورد بنجاح', 'success');
        loadSuppliers();
      } else {
        showToast(res.error || 'فشل حذف المورد (قد يكون مرتبطاً بمنتجات)', 'error');
      }
    } catch (err) {
      showToast('حدث خطأ أثناء حذف المورد', 'error');
    }
  });
}

// ========================
// Supplier Details Modal
// ========================

async function viewSupplierDetails(supplierId) {
  try {
    const res = await api('GET', '/api/suppliers/' + supplierId);
    if (!res.success || !res.data) {
      showToast(res.error || 'فشل جلب تفاصيل المورد', 'error');
      return;
    }

    const s = res.data;
    document.getElementById('supplier-detail-name').textContent = s.name || '-';
    document.getElementById('supplier-detail-phone').textContent = s.phone || '-';
    document.getElementById('supplier-detail-email').textContent = s.email || '-';
    document.getElementById('supplier-detail-address').textContent = s.address || '-';
    document.getElementById('supplier-detail-notes').textContent = s.notes || 'لا توجد ملاحظات';

    const tbody = document.querySelector('#supplier-products-table tbody');
    if (tbody) {
      const prods = s.products || [];
      if (prods.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" class="empty-state">
              <i class="fas fa-box-open"></i>
              <p>لا توجد منتجات مرتبطة بهذا المورد حتى الآن</p>
            </td>
          </tr>
        `;
      } else {
        tbody.innerHTML = prods.map(p => `
          <tr>
            <td><strong>${escapeHtml(p.name)}</strong></td>
            <td>${formatCurrency(p.purchase_price)}</td>
            <td><strong>${formatCurrency(p.sale_price)}</strong></td>
            <td><span class="status-badge badge-processing">${p.stock_quantity !== undefined ? p.stock_quantity : (p.stock || 0)}</span></td>
          </tr>
        `).join('');
      }
    }

    openModal('supplier-details-modal');
  } catch (err) {
    showToast('حدث خطأ أثناء تحميل بيانات المورد', 'error');
  }
}

// ========================
// Event Listeners
// ========================

document.addEventListener('DOMContentLoaded', function () {
  const addBtn = document.getElementById('add-supplier-btn');
  if (addBtn) addBtn.addEventListener('click', () => openSupplierModal());

  const saveBtn = document.getElementById('save-supplier-btn');
  if (saveBtn) saveBtn.addEventListener('click', saveSupplier);
});
