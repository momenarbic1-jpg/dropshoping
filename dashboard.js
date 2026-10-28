/**
 * dashboard.js - Dashboard Page
 * Displays sales statistics, recent orders, and sales chart.
 */

let salesChartInstance = null;

async function loadDashboard() {
  try {
    const res = await api('GET', '/api/reports/dashboard');

    if (!res.success) {
      showToast(res.error || 'فشل تحميل بيانات لوحة التحكم', 'error');
      return;
    }

    const data = res.data || {};

    // 1. Update Stat Cards
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setVal('stat-total-sales', formatCurrency(data.total_sales || 0));
    setVal('stat-total-orders', (data.total_orders || 0).toLocaleString());
    setVal('stat-new-orders', (data.new_orders || 0).toLocaleString());
    setVal('stat-processing', (data.processing_orders || 0).toLocaleString());
    setVal('stat-completed', (data.completed_orders || 0).toLocaleString());
    setVal('stat-cancelled', (data.cancelled_orders || 0).toLocaleString());
    setVal('stat-net-profit', formatCurrency(data.net_profit || 0));

    // 2. Render Recent Orders
    renderRecentOrders(data.recent_orders || []);

    // 3. Render Sales Chart
    renderSalesChart(data.chart_data || []);
  } catch (err) {
    console.error('Dashboard load error:', err);
    showToast('حدث خطأ أثناء تحميل لوحة التحكم', 'error');
  }
}

function renderRecentOrders(orders) {
  const tbody = document.querySelector('#recent-orders-table tbody');
  if (!tbody) return;

  if (!orders || orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <i class="fas fa-inbox"></i>
          <p>لا توجد طلبات حديثة</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = orders.map(order => `
    <tr>
      <td><a href="#" onclick="navigate('orders'); return false;" class="text-primary fw-bold">${escapeHtml(order.order_number || ('ORD-' + order.id))}</a></td>
      <td>${escapeHtml(order.customer_name || '-')}</td>
      <td><strong>${formatCurrency(order.total_amount || order.items_total || 0)}</strong></td>
      <td><span class="status-badge ${getStatusClass(order.status)}">${getStatusLabel(order.status)}</span></td>
      <td>${formatDate(order.created_at)}</td>
    </tr>
  `).join('');
}

function renderSalesChart(chartData) {
  const canvas = document.getElementById('salesChart');
  if (!canvas) return;

  if (salesChartInstance) {
    salesChartInstance.destroy();
    salesChartInstance = null;
  }

  const arabicMonths = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  let labels = [];
  let values = [];

  if (chartData && chartData.length > 0) {
    labels = chartData.map(item => {
      const d = new Date(item.date);
      return d.getDate() + ' ' + (arabicMonths[d.getMonth()] || '');
    });
    values = chartData.map(item => parseFloat(item.revenue || item.amount) || 0);
  } else {
    // Show empty 7-day placeholder
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      labels.push(d.getDate() + ' ' + (arabicMonths[d.getMonth()] || ''));
      values.push(0);
    }
  }

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 280);
  gradient.addColorStop(0, 'rgba(37, 99, 235, 0.35)');
  gradient.addColorStop(1, 'rgba(37, 99, 235, 0.02)');

  salesChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'المبيعات اليومية',
        data: values,
        borderColor: '#2563EB',
        backgroundColor: gradient,
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#2563EB',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        borderWidth: 2.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'start',
          rtl: true,
          labels: {
            font: { family: 'Tajawal, sans-serif', size: 13, weight: '500' },
            boxWidth: 12,
            usePointStyle: true
          }
        },
        tooltip: {
          rtl: true,
          titleFont: { family: 'Tajawal, sans-serif' },
          bodyFont: { family: 'Tajawal, sans-serif' },
          callbacks: {
            label: function (ctx) {
              return ' المبيعات: ' + formatCurrency(ctx.parsed.y);
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: 'Tajawal, sans-serif', size: 12 }
          }
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
