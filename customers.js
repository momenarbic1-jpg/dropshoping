/**
 * customers.js - Customer Management Script
 * View customers, their phone numbers, total purchases, order count, and purchase history.
 */

const CustomersState = {
  customers: [],
  selectedCustomerOrders: []
};

async function initCustomers() {
  await loadCustomers();
  setupCustomerEvents();
}

async function loadCustomers(search = '') {
  const tbody = document.querySelector('#customers-table tbody');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="empty-state">
        <i class="fas fa-spinner fa-spin fa-2x text-primary" style="margin-bottom:8px; display:block;"></i>
        <p>جاري تحميل قائمة العملاء...</p>
      </td>
    </tr>
  `;

  try {
    const url = search ? `/api/customers?search=${encodeURIComponent(search)}` : '/api/customers';
    const res = await fetch(url);
    const json = await res.json();

    if (json.success) {
      CustomersState.customers = json.data || [];
      renderCustomersTable();
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state text-danger">
            <p>${escapeHtml(json.error || 'خطأ في تحميل العملاء')}</p>
          </td>
        </tr>
      `;
    }
  } catch (err) {
    console.error('Error loading customers:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state text-danger">
          <p>خطأ في الاتصال بالخادم</p>
        </td>
      </tr>
    `;
  }
}

function renderCustomersTable() {
  const tbody = document.querySelector('#customers-table tbody');
  if (!tbody) return;

  const list = CustomersState.customers;
  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <i class="fas fa-users-slash fa-2x text-muted" style="margin-bottom:8px; display:block;"></i>
          <p>لا يوجد عملاء مطابقين للبحث</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(c => `
    <tr>
      <td>
        <div style="font-weight:700; color:#1E293B;">${escapeHtml(c.customer_name || 'عميل بدون اسم')}</div>
        ${c.customer_email ? `<small style="color:#64748B;">${escapeHtml(c.customer_email)}</small>` : ''}
      </td>
      <td dir="ltr" style="text-align:right; font-weight:600;">
        <a href="https://wa.me/${encodeURIComponent(c.customer_phone.replace(/[^0-9]/g, ''))}" target="_blank" style="color:#059669; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
          <i class="fab fa-whatsapp"></i> ${escapeHtml(c.customer_phone)}
        </a>
      </td>
      <td>${escapeHtml(c.city || 'غير محدد')}</td>
      <td><span class="badge" style="background:#EFF6FF; color:#2563EB; font-weight:800; padding:4px 8px; border-radius:6px;">${c.total_orders} طلبات</span></td>
      <td style="font-weight:800; color:#059669;">${formatCurrency(c.total_spent || 0)}</td>
      <td style="font-size:13px; color:#64748B;">${formatDate(c.last_order_date)}</td>
      <td>
        <button type="button" class="btn btn-sm btn-outline-primary" onclick="viewCustomerOrders('${escapeHtml(c.customer_phone)}', '${escapeHtml(c.customer_name)}')">
          <i class="fas fa-list-check"></i> سجل الطلبات
        </button>
      </td>
    </tr>
  `).join('');
}

function setupCustomerEvents() {
  const searchInput = document.getElementById('customer-search');
  if (searchInput) {
    let timeout;
    searchInput.addEventListener('input', function () {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        loadCustomers(searchInput.value.trim());
      }, 350);
    });
  }
}

async function viewCustomerOrders(phone, name) {
  const modal = document.getElementById('customer-orders-modal');
  if (!modal) return;

  document.getElementById('customer-modal-title').textContent = `طلبات العميل: ${name} (${phone})`;
  const tbody = document.getElementById('customer-orders-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="empty-state">جاري التحميل...</td></tr>';

  openModal('customer-orders-modal');

  try {
    const res = await fetch(`/api/customers/${encodeURIComponent(phone)}/orders`);
    const json = await res.json();

    if (json.success && json.data) {
      const orders = json.data;
      if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">لا توجد طلبات سابقة</td></tr>';
        return;
      }

      tbody.innerHTML = orders.map(o => `
        <tr>
          <td><strong>${escapeHtml(o.order_number)}</strong></td>
          <td>${formatDate(o.created_at)}</td>
          <td><span class="status-badge badge-${o.status}">${getStatusLabel(o.status)}</span></td>
          <td style="font-weight:700;">${formatCurrency(o.total_amount || 0)}</td>
          <td>
            <button type="button" class="btn btn-sm btn-secondary" onclick="closeModal('customer-orders-modal'); Orders.openDetailsModal(${o.id});">
              <i class="fas fa-eye"></i> تفاصيل
            </button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Error fetching customer orders:', err);
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state text-danger">خطأ في جلب الطلبات</td></tr>';
  }
}
