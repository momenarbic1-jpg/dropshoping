/**
 * reports.js - Reports Page
 * Daily, weekly, and monthly reports, revenue, product costs,
 * shipping costs, net profit, status breakdown, and sales chart.
 */

const ReportsState = {
  period: 'daily',
  startDate: '',
  endDate: '',
  productId: ''
};

let reportsChartInstance = null;

async function loadReports() {
  // Set default dates: last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const formatD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  if (!ReportsState.startDate) ReportsState.startDate = formatD(thirtyDaysAgo);
  if (!ReportsState.endDate) ReportsState.endDate = formatD(today);

  const fromInput = document.getElementById('report-date-from');
  const toInput = document.getElementById('report-date-to');
  if (fromInput && !fromInput.value) fromInput.value = ReportsState.startDate;
  if (toInput && !toInput.value) toInput.value = ReportsState.endDate;

  // Load products filter dropdown
  await loadReportsProductDropdown();

  // Load report data
  await fetchAndRenderReports();
}

async function loadReportsProductDropdown() {
  const select = document.getElementById('filter-report-product');
  if (!select) return;

  try {
    const res = await api('GET', '/api/products');
    if (res.success && res.data) {
      const cur = select.value;
      select.innerHTML = '<option value="">جميع المنتجات</option>' +
        res.data.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
      select.value = cur;
    }
  } catch (_) {}
}

async function fetchAndRenderReports() {
  const fromInput = document.getElementById('report-date-from');
  const toInput = document.getElementById('report-date-to');
  const productSelect = document.getElementById('filter-report-product');

  const startDate = fromInput ? fromInput.value : ReportsState.startDate;
  const endDate = toInput ? toInput.value : ReportsState.endDate;
  const productId = productSelect ? productSelect.value : '';

  const params = new URLSearchParams();
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  if (productId) params.set('product_id', productId);

  // Period for chart/sales: map 'daily' -> 'day', 'weekly' -> 'week', 'monthly' -> 'month'
  let periodParam = 'day';
  if (ReportsState.period === 'weekly') periodParam = 'week';
  if (ReportsState.period === 'monthly') periodParam = 'month';
  params.set('period', periodParam);

  try {
    const [summaryRes, salesRes] = await Promise.all([
      api('GET', '/api/reports/summary?' + params.toString()),
      api('GET', '/api/reports/sales?' + params.toString())
    ]);

    if (summaryRes.success && summaryRes.data) {
      renderSummaryCards(summaryRes.data);
      renderStatusBreakdown(summaryRes.data.order_counts || {});
    }

    if (salesRes.success && salesRes.data) {
      renderReportsChart(salesRes.data);
      renderReportsTable(salesRes.data);
    }
  } catch (err) {
    console.error('fetchAndRenderReports error:', err);
    showToast('حدث خطأ أثناء إعداد التقرير', 'error');
  }
}

function renderSummaryCards(data) {
  const rev = data.total_revenue !== undefined ? data.total_revenue : data.revenue;
  const cost = data.total_cost !== undefined ? data.total_cost : data.cost;
  const shipping = data.shipping_and_fees !== undefined ? data.shipping_and_fees : (data.total_shipping || 0);
  const profit = data.net_profit !== undefined ? data.net_profit : data.profit;

  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatCurrency(val || 0);
  };

  setEl('report-revenue', rev);
  setEl('report-product-cost', cost);
  setEl('report-shipping-cost', shipping);
  setEl('report-net-profit', profit);
}

function renderStatusBreakdown(counts) {
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = (val || 0).toLocaleString();
  };

  setEl('breakdown-new', counts.new);
  setEl('breakdown-confirming', counts.confirming);
  setEl('breakdown-processing', counts.processing);
  setEl('breakdown-shipped', counts.shipped);
  setEl('breakdown-delivered', counts.delivered);
  setEl('breakdown-cancelled', counts.cancelled);
  setEl('breakdown-returned', counts.returned);
}

function renderReportsChart(data) {
  const canvas = document.getElementById('reportsChart');
  if (!canvas) return;

  if (reportsChartInstance) {
    reportsChartInstance.destroy();
    reportsChartInstance = null;
  }

  const labels = (data || []).map(d => d.date);
  const revenues = (data || []).map(d => parseFloat(d.revenue) || 0);
  const profits = (data || []).map(d => parseFloat(d.profit) || 0);

  const ctx = canvas.getContext('2d');
  reportsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length > 0 ? labels : ['لا توجد بيانات'],
      datasets: [
        {
          label: 'الإيرادات',
          data: revenues.length > 0 ? revenues : [0],
          backgroundColor: '#2563EB',
          borderRadius: 6
        },
        {
          label: 'صافي الربح',
          data: profits.length > 0 ? profits : [0],
          backgroundColor: '#10B981',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          rtl: true,
          labels: {
            font: { family: 'Tajawal, sans-serif', size: 13, weight: '500' },
            boxWidth: 12,
            usePointStyle: true
          }
        },
        tooltip: {
          rtl: true,
          callbacks: {
            label: function (ctx) {
              return ' ' + ctx.dataset.label + ': ' + formatCurrency(ctx.parsed.y);
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'Tajawal, sans-serif', size: 12 } }
        },
        y: {
          position: 'right',
          beginAtZero: true,
          grid: { color: '#F1F5F9' },
          ticks: {
            font: { family: 'Tajawal, sans-serif', size: 12 },
            callback: function (val) {
              const curr = (App.settings && App.settings.currency) || 'ج.م';
              return val.toLocaleString() + ' ' + curr;
            }
          }
        }
      }
    }
  });
}

function renderReportsTable(data) {
  const tbody = document.querySelector('#report-results-table tbody');
  if (!tbody) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <i class="fas fa-chart-bar"></i>
          <p>لا توجد بيانات للفترة المحددة</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = data.map(row => `
    <tr>
      <td><strong>${escapeHtml(row.date)}</strong></td>
      <td>${(row.order_count || 0).toLocaleString()}</td>
      <td><strong>${formatCurrency(row.revenue)}</strong></td>
      <td>${formatCurrency(row.cost)}</td>
      <td class="${(parseFloat(row.profit) || 0) >= 0 ? 'text-success' : 'text-danger'} fw-bold">${formatCurrency(row.profit)}</td>
    </tr>
  `).join('');
}

// ========================
// Event Listeners
// ========================

document.addEventListener('DOMContentLoaded', function () {
  // Period Tabs
  document.querySelectorAll('.period-tab').forEach(tab => {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      ReportsState.period = this.getAttribute('data-period') || 'daily';
      fetchAndRenderReports();
    });
  });

  // Filter button
  const filterBtn = document.getElementById('generate-report-btn');
  if (filterBtn) filterBtn.addEventListener('click', fetchAndRenderReports);

  const dateFrom = document.getElementById('report-date-from');
  const dateTo = document.getElementById('report-date-to');
  const prodSelect = document.getElementById('filter-report-product');

  if (dateFrom) dateFrom.addEventListener('change', fetchAndRenderReports);
  if (dateTo) dateTo.addEventListener('change', fetchAndRenderReports);
  if (prodSelect) prodSelect.addEventListener('change', fetchAndRenderReports);
});
