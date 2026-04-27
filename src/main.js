import { createClient } from '@supabase/supabase-js';
import { initTelegram } from './telegram';

const tg = initTelegram();
let supabase;
let currentUserId = null;
let currentLanguage = 'ar';
let cart = [];
let purchaseCart = [];
let viewStack = [];
let currentView = 'products';
let usdRate = 15000;

// ==================== i18n ====================
const i18n = {
  ar: {
    products: 'الأصناف',
    sell: 'بيع',
    history: 'المبيعات',
    analytics: 'تحليلات',
    purchases: 'المشتريات',
    customers: 'العملاء',
    cash: 'الصندوق',
    expenses: 'المصروفات',
    alerts: 'تنبيهات',
    addProduct: 'إضافة صنف',
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    search: 'بحث...',
    noData: 'لا توجد بيانات',
    confirmDelete: 'هل أنت متأكد من الحذف؟',
    stock: 'المخزون',
    price: 'السعر',
    quantity: 'الكمية',
    minAlert: 'حد التنبيه',
    total: 'الإجمالي',
    discount: 'حسم',
    tax: 'ضريبة',
    grandTotal: 'الصافي',
    customer: 'العميل',
    supplier: 'المورد',
    cashCustomer: 'نقدي',
    invoice: 'فاتورة',
    print: 'طباعة',
    downloadPDF: 'PDF',
    close: 'إغلاق',
    exportCSV: 'تصدير CSV',
    saved: 'تم الحفظ بنجاح',
    deleted: 'تم الحذف',
    fillAllFields: 'يرجى ملء جميع الحقول',
    quantityInsufficient: 'الكمية غير كافية',
    cartEmpty: 'العربة فارغة',
    sessionExpired: 'انتهت الجلسة',
    deposit: 'إيداع',
    withdraw: 'سحب',
    balance: 'الرصيد',
    paid: 'المدفوع',
    remaining: 'المتبقي',
    notes: 'ملاحظات',
    worker: 'العامل',
    category: 'الفئة',
    amount: 'المبلغ',
    date: 'التاريخ',
    description: 'الوصف'
  }
};

function t(key) { return i18n[currentLanguage]?.[key] || key; }

// ==================== Helpers ====================
function sanitize(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;' };
  return String(str).replace(/[&<>"'/]/g, m => map[m]);
}

function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.backgroundColor = isError ? '#d32f2f' : '#388e3c';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function formatCurrency(amountSYP) {
  const usd = amountSYP / usdRate;
  return `${amountSYP.toFixed(2)} ل.س (≈ ${usd.toFixed(2)} $)`;
}

async function logActivity(action, details = '') {
  try {
    await supabase.rpc('add_activity', { action, details });
  } catch (e) { console.warn('Activity log error:', e); }
}

function exportToCSV(filename, headers, rows) {
  const bom = '\uFEFF';
  const csv = bom + [headers.map(h => `"${h}"`).join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

async function recordCashTransaction(type, amount, refType, refId, note = '') {
  try {
    await supabase.from('cash_register').insert({
      user_id: currentUserId, type, amount,
      reference_type: refType, reference_id: refId, note
    });
  } catch (err) { console.error('Cash transaction error:', err); }
}

// ==================== Navigation ====================
function navigateTo(viewName, params) {
  if (currentView) viewStack.push({ name: currentView, params: window.currentViewParams });
  window.currentViewParams = params;
  currentView = viewName;
  applyBackButton();
  switch (viewName) {
    case 'products': showProducts(); break;
    case 'sell': showSellForm(); break;
    case 'history': showHistory(); break;
    case 'analytics': showAnalytics(); break;
    case 'purchases': showPurchases(); break;
    case 'customers': showCustomers(); break;
    case 'cash': showCashRegister(); break;
    case 'expenses': showExpenses(); break;
    case 'alerts': showAlerts(); break;
    case 'add-product': showAddProductForm(); break;
    case 'edit-product': showEditProductForm(params?.productId); break;
    case 'add-expense': showAddExpenseForm(); break;
    case 'add-cash-transaction': showAddCashTransactionForm(params?.type); break;
    default: console.warn('Unknown view:', viewName);
  }
}

function goBack() {
  if (viewStack.length === 0) { navigateTo('products'); return; }
  const prev = viewStack.pop();
  currentView = prev.name;
  window.currentViewParams = prev.params;
  applyBackButton();
  switch (currentView) {
    case 'products': showProducts(); break;
    case 'sell': showSellForm(); break;
    case 'history': showHistory(); break;
    case 'analytics': showAnalytics(); break;
    case 'purchases': showPurchases(); break;
    case 'customers': showCustomers(); break;
    case 'cash': showCashRegister(); break;
    case 'expenses': showExpenses(); break;
    case 'alerts': showAlerts(); break;
    case 'add-product': showAddProductForm(); break;
    case 'edit-product': showEditProductForm(window.currentViewParams?.productId); break;
    case 'add-expense': showAddExpenseForm(); break;
    case 'add-cash-transaction': showAddCashTransactionForm(window.currentViewParams?.type); break;
    default: navigateTo('products');
  }
}
window.goBack = goBack;

function applyBackButton() {
  const mainViews = ['products', 'sell', 'history', 'analytics', 'purchases', 'customers', 'cash', 'expenses', 'alerts'];
  if (!mainViews.includes(currentView) || viewStack.length > 0) tg.BackButton.show();
  else tg.BackButton.hide();
}

// ==================== Realtime Handler ====================
function handleRealtimeUpdate() {
  if (['products', 'sell', 'history', 'analytics', 'cash', 'expenses'].includes(currentView)) {
    if (window.currentRefreshFunction) window.currentRefreshFunction();
  }
}

// ==================== VIEWS ====================

// ---------- Products ----------
async function showProducts() {
  window.currentRefreshFunction = showProducts;
  tg.MainButton.hide();
  applyBackButton();
  const { data: products } = await supabase.from('products').select('id, name, variants(id, attributes, price, quantity, min_quantity)').order('name');
  let html = `<h2>${t('products')}</h2><input id="search-products" type="text" placeholder="${t('search')}"/><div id="products-list">`;
  if (!products?.length) html += `<p>${t('noData')}</p>`;
  else products.forEach(p => {
    html += `<div class="product-card"><strong>${sanitize(p.name)}</strong> <button onclick="navigateTo('edit-product',{productId:${p.id}})">${t('edit')}</button> <button onclick="window.deleteProduct(${p.id})">${t('delete')}</button><ul>`;
    p.variants?.forEach(v => {
      const attrs = Object.entries(v.attributes).map(([k,val]) => `${sanitize(k)}:${sanitize(val)}`).join(' / ');
      const warn = (v.min_quantity > 0 && v.quantity <= v.min_quantity) ? ' ⚠️' : '';
      html += `<li>${attrs} - ${formatCurrency(v.price)} (${v.quantity}) ${t('minAlert')}: ${v.min_quantity}${warn} <button onclick="window.deleteVariant(${v.id})">${t('delete')}</button></li>`;
    });
    html += '</ul></div>';
  });
  html += `</div><button id="add-product-btn">+ ${t('addProduct')}</button><button id="export-stock-btn">📥 ${t('exportCSV')}</button>`;
  view.innerHTML = html;
  document.getElementById('search-products').addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.product-card').forEach(card => card.style.display = card.textContent.toLowerCase().includes(term) ? '' : 'none');
  });
  document.getElementById('add-product-btn').addEventListener('click', () => navigateTo('add-product'));
  document.getElementById('export-stock-btn').addEventListener('click', exportStockCSV);
}

window.deleteProduct = async id => {
  if (!confirm(t('confirmDelete'))) return;
  try { await supabase.from('products').delete().eq('id', id); await logActivity('delete_product', `ID:${id}`); showToast(t('deleted')); showProducts(); } catch (err) { showToast(err.message, true); }
};
window.deleteVariant = async id => {
  if (!confirm(t('confirmDelete'))) return;
  try { await supabase.from('variants').delete().eq('id', id); await logActivity('delete_variant', `ID:${id}`); showToast(t('deleted')); showProducts(); } catch (err) { showToast(err.message, true); }
};

async function exportStockCSV() {
  const { data: products } = await supabase.from('products').select('name, variants(attributes, price, quantity, min_quantity)');
  const headers = [t('products'), 'المتغير', t('price'), t('quantity'), t('minAlert')];
  const rows = [];
  products.forEach(p => p.variants?.forEach(v => rows.push([p.name, Object.entries(v.attributes).map(([k,val])=>`${k}:${val}`).join(' / '), v.price, v.quantity, v.min_quantity])));
  exportToCSV('المخزون.csv', headers, rows);
}

// ---------- Add/Edit Product ----------
async function showAddProductForm() {
  tg.BackButton.show(); tg.MainButton.setText(t('save')); tg.MainButton.show(); tg.MainButton.onClick(saveProductWithVariants);
  view.innerHTML = `<h3>${t('addProduct')}</h3><input id="pname" placeholder="اسم الصنف"/><div id="variants-container"></div><button id="add-variant-row">+ إضافة متغير</button>`;
  document.getElementById('add-variant-row').addEventListener('click', addVariantRow);
  addVariantRow();
}
function addVariantRow() {
  const row = document.createElement('div'); row.className = 'variant-row';
  row.innerHTML = `<input placeholder="خصائص (size:M, color:أبيض)" class="v-attrs"/><input type="number" placeholder="السعر" class="v-price"/><input type="number" placeholder="الكمية" class="v-qty"/><input type="number" placeholder="حد التنبيه" class="v-min" value="0"/><button class="remove-variant">X</button>`;
  row.querySelector('.remove-variant').addEventListener('click', () => row.remove());
  document.getElementById('variants-container').appendChild(row);
}
async function saveProductWithVariants() {
  const name = document.getElementById('pname').value.trim();
  if (!name) { showToast(t('fillAllFields'), true); return; }
  const rows = document.querySelectorAll('.variant-row');
  const variants = []; let hasError = false;
  rows.forEach(row => {
    const attrsStr = row.querySelector('.v-attrs').value.trim();
    const price = parseFloat(row.querySelector('.v-price').value);
    const qty = parseInt(row.querySelector('.v-qty').value);
    const minQty = parseInt(row.querySelector('.v-min').value) || 0;
    if (!attrsStr || isNaN(price) || price <= 0 || isNaN(qty) || qty < 0) { hasError = true; return; }
    const attrs = {}; attrsStr.split(',').forEach(pair => { const [k,v] = pair.split(':').map(s=>s.trim()); if(k&&v) attrs[k]=v; });
    if (!Object.keys(attrs).length) { hasError = true; return; }
    variants.push({ attributes: attrs, price, quantity: qty, min_quantity: minQty });
  });
  if (hasError || !variants.length) { showToast(t('fillAllFields'), true); return; }
  tg.MainButton.disable();
  try {
    const { data: product, error } = await supabase.from('products').insert({ name, user_id: currentUserId }).select().single();
    if (error) throw error;
    const varsData = variants.map(v => ({ ...v, product_id: product.id, user_id: currentUserId }));
    const { error: vError } = await supabase.from('variants').insert(varsData);
    if (vError) throw vError;
    await logActivity('add_product', `Name: ${name}`);
    showToast(t('saved')); tg.MainButton.hide(); goBack(); showProducts();
  } catch (err) { showToast(err.message, true); } finally { tg.MainButton.enable(); }
}

async function showEditProductForm(productId) {
  tg.BackButton.show(); tg.MainButton.setText(t('save')); tg.MainButton.show(); tg.MainButton.onClick(() => updateProduct(productId));
  const { data: product } = await supabase.from('products').select('*, variants(*)').eq('id', productId).single();
  view.innerHTML = `<h3>تعديل ${sanitize(product.name)}</h3><div id="variants-container"></div><button id="add-variant-row">+ إضافة متغير</button>`;
  const container = document.getElementById('variants-container');
  product.variants.forEach(v => {
    const row = document.createElement('div'); row.className = 'variant-row';
    row.innerHTML = `<input value="${Object.entries(v.attributes).map(([k,val])=>`${k}:${val}`).join(', ')}" class="v-attrs"/><input type="number" value="${v.price}" class="v-price"/><input type="number" value="${v.quantity}" class="v-qty"/><input type="number" value="${v.min_quantity}" class="v-min"/><button class="remove-variant">X</button>`;
    row.querySelector('.remove-variant').addEventListener('click', () => row.remove());
    container.appendChild(row);
  });
  document.getElementById('add-variant-row').addEventListener('click', addVariantRow);
}
async function updateProduct(productId) {
  if (!confirm('سيتم استبدال جميع المتغيرات. متابعة؟')) return;
  const rows = document.querySelectorAll('.variant-row');
  const variants = [];
  rows.forEach(row => {
    const attrsStr = row.querySelector('.v-attrs').value.trim();
    const price = parseFloat(row.querySelector('.v-price').value);
    const qty = parseInt(row.querySelector('.v-qty').value);
    const minQty = parseInt(row.querySelector('.v-min').value) || 0;
    if (!attrsStr || isNaN(price) || isNaN(qty)) return;
    const attrs = {}; attrsStr.split(',').forEach(pair => { const [k,v] = pair.split(':').map(s=>s.trim()); if(k&&v) attrs[k]=v; });
    variants.push({ attributes: attrs, price, quantity: qty, min_quantity: minQty });
  });
  if (!variants.length) { showToast(t('fillAllFields'), true); return; }
  tg.MainButton.disable();
  try {
    await supabase.from('variants').delete().eq('product_id', productId);
    const newVariants = variants.map(v => ({ ...v, product_id: productId, user_id: currentUserId }));
    const { error } = await supabase.from('variants').insert(newVariants);
    if (error) throw error;
    await logActivity('update_product', `ID: ${productId}`);
    showToast(t('saved')); tg.MainButton.hide(); goBack(); showProducts();
  } catch (err) { showToast(err.message, true); } finally { tg.MainButton.enable(); }
}

// ---------- Sell (Cart) ----------
async function showSellForm() {
  window.currentRefreshFunction = showSellForm;
  tg.MainButton.setText('إتمام البيع'); tg.MainButton.show(); tg.MainButton.onClick(checkout);
  applyBackButton();
  const { data: products } = await supabase.from('products').select('id, name, variants!inner(id, attributes, price, quantity)').gt('variants.quantity', 0).order('name');
  let prodOptions = '';
  products.forEach(p => p.variants.forEach(v => {
    const attrs = Object.entries(v.attributes).map(([k,val])=>`${k}:${val}`).join('/');
    prodOptions += `<option value="${p.id}_${v.id}">${p.name} - ${attrs} (${formatCurrency(v.price)})</option>`;
  }));
  const { data: customers } = await supabase.from('customers').select('id, name').order('name');
  let custOptions = `<option value="">${t('cashCustomer')}</option>`;
  customers.forEach(c => custOptions += `<option value="${c.id}">${c.name}</option>`);
  view.innerHTML = `
    <h2>${t('sell')}</h2>
    <div style="display:flex; gap:10px;">
      <select id="prod-select">${prodOptions}</select>
      <input id="cart-qty" type="number" value="1" min="1" style="width:60px"/>
      <button id="add-to-cart">أضف</button>
    </div>
    <table id="cart-table"><thead><tr><th>الصنف</th><th>سعر</th><th>كمية</th><th>إجمالي</th><th></th></tr></thead><tbody></tbody></table>
    <p>${t('total')}: <span id="cart-total">0</span></p>
    <div><label>${t('discount')}:</label><input id="discount" type="number" value="0" step="0.01"/> ل.س</div>
    <div><label>${t('tax')}:</label><input id="tax" type="number" value="0" step="0.01"/> ل.س</div>
    <div><label>${t('paid')}:</label><input id="paid-amount" type="number" value="0" step="0.01"/> ل.س</div>
    <p>${t('grandTotal')}: <strong id="grand-total">0</strong></p>
    <div><label>${t('customer')}:</label><select id="customer-select">${custOptions}</select></div>
    <div id="checkout-msg"></div>`;
  document.getElementById('add-to-cart').addEventListener('click', addToCart);
  document.getElementById('discount').addEventListener('input', renderCart);
  document.getElementById('tax').addEventListener('input', renderCart);
  document.getElementById('paid-amount').addEventListener('input', renderCart);
  renderCart();
}

async function addToCart() {
  const select = document.getElementById('prod-select');
  const [productId, variantId] = select.value.split('_');
  const qty = parseInt(document.getElementById('cart-qty').value);
  if (isNaN(qty) || qty <= 0) { showToast(t('quantityInsufficient'), true); return; }
  const { data: variant } = await supabase.from('variants').select('id, price, attributes, quantity, products(name)').eq('id', variantId).single();
  if (!variant || variant.quantity < qty) { showToast(t('quantityInsufficient'), true); return; }
  const existing = cart.find(item => item.variantId === variantId);
  if (existing) existing.quantity += qty;
  else cart.push({ productId, variantId, name: variant.products.name, attributes: variant.attributes, price: variant.price, quantity: qty, max: variant.quantity });
  renderCart(); showToast('تمت الإضافة');
}

function renderCart() {
  const tbody = document.querySelector('#cart-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  let total = 0;
  cart.forEach((item, idx) => {
    const line = item.price * item.quantity;
    total += line;
    const attrs = Object.entries(item.attributes).map(([k,v])=>`${k}:${v}`).join('/');
    tbody.innerHTML += `<tr><td>${item.name} ${attrs}</td><td>${formatCurrency(item.price)}</td><td>${item.quantity}</td><td>${formatCurrency(line)}</td><td><button onclick="window.removeFromCart(${idx})">X</button></td></tr>`;
  });
  document.getElementById('cart-total').textContent = formatCurrency(total);
  const discount = parseFloat(document.getElementById('discount')?.value) || 0;
  const tax = parseFloat(document.getElementById('tax')?.value) || 0;
  const paid = parseFloat(document.getElementById('paid-amount')?.value) || 0;
  const grand = total - discount + tax;
  const remaining = grand - paid;
  document.getElementById('grand-total').textContent = `${formatCurrency(grand)} (${t('remaining')}: ${formatCurrency(remaining)})`;
}
window.removeFromCart = idx => { cart.splice(idx, 1); renderCart(); };

async function checkout() {
  if (!cart.length) { showToast(t('cartEmpty'), true); return; }
  tg.MainButton.disable();
  try {
    const total = cart.reduce((s,i) => s + i.price * i.quantity, 0);
    const discount = parseFloat(document.getElementById('discount')?.value) || 0;
    const tax = parseFloat(document.getElementById('tax')?.value) || 0;
    const paid = parseFloat(document.getElementById('paid-amount')?.value) || 0;
    const grand = total - discount + tax;
    const customerId = document.getElementById('customer-select')?.value || null;
    const { data: order, error } = await supabase.from('orders').insert({
      user_id: currentUserId, total_amount: total, discount, tax, paid_amount: paid, customer_id: customerId || null
    }).select().single();
    if (error) throw error;
    const itemsData = cart.map(item => ({ order_id: order.id, product_id: item.productId, variant_id: item.variantId, quantity: item.quantity, unit_price: item.price }));
    const { error: itemsError } = await supabase.from('order_items').insert(itemsData);
    if (itemsError) { await supabase.from('orders').delete().eq('id', order.id); throw itemsError; }
    for (const item of cart) {
      const { data: variant } = await supabase.from('variants').select('quantity, min_quantity, attributes, products(name)').eq('id', item.variantId).single();
      if (!variant) continue;
      const newQty = variant.quantity - item.quantity;
      await supabase.from('variants').update({ quantity: newQty }).eq('id', item.variantId);
      if (variant.min_quantity > 0 && newQty <= variant.min_quantity) {
        fetch('/api/stock-alert', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variantName: variant.products.name + ' ' + Object.entries(variant.attributes).map(([k,v])=>`${k}:${v}`).join('/'), quantity: newQty, minQuantity: variant.min_quantity })
        }).catch(console.error);
      }
    }
    await recordCashTransaction('deposit', paid, 'sale', order.id, `بيع #${order.id}`);
    await logActivity('sale', `Order #${order.id}, Total: ${grand}`);
    showToast(`تم البيع! رقم الإيصال: ${order.id}`);
    cart = []; renderCart(); tg.MainButton.hide();
    showInvoice({
      id: order.id, created_at: order.created_at || new Date().toISOString(),
      total_amount: total, discount, tax, grand_total: grand, paid_amount: paid,
      customer_name: (await supabase.from('customers').select('name').eq('id', customerId).single())?.data?.name,
      items: cart.map(i => ({ name: i.name, attrs: Object.entries(i.attributes).map(([k,v])=>`${k}:${v}`).join('/'), quantity: i.quantity, unit_price: i.price }))
    });
  } catch (err) { showToast(err.message, true); } finally { tg.MainButton.enable(); }
}

// ---------- Invoice ----------
function showInvoice(order, type = 'sale') {
  const { id, created_at, total_amount, discount, tax, grand_total, paid_amount, customer_name, supplier_name, items } = order;
  const netTotal = type === 'sale' ? grand_total : total_amount - (discount || 0);
  const remaining = netTotal - paid_amount;
  const title = type === 'sale' ? 'فاتورة مبيعات' : 'فاتورة مشتريات';
  const entityLabel = type === 'sale' ? t('customer') : t('supplier');
  const entityName = type === 'sale' ? (customer_name || t('cashCustomer')) : (supplier_name || 'غير محدد');
  const html = `<div id="invoice-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1000; display:flex; justify-content:center; align-items:center;">
    <div id="invoice-printable" style="background:#fff; padding:20px; border-radius:8px; max-width:400px; width:90%; color:#000;" dir="rtl">
      <h2 style="text-align:center">${title} #${id}</h2>
      <p>${t('date')}: ${new Date(created_at).toLocaleString()}</p>
      <p>${entityLabel}: ${entityName}</p>
      <table width="100%" border="1" style="border-collapse:collapse"><tr><th>الصنف</th><th>كمية</th><th>سعر الوحدة</th><th>إجمالي</th></tr>
      ${items.map(i => `<tr><td>${sanitize(i.name)} ${sanitize(i.attrs)}</td><td>${i.quantity}</td><td>${formatCurrency(i.unit_price)}</td><td>${formatCurrency(i.quantity * i.unit_price)}</td></tr>`).join('')}
      </table>
      <p>الإجمالي: ${formatCurrency(total_amount)}</p>
      <p>${t('discount')}: ${formatCurrency(discount || 0)}</p>
      ${type === 'sale' ? `<p>${t('tax')}: ${formatCurrency(tax)}</p>` : ''}
      <p><strong>المستحق: ${formatCurrency(netTotal)}</strong></p>
      <p>${t('paid')}: ${formatCurrency(paid_amount)}</p>
      <p>${t('remaining')}: ${formatCurrency(remaining)}</p>
      <div style="text-align:center; margin-top:10px;">
        <button id="print-invoice">${t('print')}</button>
        <button id="download-pdf-invoice">${t('downloadPDF')}</button>
        <button id="close-invoice">${t('close')}</button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('close-invoice').addEventListener('click', () => document.getElementById('invoice-modal').remove());
  document.getElementById('print-invoice').addEventListener('click', () => {
    const win = window.open('', '_blank');
    win.document.write(`<html dir="rtl"><head><title>${title} #${id}</title></head><body>${document.getElementById('invoice-printable').innerHTML}</body></html>`);
    win.print();
  });
  document.getElementById('download-pdf-invoice').addEventListener('click', async () => {
    const canvas = await html2canvas(document.getElementById('invoice-printable'), { scale: 2 });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
    pdf.save(`${title}_${id}.pdf`);
  });
}

// ---------- History ----------
async function showHistory() {
  window.currentRefreshFunction = showHistory; tg.MainButton.hide(); applyBackButton();
  const { data: orders } = await supabase.from('orders').select('id, created_at, total_amount, discount, tax, grand_total, paid_amount, customers(name), order_items(quantity, unit_price, variants(attributes, products(name)))').order('created_at', { ascending: false });
  let html = `<h2>${t('history')}</h2>`;
  if (!orders?.length) html += `<p>${t('noData')}</p>`;
  else {
    orders.forEach(order => {
      const remaining = order.grand_total - order.paid_amount;
      html += `<div style="border:1px solid #ccc; margin:5px; padding:5px;">
        <strong>طلب #${order.id}</strong> - ${new Date(order.created_at).toLocaleString()}<br/>
        <small>${t('customer')}: ${order.customers?.name || t('cashCustomer')} | ${t('total')}: ${formatCurrency(order.total_amount)} | ${t('discount')}: ${formatCurrency(order.discount)} | ${t('tax')}: ${formatCurrency(order.tax)} | ${t('grandTotal')}: ${formatCurrency(order.grand_total)}</small><br/>
        <small>${t('paid')}: ${formatCurrency(order.paid_amount)} | ${t('remaining')}: ${formatCurrency(remaining)}</small>
        <button onclick="window.showInvoiceFromOrder(${order.id})">${t('invoice')}</button>
        <ul>${order.order_items.map(i => `<li>${i.variants?.products?.name || ''} ${Object.entries(i.variants?.attributes || {}).map(([k,v])=>`${k}:${v}`).join('/')} ×${i.quantity} (${formatCurrency(i.unit_price)})</li>`).join('')}</ul>
      </div>`;
    });
    html += `<button id="export-sales-btn">📥 ${t('exportCSV')}</button>`;
  }
  view.innerHTML = html;
  document.getElementById('export-sales-btn')?.addEventListener('click', exportSalesCSV);
}
window.showInvoiceFromOrder = async orderId => {
  const { data: order } = await supabase.from('orders').select('*, customers(name), order_items(quantity, unit_price, variants(attributes, products(name)))').eq('id', orderId).single();
  showInvoice({
    id: order.id, created_at: order.created_at, total_amount: order.total_amount, discount: order.discount, tax: order.tax, grand_total: order.grand_total, paid_amount: order.paid_amount,
    customer_name: order.customers?.name,
    items: order.order_items.map(i => ({ name: i.variants?.products?.name, attrs: Object.entries(i.variants?.attributes || {}).map(([k,v])=>`${k}:${v}`).join('/'), quantity: i.quantity, unit_price: i.unit_price }))
  });
};
async function exportSalesCSV() {
  const { data: orders } = await supabase.from('orders').select('id, created_at, total_amount, discount, tax, grand_total, paid_amount, customers(name)');
  exportToCSV('المبيعات.csv', ['رقم الطلب','التاريخ','العميل','الإجمالي','الحسم','الضريبة','الصافي','المدفوع','المتبقي'], orders.map(o => [o.id, new Date(o.created_at).toLocaleString(), o.customers?.name||'', o.total_amount, o.discount, o.tax, o.grand_total, o.paid_amount, o.grand_total - o.paid_amount]));
}

// ---------- Analytics (مختصرة) ----------
async function showAnalytics() {
  window.currentRefreshFunction = showAnalytics; tg.MainButton.hide(); applyBackButton();
  view.innerHTML = '<h2>تحليلات</h2><p>قيد التطوير...</p>';
}

// ---------- Purchases ----------
async function showPurchases() {
  window.currentRefreshFunction = showPurchases; tg.MainButton.hide(); applyBackButton();
  view.innerHTML = `<h2>${t('purchases')}</h2><button id="new-purchase-btn">شراء جديد</button><button id="purchases-history-btn">سجل المشتريات</button>`;
  document.getElementById('new-purchase-btn').addEventListener('click', () => navigateTo('add-purchase'));
  document.getElementById('purchases-history-btn').addEventListener('click', showPurchasesHistory);
}

// ---------- Customers ----------
async function showCustomers() {
  window.currentRefreshFunction = showCustomers; tg.MainButton.hide(); applyBackButton();
  const { data: customers } = await supabase.from('customers').select('*').order('name');
  let html = `<h2>${t('customers')}</h2><input id="search-customers" placeholder="${t('search')}"/><ul>`;
  customers?.forEach(c => html += `<li>${sanitize(c.name)} ${sanitize(c.phone||'')} <button onclick="window.deleteCustomer(${c.id})">${t('delete')}</button></li>`);
  html += `</ul><button id="add-customer-btn">+ ${t('addProduct')}</button><button id="export-customers-btn">📥 ${t('exportCSV')}</button>`;
  view.innerHTML = html;
  document.getElementById('search-customers')?.addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('li').forEach(li => li.style.display = li.textContent.toLowerCase().includes(term) ? '' : 'none');
  });
  document.getElementById('add-customer-btn')?.addEventListener('click', () => navigateTo('add-customer'));
  document.getElementById('export-customers-btn')?.addEventListener('click', exportCustomersCSV);
}
window.deleteCustomer = async id => { if (confirm(t('confirmDelete'))) { await supabase.from('customers').delete().eq('id', id); showToast(t('deleted')); showCustomers(); } };

async function exportCustomersCSV() {
  const { data } = await supabase.from('customers').select('name, phone, notes');
  exportToCSV('العملاء.csv', ['الاسم','الهاتف','ملاحظات'], data.map(c => [c.name, c.phone||'', c.notes||'']));
}

// ---------- Cash Register ----------
async function showCashRegister() {
  window.currentRefreshFunction = showCashRegister; tg.MainButton.hide(); applyBackButton();
  const { data: transactions } = await supabase.from('cash_register').select('*').order('created_at', { ascending: false });
  let balance = transactions?.reduce((sum, t) => sum + (t.type === 'deposit' ? t.amount : -t.amount), 0) || 0;
  let html = `<h2>${t('cash')}</h2><div class="stat-card"><strong>${t('balance')}</strong><br/>${formatCurrency(balance)}</div>
    <input id="search-cash" placeholder="${t('search')}"/><ul>`;
  transactions?.forEach(t => {
    const sign = t.type === 'deposit' ? '+' : '-';
    html += `<li style="color:${t.type==='deposit'?'green':'red'}">${sign}${t.amount} ل.س - ${sanitize(t.note||'')} <small>${new Date(t.created_at).toLocaleString()}</small></li>`;
  });
  html += `</ul><button id="add-deposit-btn">+ ${t('deposit')}</button><button id="add-withdraw-btn">- ${t('withdraw')}</button><button id="export-cash-btn">📥 ${t('exportCSV')}</button>`;
  view.innerHTML = html;
  document.getElementById('search-cash')?.addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('li').forEach(li => li.style.display = li.textContent.toLowerCase().includes(term) ? '' : 'none');
  });
  document.getElementById('add-deposit-btn')?.addEventListener('click', () => navigateTo('add-cash-transaction', { type: 'deposit' }));
  document.getElementById('add-withdraw-btn')?.addEventListener('click', () => navigateTo('add-cash-transaction', { type: 'withdraw' }));
  document.getElementById('export-cash-btn')?.addEventListener('click', exportCashCSV);
}

async function showAddCashTransactionForm(type) {
  tg.BackButton.show(); tg.MainButton.setText(t('save')); tg.MainButton.show(); tg.MainButton.onClick(() => saveCashTransaction(type));
  view.innerHTML = `<h3>${type === 'deposit' ? 'إيداع' : 'سحب'} جديد</h3><input id="cash-amount" type="number" step="0.01" placeholder="${t('amount')}"/><textarea id="cash-note" placeholder="${t('notes')}"></textarea>`;
}
async function saveCashTransaction(type) {
  const amount = parseFloat(document.getElementById('cash-amount')?.value);
  if (isNaN(amount) || amount <= 0) { showToast('أدخل مبلغاً صحيحاً', true); return; }
  const note = document.getElementById('cash-note')?.value?.trim() || '';
  tg.MainButton.disable();
  try {
    await supabase.from('cash_register').insert({ user_id: currentUserId, type, amount, reference_type: 'manual', note });
    await logActivity('cash_' + type, `Amount: ${amount}`);
    showToast(t('saved')); tg.MainButton.hide(); goBack(); showCashRegister();
  } catch (err) { showToast(err.message, true); } finally { tg.MainButton.enable(); }
}
async function exportCashCSV() {
  const { data } = await supabase.from('cash_register').select('type, amount, note, created_at');
  exportToCSV('الصندوق.csv', ['النوع','المبلغ','ملاحظات','التاريخ'], data.map(t => [t.type==='deposit'?'إيداع':'سحب', t.amount, t.note||'', new Date(t.created_at).toLocaleString()]));
}

// ---------- Expenses ----------
async function showExpenses() {
  window.currentRefreshFunction = showExpenses; tg.MainButton.hide(); applyBackButton();
  const { data: expenses } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false });
  const { data: workers } = await supabase.from('expenses').select('worker_name, amount').not('worker_name', 'eq', '');
  const workerTotals = {};
  workers?.forEach(e => { const w = e.worker_name || 'بدون'; workerTotals[w] = (workerTotals[w] || 0) + parseFloat(e.amount); });
  const totalAll = expenses?.reduce((s, e) => s + parseFloat(e.amount), 0) || 0;
  let html = `<h2>${t('expenses')}</h2><p>الإجمالي العام: ${formatCurrency(totalAll)}</p>
    <div class="worker-summary"><h4>توزيع حسب العامل</h4><ul>${Object.entries(workerTotals).map(([n,t])=>`<li><strong>${sanitize(n)}</strong>: ${formatCurrency(t)}</li>`).join('')||'<li>لا بيانات</li>'}</ul></div>
    <input id="search-expenses" placeholder="${t('search')}"/><table id="expenses-table"><thead><tr><th>التاريخ</th><th>الفئة</th><th>العامل</th><th>المبلغ</th><th>الوصف</th><th></th></tr></thead><tbody>
    ${expenses?.map(e => `<tr><td>${new Date(e.expense_date).toLocaleDateString()}</td><td>${sanitize(e.category)}</td><td>${sanitize(e.worker_name||'-')}</td><td>${formatCurrency(e.amount)}</td><td>${sanitize(e.description||'')}</td><td><button onclick="window.deleteExpense(${e.id})">${t('delete')}</button></td></tr>`).join('')||`<tr><td colspan="6">${t('noData')}</td></tr>`}
    </tbody></table><button id="add-expense-btn">+ إضافة مصروف</button><button id="export-expenses-btn">📥 ${t('exportCSV')}</button>`;
  view.innerHTML = html;
  document.getElementById('search-expenses')?.addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('#expenses-table tbody tr').forEach(row => row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none');
  });
  document.getElementById('add-expense-btn')?.addEventListener('click', () => navigateTo('add-expense'));
  document.getElementById('export-expenses-btn')?.addEventListener('click', exportExpensesCSV);
}
window.deleteExpense = async id => { if (confirm(t('confirmDelete'))) { await supabase.from('expenses').delete().eq('id', id); await logActivity('delete_expense', `ID:${id}`); showToast(t('deleted')); showExpenses(); } };

async function showAddExpenseForm() {
  tg.BackButton.show(); tg.MainButton.setText(t('save')); tg.MainButton.show(); tg.MainButton.onClick(saveExpense);
  view.innerHTML = `<h3>إضافة مصروف</h3><input id="expense-amount" type="number" step="0.01" placeholder="${t('amount')}"/><input id="expense-category" placeholder="${t('category')}" value="أخرى"/><input id="expense-worker" placeholder="${t('worker')}"/><input id="expense-desc" placeholder="${t('description')}"/><input id="expense-date" type="date" value="${new Date().toISOString().split('T')[0]}"/>`;
}
async function saveExpense() {
  const amount = parseFloat(document.getElementById('expense-amount')?.value);
  if (isNaN(amount) || amount <= 0) { showToast('أدخل مبلغاً صحيحاً', true); return; }
  const category = document.getElementById('expense-category')?.value?.trim() || 'أخرى';
  const workerName = document.getElementById('expense-worker')?.value?.trim() || '';
  const description = document.getElementById('expense-desc')?.value?.trim() || '';
  const date = document.getElementById('expense-date')?.value || new Date().toISOString().split('T')[0];
  tg.MainButton.disable();
  try {
    const { data: record, error } = await supabase.from('expenses').insert({ user_id: currentUserId, amount, category, worker_name: workerName, description, expense_date: date }).select('id').single();
    if (error) throw error;
    await recordCashTransaction('withdraw', amount, 'expense', record.id, `${category} - ${workerName}`);
    await logActivity('add_expense', `Amount: ${amount}, Worker: ${workerName}`);
    showToast(t('saved')); tg.MainButton.hide(); goBack(); showExpenses();
  } catch (err) { showToast(err.message, true); } finally { tg.MainButton.enable(); }
}
async function exportExpensesCSV() {
  const { data } = await supabase.from('expenses').select('amount, category, description, expense_date, worker_name');
  exportToCSV('المصروفات.csv', ['المبلغ','الفئة','الوصف','التاريخ','العامل'], data.map(e => [e.amount, e.category, e.description||'', e.expense_date, e.worker_name||'']));
}

// ---------- Alerts ----------
async function showAlerts() {
  window.currentRefreshFunction = showAlerts; tg.MainButton.hide(); applyBackButton();
  const { data: variants } = await supabase.from('variants').select('id, quantity, min_quantity, attributes, products(name)').gt('min_quantity', 0);
  const lowStock = variants?.filter(v => v.quantity <= v.min_quantity) || [];
  let html = `<h2>${t('alerts')}</h2>`;
  if (!lowStock.length) html += `<p>${t('noData')}</p>`;
  else {
    html += '<ul>';
    lowStock.forEach(v => {
      const attrs = Object.entries(v.attributes).map(([k,val])=>`${k}:${val}`).join('/');
      html += `<li><strong>${v.products.name}</strong> - ${attrs} – ${v.quantity} (حد ${v.min_quantity})</li>`;
    });
    html += '</ul>';
  }
  html += `<button onclick="window.setOwnerChatId()">تفعيل تنبيهات تيليجرام</button>`;
  view.innerHTML = html;
}
window.setOwnerChatId = async () => {
  const userId = tg.initDataUnsafe.user.id.toString();
  await supabase.from('bot_settings').upsert({ key: 'owner_chat_id', value: userId }, { onConflict: 'key' });
  showToast('تم تفعيل التنبيهات');
};

// ==================== Startup ====================
(async () => {
  const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: tg.initData }) });
  if (!res.ok) { view.innerHTML = '<p>فشل المصادقة</p>'; return; }
  const { token, userId } = await res.json();
  supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
  await supabase.auth.setSession({ access_token: token, refresh_token: '' });
  currentUserId = userId;
  const { data: rateData } = await supabase.from('bot_settings').select('value').eq('key', 'usd_rate').single();
  if (rateData) usdRate = parseFloat(rateData.value) || 15000;
  supabase.channel('public:variants').on('postgres_changes', { event: '*', schema: 'public', table: 'variants' }, handleRealtimeUpdate).subscribe();
  supabase.channel('public:orders').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, handleRealtimeUpdate).subscribe();
  navigateTo('products');
})();
