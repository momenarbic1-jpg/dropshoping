/**
 * store.js - Complete Customer Storefront Controller
 * Handles product browsing, filters, sorting, product details gallery,
 * slide-out cart drawer, COD checkout, order tracking, and contact form.
 */

const StoreState = {
  storeInfo: {
    store_name: 'متجر دروب شيبنج',
    currency: 'ج.م',
    shipping_fee: 50,
    free_shipping_threshold: 500,
    policies: {}
  },
  products: [],
  categories: [],
  activeCategory: '',
  specialFilter: '', // 'featured' | 'discount' | ''
  searchQuery: '',
  sortBy: 'newest',
  selectedProduct: null,
  detailQty: 1,
  cart: [] // [{ product_id, name, price, compare_price, image, quantity, stock }]
};

function storeFetch(url, options = {}) {
  const baseUrl = (window.APP_BACKEND_URL || '').replace(/\/$/, '');
  const fullUrl = url.startsWith('http') ? url : (baseUrl + url);
  if (baseUrl && !options.credentials) {
    options.credentials = 'include';
  }
  return fetch(fullUrl, options);
}

// ─── Initialize ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
  loadCartFromStorage();
  initStorefront();
  setupStoreEvents();
});

async function initStorefront() {
  await Promise.all([
    loadStoreInfo(),
    loadCategories(),
    loadProducts()
  ]);
  updateCartUI();
}

// ─── Store Info & Policies ──────────────────────────────────────────────────

async function loadStoreInfo() {
  try {
    const res = await storeFetch('/api/public/store-info');
    const json = await res.json();
    if (json.success && json.data) {
      StoreState.storeInfo = json.data;
      const info = json.data;

      if (info.store_name) {
        document.title = info.store_name;
        const brandText = document.getElementById('store-name-text');
        if (brandText) brandText.textContent = info.store_name;
        const footerBrand = document.getElementById('footer-brand');
        if (footerBrand) footerBrand.textContent = info.store_name;
        const footerName = document.getElementById('footer-store-name');
        if (footerName) footerName.textContent = `جميع الحقوق محفوظة © ${info.store_name}`;
      }

      if (info.store_description) {
        const descEl = document.getElementById('footer-desc');
        if (descEl) descEl.textContent = info.store_description;
      }

      if (info.banner_title) {
        const titleEl = document.getElementById('hero-title');
        if (titleEl) titleEl.textContent = info.banner_title;
      }

      if (info.banner_subtitle) {
        const subEl = document.getElementById('hero-subtitle');
        if (subEl) subEl.textContent = info.banner_subtitle;
      }

      if (info.store_logo) {
        const logoBox = document.getElementById('store-logo-box');
        if (logoBox) {
          logoBox.innerHTML = `<img src="${getImgUrl(info.store_logo)}" alt="شعار المتجر" style="max-width:100%; max-height:100%; border-radius:8px;">`;
        }
      }

      // Social Links
      renderSocialLinks(info.social);
    }
  } catch (err) {
    console.error('Error loading store info:', err);
  }
}

function renderSocialLinks(social) {
  const container = document.getElementById('footer-social-links');
  if (!container || !social) return;

  let html = '';
  if (social.whatsapp) {
    const waUrl = social.whatsapp.startsWith('http') ? social.whatsapp : `https://wa.me/${social.whatsapp.replace(/[^0-9]/g, '')}`;
    html += `<a href="${waUrl}" target="_blank" style="color:#10B981;" title="واتساب"><i class="fab fa-whatsapp"></i></a>`;
  }
  if (social.instagram) {
    html += `<a href="${social.instagram}" target="_blank" style="color:#E1306C;" title="انستقرام"><i class="fab fa-instagram"></i></a>`;
  }
  if (social.tiktok) {
    html += `<a href="${social.tiktok}" target="_blank" style="color:#000000;" title="تيك توك"><i class="fab fa-tiktok"></i></a>`;
  }
  container.innerHTML = html;
}

// ─── Categories ─────────────────────────────────────────────────────────────

async function loadCategories() {
  const container = document.getElementById('customer-categories-container');
  if (!container) return;

  try {
    const res = await storeFetch('/api/public/categories');
    const json = await res.json();
    if (json.success && json.data) {
      StoreState.categories = json.data;

      container.innerHTML = `
        <button class="store-cat-pill active" data-cat="">جميع المنتجات</button>
        <button class="store-cat-pill" data-special="featured"><i class="fas fa-star text-warning"></i> المميزة</button>
        <button class="store-cat-pill" data-special="discount"><i class="fas fa-fire text-danger"></i> العروض والتخفيضات</button>
      ` + json.data.map(c => `
        <button class="store-cat-pill" data-cat="${c.id}">${escapeHtml(c.name)}</button>
      `).join('');

      container.querySelectorAll('.store-cat-pill').forEach(btn => {
        btn.addEventListener('click', function () {
          container.querySelectorAll('.store-cat-pill').forEach(b => b.classList.remove('active'));
          this.classList.add('active');

          const special = this.getAttribute('data-special');
          if (special) {
            StoreState.specialFilter = special;
            StoreState.activeCategory = '';
          } else {
            StoreState.specialFilter = '';
            StoreState.activeCategory = this.getAttribute('data-cat') || '';
          }
          loadProducts();
        });
      });
    }
  } catch (err) {
    console.error('Error loading categories:', err);
  }
}

// ─── Products ───────────────────────────────────────────────────────────────

async function loadProducts() {
  const container = document.getElementById('customer-products-container');
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state-card" style="grid-column: 1 / -1; padding: 60px 20px; text-align: center;">
      <i class="fas fa-spinner fa-spin fa-2x text-primary" style="margin-bottom: 12px; display:block;"></i>
      <p>جاري تحميل المنتجات...</p>
    </div>
  `;

  try {
    const params = new URLSearchParams();
    if (StoreState.activeCategory) params.set('category_id', StoreState.activeCategory);
    if (StoreState.searchQuery) params.set('search', StoreState.searchQuery);
    if (StoreState.specialFilter === 'featured') params.set('featured', '1');
    if (StoreState.specialFilter === 'discount') params.set('has_discount', '1');
    if (StoreState.sortBy) params.set('sort', StoreState.sortBy);

    const res = await storeFetch('/api/public/products?' + params.toString());
    const json = await res.json();

    if (json.success) {
      StoreState.products = json.data || [];
      renderProducts();
    } else {
      container.innerHTML = `<div class="empty-state-card" style="grid-column:1/-1;"><p>${escapeHtml(json.error || 'تعذر جلب المنتجات')}</p></div>`;
    }
  } catch (err) {
    console.error('Error loading products:', err);
    container.innerHTML = `<div class="empty-state-card" style="grid-column:1/-1;"><p>تعذر الاتصال بالخادم</p></div>`;
  }
}

function renderProducts() {
  const container = document.getElementById('customer-products-container');
  if (!container) return;

  const prods = StoreState.products;
  if (!prods || prods.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card" style="grid-column: 1 / -1; padding: 60px 20px; text-align: center;">
        <i class="fas fa-box-open fa-3x" style="color:#94A3B8; margin-bottom: 14px; display:block;"></i>
        <h3 style="font-size:18px; color:#475569; margin-bottom:6px;">لا توجد منتجات مطابقة</h3>
        <p style="color:#94A3B8; font-size:14px;">جرب تغيير كلمة البحث أو التصنيف</p>
      </div>
    `;
    return;
  }

  container.innerHTML = prods.map(p => {
    const images = Array.isArray(p.images) ? p.images : [];
    const firstImg = images.length > 0 ? getImgUrl(images[0]) : '';
    const hasDiscount = p.compare_price && p.compare_price > p.sale_price;
    const discountPercent = hasDiscount ? Math.round(((p.compare_price - p.sale_price) / p.compare_price) * 100) : 0;
    const isOutOfStock = p.stock_quantity !== undefined && p.stock_quantity !== null && p.stock_quantity <= 0;

    return `
      <div class="store-card">
        <div class="store-card-img-wrapper" onclick="openProductDetails(${p.id})">
          ${firstImg ? `<img src="${firstImg}" alt="${escapeHtml(p.name)}" class="store-card-img">` : `<div class="store-card-img-placeholder"><i class="fas fa-box"></i></div>`}

          ${p.category_name ? `<span class="store-card-badge">${escapeHtml(p.category_name)}</span>` : ''}

          ${hasDiscount ? `<span style="position:absolute; top:10px; left:10px; background:#EF4444; color:#FFF; font-size:11px; font-weight:800; padding:4px 8px; border-radius:6px;"><i class="fas fa-tag"></i> خصم ${discountPercent}%</span>` : ''}

          ${p.is_featured ? `<span style="position:absolute; bottom:10px; right:10px; background:#F59E0B; color:#FFF; font-size:11px; font-weight:800; padding:3px 8px; border-radius:6px;"><i class="fas fa-star"></i> مميز</span>` : ''}

          ${isOutOfStock ? `<div style="position:absolute; inset:0; background:rgba(15,23,42,0.6); display:flex; align-items:center; justify-content:center; color:#FFF; font-weight:900; font-size:16px;">نفدت الكمية</div>` : ''}
        </div>

        <div class="store-card-body">
          <h3 class="store-card-title" onclick="openProductDetails(${p.id})">
            ${escapeHtml(p.name)}
          </h3>

          <p class="store-card-desc">
            ${escapeHtml(p.description || 'منتج عالي الجودة مع شحن سريع والدفع عند الاستلام.')}
          </p>

          <div style="margin-top:auto; padding-top:10px; border-top:1px solid #F1F5F9;">
            <div style="display:flex; align-items:baseline; gap:8px; margin-bottom:12px;">
              <span style="font-size:18px; font-weight:900; color:#2563EB;">${formatCurr(p.sale_price)}</span>
              ${hasDiscount ? `<span style="font-size:13px; color:#94A3B8; text-decoration:line-through;">${formatCurr(p.compare_price)}</span>` : ''}
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
              <button type="button" class="btn btn-sm btn-outline-primary" onclick="quickAddToCart(${p.id})" ${isOutOfStock ? 'disabled' : ''} style="padding:8px; font-weight:700;">
                <i class="fas fa-cart-plus"></i> للسلة
              </button>
              <button type="button" class="btn btn-sm btn-primary" onclick="quickBuyNow(${p.id})" ${isOutOfStock ? 'disabled' : ''} style="padding:8px; font-weight:800;">
                <i class="fas fa-bolt"></i> اطلب الآن
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ─── Product Details Modal ──────────────────────────────────────────────────

async function openProductDetails(id) {
  try {
    const res = await storeFetch(`/api/public/products/${id}`);
    const json = await res.json();
    if (!json.success || !json.data) return;

    const p = json.data;
    StoreState.selectedProduct = p;
    StoreState.detailQty = 1;

    document.getElementById('pdetail-title').textContent = p.name;
    document.getElementById('pdetail-desc').textContent = p.description || 'لا يوجد وصف مضاف لهذا المنتج.';

    const catBadge = document.getElementById('pdetail-category-badge');
    if (catBadge) {
      catBadge.textContent = p.category_name || 'عام';
      catBadge.style.display = p.category_name ? 'inline-block' : 'none';
    }

    document.getElementById('pdetail-sale-price').textContent = formatCurr(p.sale_price);

    const comparePriceEl = document.getElementById('pdetail-compare-price');
    const discountTagEl = document.getElementById('pdetail-discount-tag');
    if (p.compare_price && p.compare_price > p.sale_price) {
      comparePriceEl.textContent = formatCurr(p.compare_price);
      comparePriceEl.style.display = 'inline-block';
      const pct = Math.round(((p.compare_price - p.sale_price) / p.compare_price) * 100);
      discountTagEl.textContent = `خصم ${pct}%`;
      discountTagEl.style.display = 'inline-block';
    } else {
      comparePriceEl.style.display = 'none';
      discountTagEl.style.display = 'none';
    }

    // Stock Status
    const stockEl = document.getElementById('pdetail-stock-status');
    const isOut = p.stock_quantity !== undefined && p.stock_quantity !== null && p.stock_quantity <= 0;
    if (isOut) {
      stockEl.innerHTML = '<span style="color:#DC2626;"><i class="fas fa-circle-xmark"></i> نعتذر، نفدت الكمية من هذا المنتج حالياً</span>';
    } else if (p.stock_quantity && p.stock_quantity <= 5) {
      stockEl.innerHTML = `<span style="color:#D97706;"><i class="fas fa-triangle-exclamation"></i> متبقي ${p.stock_quantity} قطع فقط في المخزون!</span>`;
    } else {
      stockEl.innerHTML = '<span style="color:#059669;"><i class="fas fa-circle-check"></i> متوفر في المخزون - جاهز للشحن الفوري</span>';
    }

    // Gallery Main Image & Thumbnails
    const images = Array.isArray(p.images) ? p.images : [];
    const mainImg = document.getElementById('pdetail-main-img');
    const thumbs = document.getElementById('pdetail-thumbnails');
    thumbs.innerHTML = '';

    if (images.length > 0) {
      mainImg.src = getImgUrl(images[0]);
      images.forEach((img, idx) => {
        const thumbDiv = document.createElement('div');
        thumbDiv.style.cssText = 'width:60px; height:60px; border-radius:8px; border:2px solid ' + (idx === 0 ? '#2563EB' : '#E2E8F0') + '; overflow:hidden; cursor:pointer; flex-shrink:0;';
        thumbDiv.innerHTML = `<img src="${getImgUrl(img)}" style="width:100%; height:100%; object-fit:cover;">`;
        thumbDiv.addEventListener('click', function () {
          mainImg.src = getImgUrl(img);
          thumbs.querySelectorAll('div').forEach(d => d.style.borderColor = '#E2E8F0');
          thumbDiv.style.borderColor = '#2563EB';
        });
        thumbs.appendChild(thumbDiv);
      });
    } else {
      mainImg.src = '';
    }

    // Specifications
    const specsBox = document.getElementById('pdetail-specs-box');
    const specsText = document.getElementById('pdetail-specs-text');
    if (p.specifications && p.specifications.trim()) {
      specsText.textContent = p.specifications;
      specsBox.style.display = 'block';
    } else {
      specsBox.style.display = 'none';
    }

    // Related Products
    const relatedSection = document.getElementById('pdetail-related-section');
    const relatedGrid = document.getElementById('pdetail-related-grid');
    if (p.related_products && p.related_products.length > 0) {
      relatedSection.style.display = 'block';
      relatedGrid.innerHTML = p.related_products.map(r => `
        <div style="background:#FFF; border:1px solid #E2E8F0; border-radius:8px; padding:10px; cursor:pointer;" onclick="openProductDetails(${r.id})">
          <div style="height:100px; border-radius:6px; overflow:hidden; background:#F8FAFC; margin-bottom:8px;">
            ${r.images && r.images.length > 0 ? `<img src="${getImgUrl(r.images[0])}" style="width:100%; height:100%; object-fit:cover;">` : ''}
          </div>
          <div style="font-weight:700; font-size:12px; color:#1E293B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(r.name)}</div>
          <div style="font-weight:800; font-size:13px; color:#2563EB; margin-top:4px;">${formatCurr(r.sale_price)}</div>
        </div>
      `).join('');
    } else {
      relatedSection.style.display = 'none';
    }

    document.getElementById('pdetail-qty').textContent = '1';
    openModal('product-details-modal');
  } catch (err) {
    console.error('Error fetching details:', err);
  }
}

function adjustDetailQty(delta) {
  const current = StoreState.detailQty;
  const next = current + delta;
  if (next >= 1) {
    StoreState.detailQty = next;
    document.getElementById('pdetail-qty').textContent = next;
  }
}

function addDetailToCart() {
  if (!StoreState.selectedProduct) return;
  addToCart(StoreState.selectedProduct, StoreState.detailQty);
  closeModal('product-details-modal');
  openCartDrawer();
}

function buyNowFromDetail() {
  if (!StoreState.selectedProduct) return;
  closeModal('product-details-modal');
  openCheckoutWithSingle(StoreState.selectedProduct, StoreState.detailQty);
}

// ─── Shopping Cart ──────────────────────────────────────────────────────────

function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem('dropshipping_cart');
    if (raw) StoreState.cart = JSON.parse(raw);
  } catch (e) {
    StoreState.cart = [];
  }
}

function saveCartToStorage() {
  try {
    localStorage.setItem('dropshipping_cart', JSON.stringify(StoreState.cart));
  } catch (e) {}
}

function addToCart(product, qty = 1) {
  const existing = StoreState.cart.find(item => item.product_id === product.id);
  const images = Array.isArray(product.images) ? product.images : [];
  const imgUrl = images.length > 0 ? getImgUrl(images[0]) : '';

  if (existing) {
    existing.quantity += qty;
  } else {
    StoreState.cart.push({
      product_id: product.id,
      name: product.name,
      price: parseFloat(product.sale_price) || 0,
      compare_price: parseFloat(product.compare_price) || 0,
      image: imgUrl,
      quantity: qty,
      stock: product.stock_quantity
    });
  }

  saveCartToStorage();
  updateCartUI();
  showToast(`تمت إضافة "${product.name}" إلى السلة`, 'success');
}

function quickAddToCart(productId) {
  const p = StoreState.products.find(x => x.id === productId);
  if (p) addToCart(p, 1);
}

function updateCartItemQty(productId, delta) {
  const item = StoreState.cart.find(x => x.product_id === productId);
  if (!item) return;

  const next = item.quantity + delta;
  if (next <= 0) {
    removeFromCart(productId);
  } else {
    item.quantity = next;
    saveCartToStorage();
    updateCartUI();
  }
}

function removeFromCart(productId) {
  StoreState.cart = StoreState.cart.filter(x => x.product_id !== productId);
  saveCartToStorage();
  updateCartUI();
}

function updateCartUI() {
  const cart = StoreState.cart;
  const count = cart.reduce((sum, i) => sum + i.quantity, 0);

  // Update header badge
  const badge = document.getElementById('cart-count-badge');
  if (badge) badge.textContent = count;

  const bottomBadge = document.getElementById('bottom-cart-count');
  if (bottomBadge) bottomBadge.textContent = count;

  const drawerCount = document.getElementById('cart-drawer-items-count');
  if (drawerCount) drawerCount.textContent = count;

  // Render items in drawer
  const container = document.getElementById('cart-items-container');
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:50px 10px;">
        <i class="fas fa-cart-shopping fa-3x" style="color:#CBD5E1; margin-bottom:14px; display:block;"></i>
        <h4 style="color:#475569; font-size:16px;">سلة المشتريات فارغة</h4>
        <p style="color:#94A3B8; font-size:13px;">تصفح المنتجات وأضف ما يعجبك إلى سلتك</p>
      </div>
    `;
    updateCartTotals(0);
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item-card">
      <img src="${item.image || ''}" alt="${escapeHtml(item.name)}" class="cart-item-img">
      <div class="cart-item-details">
        <div class="cart-item-name">${escapeHtml(item.name)}</div>
        <div class="cart-item-price">${formatCurr(item.price)}</div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div class="order-qty-stepper" style="margin:0;">
            <button type="button" class="stepper-btn" onclick="updateCartItemQty(${item.product_id}, -1)">-</button>
            <span class="stepper-value">${item.quantity}</span>
            <button type="button" class="stepper-btn" onclick="updateCartItemQty(${item.product_id}, 1)">+</button>
          </div>
          <button type="button" onclick="removeFromCart(${item.product_id})" style="background:none; border:none; color:#EF4444; font-size:13px; cursor:pointer;" title="حذف">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  const subtotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  updateCartTotals(subtotal);
}

function updateCartTotals(subtotal) {
  const info = StoreState.storeInfo;
  const threshold = parseFloat(info.free_shipping_threshold) || 200;
  const baseShipping = parseFloat(info.shipping_fee) || 25;
  const isFreeShipping = subtotal >= threshold && subtotal > 0;
  const shippingCost = subtotal === 0 ? 0 : (isFreeShipping ? 0 : baseShipping);
  const grandTotal = subtotal + shippingCost;

  // Free shipping banner progress
  const msgEl = document.getElementById('free-shipping-msg');
  const barEl = document.getElementById('free-shipping-bar');
  const curr = (StoreState.storeInfo && StoreState.storeInfo.currency) || 'ج.م';
  if (msgEl && barEl) {
    if (subtotal === 0) {
      msgEl.innerHTML = `<i class="fas fa-gift"></i> شحن مجاني للطلبات بقيمة ${threshold} ${curr} وأكثر!`;
      barEl.style.width = '0%';
    } else if (isFreeShipping) {
      msgEl.innerHTML = `<i class="fas fa-circle-check" style="color:#059669;"></i> تهانينا! حصلت على شحن مجاني لكامل الطلب`;
      barEl.style.width = '100%';
      barEl.style.background = '#10B981';
    } else {
      const remaining = (threshold - subtotal).toFixed(2);
      const pct = Math.min(Math.round((subtotal / threshold) * 100), 100);
      msgEl.innerHTML = `<i class="fas fa-truck-fast"></i> أضف <strong style="color:#2563EB;">${remaining} ${curr}</strong> إضافية للحصول على شحن مجاني!`;
      barEl.style.width = pct + '%';
      barEl.style.background = '#2563EB';
    }
  }

  const subtotalEl = document.getElementById('cart-subtotal-val');
  if (subtotalEl) subtotalEl.textContent = formatCurr(subtotal);

  const shippingEl = document.getElementById('cart-shipping-val');
  if (shippingEl) shippingEl.textContent = isFreeShipping ? 'مجاني 100%' : formatCurr(shippingCost);

  const totalEl = document.getElementById('cart-total-val');
  if (totalEl) totalEl.textContent = formatCurr(grandTotal);
}

function openCartDrawer() {
  document.getElementById('cart-drawer').classList.add('open');
  document.getElementById('cart-drawer-overlay').classList.add('active');
}

function closeCartDrawer() {
  document.getElementById('cart-drawer').classList.remove('open');
  document.getElementById('cart-drawer-overlay').classList.remove('active');
}

// ─── Checkout ───────────────────────────────────────────────────────────────

function quickBuyNow(productId) {
  const p = StoreState.products.find(x => x.id === productId);
  if (!p) return;
  openCheckoutWithSingle(p, 1);
}

function openCheckoutWithSingle(product, qty) {
  StoreState.cart = [{
    product_id: product.id,
    name: product.name,
    price: parseFloat(product.sale_price) || 0,
    compare_price: parseFloat(product.compare_price) || 0,
    image: (product.images && product.images.length > 0) ? getImgUrl(product.images[0]) : '',
    quantity: qty,
    stock: product.stock_quantity
  }];
  saveCartToStorage();
  updateCartUI();
  openCheckoutModal();
}

function openCheckoutModal() {
  if (StoreState.cart.length === 0) {
    showToast('سلة المشتريات فارغة!', 'warning');
    return;
  }
  closeCartDrawer();

  const cart = StoreState.cart;
  const subtotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const threshold = parseFloat(StoreState.storeInfo.free_shipping_threshold) || 200;
  const baseShipping = parseFloat(StoreState.storeInfo.shipping_fee) || 25;
  const shipping = subtotal >= threshold ? 0 : baseShipping;
  const total = subtotal + shipping;

  const summaryEl = document.getElementById('checkout-items-summary');
  summaryEl.innerHTML = cart.map(i => `
    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
      <span>${escapeHtml(i.name)} × ${i.quantity}</span>
      <span style="font-weight:700;">${formatCurr(i.price * i.quantity)}</span>
    </div>
  `).join('');

  document.getElementById('checkout-subtotal').textContent = formatCurr(subtotal);
  document.getElementById('checkout-shipping').textContent = shipping === 0 ? 'مجاني' : formatCurr(shipping);
  document.getElementById('checkout-grand-total').textContent = formatCurr(total);

  openModal('checkout-modal');
}

async function submitOrderForm(e) {
  if (e) e.preventDefault();

  const name = document.getElementById('checkout-name').value.trim();
  const phone = document.getElementById('checkout-phone').value.trim();
  const email = document.getElementById('checkout-email').value.trim();
  const country = document.getElementById('checkout-country').value.trim();
  const city = document.getElementById('checkout-city').value.trim();
  const address = document.getElementById('checkout-address').value.trim();
  const notes = document.getElementById('checkout-notes').value.trim();

  if (!name || !phone || !city || !address) {
    showToast('يرجى ملء جميع الحقول المطلوبة', 'warning');
    return;
  }

  const btn = document.getElementById('submit-checkout-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري تأكيد الطلب...';
  }

  try {
    const payload = {
      customer_name: name,
      customer_phone: phone,
      customer_email: email,
      country: country || 'المملكة العربية السعودية',
      city: city,
      customer_address: address,
      notes: notes,
      items: StoreState.cart.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity
      }))
    };

    const res = await storeFetch('/api/public/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();

    if (json.success && json.data) {
      // Clear cart
      StoreState.cart = [];
      saveCartToStorage();
      updateCartUI();

      closeModal('checkout-modal');

      // Show success modal
      const numEl = document.getElementById('success-order-num');
      if (numEl) numEl.textContent = json.data.order_number;

      const trackBtn = document.getElementById('track-success-order-btn');
      if (trackBtn) {
        trackBtn.onclick = function () {
          closeModal('order-success-modal');
          openTrackOrderModal(json.data.order_number, phone);
        };
      }

      openModal('order-success-modal');
    } else {
      showToast(json.error || 'فشل إرسال الطلب، يرجى المحاولة لاحقاً', 'error');
    }
  } catch (err) {
    console.error('Submit order error:', err);
    showToast('حدث خطأ في الاتصال، يرجى المحاولة مجدداً', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check-circle"></i> تأكيد الطلب الآن';
    }
  }
}

// ─── Order Tracking ─────────────────────────────────────────────────────────

function openTrackOrderModal(prefillNum = '', prefillPhone = '') {
  const numInput = document.getElementById('track-order-num');
  const phoneInput = document.getElementById('track-phone');
  const resContainer = document.getElementById('track-result-container');

  if (numInput) numInput.value = prefillNum;
  if (phoneInput) phoneInput.value = prefillPhone;
  if (resContainer) resContainer.style.display = 'none';

  openModal('track-order-modal');

  if (prefillNum && prefillPhone) {
    trackOrderRequest(prefillNum, prefillPhone);
  }
}

async function trackOrderRequest(orderNum, phone) {
  const btn = document.getElementById('track-submit-btn');
  const resContainer = document.getElementById('track-result-container');

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري البحث...';
  }

  try {
    const url = `/api/public/track-order?order_number=${encodeURIComponent(orderNum)}&phone=${encodeURIComponent(phone)}`;
    const res = await storeFetch(url);
    const json = await res.json();

    if (json.success && json.data) {
      const d = json.data;
      resContainer.style.display = 'block';

      // Visual Timeline Steps
      const stepsHtml = (d.status_steps || []).map(s => `
        <div class="timeline-step ${s.completed ? 'completed' : ''}">
          <div class="step-circle"><i class="fas ${s.completed ? 'fa-check' : 'fa-circle'}"></i></div>
          <div class="step-title">${escapeHtml(s.label)}</div>
        </div>
      `).join('');

      // Items list
      const itemsHtml = (d.items || []).map(it => `
        <div style="display:flex; justify-content:space-between; font-size:13px; padding:6px 0; border-bottom:1px solid #F1F5F9;">
          <span>${escapeHtml(it.product_name)} × ${it.quantity}</span>
          <span style="font-weight:700;">${formatCurr(it.sale_price * it.quantity)}</span>
        </div>
      `).join('');

      resContainer.innerHTML = `
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:20px; margin-top:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:16px;">
            <div>
              <span style="font-size:12px; color:#64748B;">رقم الشحنة:</span>
              <h4 style="margin:0; font-size:18px; font-weight:900; color:#2563EB;">${escapeHtml(d.order_number)}</h4>
            </div>
            <div style="font-size:13px; color:#64748B;">تاريخ الطلب: <strong>${formatDate(d.created_at)}</strong></div>
          </div>

          <div class="tracking-timeline">
            ${stepsHtml}
          </div>

          <div style="margin-top:20px; background:#FFF; border-radius:8px; padding:14px; border:1px solid #E2E8F0;">
            <h5 style="margin:0 0 10px; font-size:14px; font-weight:800; color:#1E293B;">تفاصيل المنتجات:</h5>
            ${itemsHtml}
            <div style="display:flex; justify-content:space-between; padding-top:10px; margin-top:8px; font-size:15px; font-weight:900; color:#1E293B;">
              <span>المجموع الكلي عند الاستلام:</span>
              <span style="color:#2563EB;">${formatCurr(d.total_amount)}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      resContainer.style.display = 'block';
      resContainer.innerHTML = `
        <div class="empty-state-card text-danger" style="padding:24px; text-align:center; background:#FEF2F2; border:1px solid #FECACA; border-radius:8px;">
          <i class="fas fa-circle-exclamation fa-2x" style="margin-bottom:8px; display:block;"></i>
          <p>${escapeHtml(json.error || 'لم يتم العثور على الطلب')}</p>
        </div>
      `;
    }
  } catch (err) {
    console.error('Track order error:', err);
    showToast('حدث خطأ أثناء البحث عن الطلب', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-search"></i> بحث';
    }
  }
}

// ─── Contact Form ───────────────────────────────────────────────────────────

function openContactModal() {
  openModal('contact-modal');
}

async function submitContactForm(e) {
  if (e) e.preventDefault();

  const name = document.getElementById('contact-name').value.trim();
  const phone = document.getElementById('contact-phone').value.trim();
  const email = document.getElementById('contact-email').value.trim();
  const msg = document.getElementById('contact-msg').value.trim();

  if (!name || !msg) {
    showToast('يرجى كتابة الاسم والرسالة', 'warning');
    return;
  }

  const btn = document.getElementById('contact-submit-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';
  }

  try {
    const res = await storeFetch('/api/public/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, message: msg })
    });
    const json = await res.json();

    if (json.success) {
      showToast(json.message || 'تم إرسال رسالتك بنجاح!', 'success');
      document.getElementById('contact-form').reset();
      closeModal('contact-modal');
    } else {
      showToast(json.error || 'فشل إرسال الرسالة', 'error');
    }
  } catch (err) {
    showToast('حدث خطأ في الاتصال بالخادم', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال الرسالة';
    }
  }
}

// ─── Policies ───────────────────────────────────────────────────────────────

function openPolicyModal(tab = 'about') {
  openModal('policy-modal');
  switchPolicyTab(tab);
}

function switchPolicyTab(tab) {
  const policies = StoreState.storeInfo.policies || {};
  const contentEl = document.getElementById('policy-content');
  const titleEl = document.getElementById('policy-modal-title');

  document.querySelectorAll('#policy-modal .period-tab').forEach(b => b.classList.remove('active'));
  const activeBtn = Array.from(document.querySelectorAll('#policy-modal .period-tab')).find(b => b.getAttribute('onclick').includes(tab));
  if (activeBtn) activeBtn.classList.add('active');

  let text = '';
  if (tab === 'about') {
    titleEl.innerHTML = '<i class="fas fa-store text-primary"></i> من نحن';
    text = policies.about || `${StoreState.storeInfo.store_name} هو متجر إلكتروني رائد في توفير أفضل المنتجات الحصرية والمختارة بعناية. نحرص دائماً على تقديم أعلى جودة وأسرع خدمة توصيل لجميع المدن مع ميزة الدفع عند الاستلام.`;
  } else if (tab === 'shipping') {
    titleEl.innerHTML = '<i class="fas fa-truck-fast text-primary"></i> سياسة الشحن والتوصيل';
    const curr = (StoreState.storeInfo && StoreState.storeInfo.currency) || 'ج.م';
    const thresh = StoreState.storeInfo.free_shipping_threshold || 500;
    text = policies.shipping || `نوفر خدمة الشحن والتوصيل السريع لجميع المحافظات خلال 1 إلى 3 أيام عمل. الشحن مجاني للطلبات بقيمة ${thresh} ${curr} وأكثر. ويكون الدفع نقداً لمندوب الشحن عند باب بيتك بعد المعاينة.`;
  } else if (tab === 'returns') {
    titleEl.innerHTML = '<i class="fas fa-shield-halved text-primary"></i> سياسة الاسترجاع والضمان';
    text = policies.returns || `يحق للعميل معاينة المنتج بالكامل والتأكد من مطابقته قبل الدفع للمندوب. كما نقدم ضمان استبدال أو استرجاع مجاني خلال 7 أيام من تاريخ الاستلام في حال وجود أي عيب مصنعي أو اختلاف في المواصفات.`;
  } else if (tab === 'privacy') {
    titleEl.innerHTML = '<i class="fas fa-user-lock text-primary"></i> الشروط والأحكام والخصوصية';
    text = policies.privacy || `نلتزم التزاماً كاملاً بحماية خصوصية بياناتك وأرقام التواصل الخاصة بك. لا يتم استخدام رقم هاتفك أو عنوانك إلا لأغراض توصيل طلباتك وتحديثات الشحن فقط، ولن يتم مشاركتها مع أي طرف ثالث إطلاقاً.`;
  }

  contentEl.textContent = text;
}

// ─── Event Setup ────────────────────────────────────────────────────────────

function setupStoreEvents() {
  // Live search
  const searchInput = document.getElementById('customer-search-input');
  if (searchInput) {
    let timeout;
    searchInput.addEventListener('input', function () {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        StoreState.searchQuery = searchInput.value.trim();
        loadProducts();
      }, 350);
    });
  }

  // Sort dropdown
  const sortSelect = document.getElementById('customer-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', function () {
      StoreState.sortBy = this.value;
      loadProducts();
    });
  }

  // Checkout form submit
  const checkoutForm = document.getElementById('checkout-form');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', submitOrderForm);
  }

  // Track order form submit
  const trackForm = document.getElementById('track-order-form');
  if (trackForm) {
    trackForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const num = document.getElementById('track-order-num').value.trim();
      const phone = document.getElementById('track-phone').value.trim();
      if (num && phone) trackOrderRequest(num, phone);
    });
  }

  // Contact form submit
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', submitContactForm);
  }

  // Close modals on dismiss click
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

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.active, .modal.show').forEach(closeModal);
      closeCartDrawer();
    }
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function getImgUrl(img) {
  if (!img) return '';
  if (img.startsWith('http') || img.startsWith('data:')) return img;
  const baseUrl = (window.APP_BACKEND_URL || '').replace(/\/$/, '');
  if (img.startsWith('/uploads/')) return baseUrl + img;
  return baseUrl + '/uploads/' + img;
}

function formatCurr(amount) {
  const n = parseFloat(amount);
  const curr = (StoreState.storeInfo && StoreState.storeInfo.currency) || 'ج.م';
  if (isNaN(n)) return `0.00 ${curr}`;
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + curr;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
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

// ─── Mobile Navigation Helpers ──────────────────────────────────────────────
function toggleMobileNav() {
  const drawer = document.getElementById('mobile-nav-drawer');
  const overlay = document.getElementById('mobile-nav-overlay');
  if (drawer && overlay) {
    drawer.classList.toggle('open');
    overlay.classList.toggle('active');
  }
}

function closeMobileNav() {
  const drawer = document.getElementById('mobile-nav-drawer');
  const overlay = document.getElementById('mobile-nav-overlay');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
}

function focusMobileSearch() {
  const input = document.getElementById('customer-search-input');
  const section = document.getElementById('products-section');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth' });
  }
  if (input) {
    setTimeout(() => input.focus(), 300);
  }
}
