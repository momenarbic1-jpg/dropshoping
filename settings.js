/**
 * settings.js - Settings Page
 * Store settings management, logo upload, and admin password change.
 */

async function loadSettings() {
  try {
    const res = await api('GET', '/api/settings');
    if (res.success && res.data) {
      const data = res.data;
      App.settings = data;

      const nameInput = document.getElementById('setting-store-name');
      const emailInput = document.getElementById('setting-store-email');
      const phoneInput = document.getElementById('setting-store-phone');

      if (nameInput) nameInput.value = data.store_name || '';
      if (emailInput) emailInput.value = data.contact_email || data.store_email || '';
      if (phoneInput) phoneInput.value = data.contact_phone || data.store_phone || '';

      // Shipping & Currency
      const feeInput = document.getElementById('setting-shipping-fee');
      if (feeInput) feeInput.value = data.shipping_fee || '25';
      const threshInput = document.getElementById('setting-free-shipping-threshold');
      if (threshInput) threshInput.value = data.free_shipping_threshold || '200';
      const currInput = document.getElementById('setting-currency');
      if (currInput) currInput.value = data.currency || 'ر.س';

      // Policies
      const aboutInput = document.getElementById('setting-policy-about');
      if (aboutInput) aboutInput.value = data.policy_about || '';
      const shipPolInput = document.getElementById('setting-policy-shipping');
      if (shipPolInput) shipPolInput.value = data.policy_shipping || '';
      const retPolInput = document.getElementById('setting-policy-returns');
      if (retPolInput) retPolInput.value = data.policy_returns || '';
      const privInput = document.getElementById('setting-policy-privacy');
      if (privInput) privInput.value = data.policy_privacy || '';

      // Social
      const waInput = document.getElementById('setting-social-whatsapp');
      if (waInput) waInput.value = data.social_whatsapp || '';
      const igInput = document.getElementById('setting-social-instagram');
      if (igInput) igInput.value = data.social_instagram || '';
      const ttInput = document.getElementById('setting-social-tiktok');
      if (ttInput) ttInput.value = data.social_tiktok || '';

      renderLogoPreview(data.store_logo);
    }
  } catch (err) {
    console.error('loadSettings error:', err);
    showToast('حدث خطأ أثناء تحميل الإعدادات', 'error');
  }
}

function renderLogoPreview(logoFilename) {
  const preview = document.getElementById('logo-preview');
  if (!preview) return;

  if (logoFilename) {
    const url = getProductImageUrl(logoFilename);
    preview.innerHTML = `
      <div class="logo-preview-box">
        <img src="${url}" alt="شعار المتجر" style="max-height: 80px; border-radius: 8px;">
        <span class="text-muted" style="display:block; font-size:12px; margin-top:4px;">الشعار الحالي</span>
      </div>
    `;
  } else {
    preview.innerHTML = '';
  }
}

async function saveStoreSettings(e) {
  if (e) e.preventDefault();

  const name = document.getElementById('setting-store-name').value.trim();
  const email = document.getElementById('setting-store-email').value.trim();
  const phone = document.getElementById('setting-store-phone').value.trim();
  const logoInput = document.getElementById('setting-store-logo');

  if (!name) {
    showToast('يرجى إدخال اسم المتجر', 'warning');
    return;
  }

  try {
    // 1. Update text settings
    const res = await api('PUT', '/api/settings', {
      store_name: name,
      contact_email: email,
      contact_phone: phone
    });

    if (res.success) {
      App.settings.store_name = name;
      document.querySelectorAll('.sidebar-store-name').forEach(el => el.textContent = name);

      // 2. Upload logo if selected
      if (logoInput && logoInput.files && logoInput.files.length > 0) {
        const formData = new FormData();
        formData.append('logo', logoInput.files[0]);

        const logoRes = await api('POST', '/api/settings/logo', formData, true);
        if (logoRes.success && logoRes.data && logoRes.data.logo) {
          renderLogoPreview(logoRes.data.logo);
        }
      }

      showToast('تم حفظ إعدادات المتجر بنجاح', 'success');
    } else {
      showToast(res.error || 'فشل حفظ الإعدادات', 'error');
    }
  } catch (err) {
    showToast('حدث خطأ أثناء حفظ الإعدادات', 'error');
  }
}

async function changePassword(e) {
  if (e) e.preventDefault();

  const oldPassword = document.getElementById('setting-old-password').value;
  const newPassword = document.getElementById('setting-new-password').value;
  const confirmPassword = document.getElementById('setting-confirm-password').value;

  if (!oldPassword || !newPassword) {
    showToast('يرجى ملء جميع حقول كلمة المرور', 'warning');
    return;
  }

  if (newPassword.length < 4) {
    showToast('كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل', 'warning');
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('كلمة المرور الجديدة وتأكيدها غير متطابقين', 'warning');
    return;
  }

  try {
    const res = await api('POST', '/api/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword
    });

    if (res.success) {
      showToast('تم تغيير كلمة المرور بنجاح', 'success');
      document.getElementById('setting-old-password').value = '';
      document.getElementById('setting-new-password').value = '';
      document.getElementById('setting-confirm-password').value = '';
    } else {
      showToast(res.error || 'فشل تغيير كلمة المرور', 'error');
    }
  } catch (err) {
    showToast('حدث خطأ أثناء تغيير كلمة المرور', 'error');
  }
}

async function saveShippingSettings(e) {
  if (e) e.preventDefault();
  const fee = document.getElementById('setting-shipping-fee').value.trim();
  const thresh = document.getElementById('setting-free-shipping-threshold').value.trim();
  const curr = document.getElementById('setting-currency').value.trim();

  try {
    const res = await api('PUT', '/api/settings', {
      shipping_fee: fee,
      free_shipping_threshold: thresh,
      currency: curr || 'ر.س'
    });
    if (res.success) {
      showToast('تم حفظ إعدادات الشحن بنجاح', 'success');
    } else {
      showToast(res.error || 'فشل حفظ الإعدادات', 'error');
    }
  } catch (err) {
    showToast('خطأ أثناء حفظ إعدادات الشحن', 'error');
  }
}

async function savePoliciesSettings(e) {
  if (e) e.preventDefault();
  const about = document.getElementById('setting-policy-about').value.trim();
  const shipping = document.getElementById('setting-policy-shipping').value.trim();
  const returns = document.getElementById('setting-policy-returns').value.trim();
  const privacy = document.getElementById('setting-policy-privacy').value.trim();

  try {
    const res = await api('PUT', '/api/settings', {
      policy_about: about,
      policy_shipping: shipping,
      policy_returns: returns,
      policy_privacy: privacy
    });
    if (res.success) {
      showToast('تم حفظ سياسات المتجر بنجاح', 'success');
    } else {
      showToast(res.error || 'فشل حفظ السياسات', 'error');
    }
  } catch (err) {
    showToast('خطأ أثناء حفظ السياسات', 'error');
  }
}

async function saveSocialSettings(e) {
  if (e) e.preventDefault();
  const wa = document.getElementById('setting-social-whatsapp').value.trim();
  const ig = document.getElementById('setting-social-instagram').value.trim();
  const tt = document.getElementById('setting-social-tiktok').value.trim();

  try {
    const res = await api('PUT', '/api/settings', {
      social_whatsapp: wa,
      social_instagram: ig,
      social_tiktok: tt
    });
    if (res.success) {
      showToast('تم حفظ روابط التواصل بنجاح', 'success');
    } else {
      showToast(res.error || 'فشل حفظ الروابط', 'error');
    }
  } catch (err) {
    showToast('خطأ أثناء حفظ الروابط', 'error');
  }
}

// ========================
// Event Listeners
// ========================

document.addEventListener('DOMContentLoaded', function () {
  const storeForm = document.getElementById('store-settings-form');
  if (storeForm) storeForm.addEventListener('submit', saveStoreSettings);

  const shippingForm = document.getElementById('shipping-settings-form');
  if (shippingForm) shippingForm.addEventListener('submit', saveShippingSettings);

  const policiesForm = document.getElementById('policies-settings-form');
  if (policiesForm) policiesForm.addEventListener('submit', savePoliciesSettings);

  const socialForm = document.getElementById('social-settings-form');
  if (socialForm) socialForm.addEventListener('submit', saveSocialSettings);

  const accountForm = document.getElementById('account-settings-form');
  if (accountForm) accountForm.addEventListener('submit', changePassword);

  // Logo file upload area click
  const logoArea = document.getElementById('logo-upload-area');
  const logoInput = document.getElementById('setting-store-logo');

  if (logoArea && logoInput) {
    logoArea.addEventListener('click', function (e) {
      if (e.target !== logoInput) logoInput.click();
    });

    logoInput.addEventListener('change', function () {
      if (this.files && this.files[0]) {
        const file = this.files[0];
        const reader = new FileReader();
        reader.onload = function (e) {
          const preview = document.getElementById('logo-preview');
          if (preview) {
            preview.innerHTML = `
              <div class="logo-preview-box">
                <img src="${e.target.result}" alt="معاينة الشعار" style="max-height: 80px; border-radius: 8px;">
                <span class="text-muted" style="display:block; font-size:12px; margin-top:4px;">معاينة (اضغط حفظ للتطبيق)</span>
              </div>
            `;
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }
});
