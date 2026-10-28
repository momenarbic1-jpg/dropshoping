/**
 * orders.js - Orders Management
 * Full CRUD, dynamic product rows, inventory stock deduction/restoration,
 * status workflow, invoice printing, and filtering.
 */

const OrdersState = {
  orders: [],
  products: [],
  editingId: null,
  activeDetailOrderId: null
};

async function loadOrders() {
  const tbody = document.querySelector('#orders-table tbody');

  try {
    const params = buildOrderFilterParams();
    const [ordersRes, prodRes] = await Promise.all([
      api('GET', '/api/orders?' + params.toString()),
      api('GET', '/api/products?status=active')
    ]);

    if (ordersRes.success) {
      OrdersState.orders = ordersRes.data || [];
    } else {
      showToast(ordersRes.error || 'فشل تحميل الطلبات', 'error');
      OrdersState.orders = [];
    }

    if (prodRes.success) {
      OrdersState.products = prodRes.data || [];
    }

    renderOrdersTable();
  } catch (err) {
    console.error('loadOrders error:', err);
    showToast('حدث خطأ أثناء تحميل الطلبات', 'error');
  }
}

function buildOrderFilterParams() {
  const params = new URLSearchParams();
  const search = document.getElementById('order-search');
  const status = document.getElementById('filter-order-status');
  const dateFrom = document.getElementById('filter-date-from');
  const dateTo = document.getElementById('filter-date-to');

  if (search && search.value.trim()) params.set('search', search.value.trim());
  if (status && status.value) params.set('status', status.value);
  if (dateFrom && dateFrom.value) params.set('date_from', dateFrom.value);
  if (dateTo && dateTo.value) params.set('date_to', dateTo.value);

  return params;
}

function renderOrdersTable() {
  const tbody = document.querySelector('#orders-table tbody');
  if (!tbody) return;

  const orders = OrdersState.orders;
  if (!orders || orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-state">
          <i class="fas fa-shopping-cart"></i>
          <p>لا توجد طلبات مسجلة حتى الآن</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = orders.map(order => {
    let itemsText = '-';
    if (order.items && order.items.length > 0) {
      itemsText = order.items.map(i => `${escapeHtml(i.product_name)} (${i.quantity})`).join('، ');
      if (itemsText.length > 40) itemsText = itemsText.substring(0, 37) + '...';
    }

    const profit = parseFloat(order.profit) || 0;
    const total = parseFloat(order.total_amount) || 0;
    const shipping = parseFloat(order.shipping_cost) || 0;

    return `
      <tr>
        <td>
          <a href="#" onclick="viewOrderDetails(${order.id}); return false;" class="text-primary fw-bold">
            ${escapeHtml(order.order_number || ('ORD-' + order.id))}
          </a>
        </td>
        <td><strong>${escapeHtml(order.customer_name || '-')}</strong></td>
        <td dir="ltr" class="text-right">${escapeHtml(order.customer_phone || '-')}</td>
        <td title="${escapeHtml(itemsText)}">${itemsText}</td>
        <td><strong>${formatCurrency(total)}</strong></td>
        <td>${formatCurrency(shipping)}</td>
        <td class="${profit >= 0 ? 'text-success' : 'text-danger'} fw-bold">${formatCurrency(profit)}</td>
        <td><span class="status-badge ${getStatusClass(order.status)}">${getStatusLabel(order.status)}</span></td>
        <td>${formatDate(order.created_at)}</td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-sm btn-icon btn-secondary" onclick="viewOrderDetails(${order.id})" title="عرض التفاصيل">
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-sm btn-icon btn-secondary" onclick="printInvoice(${order.id})" title="طباعة الفاتورة">
              <i class="fas fa-print"></i>
            </button>
            <button class="btn btn-sm btn-icon btn-danger" onclick="deleteOrder(${order.id})" title="حذف">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ========================
// Order Modal (Create / Edit)
// ========================

async function openOrderModal(orderId) {
  const form = document.getElementById('order-form');
  const title = document.getElementById('order-modal-title');
  const idField = document.getElementById('order-id');
  const itemsContainer = document.getElementById('order-items');

  if (form) form.reset();
  if (idField) idField.value = '';
  if (itemsContainer) itemsContainer.innerHTML = '';
  OrdersState.editingId = null;

  // Refresh active products list
  try {
    const prodRes = await api('GET', '/api/products?status=active');
    if (prodRes.success) {
      OrdersState.products = prodRes.data || [];
    }
  } catch (_) {}

  if (orderId) {
    OrdersState.editingId = orderId;
    if (title) title.textContent = 'تعديل بيانات الطلب';

    try {
      const res = await api('GET', '/api/orders/' + orderId);
      if (res.success && res.data) {
        const order = res.data;
        if (idField) idField.value = order.id;
        document.getElementById('order-customer-name').value = order.customer_name || '';
        document.getElementById('order-customer-phone').value = order.customer_phone || '';
        document.getElementById('order-customer-address').value = order.customer_address || '';
        document.getElementById('order-shipping-cost').value = order.shipping_cost || 0;
        document.getElementById('order-extra-fees').value = order.extra_fees || 0;
        document.getElementById('order-notes').value = order.notes || '';

        if (order.items && order.items.length > 0) {
          order.items.forEach(item => addOrderItemRow(item));
        } else {
          addOrderItemRow();
        }
        updateOrderTotals();
      }
    } catch (err) {
      showToast('خطأ في تحميل بيانات الطلب', 'error');
    }
  } else {
    OrdersState.editingId = null;
    if (title) title.textContent = 'إنشاء طلب جديد';
    document.getElementById('order-shipping-cost').value = 0;
    document.getElementById('order-extra-fees').value = 0;
    addOrderItemRow();
    updateOrderTotals();
  }

  openModal('order-modal');
}

function addOrderItemRow(existingItem) {
  const container = document.getElementById('order-items');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'order-item-row';

  const productOptions = OrdersState.products.map(p => {
    const stock = parseInt(p.stock_quantity !== undefined ? p.stock_quantity : p.stock) || 0;
    const selected = existingItem && existingItem.product_id == p.id ? 'selected' : '';
    return `<option value="${p.id}" data-sale="${p.sale_price || 0}" data-cost="${p.purchase_price || 0}" data-stock="${stock}" ${selected}>
      ${escapeHtml(p.name)} (المخزون: ${stock})
    </option>`;
  }).join('');

  const qty = existingItem ? existingItem.quantity : 1;
  const price = existingItem ? (existingItem.sale_price || 0) : 0;
  const total = qty * price;

  row.innerHTML = `
    <div class="form-group item-product">
      <select class="order-item-product" required>
        <option value="">اختر المنتج...</option>
        ${productOptions}
      </select>
    </div>
    <div class="form-group item-qty">
      <input type="number" class="order-item-qty" placeholder="الكمية" min="1" value="${qty}" required>
    </div>
    <div class="form-group item-price">
      <input type="text" class="order-item-price" placeholder="السعر" value="${price.toFixed(2)}" readonly>
    </div>
    <div class="form-group item-total">
      <input type="text" class="order-item-total" placeholder="الإجمالي" value="${total.toFixed(2)}" readonly>
    </div>
    <button type="button" class="btn btn-danger btn-sm btn-icon remove-item-btn" title="حذف">
      <i class="fas fa-trash"></i>
    </button>
  `;

  // Attach row event listeners
  const select = row.querySelector('.order-item-product');
  const qtyInput = row.querySelector('.order-item-qty');
  const removeBtn = row.querySelector('.remove-item-btn');

  select.addEventListener('change', function () {
    const opt = this.options[this.selectedIndex];
    if (opt && opt.value) {
      const sale = parseFloat(opt.getAttribute('data-sale')) || 0;
      row.querySelector('.order-item-price').value = sale.toFixed(2);
      const q = parseInt(qtyInput.value) || 1;
      row.querySelector('.order-item-total').value = (q * sale).toFixed(2);
    } else {
      row.querySelector('.order-item-price').value = '0.00';
      row.querySelector('.order-item-total').value = '0.00';
    }
    updateOrderTotals();
  });

  qtyInput.addEventListener('input', function () {
    const q = parseInt(this.value) || 0;
    const price = parseFloat(row.querySelector('.order-item-price').value) || 0;
    row.querySelector('.order-item-total').value = (q * price).toFixed(2);
    updateOrderTotals();
  });

  removeBtn.addEventListener('click', function () {
    const allRows = container.querySelectorAll('.order-item-row');
    if (allRows.length <= 1) {
      showToast('يجب أن يحتوي الطلب على منتج واحد على الأقل', 'warning');
      return;
    }
    row.remove();
    updateOrderTotals();
  });

  container.appendChild(row);

  // If item already had product selected, trigger update
  if (existingItem && existingItem.product_id) {
    select.value = existingItem.product_id;
    const opt = select.options[select.selectedIndex];
    if (opt) {
      const sale = parseFloat(existingItem.sale_price) || parseFloat(opt.getAttribute('data-sale')) || 0;
      row.querySelector('.order-item-price').value = sale.toFixed(2);
      row.querySelector('.order-item-total').value = (qty * sale).toFixed(2);
    }
  }
}

function updateOrderTotals() {
  const container = document.getElementById('order-items');
  if (!container) return;

  let subtotal = 0;
  let totalCost = 0;

  container.querySelectorAll('.order-item-row').forEach(row => {
    const select = row.querySelector('.order-item-product');
    const opt = select ? select.options[select.selectedIndex] : null;
    const qty = parseInt(row.querySelector('.order-item-qty').value) || 0;

    if (opt && opt.value) {
      const salePrice = parseFloat(opt.getAttribute('data-sale')) || 0;
      const costPrice = parseFloat(opt.getAttribute('data-cost')) || 0;
      subtotal += qty * salePrice;
      totalCost += qty * costPrice;
    }
  });

  const shipping = parseFloat(document.getElementById('order-shipping-cost').value) || 0;
  const extraFees = parseFloat(document.getElementById('order-extra-fees').value) || 0;

  const total = subtotal + shipping + extraFees;
  const profit = subtotal - totalCost - shipping - extraFees;

  const subtotalEl = document.getElementById('order-subtotal');
  const totalEl = document.getElementById('order-total');
  const profitEl = document.getElementById('order-estimated-profit');

  if (subtotalEl) subtotalEl.value = formatCurrency(subtotal);
  if (totalEl) totalEl.value = formatCurrency(total);
  if (profitEl) {
    profitEl.value = formatCurrency(profit);
    profitEl.style.color = profit >= 0 ? '#10B981' : '#EF4444';
    profitEl.style.fontWeight = 'bold';
  }
}

async function saveOrder() {
  const customerName = document.getElementById('order-customer-name').value.trim();
  const customerPhone = document.getElementById('order-customer-phone').value.trim();
  const customerAddress = document.getElementById('order-customer-address').value.trim();
  const shippingCost = parseFloat(document.getElementById('order-shipping-cost').value) || 0;
  const extraFees = parseFloat(document.getElementById('order-extra-fees').value) || 0;
  const notes = document.getElementById('order-notes').value.trim();

  if (!customerName) {
    showToast('يرجى إدخال اسم العميل', 'warning');
    return;
  }
  if (!customerPhone) {
    showToast('يرجى إدخال رقم هاتف العميل', 'warning');
    return;
  }

  const items = [];
  const rows = document.querySelectorAll('#order-items .order-item-row');
  let hasItemError = false;

  rows.forEach(row => {
    const select = row.querySelector('.order-item-product');
    const qtyInput = row.querySelector('.order-item-qty');
    const opt = select.options[select.selectedIndex];

    if (!opt || !opt.value) {
      showToast('يرجى اختيار منتج لجميع الصفوف', 'warning');
      hasItemError = true;
      return;
    }

    const qty = parseInt(qtyInput.value) || 0;
    if (qty <= 0) {
      showToast('الكمية يجب أن تكون 1 على الأقل', 'warning');
      hasItemError = true;
      return;
    }

    const salePrice = parseFloat(opt.getAttribute('data-sale')) || 0;
    const purchasePrice = parseFloat(opt.getAttribute('data-cost')) || 0;

    items.push({
      product_id: parseInt(opt.value),
      quantity: qty,
      sale_price: salePrice,
      purchase_price: purchasePrice
    });
  });

  if (hasItemError) return;

  if (items.length === 0) {
    showToast('يجب إضافة منتج واحد على الأقل للطلب', 'warning');
    return;
  }

  const payload = {
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_address: customerAddress,
    shipping_cost: shippingCost,
    extra_fees: extraFees,
    notes: notes,
    items: items
  };

  const saveBtn = document.getElementById('save-order-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
  }

  try {
    let res;
    if (OrdersState.editingId) {
      res = await api('PUT', '/api/orders/' + OrdersState.editingId, payload);
    } else {
      res = await api('POST', '/api/orders', payload);
    }

    if (res.success) {
      showToast(OrdersState.editingId ? 'تم تحديث الطلب بنجاح' : 'تم إنشاء الطلب بنجاح', 'success');
      closeModal('order-modal');
      loadOrders();
    } else {
      showToast(res.error || 'فشل حفظ الطلب', 'error');
    }
  } catch (err) {
    showToast('حدث خطأ أثناء حفظ الطلب', 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ الطلب';
    }
  }
}

function deleteOrder(id) {
  showConfirm('هل أنت متأكد من رغبتك في حذف هذا الطلب نهائياً؟', async function () {
    try {
      const res = await api('DELETE', '/api/orders/' + id);
      if (res.success) {
        showToast('تم حذف الطلب بنجاح', 'success');
        loadOrders();
      } else {
        showToast(res.error || 'فشل حذف الطلب', 'error');
      }
    } catch (err) {
      showToast('حدث خطأ أثناء حذف الطلب', 'error');
    }
  });
}

// ========================
// View Order Details
// ========================

async function viewOrderDetails(orderId) {
  OrdersState.activeDetailOrderId = orderId;

  try {
    const res = await api('GET', '/api/orders/' + orderId);
    if (!res.success || !res.data) {
      showToast(res.error || 'فشل تحميل تفاصيل الطلب', 'error');
      return;
    }

    const order = res.data;

    document.getElementById('order-detail-number').textContent = `(${order.order_number || ('ORD-' + order.id)})`;
    document.getElementById('detail-customer-name').textContent = order.customer_name || '-';
    document.getElementById('detail-customer-phone').textContent = order.customer_phone || '-';
    document.getElementById('detail-customer-address').textContent = order.customer_address || '-';
    document.getElementById('detail-order-date').textContent = formatDate(order.created_at);
    document.getElementById('detail-order-status').innerHTML = `<span class="status-badge ${getStatusClass(order.status)}">${getStatusLabel(order.status)}</span>`;
    document.getElementById('detail-order-total').textContent = formatCurrency(order.total_amount);
    document.getElementById('detail-order-profit').textContent = formatCurrency(order.profit);
    document.getElementById('detail-order-notes').textContent = order.notes || 'لا توجد ملاحظات';

    // Status change select
    const statusSelect = document.getElementById('order-status-change');
    if (statusSelect) statusSelect.value = order.status;

    // Items table
    const tbody = document.querySelector('#order-detail-items-table tbody');
    if (tbody) {
      tbody.innerHTML = (order.items || []).map(item => {
        let supplierLink = '';
        if (item.supplier_product_url) {
          supplierLink = `
            <div style="margin-top:4px;">
              <a href="${item.supplier_product_url}" target="_blank" class="btn btn-sm btn-secondary" style="font-size:11px; padding:3px 8px; display:inline-flex; align-items:center; gap:4px;">
                <i class="fas fa-truck"></i> طلب من المورد ${item.supplier_sku ? `(${escapeHtml(item.supplier_sku)})` : ''}
              </a>
            </div>
          `;
        } else if (item.supplier_sku) {
          supplierLink = `<div style="font-size:11px; color:#64748B; margin-top:2px;">كود المورد: ${escapeHtml(item.supplier_sku)}</div>`;
        }

        return `
          <tr>
            <td>
              <strong>${escapeHtml(item.product_name)}</strong>
              ${supplierLink}
            </td>
            <td>${item.quantity}</td>
            <td>${formatCurrency(item.sale_price)}</td>
            <td><strong>${formatCurrency(item.sale_price * item.quantity)}</strong></td>
          </tr>
        `;
      }).join('');
    }

    openModal('order-details-modal');
  } catch (err) {
    showToast('حدث خطأ أثناء جلب تفاصيل الطلب', 'error');
  }
}

async function updateOrderStatusAction() {
  if (!OrdersState.activeDetailOrderId) return;
  const select = document.getElementById('order-status-change');
  const newStatus = select ? select.value : '';

  if (!newStatus) return;

  const btn = document.getElementById('update-status-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحديث...';
  }

  try {
    const res = await api('PUT', `/api/orders/${OrdersState.activeDetailOrderId}/status`, { status: newStatus });
    if (res.success) {
      showToast('تم تحديث حالة الطلب بنجاح', 'success');
      viewOrderDetails(OrdersState.activeDetailOrderId);
      loadOrders();
    } else {
      showToast(res.error || 'فشل تحديث حالة الطلب', 'error');
    }
  } catch (err) {
    showToast('حدث خطأ أثناء تحديث حالة الطلب', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-sync-alt"></i> تحديث الحالة';
    }
  }
}

// ========================
// Print Invoice
// ========================

async function printInvoice(orderId) {
  try {
    const res = await api('GET', `/api/orders/${orderId}/invoice`);
    if (!res.success || !res.data) {
      showToast('فشل جلب بيانات الفاتورة', 'error');
      return;
    }

    const { order, store } = res.data;

    // Fill invoice print template
    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setEl('invoice-order-number', order.order_number || ('ORD-' + order.id));
    setEl('invoice-date', formatDate(order.created_at));
    setEl('invoice-customer-name', order.customer_name || '-');
    setEl('invoice-customer-phone', order.customer_phone || '-');
    setEl('invoice-customer-address', order.customer_address || '-');

    if (store && store.store_name) {
      document.querySelectorAll('.invoice-store-name').forEach(el => el.textContent = store.store_name);
    }

    const tbody = document.querySelector('#invoice-items-table tbody');
    if (tbody) {
      tbody.innerHTML = (order.items || []).map(item => `
        <tr>
          <td>${escapeHtml(item.product_name)}</td>
          <td>${item.quantity}</td>
          <td>${formatCurrency(item.sale_price)}</td>
          <td>${formatCurrency(item.sale_price * item.quantity)}</td>
        </tr>
      `).join('');
    }

    setEl('invoice-subtotal', formatCurrency(order.items_total || 0));
    setEl('invoice-shipping', formatCurrency(order.shipping_cost || 0));
    setEl('invoice-extra', formatCurrency(order.extra_fees || 0));
    setEl('invoice-grand-total', formatCurrency(order.total_amount || 0));

    // Trigger browser print
    window.print();
  } catch (err) {
    showToast('حدث خطأ أثناء طباعة الفاتورة', 'error');
  }
}

// ========================
// Event Listeners
// ========================

document.addEventListener('DOMContentLoaded', function () {
  // Add Order Button
  const addBtn = document.getElementById('add-order-btn');
  if (addBtn) addBtn.addEventListener('click', () => openOrderModal());

  // Save Order Button
  const saveBtn = document.getElementById('save-order-btn');
  if (saveBtn) saveBtn.addEventListener('click', saveOrder);

  // Add Item Row Button
  const addItemBtn = document.getElementById('add-order-item-btn');
  if (addItemBtn) addItemBtn.addEventListener('click', () => addOrderItemRow());

  // Shipping & Extra fee inputs
  const shippingInput = document.getElementById('order-shipping-cost');
  const extraInput = document.getElementById('order-extra-fees');
  if (shippingInput) shippingInput.addEventListener('input', updateOrderTotals);
  if (extraInput) extraInput.addEventListener('input', updateOrderTotals);

  // Update Status Button
  const updateStatusBtn = document.getElementById('update-status-btn');
  if (updateStatusBtn) updateStatusBtn.addEventListener('click', updateOrderStatusAction);

  // Print Invoice Button
  const printBtn = document.getElementById('print-invoice-btn');
  if (printBtn) {
    printBtn.addEventListener('click', function () {
      if (OrdersState.activeDetailOrderId) {
        printInvoice(OrdersState.activeDetailOrderId);
      }
    });
  }

  // Filters
  const searchInput = document.getElementById('order-search');
  if (searchInput) {
    let timeout;
    searchInput.addEventListener('input', function () {
      clearTimeout(timeout);
      timeout = setTimeout(loadOrders, 350);
    });
  }

  const filterStatus = document.getElementById('filter-order-status');
  const filterFrom = document.getElementById('filter-date-from');
  const filterTo = document.getElementById('filter-date-to');

  if (filterStatus) filterStatus.addEventListener('change', loadOrders);
  if (filterFrom) filterFrom.addEventListener('change', loadOrders);
  if (filterTo) filterTo.addEventListener('change', loadOrders);
});
