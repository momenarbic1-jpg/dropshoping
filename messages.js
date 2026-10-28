/**
 * messages.js - Contact Messages Script
 * View and manage customer inquiries submitted via public contact form.
 */

async function initMessages() {
  await loadMessages();
}

async function loadMessages() {
  const container = document.getElementById('messages-list-container');
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state-card" style="padding:40px; text-align:center;">
      <i class="fas fa-spinner fa-spin fa-2x text-primary" style="margin-bottom:8px; display:block;"></i>
      <p>جاري تحميل رسائل التواصل...</p>
    </div>
  `;

  try {
    const res = await fetch('/api/messages');
    const json = await res.json();

    if (json.success) {
      renderMessagesList(json.data || []);
    } else {
      container.innerHTML = `<div class="empty-state-card text-danger">${escapeHtml(json.error || 'خطأ في التحميل')}</div>`;
    }
  } catch (err) {
    console.error('Error loading messages:', err);
    container.innerHTML = '<div class="empty-state-card text-danger">حدث خطأ في الاتصال بالخادم</div>';
  }
}

function renderMessagesList(messages) {
  const container = document.getElementById('messages-list-container');
  if (!container) return;

  if (messages.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card" style="padding:60px 20px; text-align:center;">
        <i class="fas fa-inbox fa-3x text-muted" style="margin-bottom:12px; display:block;"></i>
        <h4 style="color:#475569;">لا توجد رسائل جديدة</h4>
        <p style="color:#94A3B8; font-size:14px;">أي رسالة يرسلها الزوار من نموذج "اتصل بنا" في المتجر ستظهر هنا فوراً.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = messages.map(m => `
    <div class="card" style="margin-bottom:14px; border-right: 4px solid ${m.is_read ? '#94A3B8' : '#2563EB'};">
      <div class="card-body" style="padding:16px 20px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
          <div>
            <h4 style="margin:0 0 4px; font-size:16px; font-weight:700; color:#1E293B;">
              ${escapeHtml(m.name)}
              ${!m.is_read ? '<span class="badge" style="background:#EFF6FF; color:#2563EB; font-size:11px; margin-right:6px;">جديدة</span>' : ''}
            </h4>
            <div style="font-size:13px; color:#64748B; display:flex; gap:16px; flex-wrap:wrap;">
              ${m.phone ? `<span><i class="fas fa-phone text-primary"></i> <a href="tel:${escapeHtml(m.phone)}" dir="ltr">${escapeHtml(m.phone)}</a></span>` : ''}
              ${m.email ? `<span><i class="fas fa-envelope text-primary"></i> <a href="mailto:${escapeHtml(m.email)}">${escapeHtml(m.email)}</a></span>` : ''}
              <span><i class="fas fa-clock text-muted"></i> ${formatDate(m.created_at)}</span>
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn btn-sm btn-outline-primary" onclick="toggleMessageRead(${m.id})">
              <i class="fas ${m.is_read ? 'fa-envelope' : 'fa-envelope-open'}"></i>
              ${m.is_read ? 'تحديد كغير مقروءة' : 'تحديد كمقروءة'}
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteMessage(${m.id})">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div style="background:#F8FAFC; border-radius:8px; padding:12px 14px; font-size:14px; color:#334155; line-height:1.6; white-space:pre-wrap;">${escapeHtml(m.message)}</div>
      </div>
    </div>
  `).join('');
}

async function toggleMessageRead(id) {
  try {
    const res = await fetch(`/api/messages/${id}/read`, { method: 'PUT' });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      await loadMessages();
    }
  } catch (err) {
    showToast('خطأ في الاتصال', 'error');
  }
}

async function deleteMessage(id) {
  if (confirm('هل أنت متأكد من حذف هذه الرسالة؟')) {
    try {
      const res = await fetch(`/api/messages/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast(json.message, 'success');
        await loadMessages();
      }
    } catch (err) {
      showToast('خطأ في الاتصال', 'error');
    }
  }
}
