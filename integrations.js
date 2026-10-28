/**
 * integrations.js - API Integrations & API Keys Management
 * Clean, secure, modern administration for dropshipping suppliers, shipping, WhatsApp, email, AI.
 */

const IntegrationsState = {
  integrations: [],
  catalog: [],
  activeCategory: 'all',
  editingIntegration: null,
  selectedProvider: null
};

document.addEventListener('DOMContentLoaded', function () {
  // If app is loaded
  if (typeof App !== 'undefined') {
    initIntegrations();
  }
});

let integrationsEventsConfigured = false;

async function initIntegrations() {
  await loadCatalog();
  await loadIntegrations();
  if (!integrationsEventsConfigured) {
    setupIntegrationEvents();
    integrationsEventsConfigured = true;
  }
}

function integrationFetch(url, options = {}) {
  const baseUrl = (window.APP_BACKEND_URL || '').replace(/\/$/, '');
  const fullUrl = url.startsWith('http') ? url : (baseUrl + url);
  if (baseUrl && !options.credentials) {
    options.credentials = 'include';
  }
  return fetch(fullUrl, options);
}

async function loadCatalog() {
  try {
    const res = await integrationFetch('/api/integrations/catalog');
    const json = await res.json();
    if (json.success && json.data) {
      IntegrationsState.catalog = json.data;
    }
  } catch (err) {
    console.error('Error loading catalog:', err);
  }
}

async function loadIntegrations() {
  const container = document.getElementById('integrations-grid');
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state-card" style="grid-column: 1 / -1; padding: 50px 20px; text-align:center;">
      <i class="fas fa-spinner fa-spin fa-2x text-primary" style="margin-bottom:12px; display:block;"></i>
      <p>جاري تحميل التكاملات و API...</p>
    </div>
  `;

  try {
    const res = await integrationFetch('/api/integrations');
    const json = await res.json();
    if (json.success) {
      IntegrationsState.integrations = json.data || [];
      renderIntegrationStats();
      renderIntegrations();
    } else {
      container.innerHTML = `
        <div class="empty-state-card" style="grid-column: 1 / -1; padding: 40px; text-align:center;">
          <p class="text-danger">${escapeHtml(json.error || 'تعذر تحميل التكاملات')}</p>
        </div>
      `;
    }
  } catch (err) {
    console.error('Error loading integrations:', err);
    container.innerHTML = `
      <div class="empty-state-card" style="grid-column: 1 / -1; padding: 40px; text-align:center;">
        <p class="text-danger">حدث خطأ في الاتصال بالخادم</p>
      </div>
    `;
  }
}

function renderIntegrationStats() {
  const list = IntegrationsState.integrations;
  const total = list.length;
  const enabled = list.filter(i => i.is_enabled).length;
  const connected = list.filter(i => i.status === 'connected').length;
  const issues = list.filter(i => i.status === 'error').length;

  const totalEl = document.getElementById('stat-integrations-total');
  const enabledEl = document.getElementById('stat-integrations-enabled');
  const connectedEl = document.getElementById('stat-integrations-connected');
  const issuesEl = document.getElementById('stat-integrations-issues');

  if (totalEl) totalEl.textContent = total;
  if (enabledEl) enabledEl.textContent = enabled;
  if (connectedEl) connectedEl.textContent = connected;
  if (issuesEl) issuesEl.textContent = issues;
}

function renderIntegrations() {
  const container = document.getElementById('integrations-grid');
  if (!container) return;

  let list = IntegrationsState.integrations;
  if (IntegrationsState.activeCategory !== 'all') {
    list = list.filter(i => i.category === IntegrationsState.activeCategory);
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
        <i class="fas fa-plug-circle-plus fa-3x" style="color:#94A3B8; margin-bottom:16px; display:block;"></i>
        <h3 style="font-size:18px; color:#334155; margin-bottom:8px;">لا توجد تكاملات مضافة في هذا القسم</h3>
        <p style="color:#64748B; font-size:14px; max-width:400px; margin:0 auto 16px;">
          قم بربط متجرك مع منصات الدروب شيبنج (CJ Dropshipping / AliExpress)، أو شركات الشحن، أو خدمات رسائل الواتساب والذكاء الاصطناعي.
        </p>
        <button type="button" class="btn btn-primary" onclick="openAddIntegrationModal()">
          <i class="fas fa-plus"></i> إضافة تكامل جديد
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(item => {
    let statusClass = 'status-badge-gray';
    let statusText = 'غير متصل';
    let statusIcon = 'fa-circle-pause';

    if (item.status === 'connected') {
      statusClass = 'status-badge-green';
      statusText = 'متصل بنجاح';
      statusIcon = 'fa-circle-check';
    } else if (item.status === 'error') {
      statusClass = 'status-badge-red';
      statusText = 'فشل الاتصال';
      statusIcon = 'fa-circle-xmark';
    }

    const testTime = item.last_tested_at ? formatDate(item.last_tested_at) : 'لم يتم الفحص بعد';
    const lastResultMsg = item.last_test_result && item.last_test_result.message 
      ? item.last_test_result.message 
      : '';

    return `
      <div class="integration-card ${item.is_enabled ? 'is-active' : 'is-inactive'}">
        <div class="integration-card-header">
          <div class="integration-brand">
            <div class="integration-icon-box bg-${item.badge_color || 'blue'}">
              <i class="${item.icon || 'fas fa-plug'}"></i>
            </div>
            <div>
              <h4 class="integration-card-title">${escapeHtml(item.name)}</h4>
              <span class="integration-provider-sub">${escapeHtml(item.provider_name)}</span>
            </div>
          </div>

          <!-- Enable Switch -->
          <label class="switch-toggle" title="${item.is_enabled ? 'تعطيل التكامل' : 'تفعيل التكامل'}">
            <input type="checkbox" ${item.is_enabled ? 'checked' : ''} onchange="toggleIntegrationStatus(${item.id})">
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="integration-card-body">
          <div class="integration-meta-row">
            <span class="meta-label">القسم:</span>
            <span class="category-pill">${escapeHtml(item.category_name)}</span>
          </div>

          <div class="integration-meta-row">
            <span class="meta-label">حالة الاتصال:</span>
            <span class="integration-status-pill ${statusClass}">
              <i class="fas ${statusIcon}"></i>
              ${statusText}
            </span>
          </div>

          <div class="integration-meta-row">
            <span class="meta-label">مفتاح API:</span>
            <span class="key-masked-code font-monospace">${item.has_api_key ? item.api_key_masked : '<span class="text-muted">غير مدخل</span>'}</span>
          </div>

          ${item.base_url ? `
          <div class="integration-meta-row">
            <span class="meta-label">الرابط:</span>
            <span class="url-snippet" title="${escapeHtml(item.base_url)}">${escapeHtml(truncate(item.base_url, 32))}</span>
          </div>` : ''}

          <!-- Diagnostic Result Box -->
          <div class="integration-diagnostic-box ${item.status === 'connected' ? 'diag-success' : (item.status === 'error' ? 'diag-error' : '')}">
            <div class="diag-header">
              <i class="fas fa-clock-rotate-left"></i>
              <span>آخر فحص: ${testTime}</span>
            </div>
            ${lastResultMsg ? `<p class="diag-msg">${escapeHtml(lastResultMsg)}</p>` : ''}
          </div>
        </div>

        <div class="integration-card-footer">
          <button type="button" class="btn btn-sm btn-outline-primary" id="test-btn-${item.id}" onclick="testIntegrationConnection(${item.id})">
            <i class="fas fa-vial"></i>
            <span>فحص الاتصال</span>
          </button>

          <div style="display:flex; gap:6px;">
            <button type="button" class="btn btn-sm btn-secondary btn-icon" onclick="openEditIntegrationModal(${item.id})" title="تعديل الإعدادات">
              <i class="fas fa-edit"></i>
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger btn-icon" onclick="confirmDeleteIntegration(${item.id}, '${escapeHtml(item.name)}')" title="حذف التكامل">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function setupIntegrationEvents() {
  // Category tabs filter
  document.querySelectorAll('.integration-cat-tab').forEach(tab => {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.integration-cat-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      IntegrationsState.activeCategory = this.getAttribute('data-cat') || 'all';
      renderIntegrations();
    });
  });

  // Modal Provider Selector change
  const providerSelect = document.getElementById('integration-provider-select');
  if (providerSelect) {
    providerSelect.addEventListener('change', function () {
      const selectedId = this.value;
      onProviderSelected(selectedId);
    });
  }

  // Toggle secret eye visibility
  document.querySelectorAll('.toggle-secret-visibility').forEach(btn => {
    btn.addEventListener('click', function () {
      const inputId = this.getAttribute('data-target');
      const input = document.getElementById(inputId);
      const icon = this.querySelector('i');
      if (input) {
        if (input.type === 'password') {
          input.type = 'text';
          if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
          }
        } else {
          input.type = 'password';
          if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
          }
        }
      }
    });
  });

  // Prevent form reload on enter
  const form = document.getElementById('integration-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      saveIntegrationForm(false);
    });
  }
}

function onProviderSelected(providerId) {
  const catalogEntry = IntegrationsState.catalog.find(p => p.id === providerId);
  const baseUrlInput = document.getElementById('integration-base-url');
  const instructionsBox = document.getElementById('integration-instructions-box');
  const instructionsText = document.getElementById('integration-instructions-text');
  const extraFieldsBox = document.getElementById('integration-extra-fields');

  if (catalogEntry) {
    if (baseUrlInput && !baseUrlInput.value) {
      baseUrlInput.value = catalogEntry.default_base_url || '';
    }
    if (instructionsBox && instructionsText) {
      if (catalogEntry.instructions) {
        instructionsText.innerHTML = catalogEntry.instructions.replace(/\n/g, '<br>');
        instructionsBox.style.display = 'block';
      } else {
        instructionsBox.style.display = 'none';
      }
    }

    // Provider specific dynamic extra fields
    if (extraFieldsBox) {
      extraFieldsBox.innerHTML = '';
      if (providerId === 'whatsapp_ultramsg') {
        extraFieldsBox.innerHTML = `
          <div class="form-group">
            <label for="extra-instance-id"><i class="fas fa-fingerprint text-primary"></i> معرف النسخة (Instance ID) <span class="required">*</span></label>
            <input type="text" id="extra-instance-id" class="form-control font-monospace" placeholder="e.g. instance12345" required dir="ltr">
            <small class="form-text text-muted">تجد هذا المعرف في لوحة تحكم UltraMsg بعد مسح كود QR</small>
          </div>
        `;
      } else if (providerId === 'smsa' || providerId === 'aramex') {
        extraFieldsBox.innerHTML = `
          <div class="form-row">
            <div class="form-group">
              <label for="extra-account-no">رقم الحساب التجاري (Account No)</label>
              <input type="text" id="extra-account-no" class="form-control font-monospace" placeholder="رقم الحساب" dir="ltr">
            </div>
            ${providerId === 'aramex' ? `
            <div class="form-group">
              <label for="extra-account-pin">رمز الحساب (Account PIN)</label>
              <input type="password" id="extra-account-pin" class="form-control font-monospace" placeholder="PIN" dir="ltr">
            </div>` : ''}
          </div>
        `;
      } else if (providerId === 'gemini_ai') {
        extraFieldsBox.innerHTML = `
          <div class="form-group">
            <label for="extra-model">النموذج المفضل (Model)</label>
            <input type="text" id="extra-model" class="form-control font-monospace" value="gemini-1.5-flash" placeholder="gemini-1.5-flash" dir="ltr">
          </div>
        `;
      }
    }
  }
}

async function openAddIntegrationModal(preselectedProviderId) {
  IntegrationsState.editingIntegration = null;
  const form = document.getElementById('integration-form');
  if (form) form.reset();

  document.getElementById('integration-modal-title').textContent = 'إضافة مفتاح API جديد';
  document.getElementById('integration-id').value = '';

  if (!IntegrationsState.catalog || IntegrationsState.catalog.length === 0) {
    await loadCatalog();
  }

  const defaultProvider = preselectedProviderId || 'custom';
  const providerSelect = document.getElementById('integration-provider-select');
  if (providerSelect) {
    providerSelect.disabled = false;
    providerSelect.innerHTML = (IntegrationsState.catalog || []).map(c => `
        <option value="${c.id}" ${c.id === defaultProvider ? 'selected' : ''}>${escapeHtml(c.name)}</option>
      `).join('');

    providerSelect.value = defaultProvider;
    onProviderSelected(defaultProvider);
  }

  // Clear masks and fields
  ['integration-api-key', 'integration-api-secret', 'integration-access-token', 'integration-webhook-secret'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.value = '';
      el.placeholder = 'الصق مفتاح الـ API أو التوكن هنا...';
    }
  });

  const nameInput = document.getElementById('integration-name');
  if (nameInput) {
    nameInput.value = '';
    nameInput.placeholder = 'اختياري - اتركه فارغاً وسيتم التسمية تلقائياً';
  }

  const enabledCheck = document.getElementById('integration-is-enabled');
  if (enabledCheck) enabledCheck.checked = true;

  openModal('integration-modal');
}

async function openEditIntegrationModal(id) {
  if (!IntegrationsState.catalog || IntegrationsState.catalog.length === 0) {
    await loadCatalog();
  }
  const item = IntegrationsState.integrations.find(i => i.id === id);
  if (!item) return;

  IntegrationsState.editingIntegration = item;

  document.getElementById('integration-modal-title').textContent = `تعديل إعدادات: ${item.name}`;
  document.getElementById('integration-id').value = item.id;
  document.getElementById('integration-name').value = item.name;

  const providerSelect = document.getElementById('integration-provider-select');
  if (providerSelect) {
    providerSelect.innerHTML = IntegrationsState.catalog.map(c => `
      <option value="${c.id}" ${c.id === item.provider ? 'selected' : ''}>${escapeHtml(c.name)}</option>
    `).join('');
    providerSelect.disabled = true; // Provider is locked during edit to avoid schema conflict
  }

  onProviderSelected(item.provider);

  document.getElementById('integration-base-url').value = item.base_url || '';
  document.getElementById('integration-webhook-url').value = item.webhook_url || '';

  // Show placeholder hint for secrets
  const keyInput = document.getElementById('integration-api-key');
  if (keyInput) {
    keyInput.value = '';
    keyInput.placeholder = item.has_api_key ? `مضبوط مسبقاً (${item.api_key_masked}) - اتركه فارغاً للإبقاء عليه` : 'أدخل مفتاح الـ API';
  }

  const secretInput = document.getElementById('integration-api-secret');
  if (secretInput) {
    secretInput.value = '';
    secretInput.placeholder = item.has_api_secret ? `مضبوط مسبقاً (${item.api_secret_masked}) - اتركه فارغاً للإبقاء عليه` : 'أدخل الـ Secret';
  }

  const tokenInput = document.getElementById('integration-access-token');
  if (tokenInput) {
    tokenInput.value = '';
    tokenInput.placeholder = item.has_access_token ? `مضبوط مسبقاً (${item.access_token_masked}) - اتركه فارغاً للإبقاء عليه` : 'أدخل التوكن';
  }

  const webhookSecretInput = document.getElementById('integration-webhook-secret');
  if (webhookSecretInput) {
    webhookSecretInput.value = '';
    webhookSecretInput.placeholder = item.has_webhook_secret ? `مضبوط مسبقاً (${item.webhook_secret_masked}) - اتركه فارغاً للإبقاء عليه` : 'أدخل سر الـ Webhook';
  }

  // Populate extra settings
  const extra = item.extra_settings || {};
  const instanceInput = document.getElementById('extra-instance-id');
  if (instanceInput && extra.extra_instance_id) instanceInput.value = extra.extra_instance_id;

  const accountNoInput = document.getElementById('extra-account-no');
  if (accountNoInput && extra.extra_account_no) accountNoInput.value = extra.extra_account_no;

  const modelInput = document.getElementById('extra-model');
  if (modelInput && extra.extra_model) modelInput.value = extra.extra_model;

  const enabledCheck = document.getElementById('integration-is-enabled');
  if (enabledCheck) enabledCheck.checked = item.is_enabled;

  openModal('integration-modal');
}

async function saveIntegrationForm(testNow = false) {
  const id = document.getElementById('integration-id').value;
  const name = document.getElementById('integration-name').value.trim();
  const provider = (document.getElementById('integration-provider-select').value || 'custom').trim();
  const baseUrl = document.getElementById('integration-base-url').value.trim();
  const webhookUrl = document.getElementById('integration-webhook-url').value.trim();
  const apiKey = document.getElementById('integration-api-key').value.trim();
  const apiSecret = document.getElementById('integration-api-secret').value.trim();
  const accessToken = document.getElementById('integration-access-token').value.trim();
  const webhookSecret = document.getElementById('integration-webhook-secret').value.trim();
  const isEnabled = document.getElementById('integration-is-enabled').checked;

  // New integration requires at least API Key or URL or Name
  if (!id && !apiKey && !apiSecret && !accessToken && !baseUrl && !name) {
    showToast('يرجى إدخال مفتاح الـ API على الأقل', 'warning');
    return;
  }

  // Collect extra fields
  const extraSettings = {};
  const instanceEl = document.getElementById('extra-instance-id');
  if (instanceEl) extraSettings.extra_instance_id = instanceEl.value.trim();

  const accountEl = document.getElementById('extra-account-no');
  if (accountEl) extraSettings.extra_account_no = accountEl.value.trim();

  const pinEl = document.getElementById('extra-account-pin');
  if (pinEl && pinEl.value.trim()) extraSettings.extra_account_pin = pinEl.value.trim();

  const modelEl = document.getElementById('extra-model');
  if (modelEl) extraSettings.extra_model = modelEl.value.trim();

  const payload = {
    name,
    provider,
    base_url: baseUrl,
    webhook_url: webhookUrl,
    is_enabled: isEnabled,
    extra_settings: extraSettings,
    test_now: testNow
  };

  if (apiKey) payload.api_key = apiKey;
  if (apiSecret) payload.api_secret = apiSecret;
  if (accessToken) payload.access_token = accessToken;
  if (webhookSecret) payload.webhook_secret = webhookSecret;

  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/integrations/${id}` : '/api/integrations';

  const btn = testNow 
    ? document.getElementById('save-test-integration-btn') 
    : document.getElementById('save-integration-btn');

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${testNow ? 'جاري الفحص والحفظ...' : 'جاري الحفظ...'}`;
  }

  try {
    const res = await integrationFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();

    if (json.success) {
      showToast(json.message || 'تم حفظ التكامل بنجاح', 'success');
      closeModal('integration-modal');
      await loadIntegrations();

      if (testNow && json.data && json.data.last_test_result) {
        showTestResultAlert(json.data.last_test_result);
      }
    } else {
      showToast(json.error || 'فشل حفظ التكامل', 'error');
    }
  } catch (err) {
    console.error('Save integration error:', err);
    showToast('حدث خطأ في الاتصال بالخادم', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = testNow ? '<i class="fas fa-bolt"></i> حفظ وفحص الاتصال' : '<i class="fas fa-save"></i> حفظ الإعدادات';
    }
  }
}

async function testIntegrationConnection(id) {
  const btn = document.getElementById(`test-btn-${id}`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> فحص...';
  }

  try {
    const res = await integrationFetch(`/api/integrations/${id}/test`, {
      method: 'POST'
    });
    const json = await res.json();

    if (json.success && json.data && json.data.result) {
      const result = json.data.result;
      showTestResultAlert(result);
      await loadIntegrations();
    } else {
      showToast(json.error || 'تعذر استكمال فحص الاتصال', 'error');
    }
  } catch (err) {
    console.error('Test connection error:', err);
    showToast('حدث خطأ أثناء الاتصال بالخادم', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-vial"></i> فحص الاتصال';
    }
  }
}

async function toggleIntegrationStatus(id) {
  try {
    const res = await integrationFetch(`/api/integrations/${id}/toggle`, { method: 'PUT' });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      await loadIntegrations();
    } else {
      showToast(json.error || 'فشل تغيير الحالة', 'error');
    }
  } catch (err) {
    showToast('حدث خطأ في الاتصال', 'error');
  }
}

function confirmDeleteIntegration(id, name) {
  if (typeof showConfirmModal === 'function') {
    showConfirmModal(`هل أنت متأكد من حذف تكامل "${name}"؟ سيتم حذف بيانات الاعتماد المشفرة المرتبطة به.`, async () => {
      await deleteIntegration(id);
    });
  } else {
    if (confirm(`هل أنت متأكد من حذف تكامل "${name}"؟`)) {
      deleteIntegration(id);
    }
  }
}

async function deleteIntegration(id) {
  try {
    const res = await integrationFetch(`/api/integrations/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast(json.message || 'تم حذف التكامل', 'success');
      await loadIntegrations();
    } else {
      showToast(json.error || 'فشل الحذف', 'error');
    }
  } catch (err) {
    showToast('خطأ في الاتصال أثناء الحذف', 'error');
  }
}

function showTestResultAlert(result) {
  const isSuccess = result.success;
  const modalEl = document.getElementById('test-result-modal');
  if (!modalEl) {
    showToast(result.message, isSuccess ? 'success' : 'error');
    return;
  }

  const iconEl = document.getElementById('test-result-icon');
  const titleEl = document.getElementById('test-result-title');
  const msgEl = document.getElementById('test-result-msg');

  if (iconEl) {
    iconEl.className = isSuccess 
      ? 'fas fa-check-circle text-success fa-3x' 
      : 'fas fa-exclamation-triangle text-danger fa-3x';
  }
  if (titleEl) {
    titleEl.textContent = isSuccess ? 'نجح الاتصال بالخدمة!' : 'فشل فحص الاتصال';
    titleEl.style.color = isSuccess ? '#059669' : '#DC2626';
  }
  if (msgEl) {
    msgEl.textContent = result.message || '';
  }

  openModal('test-result-modal');
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
}
