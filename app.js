/**
 * app.js - Main Application Controller
 * Core SPA controller for Drop Shipping Sales Management
 */

// ========================
// Global Application State
// ========================
const App = {
  currentPage: 'dashboard',
  isAuthenticated: false,
  user: null,
  settings: {}
};

// Page title mapping (Arabic)
const PAGE_TITLES = {
  dashboard: 'لوحة التحكم',
  products: 'المنتجات',
  orders: 'الطلبات',
  customers: 'العملاء والمشترين',
  suppliers: 'الموردين',
  integrations: 'إدارة التكاملات و API',
  messages: 'رسائل العملاء',
  reports: 'التقارير والأرباح',
  settings: 'الإعدادات'
};

// Order status labels (Arabic)
const STATUS_LABELS = {
  new: 'جديد',
  confirming: 'قيد التأكيد',
  processing: 'قيد التجهيز',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
  returned: 'مرتجع'
};

// Order status CSS classes
const STATUS_CLASSES = {
  new: 'badge-new',
  confirming: 'badge-confirming',
  processing: 'badge-processing',
  shipped: 'badge-shipped',
  delivered: 'badge-delivered',
  cancelled: 'badge-cancelled',
  returned: 'badge-returned'
};

// ========================
// Initialization
// ========================

async function init() {
  try {
    const res = await api('GET', '/api/auth/check');
    if (res.success && res.data && (res.data.authenticated || res.data.user)) {
      App.isAuthenticated = true;
      App.user = res.data.user || null;
      showApp();
    } else {
      showLogin();
    }
  } catch (err) {
    showLogin();
  }
}

document.addEventListener('DOMContentLoaded', init);

// ========================
// Auth / Navigation
// ========================

function showLogin() {
  App.isAuthenticated = false;
  App.user = null;

  const loginPage = document.getElementById('login-page');
  const appEl = document.getElementById('app');

  if (loginPage) {
    loginPage.classList.remove('hidden');
    loginPage.style.display = 'flex';
  }
  if (appEl) {
    appEl.classList.add('hidden');
    appEl.style.display = 'none';
  }
}

async function showApp() {
  const loginPage = document.getElementById('login-page');
  const appEl = document.getElementById('app');

  if (loginPage) {
    loginPage.classList.add('hidden');
    loginPage.style.display = 'none';
  }
  if (appEl) {
    appEl.classList.remove('hidden');
    appEl.style.display = 'block';
  }

  // Update user name in header
  const userNameEl = document.querySelector('.user-greeting span');
  if (userNameEl && App.user) {
    userNameEl.textContent = 'مرحباً، ' + (App.user.username || 'المدير');
  }

  // Load store settings
  try {
    const res = await api('GET', '/api/settings');
    if (res.success && res.data) {
      App.settings = res.data;
      if (res.data.store_name) {
        document.querySelectorAll('.sidebar-store-name').forEach(el => {
          el.textContent = res.data.store_name;
        });
      }
    }
  } catch (_) {}

  navigate('dashboard');
}

function navigate(page) {
  App.currentPage = page;

  // Hide all page sections
  document.querySelectorAll('.page').forEach(function (el) {
    el.classList.remove('active');
    el.classList.add('hidden');
    el.style.display = 'none';
  });

  // Show the target page
  const target = document.getElementById('page-' + page);
  if (target) {
    target.classList.add('active');
    target.classList.remove('hidden');
    target.style.display = 'block';
  }

  // Update sidebar active link
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(function (link) {
    link.classList.remove('active');
  });
  const activeLink = document.querySelector('.sidebar-nav .nav-item[data-page="' + page + '"]');
  if (activeLink) activeLink.classList.add('active');

  // Update header title
  const headerTitle = document.querySelector('.header-title');
  if (headerTitle) {
    headerTitle.textContent = PAGE_TITLES[page] || page;
  }

  // Close sidebar on mobile after navigating
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open', 'active');
  if (overlay) overlay.classList.remove('active');

  // Invoke page-specific loader
  switch (page) {
    case 'dashboard':
      if (typeof loadDashboard === 'function') loadDashboard();
      break;
    case 'products':
      if (typeof loadProducts === 'function') loadProducts();
      break;
    case 'orders':
      if (typeof loadOrders === 'function') loadOrders();
      break;
    case 'suppliers':
      if (typeof loadSuppliers === 'function') loadSuppliers();
      break;
    case 'integrations':
      if (typeof initIntegrations === 'function') initIntegrations();
      break;
    case 'customers':
      if (typeof initCustomers === 'function') initCustomers();
      break;
    case 'messages':
      if (typeof initMessages === 'function') initMessages();
      break;
    case 'reports':
      if (typeof loadReports === 'function') loadReports();
      break;
    case 'settings':
      if (typeof loadSettings === 'function') loadSettings();
      break;
  }
}

async function login(username, password) {
  if (!username || !password) {
    showToast('يرجى إدخال اسم المستخدم وكلمة المرور', 'error');
    return;
  }

  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الدخول...';
  }

  try {
    const res = await api('POST', '/api/auth/login', { username, password });

    if (res.success) {
      App.isAuthenticated = true;
      App.user = res.data.user || { username };
      showToast('تم تسجيل الدخول بنجاح', 'success');
      showApp();
    } else {
      showToast(res.error || 'فشل تسجيل الدخول', 'error');
    }
  } catch (err) {
    showToast('حدث خطأ في الاتصال بالخادم', 'error');
  } finally {
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> تسجيل الدخول';
    }
  }
}

async function logout() {
  try {
    await api('POST', '/api/auth/logout');
  } catch (_) {}
  App.isAuthenticated = false;
  App.user = null;
  App.settings = {};
  showLogin();
  showToast('تم تسجيل الخروج', 'info');
}

// ========================
// API Helper
// ========================

async function api(method, url, data, isFormData) {
  const baseUrl = (window.APP_BACKEND_URL || '').replace(/\/$/, '');
  const fullUrl = url.startsWith('http') ? url : (baseUrl + url);
  const options = {
    method: method,
    headers: {},
    credentials: baseUrl ? 'include' : 'same-origin'
  };

  if (data) {
    if (isFormData) {
      options.body = data;
    } else {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(data);
    }
  }

  const response = await fetch(fullUrl, options);

  if (response.status === 401 && !url.includes('/api/auth/login') && !url.includes('/api/auth/check')) {
    showLogin();
    throw new Error('غير مصرح بالدخول');
  }

  return await response.json();
}

// ========================
// Toast Notifications
// ========================

function showToast(message, type) {
  type = type || 'info';

  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: 'fa-check-circle',
    error: 'fa-times-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };

  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML =
    '<i class="fas ' + (icons[type] || icons.info) + '"></i>' +
    '<span>' + message + '</span>' +
    '<button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>';

  container.appendChild(toast);

  requestAnimationFrame(function () {
    toast.classList.add('show');
  });

  setTimeout(function () {
    toast.classList.remove('show');
    setTimeout(function () {
      if (toast.parentElement) toast.remove();
    }, 300);
  }, 3500);
}

// ========================
// Confirmation Modal
// ========================

let onConfirmAction = null;

function showConfirm(message, onConfirm) {
  const msgEl = document.getElementById('confirm-modal-message');
  if (msgEl) msgEl.textContent = message;
  onConfirmAction = onConfirm;
  openModal('confirm-modal');
}

// ========================
// Modal Helpers
// ========================

function openModal(modalId) {
  const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
  if (!modal) return;
  modal.classList.add('active', 'show');
  modal.style.display = 'flex';
}

function closeModal(modalId) {
  const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
  if (!modal) return;
  modal.classList.remove('active', 'show');
  modal.style.display = 'none';
}

// ========================
// Formatting Helpers
// ========================

function formatCurrency(amount) {
  const num = parseFloat(amount);
  const curr = (App.settings && App.settings.currency) || 'ج.م';
  if (isNaN(num)) return `0.00 ${curr}`;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + curr;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return year + '/' + month + '/' + day + ' ' + hours + ':' + minutes;
}

function getStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function getStatusClass(status) {
  return STATUS_CLASSES[status] || 'badge-new';
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getProductImageUrl(img) {
  if (!img) return '';
  if (img.startsWith('http') || img.startsWith('data:')) return img;
  const baseUrl = (window.APP_BACKEND_URL || '').replace(/\/$/, '');
  if (img.startsWith('/uploads/')) return baseUrl + img;
  return baseUrl + '/uploads/' + img;
}

// ========================
// Event Listeners
// ========================

document.addEventListener('DOMContentLoaded', function () {
  // Login form submission
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      login(username, password);
    });
  }

  // Sidebar navigation
  const sidebarNav = document.querySelector('.sidebar-nav');
  if (sidebarNav) {
    sidebarNav.addEventListener('click', function (e) {
      const link = e.target.closest('a[data-page]');
      if (!link) return;
      e.preventDefault();
      const page = link.getAttribute('data-page');
      if (page) navigate(page);
    });
  }

  // Hamburger mobile menu
  const hamburger = document.getElementById('hamburger-btn');
  const sidebar = document.getElementById('sidebar');
  const sidebarClose = document.getElementById('sidebar-close');
  const overlay = document.getElementById('sidebar-overlay');

  if (hamburger && sidebar) {
    hamburger.addEventListener('click', function () {
      sidebar.classList.toggle('open');
      sidebar.classList.toggle('active');
      if (overlay) overlay.classList.toggle('active');
    });
  }

  if (sidebarClose && sidebar) {
    sidebarClose.addEventListener('click', function () {
      sidebar.classList.remove('open', 'active');
      if (overlay) overlay.classList.remove('active');
    });
  }

  if (overlay && sidebar) {
    overlay.addEventListener('click', function () {
      sidebar.classList.remove('open', 'active');
      overlay.classList.remove('active');
    });
  }

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function (e) {
      e.preventDefault();
      showConfirm('هل أنت متأكد من تسجيل الخروج؟', logout);
    });
  }

  // Global modal close handlers
  document.body.addEventListener('click', function (e) {
    const dismissBtn = e.target.closest('[data-dismiss="modal"], .modal-close');
    if (dismissBtn) {
      const modal = dismissBtn.closest('.modal');
      if (modal) closeModal(modal);
      return;
    }

    if (e.target.classList.contains('modal')) {
      closeModal(e.target);
    }
  });

  // Global confirm button handler
  const confirmActionBtn = document.getElementById('confirm-action-btn');
  if (confirmActionBtn) {
    confirmActionBtn.addEventListener('click', function () {
      closeModal('confirm-modal');
      if (typeof onConfirmAction === 'function') {
        const cb = onConfirmAction;
        onConfirmAction = null;
        cb();
      }
    });
  }

  // Escape key closes modals
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.active, .modal.show').forEach(function (m) {
        closeModal(m);
      });
    }
  });
});
