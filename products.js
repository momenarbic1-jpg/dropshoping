/**
 * products.js - Products Management
 * Full CRUD, filter, cards/table view, image handling, inline/modal category, profit calculation.
 */

const ProductsState = {
  products: [],
  categories: [],
  suppliers: [],
  viewMode: 'table',
  editingId: null,
  selectedFiles: [],
  removedImages: []
};

async function loadProducts() {
  const tbody = document.querySelector('#products-table tbody');
  const grid = document.getElementById('products-grid-view');

  try {
    const params = buildProductFilterParams();
    const [prodRes, catRes, supRes] = await Promise.all([
      api('GET', '/api/products?' + params.toString()),
      api('GET', '/api/products/categories/list'),
      api('GET', '/api/suppliers')
    ]);

    if (prodRes.success) {
      ProductsState.products = prodRes.data || [];
    } else {
      showToast(prodRes.error || 'فشل تحميل المنتجات', 'error');
      ProductsState.products = [];
    }

    if (catRes.success) {
      ProductsState.categories = catRes.data || [];
      populateCategoryDropdowns();
    }

    if (supRes.success) {
      ProductsState.suppliers = supRes.data || [];
      populateSupplierDropdowns();
    }

    renderProducts();
  } catch (err) {
    console.error('loadProducts error:', err);
    showToast('حدث خطأ أثناء تحميل المنتجات', 'error');
  }
}

function buildProductFilterParams() {
  const params = new URLSearchParams();
  const search = document.getElementById('product-search');
  const cat = document.getElementById('filter-category');
  const status = document.getElementById('filter-product-status');
  const sup = document.getElementById('filter-supplier');

  if (search && search.value.trim()) params.set('search', search.value.trim());
  if (cat && cat.value) params.set('category_id', cat.value);
  if (status && status.value) params.set('status', status.value);
  if (sup && sup.value) params.set('supplier_id', sup.value);

  return params;
}

function populateCategoryDropdowns() {
  // Filter dropdown
  const filterSelect = document.getElementById('filter-category');
  if (filterSelect) {
    const curVal = filterSelect.value;
    filterSelect.innerHTML = '<option value="">جميع التصنيفات</option>' +
      ProductsState.categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    filterSelect.value = curVal;
  }

  // Modal dropdown
  const modalSelect = document.getElementById('product-category');
  if (modalSelect) {
    const curVal = modalSelect.value;
    modalSelect.innerHTML = '<option value="">اختر التصنيف</option>' +
      ProductsState.categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    modalSelect.value = curVal;
  }
}

function populateSupplierDropdowns() {
  // Filter dropdown
  const filterSelect = document.getElementById('filter-supplier');
  if (filterSelect) {
    const curVal = filterSelect.value;
    filterSelect.innerHTML = '<option value="">جميع الموردين</option>' +
      ProductsState.suppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    filterSelect.value = curVal;
  }

  // Modal dropdown
  const modalSelect = document.getElementById('product-supplier');
  if (modalSelect) {
    const curVal = modalSelect.value;
    modalSelect.innerHTML = '<option value="">اختر المورد</option>' +
      ProductsState.suppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    modalSelect.value = curVal;
  }
}

function renderProducts() {
  if (ProductsState.viewMode === 'grid') {
    renderProductsCards();
  } else {
    renderProductsTable();
  }
}

function renderProductsTable() {
  const tbody = document.querySelector('#products-table tbody');
  const tableView = document.getElementById('products-table-view');
  const gridView = document.getElementById('products-grid-view');

  if (tableView) tableView.style.display = 'block';
  if (gridView) gridView.style.display = 'none';

  if (!tbody) return;

  const products = ProductsState.products;
  if (!products || products.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-state">
          <i class="fas fa-box-open"></i>
          <p>لا توجد منتجات مسجلة حتى الآن</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = products.map(p => {
    const profit = (parseFloat(p.sale_price) || 0) - (parseFloat(p.purchase_price) || 0);
    const stock = parseInt(p.stock_quantity !== undefined ? p.stock_quantity : p.stock) || 0;
    let stockBadgeClass = 'badge-success';
    if (stock <= 2) stockBadgeClass = 'badge-danger';
    else if (stock <= 5) stockBadgeClass = 'badge-warning';

    const images = Array.isArray(p.images) ? p.images : [];
    const firstImg = images.length > 0 ? getProductImageUrl(images[0]) : '';
    const imgHtml = firstImg
      ? `<img src="${firstImg}" alt="${escapeHtml(p.name)}" class="product-thumb">`
      : `<div class="product-thumb-placeholder"><i class="fas fa-image"></i></div>`;

    const statusBadge = p.status === 'active'
      ? `<span class="status-badge badge-delivered">نشط</span>`
      : `<span class="status-badge badge-cancelled">غير نشط</span>`;

    return `
      <tr>
        <td>${imgHtml}</td>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td>${escapeHtml(p.category_name || '-')}</td>
        <td>${escapeHtml(p.supplier_name || '-')}</td>
        <td>${formatCurrency(p.purchase_price)}</td>
        <td><strong>${formatCurrency(p.sale_price)}</strong></td>
        <td class="${profit >= 0 ? 'text-success' : 'text-danger'} fw-bold">${formatCurrency(profit)}</td>
        <td><span class="status-badge ${stockBadgeClass}">${stock}</span></td>
        <td>${statusBadge}</td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-sm btn-icon btn-secondary" onclick="openProductModal(${p.id})" title="تعديل">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-icon btn-danger" onclick="deleteProduct(${p.id})" title="حذف">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderProductsCards() {
  const tableView = document.getElementById('products-table-view');
  const gridView = document.getElementById('products-grid-view');

  if (tableView) tableView.style.display = 'none';
  if (gridView) gridView.style.display = 'grid';

  if (!gridView) return;

  const products = ProductsState.products;
  if (!products || products.length === 0) {
    gridView.innerHTML = `
      <div class="empty-state-card" style="grid-column: 1 / -1;">
        <i class="fas fa-box-open"></i>
        <p>لا توجد منتجات مسجلة حتى الآن</p>
      </div>
    `;
    return;
  }

  gridView.innerHTML = products.map(p => {
    const profit = (parseFloat(p.sale_price) || 0) - (parseFloat(p.purchase_price) || 0);
    const stock = parseInt(p.stock_quantity !== undefined ? p.stock_quantity : p.stock) || 0;
    const images = Array.isArray(p.images) ? p.images : [];
    const firstImg = images.length > 0 ? getProductImageUrl(images[0]) : '';
    const imgHtml = firstImg
      ? `<img src="${firstImg}" alt="${escapeHtml(p.name)}" class="product-card-img">`
      : `<div class="product-card-img-placeholder"><i class="fas fa-image fa-3x"></i></div>`;

    return `
      <div class="product-card">
        <div class="product-card-image">${imgHtml}</div>
        <div class="product-card-body">
          <div class="product-card-header">
            <h4>${escapeHtml(p.name)}</h4>
            <span class="status-badge ${p.status === 'active' ? 'badge-delivered' : 'badge-cancelled'}">
              ${p.status === 'active' ? 'نشط' : 'غير نشط'}
            </span>
          </div>
          <p class="product-card-category"><i class="fas fa-tag"></i> ${escapeHtml(p.category_name || 'بدون تصنيف')}</p>
          <div class="product-card-prices">
            <div><small class="text-muted">شراء:</small> <span>${formatCurrency(p.purchase_price)}</span></div>
            <div><small class="text-muted">بيع:</small> <strong>${formatCurrency(p.sale_price)}</strong></div>
          </div>
          <div class="product-card-meta">
            <span class="profit-badge ${profit >= 0 ? 'text-success' : 'text-danger'}">ربح: ${formatCurrency(profit)}</span>
            <span class="stock-badge">المخزون: ${stock}</span>
          </div>
          <div class="product-card-footer">
            <button class="btn btn-sm btn-secondary" onclick="openProductModal(${p.id})">
              <i class="fas fa-edit"></i> تعديل
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})">
              <i class="fas fa-trash"></i> حذف
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function setViewMode(mode) {
  ProductsState.viewMode = mode;
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === (mode === 'grid' ? 'grid' : 'table'));
  });
  renderProducts();
}

// ========================
// Product Modal (Add / Edit)
// ========================

async function openProductModal(productId) {
  const form = document.getElementById('product-form');
  const title = document.getElementById('product-modal-title');
  const idField = document.getElementById('product-id');
  const previewsContainer = document.getElementById('product-image-previews');
  const statusToggle = document.getElementById('product-status');

  if (form) form.reset();
  if (idField) idField.value = '';
  if (previewsContainer) previewsContainer.innerHTML = '';
  ProductsState.editingId = null;
  ProductsState.selectedFiles = [];
  ProductsState.removedImages = [];

  populateCategoryDropdowns();
  populateSupplierDropdowns();

  if (productId) {
    ProductsState.editingId = productId;
    if (title) title.textContent = 'تعديل بيانات المنتج';

    try {
      const res = await api('GET', '/api/products/' + productId);
      if (res.success && res.data) {
        const p = res.data;
        if (idField) idField.value = p.id;
        document.getElementById('product-name').value = p.name || '';
        document.getElementById('product-description').value = p.description || '';
        document.getElementById('product-category').value = p.category_id || '';
        document.getElementById('product-supplier').value = p.supplier_id || '';
        document.getElementById('product-stock').value = p.stock_quantity !== undefined ? p.stock_quantity : (p.stock || 0);
        document.getElementById('product-purchase-price').value = p.purchase_price || 0;
        document.getElementById('product-sale-price').value = p.sale_price || 0;
        const compareEl = document.getElementById('product-compare-price');
        if (compareEl) compareEl.value = p.compare_price || '';
        const specsEl = document.getElementById('product-specifications');
        if (specsEl) specsEl.value = p.specifications || '';
        const featuredEl = document.getElementById('product-is-featured');
        if (featuredEl) featuredEl.checked = Boolean(p.is_featured);

        const suppUrlEl = document.getElementById('product-supplier-url');
        const suppSkuEl = document.getElementById('product-supplier-sku');
        if (suppUrlEl) suppUrlEl.value = p.supplier_product_url || '';
        if (suppSkuEl) suppSkuEl.value = p.supplier_sku || '';
        if (statusToggle) statusToggle.checked = p.status === 'active';

        updateProductProfitCalculation();

        // Show existing images
        const images = Array.isArray(p.images) ? p.images : [];
        images.forEach(img => {
          renderImagePreview(getProductImageUrl(img), img, false);
        });
      }
    } catch (err) {
      showToast('خطأ في تحميل بيانات المنتج', 'error');
    }
  } else {
    ProductsState.editingId = null;
    if (title) title.textContent = 'إضافة منتج جديد';
    if (statusToggle) statusToggle.checked = true;
    updateProductProfitCalculation();
  }

  openModal('product-modal');
}

function updateProductProfitCalculation() {
  const pPrice = parseFloat(document.getElementById('product-purchase-price').value) || 0;
  const sPrice = parseFloat(document.getElementById('product-sale-price').value) || 0;
  const profit = sPrice - pPrice;
  const profitField = document.getElementById('product-expected-profit');
  if (profitField) {
    profitField.value = profit.toFixed(2);
    profitField.style.color = profit >= 0 ? '#10B981' : '#EF4444';
    profitField.style.fontWeight = 'bold';
  }
}

function renderImagePreview(src, filename, isNew) {
  const container = document.getElementById('product-image-previews');
  if (!container) return;

  const div = document.createElement('div');
  div.className = 'image-preview-item';
  div.innerHTML = `
    <img src="${src}" alt="صورة المنتج">
    <button type="button" class="image-preview-remove" title="حذف الصورة">
      <i class="fas fa-times"></i>
    </button>
  `;

  div.querySelector('.image-preview-remove').addEventListener('click', function () {
    div.remove();
    if (!isNew && filename) {
      ProductsState.removedImages.push(filename);
    } else if (isNew) {
      ProductsState.selectedFiles = ProductsState.selectedFiles.filter(f => f.name !== filename);
    }
  });

  container.appendChild(div);
}

function handleFilesSelected(files) {
  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) return;
    ProductsState.selectedFiles.push(file);

    const reader = new FileReader();
    reader.onload = function (e) {
      renderImagePreview(e.target.result, file.name, true);
    };
    reader.readAsDataURL(file);
  });
}

async function saveProduct() {
  const name = document.getElementById('product-name').value.trim();
  const purchasePrice = parseFloat(document.getElementById('product-purchase-price').value);
  const salePrice = parseFloat(document.getElementById('product-sale-price').value);
  const stock = parseInt(document.getElementById('product-stock').value) || 0;
  const categoryId = document.getElementById('product-category').value;
  const supplierId = document.getElementById('product-supplier').value;
  const description = document.getElementById('product-description').value.trim();
  const statusToggle = document.getElementById('product-status');
  const status = statusToggle && statusToggle.checked ? 'active' : 'inactive';

  if (!name) {
    showToast('يرجى كتابة اسم المنتج', 'warning');
    return;
  }
  if (isNaN(purchasePrice) || purchasePrice < 0) {
    showToast('يرجى تحديد سعر شراء صحيح', 'warning');
    return;
  }
  if (isNaN(salePrice) || salePrice < 0) {
    showToast('يرجى تحديد سعر بيع صحيح', 'warning');
    return;
  }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('description', description);
  formData.append('purchase_price', purchasePrice);
  formData.append('sale_price', salePrice);
  formData.append('stock_quantity', stock);
  formData.append('status', status);
  if (categoryId) formData.append('category_id', categoryId);
  if (supplierId) formData.append('supplier_id', supplierId);

  const suppUrl = document.getElementById('product-supplier-url') ? document.getElementById('product-supplier-url').value.trim() : '';
  const suppSku = document.getElementById('product-supplier-sku') ? document.getElementById('product-supplier-sku').value.trim() : '';
  formData.append('supplier_product_url', suppUrl);
  formData.append('supplier_sku', suppSku);

  const comparePrice = parseFloat(document.getElementById('product-compare-price') ? document.getElementById('product-compare-price').value : 0) || 0;
  const isFeatured = document.getElementById('product-is-featured') && document.getElementById('product-is-featured').checked ? 1 : 0;
  const specs = document.getElementById('product-specifications') ? document.getElementById('product-specifications').value.trim() : '';
  formData.append('compare_price', comparePrice);
  formData.append('is_featured', isFeatured);
  formData.append('specifications', specs);

  // Append new files
  ProductsState.selectedFiles.forEach(file => {
    formData.append('images', file);
  });

  // Append removed images
  if (ProductsState.removedImages.length > 0) {
    formData.append('remove_images', JSON.stringify(ProductsState.removedImages));
  }

  const saveBtn = document.getElementById('save-product-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
  }

  try {
    let res;
    if (ProductsState.editingId) {
      res = await api('PUT', '/api/products/' + ProductsState.editingId, formData, true);
    } else {
      res = await api('POST', '/api/products', formData, true);
    }

    if (res.success) {
      showToast(ProductsState.editingId ? 'تم تحديث المنتج بنجاح' : 'تم إضافة المنتج بنجاح', 'success');
      closeModal('product-modal');
      loadProducts();
    } else {
      showToast(res.error || 'فشل حفظ المنتج', 'error');
    }
  } catch (err) {
    showToast('حدث خطأ أثناء حفظ المنتج', 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ المنتج';
    }
  }
}

function deleteProduct(id) {
  showConfirm('هل أنت متأكد من رغبتك في حذف هذا المنتج نهائياً؟', async function () {
    try {
      const res = await api('DELETE', '/api/products/' + id);
      if (res.success) {
        showToast('تم حذف المنتج بنجاح', 'success');
        loadProducts();
      } else {
        showToast(res.error || 'فشل حذف المنتج', 'error');
      }
    } catch (err) {
      showToast('حدث خطأ أثناء حذف المنتج', 'error');
    }
  });
}

// ========================
// Category Modal
// ========================

function openCategoryModal() {
  const input = document.getElementById('new-category-name');
  if (input) input.value = '';
  openModal('category-modal');
}

async function saveCategory() {
  const input = document.getElementById('new-category-name');
  const name = input ? input.value.trim() : '';

  if (!name) {
    showToast('يرجى إدخال اسم التصنيف', 'warning');
    return;
  }

  try {
    const res = await api('POST', '/api/products/categories', { name });
    if (res.success) {
      showToast('تم إضافة التصنيف بنجاح', 'success');
      closeModal('category-modal');

      // Reload categories list
      const catRes = await api('GET', '/api/products/categories/list');
      if (catRes.success) {
        ProductsState.categories = catRes.data || [];
        populateCategoryDropdowns();
        const modalSelect = document.getElementById('product-category');
        if (modalSelect && res.data && res.data.id) {
          modalSelect.value = res.data.id;
        }
      }
    } else {
      showToast(res.error || 'فشل إضافة التصنيف', 'error');
    }
  } catch (err) {
    showToast('خطأ أثناء إضافة التصنيف', 'error');
  }
}

// ========================
// Event Listeners
// ========================

document.addEventListener('DOMContentLoaded', function () {
  // Add Product Button
  const addBtn = document.getElementById('add-product-btn');
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      openProductModal();
    });
  }

  // Save Product Button
  const saveBtn = document.getElementById('save-product-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveProduct);
  }

  // Add Category Button & Modal
  const addCatBtn = document.getElementById('add-category-btn');
  if (addCatBtn) {
    addCatBtn.addEventListener('click', openCategoryModal);
  }

  const saveCatBtn = document.getElementById('save-category-btn');
  if (saveCatBtn) {
    saveCatBtn.addEventListener('click', saveCategory);
  }

  // Auto calculate profit
  const pPrice = document.getElementById('product-purchase-price');
  const sPrice = document.getElementById('product-sale-price');
  if (pPrice) pPrice.addEventListener('input', updateProductProfitCalculation);
  if (sPrice) sPrice.addEventListener('input', updateProductProfitCalculation);

  // File Upload Area
  const uploadArea = document.getElementById('product-image-upload');
  const fileInput = document.getElementById('product-images');

  if (uploadArea && fileInput) {
    uploadArea.addEventListener('click', function (e) {
      if (e.target !== fileInput) fileInput.click();
    });

    fileInput.addEventListener('change', function () {
      if (this.files && this.files.length > 0) {
        handleFilesSelected(this.files);
      }
    });

    // Drag and drop support
    uploadArea.addEventListener('dragover', function (e) {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', function () {
      uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', function (e) {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFilesSelected(e.dataTransfer.files);
      }
    });
  }

  // View toggle buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const mode = this.getAttribute('data-view');
      setViewMode(mode === 'grid' ? 'grid' : 'table');
    });
  });

  // Filter handlers
  const searchInput = document.getElementById('product-search');
  if (searchInput) {
    let timeout;
    searchInput.addEventListener('input', function () {
      clearTimeout(timeout);
      timeout = setTimeout(loadProducts, 350);
    });
  }

  const filterCat = document.getElementById('filter-category');
  const filterStatus = document.getElementById('filter-product-status');
  const filterSup = document.getElementById('filter-supplier');

  if (filterCat) filterCat.addEventListener('change', loadProducts);
  if (filterStatus) filterStatus.addEventListener('change', loadProducts);
  if (filterSup) filterSup.addEventListener('change', loadProducts);
});
