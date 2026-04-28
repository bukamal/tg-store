import { createClient } from '@supabase/supabase-js';
import { initTelegram } from './telegram';

const tg = initTelegram();
let supabase;
let currentUserId = null;
let usdRate = 15000;
let cart = [];
let purchaseCart = [];
let viewStack = [];
let currentView = 'materials';

// ========== i18n ==========
const i18n = {
  ar: {
    materials: 'المواد',
    sell: 'بيع',
    history: 'المبيعات',
    analytics: 'تحليلات',
    purchases: 'المشتريات',
    customers: 'العملاء',
    cash: 'الصندوق',
    expenses: 'المصروفات',
    alerts: 'تنبيهات',
    categories: 'التصنيفات',
    addMaterial: 'إضافة مادة',
    save: 'حفظ',
    delete: 'حذف',
    edit: 'تعديل',
    search: 'بحث...',
    noData: 'لا توجد بيانات',
    confirmDelete: 'هل أنت متأكد من الحذف؟',
    purchasePrice: 'سعر الشراء',
    sellingPrice: 'سعر البيع',
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
    exportCSV: 'تصدير CSV',
    saved: 'تم الحفظ',
    deleted: 'تم الحذف',
    fillAllFields: 'يرجى ملء جميع الحقول',
    category: 'التصنيف'
  }
};
function t(key) { return i18n.ar[key] || key; }
// ========== Helpers ==========
function sanitize(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;' };
  return String(str).replace(/[&<>"'/]/g, m => map[m]);
}
function showToast(msg, isErr = false) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.backgroundColor = isErr ? '#d32f2f' : '#388e3c';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
function formatCurrency(amount) {
  const usd = amount / usdRate;
  return `${amount.toFixed(2)} ل.س (≈ ${usd.toFixed(2)} $)`;
}
async function logActivity(action, details = '') {
  try { await supabase.rpc('add_activity', { action, details }); } catch {}
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
  try { await supabase.from('cash_register').insert({ user_id: currentUserId, type, amount, reference_type: refType, reference_id: refId, note }); } catch {}
}
// ========== Navigation ==========
function navigateTo(view, params) {
  if (currentView) viewStack.push({ name: currentView, params: window.currentViewParams });
  window.currentViewParams = params;
  currentView = view;
  applyBackButton();
  switch (view) {
    case 'materials': showMaterials(); break;
    case 'sell': showSellForm(); break;
    case 'history': showHistory(); break;
    case 'analytics': showAnalytics(); break;
    case 'purchases': showPurchases(); break;
    case 'customers': showCustomers(); break;
    case 'cash': showCashRegister(); break;
    case 'expenses': showExpenses(); break;
    case 'alerts': showAlerts(); break;
    case 'categories': showCategories(); break;
    case 'add-material': showAddMaterialForm(); break;
    case 'edit-material': showEditMaterialForm(params?.productId); break;
    case 'add-category': showAddCategoryForm(); break;
    case 'add-expense': showAddExpenseForm(); break;
    case 'add-cash-transaction': showAddCashTransactionForm(params?.type); break;
    case 'add-purchase': showAddPurchaseForm(); break;
    case 'add-customer': showAddCustomerForm(); break;
  }
}
function goBack() {
  if (viewStack.length === 0) { navigateTo('materials'); return; }
  const prev = viewStack.pop();
  currentView = prev.name;
  window.currentViewParams = prev.params;
  applyBackButton();
  switch (currentView) {
    case 'materials': showMaterials(); break;
    case 'sell': showSellForm(); break;
    case 'history': showHistory(); break;
    case 'analytics': showAnalytics(); break;
    case 'purchases': showPurchases(); break;
    case 'customers': showCustomers(); break;
    case 'cash': showCashRegister(); break;
    case 'expenses': showExpenses(); break;
    case 'alerts': showAlerts(); break;
    case 'categories': showCategories(); break;
    case 'add-material': showAddMaterialForm(); break;
    case 'edit-material': showEditMaterialForm(window.currentViewParams?.productId); break;
    case 'add-category': showAddCategoryForm(); break;
    case 'add-expense': showAddExpenseForm(); break;
    case 'add-cash-transaction': showAddCashTransactionForm(window.currentViewParams?.type); break;
    case 'add-purchase': showAddPurchaseForm(); break;
    case 'add-customer': showAddCustomerForm(); break;
    default: navigateTo('materials');
  }
}
window.goBack = goBack;
function applyBackButton() {
  const mainViews = ['materials', 'sell', 'history', 'analytics', 'purchases', 'customers', 'cash', 'expenses', 'alerts', 'categories'];
  if (!mainViews.includes(currentView) || viewStack.length > 0) tg.BackButton.show();
  else tg.BackButton.hide();
}
function initRouter() {
  document.querySelectorAll('#bottom-nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view) navigateTo(view);
    });
  });
}
// ========== Auth & Supabase ==========
async function refreshAuth() {
  const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: tg.initData }) });
  if (res.ok) {
    const { token } = await res.json();
    await supabase.auth.setSession({ access_token: token, refresh_token: '' });
    return true;
  }
  return false;
}
async function supaCall(queryFn) {
  const { data, error } = await queryFn();
  if (error && (error.code === 'PGRST301' || error.message?.includes('JWT'))) {
    const refreshed = await refreshAuth();
    if (refreshed) return queryFn();
    else { showToast('انتهت الجلسة', true); throw error; }
  }
  if (error) throw error;
  return { data };
}
// ========== MATERIALS ==========
async function showMaterials() {
  window.currentRefreshFunction = showMaterials; tg.MainButton.hide(); applyBackButton();
  const { data: materials } = await supaCall(() => supabase.from('products').select('id, name, category_id, categories(name), variants(id, variant_name, purchase_price, selling_price, quantity, min_quantity)').eq('user_id', currentUserId).order('name'));
  let html = `<div class="card"><h2>${t('materials')}</h2><button class="btn btn-outline" onclick="navigateTo('categories')">إدارة التصنيفات</button><input class="search-input" id="search-materials" placeholder="${t('search')}"/><div id="materials-list">`;
  if (!materials?.length) html += `<div class="empty-state">📦<br>${t('noData')}</div>`;
  else materials.forEach(m => {
    const catName = m.categories?.name ? ` [${m.categories.name}]` : '';
    html += `<div class="material-card"><div class="material-header"><strong>${sanitize(m.name)}${catName}</strong><div><button class="btn btn-sm btn-outline" onclick="navigateTo('edit-material',{productId:${m.id}})">${t('edit')}</button><button class="btn btn-sm btn-danger" onclick="window.deleteMaterial(${m.id})">${t('delete')}</button></div></div><ul>`;
    m.variants?.forEach(v => {
      const warn = (v.min_quantity > 0 && v.quantity <= v.min_quantity) ? ' ⚠️' : '';
      html += `<li>${sanitize(v.variant_name || 'غير مسمى')} | شراء: ${formatCurrency(v.purchase_price)} | بيع: ${formatCurrency(v.selling_price)} | مخزون: ${v.quantity} ${warn}</li>`;
    });
    html += '</ul></div>';
  });
  html += `</div><button class="btn" id="add-material-btn">+ ${t('addMaterial')}</button> <button class="btn btn-outline" id="export-stock-btn">📥 ${t('exportCSV')}</button></div>`;
  document.getElementById('view').innerHTML = html;
  document.getElementById('search-materials').addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.material-card').forEach(card => card.style.display = card.textContent.toLowerCase().includes(term) ? '' : 'none');
  });
  document.getElementById('add-material-btn').addEventListener('click', () => navigateTo('add-material'));
  document.getElementById('export-stock-btn').addEventListener('click', exportStockCSV);
}
window.deleteMaterial = async id => { if (!confirm(t('confirmDelete'))) return; await supaCall(() => supabase.from('products').delete().eq('id', id)); await logActivity('delete_material', `ID:${id}`); showToast(t('deleted')); showMaterials(); };

async function exportStockCSV() {
  const { data: products } = await supaCall(() => supabase.from('products').select('name, categories(name), variants(variant_name, purchase_price, selling_price, quantity, min_quantity)').eq('user_id', currentUserId));
  const headers = ['المادة', 'التصنيف', 'المتغير', 'سعر الشراء', 'سعر البيع', 'الكمية', 'حد التنبيه'];
  const rows = [];
  products.forEach(p => p.variants?.forEach(v => rows.push([p.name, p.categories?.name||'', v.variant_name, v.purchase_price, v.selling_price, v.quantity, v.min_quantity])));
  exportToCSV('المخزون.csv', headers, rows);
}

// ---- Add/Edit Material ----
async function showAddMaterialForm() {
  tg.BackButton.show(); tg.MainButton.setText(t('save')); tg.MainButton.show(); tg.MainButton.onClick(saveMaterialWithVariants);
  const { data: categories } = await supaCall(() => supabase.from('categories').select('id, name').eq('user_id', currentUserId).order('name'));
  let catOptions = '<option value="">بدون تصنيف</option>';
  categories?.forEach(c => catOptions += `<option value="${c.id}">${c.name}</option>`);
  document.getElementById('view').innerHTML = `<div class="card"><h3>${t('addMaterial')}</h3><input id="mname" placeholder="اسم المادة"/><select id="material-category">${catOptions}</select><div id="variants-container"></div><button class="btn btn-outline" id="add-variant-row">+ إضافة متغير</button></div>`;
  document.getElementById('add-variant-row').addEventListener('click', addVariantRow);
  addVariantRow();
}
// ( addVariantRow, saveMaterialWithVariants, showEditMaterialForm, updateMaterial تتبع نفس النمط مع إضافة category_id )
async function saveMaterialWithVariants() {
  const name = document.getElementById('mname').value.trim();
  if (!name) { showToast(t('fillAllFields'), true); return; }
  const categoryId = document.getElementById('material-category')?.value || null;
  const rows = document.querySelectorAll('.variant-row'); const variants = []; let hasError = false;
  rows.forEach(row => {
    const vname = row.querySelector('.v-name')?.value.trim() || 'بدون اسم';
    const purchasePrice = parseFloat(row.querySelector('.v-purchase-price')?.value);
    const sellingPrice = parseFloat(row.querySelector('.v-selling-price')?.value);
    const qty = parseInt(row.querySelector('.v-qty')?.value); const minQty = parseInt(row.querySelector('.v-min')?.value) || 0;
    if (isNaN(purchasePrice) || purchasePrice < 0 || isNaN(sellingPrice) || sellingPrice < 0 || isNaN(qty) || qty < 0) { hasError = true; return; }
    variants.push({ variant_name: vname, attributes: {}, purchase_price: purchasePrice, selling_price: sellingPrice, quantity: qty, min_quantity: minQty, user_id: currentUserId });
  });
  if (hasError || !variants.length) { showToast(t('fillAllFields'), true); return; }
  tg.MainButton.disable();
  try {
    const { data: product, error } = await supaCall(() => supabase.from('products').insert({ name, user_id: currentUserId, category_id: categoryId }).select().single());
    if (error) throw error;
    const varsData = variants.map(v => ({ ...v, product_id: product.id }));
    await supaCall(() => supabase.from('variants').insert(varsData));
    await logActivity('add_material', `Name: ${name}`);
    showToast(t('saved')); tg.MainButton.hide(); goBack(); showMaterials();
  } catch (err) { showToast(err.message, true); } finally { tg.MainButton.enable(); }
}
// showEditMaterialForm و updateMaterial بنفس المنوال، مع جلب category الحالي.
// ========== CATEGORIES ==========
async function showCategories() {
  window.currentRefreshFunction = showCategories; tg.MainButton.hide(); applyBackButton();
  const { data: categories } = await supaCall(() => supabase.from('categories').select('*').eq('user_id', currentUserId).order('name'));
  let html = `<div class="card"><h2>التصنيفات</h2><ul>`;
  categories?.forEach(c => html += `<li>${sanitize(c.name)} <button class="btn btn-sm btn-danger" onclick="window.deleteCategory(${c.id})">حذف</button></li>`);
  html += `</ul><button class="btn" onclick="navigateTo('add-category')">+ إضافة تصنيف</button></div>`;
  document.getElementById('view').innerHTML = html;
}
window.deleteCategory = async id => { if (confirm(t('confirmDelete'))) { await supaCall(() => supabase.from('categories').delete().eq('id', id)); showToast(t('deleted')); showCategories(); } };

async function showAddCategoryForm() {
  tg.BackButton.show(); tg.MainButton.setText(t('save')); tg.MainButton.show(); tg.MainButton.onClick(saveCategory);
  document.getElementById('view').innerHTML = `<div class="card"><h3>إضافة تصنيف</h3><input id="category-name" placeholder="اسم التصنيف"/></div>`;
}
async function saveCategory() {
  const name = document.getElementById('category-name').value.trim();
  if (!name) { showToast('الاسم مطلوب', true); return; }
  tg.MainButton.disable();
  try {
    await supaCall(() => supabase.from('categories').insert({ name, user_id: currentUserId }));
    showToast(t('saved')); tg.MainButton.hide(); goBack(); showCategories();
  } catch (err) { showToast(err.message,true); } finally { tg.MainButton.enable(); }
}
// ========== SELL ==========
async function showSellForm() {
  window.currentRefreshFunction = showSellForm;
  tg.MainButton.setText('إتمام البيع'); tg.MainButton.show(); tg.MainButton.onClick(checkout);
  applyBackButton();
  const { data: products } = await supaCall(() => supabase.from('products').select('id, name, variants!inner(id, variant_name, selling_price, quantity)').eq('user_id', currentUserId).gt('variants.quantity',0).order('name'));
  let prodOptions = '';
  products.forEach(p => p.variants.forEach(v => prodOptions += `<option value="${p.id}_${v.id}">${p.name} - ${v.variant_name||'غير مسمى'} (${formatCurrency(v.selling_price)})</option>`));
  const { data: customers } = await supaCall(() => supabase.from('customers').select('id, name').eq('user_id', currentUserId).order('name'));
  let custOptions = `<option value="">${t('cashCustomer')}</option>`;
  customers.forEach(c => custOptions += `<option value="${c.id}">${c.name}</option>`);
  document.getElementById('view').innerHTML = `<div class="card"><h2>${t('sell')}</h2>
    <div style="display:flex;gap:8px"><select id="prod-select">${prodOptions}</select><input id="cart-qty" type="number" value="1" min="1" style="width:60px"/><button class="btn" id="add-to-cart">أضف</button></div>
    <table id="cart-table"><thead><tr><th>الصنف</th><th>سعر</th><th>كمية</th><th>إجمالي</th><th></th></tr></thead><tbody></tbody></table>
    <p>${t('total')}: <span id="cart-total">0</span></p>
    <div><label>${t('discount')}:</label><input id="discount" type="number" value="0" step="0.01"/></div>
    <div><label>${t('tax')}:</label><input id="tax" type="number" value="0" step="0.01"/></div>
    <div><label>المدفوع:</label><input id="paid-amount" type="number" value="0" step="0.01"/></div>
    <p>${t('grandTotal')}: <strong id="grand-total">0</strong></p>
    <div><label>${t('customer')}:</label><select id="customer-select">${custOptions}</select></div>
    <div id="checkout-msg"></div></div>`;
  document.getElementById('add-to-cart').addEventListener('click', addToCart);
  ['discount','tax','paid-amount'].forEach(id => document.getElementById(id).addEventListener('input', renderCart));
  renderCart();
}

async function addToCart() {
  const sel = document.getElementById('prod-select'); const [pid, vid] = sel.value.split('_');
  const qty = parseInt(document.getElementById('cart-qty').value);
  if (isNaN(qty)||qty<=0) { showToast('الكمية غير صحيحة', true); return; }
  const { data: v } = await supaCall(() => supabase.from('variants').select('id,selling_price,variant_name,quantity,products(name)').eq('id',vid).single());
  if (!v || v.quantity<qty) { showToast('الكمية غير كافية', true); return; }
  const ex = cart.find(i=>i.variantId===vid);
  if (ex) ex.quantity+=qty;
  else cart.push({productId:pid, variantId:vid, name:v.products.name, variantName:v.variant_name, price:v.selling_price, quantity:qty, max:v.quantity});
  renderCart(); showToast('تمت الإضافة');
}

function renderCart() {
  const tbody = document.querySelector('#cart-table tbody'); if(!tbody) return;
  tbody.innerHTML = ''; let total=0;
  cart.forEach((item,idx)=>{
    const line = item.price*item.quantity; total+=line;
    tbody.innerHTML += `<tr><td>${item.name} ${item.variantName||''}</td><td>${formatCurrency(item.price)}</td><td>${item.quantity}</td><td>${formatCurrency(line)}</td><td><button class="btn btn-danger" onclick="window.removeFromCart(${idx})">X</button></td></tr>`;
  });
  document.getElementById('cart-total').textContent = formatCurrency(total);
  const discount = parseFloat(document.getElementById('discount')?.value)||0;
  const tax = parseFloat(document.getElementById('tax')?.value)||0;
  const paid = parseFloat(document.getElementById('paid-amount')?.value)||0;
  const grand = total-discount+tax;
  document.getElementById('grand-total').textContent = `${formatCurrency(grand)} (المتبقي: ${formatCurrency(grand-paid)})`;
}
window.removeFromCart = idx => { cart.splice(idx,1); renderCart(); };

async function checkout() {
  if (!cart.length) { showToast('العربة فارغة', true); return; }
  tg.MainButton.disable();
  try {
    const total = cart.reduce((s,i)=>s+i.price*i.quantity,0);
    const discount = parseFloat(document.getElementById('discount')?.value)||0;
    const tax = parseFloat(document.getElementById('tax')?.value)||0;
    const paid = parseFloat(document.getElementById('paid-amount')?.value)||0;
    const grand = total-discount+tax;
    const custId = document.getElementById('customer-select')?.value||null;
    const { data: order, error } = await supaCall(() => supabase.from('orders').insert({user_id:currentUserId,total_amount:total,discount,tax,paid_amount:paid,customer_id:custId}).select().single());
    if (error) throw error;
    const itemsData = cart.map(i=>({order_id:order.id,product_id:i.productId,variant_id:i.variantId,quantity:i.quantity,unit_price:i.price}));
    const { error: itemErr } = await supaCall(() => supabase.from('order_items').insert(itemsData));
    if (itemErr) { await supaCall(() => supabase.from('orders').delete().eq('id',order.id)); throw itemErr; }
    for (const it of cart) {
      const { data: v } = await supaCall(() => supabase.from('variants').select('quantity,min_quantity,variant_name,products(name)').eq('id',it.variantId).single());
      if (!v) continue;
      const newQty = v.quantity - it.quantity;
      await supaCall(() => supabase.from('variants').update({quantity:newQty}).eq('id',it.variantId));
      if (v.min_quantity>0 && newQty<=v.min_quantity) {
        fetch('/api/stock-alert',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({variantName:`${v.products.name} ${v.variant_name||''}`,quantity:newQty,minQuantity:v.min_quantity})}).catch(console.error);
      }
    }
    await recordCashTransaction('deposit',paid,'sale',order.id,`بيع #${order.id}`);
    await logActivity('sale',`Order #${order.id}, Total:${grand}`);
    const invItems = cart.map(i=>({name:i.name,variantName:i.variantName,quantity:i.quantity,unit_price:i.price}));
    const custName = custId? (await supaCall(()=>supabase.from('customers').select('name').eq('id',custId).single())).data?.name : null;
    showToast(`تم البيع! رقم الإيصال: ${order.id}`);
    cart=[]; renderCart(); tg.MainButton.hide();
    showInvoice({id:order.id,created_at:order.created_at||new Date().toISOString(),total_amount:total,discount,tax,grand_total:grand,paid_amount:paid,customer_name:custName,items:invItems});
  } catch (err) { showToast(err.message,true); } finally { tg.MainButton.enable(); }
}

function showInvoice(order, type='sale') {
  const {id,created_at,total_amount,discount,tax,grand_total,paid_amount,customer_name,supplier_name,items} = order;
  const net = type==='sale'? grand_total : total_amount-(discount||0);
  const remaining = net - paid_amount;
  const title = type==='sale'?'فاتورة مبيعات':'فاتورة مشتريات';
  const entityLabel = type==='sale'?t('customer'):t('supplier');
  const entityName = type==='sale'?(customer_name||t('cashCustomer')):(supplier_name||'غير محدد');
  const html = `<div id="invoice-modal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;display:flex;justify-content:center;align-items:center;"><div id="invoice-printable" style="background:#fff;padding:20px;border-radius:18px;max-width:400px;width:90%;color:#000;" dir="rtl"><h2>${title} #${id}</h2><p>التاريخ: ${new Date(created_at).toLocaleString()}</p><p>${entityLabel}: ${entityName}</p><table><tr><th>الصنف</th><th>كمية</th><th>سعر</th><th>إجمالي</th></tr>${items.map(i=>`<tr><td>${sanitize(i.name)} ${sanitize(i.variantName||'')}</td><td>${i.quantity}</td><td>${formatCurrency(i.unit_price)}</td><td>${formatCurrency(i.quantity*i.unit_price)}</td></tr>`).join('')}</table><p>الإجمالي: ${formatCurrency(total_amount)}</p><p>${t('discount')}: ${formatCurrency(discount||0)}</p>${type==='sale'?`<p>${t('tax')}: ${formatCurrency(tax)}</p>`:''}<p><strong>المستحق: ${formatCurrency(net)}</strong></p><p>المدفوع: ${formatCurrency(paid_amount)}</p><p>المتبقي: ${formatCurrency(remaining)}</p><div style="text-align:center;margin-top:10px"><button class="btn" id="print-invoice">طباعة</button><button class="btn" id="close-invoice">إغلاق</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
  document.getElementById('close-invoice').addEventListener('click',()=>document.getElementById('invoice-modal').remove());
  document.getElementById('print-invoice').addEventListener('click',()=>{const w=window.open('','_blank');w.document.write(`<html dir="rtl"><head><title>${title} #${id}</title></head><body>${document.getElementById('invoice-printable').innerHTML}</body></html>`);w.print();});
}
// ========== HISTORY ==========
async function showHistory() {
  window.currentRefreshFunction = showHistory; tg.MainButton.hide(); applyBackButton();
  const { data: orders } = await supaCall(() => supabase.from('orders').select('id,created_at,total_amount,discount,tax,grand_total,paid_amount,customers(name),order_items(quantity,unit_price,variants(variant_name,products(name)))').eq('user_id', currentUserId).order('created_at',{ascending:false}));
  let html = `<div class="card"><h2>${t('history')}</h2>`;
  if (!orders?.length) html += `<div class="empty-state">📋<br>${t('noData')}</div>`;
  else {
    orders.forEach(o => {
      const rem = o.grand_total - o.paid_amount;
      html += `<div style="border:1px solid #ccc;margin:8px 0;padding:12px;border-radius:12px"><strong>طلب #${o.id}</strong> - ${new Date(o.created_at).toLocaleString()}<br/><small>${t('customer')}: ${o.customers?.name||t('cashCustomer')} | ${t('total')}: ${formatCurrency(o.total_amount)} | ${t('discount')}: ${formatCurrency(o.discount)} | ${t('tax')}: ${formatCurrency(o.tax)} | ${t('grandTotal')}: ${formatCurrency(o.grand_total)}</small><br/><small>المدفوع: ${formatCurrency(o.paid_amount)} | المتبقي: ${formatCurrency(rem)}</small><button class="btn btn-outline" onclick="window.showInvoiceFromOrder(${o.id})">${t('invoice')}</button><ul>${o.order_items.map(i=>`<li>${i.variants?.products?.name||''} ${i.variants?.variant_name||''} ×${i.quantity} (${formatCurrency(i.unit_price)})</li>`).join('')}</ul></div>`;
    });
    html += `<button class="btn btn-outline" id="export-sales-btn">📥 ${t('exportCSV')}</button>`;
  }
  document.getElementById('view').innerHTML = html;
  document.getElementById('export-sales-btn')?.addEventListener('click', exportSalesCSV);
}
window.showInvoiceFromOrder = async orderId => {
  const { data: order } = await supaCall(() => supabase.from('orders').select('*,customers(name),order_items(quantity,unit_price,variants(variant_name,products(name)))').eq('id',orderId).single());
  showInvoice({id:order.id,created_at:order.created_at,total_amount:order.total_amount,discount:order.discount,tax:order.tax,grand_total:order.grand_total,paid_amount:order.paid_amount,customer_name:order.customers?.name,items:order.order_items.map(i=>({name:i.variants?.products?.name,variantName:i.variants?.variant_name,quantity:i.quantity,unit_price:i.unit_price}))});
};
async function exportSalesCSV() {
  const { data: orders } = await supaCall(() => supabase.from('orders').select('id,created_at,total_amount,discount,tax,grand_total,paid_amount,customers(name)').eq('user_id', currentUserId).order('created_at',{ascending:false}));
  exportToCSV('المبيعات.csv',['رقم الطلب','التاريخ','العميل','الإجمالي','الحسم','الضريبة','الصافي','المدفوع','المتبقي'],orders.map(o=>[o.id,new Date(o.created_at).toLocaleString(),o.customers?.name||'',o.total_amount,o.discount,o.tax,o.grand_total,o.paid_amount,o.grand_total-o.paid_amount]));
}

// ========== ANALYTICS ==========
async function showAnalytics() {
  window.currentRefreshFunction = showAnalytics; tg.MainButton.hide(); applyBackButton();
  const now = new Date(); const days = []; for(let i=6;i>=0;i--){const d=new Date(now);d.setDate(now.getDate()-i);days.push(d.toISOString().split('T')[0]);}
  const { data: orders } = await supaCall(() => supabase.from('orders').select('grand_total,created_at').eq('user_id', currentUserId).gte('created_at',days[0]));
  const dayTotals = days.map(d=>orders?.filter(o=>o.created_at.startsWith(d)).reduce((s,o)=>s+parseFloat(o.grand_total),0)||0);
  const totalSales = dayTotals.reduce((a,b)=>a+b,0);
  const { data: oi } = await supaCall(() => supabase.from('order_items').select('quantity,variant_id,variants(purchase_price)'));
  let totalCost=0; oi?.forEach(i=>{if(i.variants) totalCost+=i.quantity*i.variants.purchase_price;});
  const { data: expenses } = await supaCall(() => supabase.from('expenses').select('amount').eq('user_id', currentUserId).gte('expense_date',days[0]));
  const totalExp = expenses?.reduce((s,e)=>s+parseFloat(e.amount),0)||0;
  const netProfit = totalSales - totalCost - totalExp;
  document.getElementById('view').innerHTML = `<div class="card"><h2>📊 تحليلات</h2><div class="stats-grid"><div class="stat-card"><strong>إجمالي المبيعات</strong><br/>${formatCurrency(totalSales)}</div><div class="stat-card"><strong>تكلفة المبيعات</strong><br/>${formatCurrency(totalCost)}</div><div class="stat-card"><strong>المصروفات</strong><br/>${formatCurrency(totalExp)}</div><div class="stat-card" style="color:${netProfit>=0?'green':'red'}"><strong>صافي الربح</strong><br/>${formatCurrency(netProfit)}</div></div></div>`;
}
// ========== PURCHASES ==========
async function showPurchases() {
  window.currentRefreshFunction = showPurchases; tg.MainButton.hide(); applyBackButton();
  document.getElementById('view').innerHTML = `<div class="card"><h2>${t('purchases')}</h2><button class="btn" id="suppliers-tab-btn">الموردين</button> <button class="btn" id="new-purchase-btn">شراء جديد</button> <button class="btn btn-outline" id="purchases-history-btn">سجل المشتريات</button><div id="purchases-subview" class="card"></div></div>`;
  document.getElementById('suppliers-tab-btn').addEventListener('click', showSuppliers);
  document.getElementById('new-purchase-btn').addEventListener('click', ()=>navigateTo('add-purchase'));
  document.getElementById('purchases-history-btn').addEventListener('click', showPurchasesHistory);
  showSuppliers();
}
async function showSuppliers() {
  const { data: supp } = await supaCall(() => supabase.from('suppliers').select('*').eq('user_id', currentUserId).order('name'));
  let html = `<h3>الموردين</h3><ul>`;
  supp?.forEach(s => html += `<li>${sanitize(s.name)} ${sanitize(s.phone||'')} <button class="btn btn-outline" onclick="window.showEntityPayments('supplier',${s.id})">💰 دفعات</button> <button class="btn btn-danger" onclick="window.deleteSupplier(${s.id})">${t('delete')}</button></li>`);
  html += `</ul><button class="btn btn-outline" id="add-supplier-btn">+ إضافة مورد</button>`;
  document.getElementById('purchases-subview').innerHTML = html;
  document.getElementById('add-supplier-btn').addEventListener('click', ()=>{
    document.getElementById('purchases-subview').innerHTML = `<input id="supp-name" placeholder="الاسم"/><input id="supp-phone" placeholder="الهاتف"/><button class="btn" id="save-supplier-btn">حفظ</button>`;
    document.getElementById('save-supplier-btn').addEventListener('click', async ()=>{
      const name = document.getElementById('supp-name').value.trim();
      if(!name) { showToast('الاسم مطلوب', true); return; }
      await supaCall(()=>supabase.from('suppliers').insert({user_id:currentUserId, name, phone:document.getElementById('supp-phone').value}));
      showToast('تم الحفظ'); showSuppliers();
    });
  });
}
window.deleteSupplier = async id => { if(confirm(t('confirmDelete'))) { await supaCall(()=>supabase.from('suppliers').delete().eq('id',id)); showToast(t('deleted')); showSuppliers(); } };

async function showPurchasesHistory() {
  const { data } = await supaCall(() => supabase.from('purchases').select('id,total_cost,discount,paid_amount,note,created_at,suppliers(name),purchase_items(quantity,unit_cost,variants(variant_name,products(name)))').eq('user_id', currentUserId).order('created_at',{ascending:false}));
  let html = `<h3>سجل المشتريات</h3>`;
  data?.forEach(p => {
    const net = p.total_cost-(p.discount||0); const rem = net-(p.paid_amount||0);
    html += `<div style="border:1px solid #ccc;margin:8px 0;padding:12px;border-radius:12px"><strong>شراء #${p.id}</strong> - ${new Date(p.created_at).toLocaleString()}<br/>${t('supplier')}: ${p.suppliers?.name||'غير محدد'} | الإجمالي: ${formatCurrency(p.total_cost)} | حسم: ${formatCurrency(p.discount||0)}<br/>المستحق: ${formatCurrency(net)} | مدفوع: ${formatCurrency(p.paid_amount||0)} | متبقي: ${formatCurrency(rem)}<ul>${p.purchase_items.map(i=>`<li>${i.variants?.products?.name||''} ${i.variants?.variant_name||''} ×${i.quantity} (${formatCurrency(i.unit_cost)})</li>`).join('')}</ul></div>`;
  });
  document.getElementById('purchases-subview').innerHTML = html;
}

async function showAddPurchaseForm() {
  tg.BackButton.show(); tg.MainButton.setText('إتمام الشراء'); tg.MainButton.show(); tg.MainButton.onClick(completePurchase);
  const { data: products } = await supaCall(() => supabase.from('products').select('id, name, variants(id, variant_name)').eq('user_id', currentUserId));
  let prodOptions = '';
  products.forEach(p => p.variants.forEach(v => prodOptions += `<option value="${p.id}_${v.id}">${p.name} - ${v.variant_name||'غير مسمى'}</option>`));
  const { data: suppliers } = await supaCall(() => supabase.from('suppliers').select('id, name').eq('user_id', currentUserId).order('name'));
  let supplierOpts = '<option value="">بدون مورد</option>';
  suppliers.forEach(s => supplierOpts += `<option value="${s.id}">${s.name}</option>`);
  document.getElementById('view').innerHTML = `<div class="card"><h3>تسجيل شراء جديد</h3>
    <div style="display:flex;gap:8px"><select id="purchase-variant">${prodOptions}</select><input id="purchase-qty" type="number" value="1" min="1" style="width:60px"/><input id="purchase-cost" type="number" step="0.01" placeholder="تكلفة الوحدة"/><button class="btn" id="add-to-purchase-cart">أضف</button></div>
    <table id="purchase-cart-table"><thead><tr><th>الصنف</th><th>تكلفة</th><th>كمية</th><th>إجمالي</th><th></th></tr></thead><tbody></tbody></table>
    <p>الإجمالي: <span id="purchase-total">0</span></p>
    <div><label>حسم مكتسب:</label><input id="purchase-discount" type="number" step="0.01" value="0"/></div>
    <div><label>المدفوع:</label><input id="purchase-paid" type="number" step="0.01" value="0"/></div>
    <div><label>${t('supplier')}:</label><select id="purchase-supplier">${supplierOpts}</select></div>
    <textarea id="purchase-note" placeholder="ملاحظات"></textarea></div>`;
  document.getElementById('add-to-purchase-cart').addEventListener('click', addToPurchaseCart);
  renderPurchaseCart();
}
function addToPurchaseCart() {
  const sel = document.getElementById('purchase-variant'); const [pid,vid] = sel.value.split('_');
  const qty = parseInt(document.getElementById('purchase-qty').value)||1;
  const unitCost = parseFloat(document.getElementById('purchase-cost').value);
  if (isNaN(unitCost)||unitCost<=0) { showToast('أدخل تكلفة صحيحة', true); return; }
  supaCall(()=>supabase.from('variants').select('variant_name, products(name)').eq('id',vid).single())
    .then(({data})=>{ purchaseCart.push({productId:pid, variantId:vid, name:data.products.name, variantName:data.variant_name, unitCost, quantity:qty}); renderPurchaseCart(); });
}
function removeFromPurchaseCart(idx){ purchaseCart.splice(idx,1); renderPurchaseCart(); }
window.removeFromPurchaseCart = removeFromPurchaseCart;
function renderPurchaseCart(){
  const tbody = document.querySelector('#purchase-cart-table tbody'); if(!tbody) return;
  tbody.innerHTML = ''; let total=0;
  purchaseCart.forEach((item,idx)=>{
    const line = item.unitCost*item.quantity; total+=line;
    tbody.innerHTML += `<tr><td>${item.name} ${item.variantName||''}</td><td>${formatCurrency(item.unitCost)}</td><td>${item.quantity}</td><td>${formatCurrency(line)}</td><td><button class="btn btn-danger" onclick="window.removeFromPurchaseCart(${idx})">X</button></td></tr>`;
  });
  document.getElementById('purchase-total').textContent = formatCurrency(total);
}
async function completePurchase() {
  if(!purchaseCart.length) { showToast('عربة المشتريات فارغة', true); return; }
  tg.MainButton.disable();
  try {
    const totalCost = purchaseCart.reduce((s,i)=>s+i.unitCost*i.quantity,0);
    const discount = parseFloat(document.getElementById('purchase-discount')?.value)||0;
    const paidAmount = parseFloat(document.getElementById('purchase-paid')?.value)||0;
    const supplierId = document.getElementById('purchase-supplier')?.value||null;
    const note = document.getElementById('purchase-note')?.value||'';
    if(paidAmount > totalCost - discount + 0.001) { showToast('المدفوع أكبر من المستحق', true); tg.MainButton.enable(); return; }
    const { data: purchase, error } = await supaCall(() => supabase.from('purchases').insert({user_id:currentUserId,supplier_id:supplierId,total_cost:totalCost,discount,paid_amount:paidAmount,note}).select().single());
    if(error) throw error;
    const itemsData = purchaseCart.map(item=>({purchase_id:purchase.id,product_id:item.productId,variant_id:item.variantId,quantity:item.quantity,unit_cost:item.unitCost}));
    await supaCall(() => supabase.from('purchase_items').insert(itemsData));
    for(const item of purchaseCart) {
      const { data: variant } = await supaCall(() => supabase.from('variants').select('quantity').eq('id',item.variantId).single());
      if(variant) await supaCall(() => supabase.from('variants').update({quantity:variant.quantity+item.quantity}).eq('id',item.variantId));
    }
    await recordCashTransaction('withdraw', paidAmount, 'purchase', purchase.id, `شراء #${purchase.id}`);
    await logActivity('purchase', `Purchase #${purchase.id}, Total: ${totalCost}`);
    showToast(`تم الشراء! رقم العملية: ${purchase.id}`);
    purchaseCart=[]; tg.MainButton.hide(); goBack();
  } catch (err) { showToast(err.message,true); } finally { tg.MainButton.enable(); }
}
// ========== CUSTOMERS ==========
async function showCustomers() {
  window.currentRefreshFunction = showCustomers; tg.MainButton.hide(); applyBackButton();
  const { data: customers } = await supaCall(() => supabase.from('customers').select('*').eq('user_id', currentUserId).order('name'));
  let html = `<div class="card"><h2>${t('customers')}</h2><input class="search-input" id="search-customers" placeholder="${t('search')}"/><ul>`;
  customers?.forEach(c => html += `<li>${sanitize(c.name)} ${sanitize(c.phone||'')} <button class="btn btn-outline" onclick="window.showEntityPayments('customer',${c.id})">💰 دفعات</button> <button class="btn btn-danger" onclick="window.deleteCustomer(${c.id})">${t('delete')}</button></li>`);
  html += `</ul><button class="btn" id="add-customer-btn">+ ${t('addMaterial')}</button><button class="btn btn-outline" id="export-customers-btn">📥 ${t('exportCSV')}</button></div>`;
  document.getElementById('view').innerHTML = html;
  document.getElementById('search-customers')?.addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('li').forEach(li => li.style.display = li.textContent.toLowerCase().includes(term) ? '' : 'none');
  });
  document.getElementById('add-customer-btn')?.addEventListener('click', ()=>navigateTo('add-customer'));
  document.getElementById('export-customers-btn')?.addEventListener('click', exportCustomersCSV);
}
window.deleteCustomer = async id => { if(confirm(t('confirmDelete'))) { await supaCall(()=>supabase.from('customers').delete().eq('id',id)); showToast(t('deleted')); showCustomers(); } };

async function showAddCustomerForm() {
  tg.BackButton.show(); tg.MainButton.setText(t('save')); tg.MainButton.show(); tg.MainButton.onClick(saveCustomer);
  document.getElementById('view').innerHTML = `<div class="card"><h3>إضافة عميل</h3><input id="cust-name" placeholder="الاسم"/><input id="cust-phone" placeholder="الهاتف"/><textarea id="cust-notes" placeholder="ملاحظات"></textarea></div>`;
}
async function saveCustomer() {
  const name = document.getElementById('cust-name').value.trim();
  if(!name) { showToast('الاسم مطلوب', true); return; }
  tg.MainButton.disable();
  try {
    await supaCall(()=>supabase.from('customers').insert({user_id:currentUserId, name, phone:document.getElementById('cust-phone').value, notes:document.getElementById('cust-notes').value}));
    showToast(t('saved')); tg.MainButton.hide(); goBack(); showCustomers();
  } catch (err) { showToast(err.message,true); } finally { tg.MainButton.enable(); }
}
async function exportCustomersCSV() {
  const { data } = await supaCall(()=>supabase.from('customers').select('name, phone, notes').eq('user_id', currentUserId));
  exportToCSV('العملاء.csv',['الاسم','الهاتف','ملاحظات'], data.map(c=>[c.name, c.phone||'', c.notes||'']));
}

// ========== CASH ==========
async function showCashRegister() {
  window.currentRefreshFunction = showCashRegister; tg.MainButton.hide(); applyBackButton();
  const { data: transactions } = await supaCall(() => supabase.from('cash_register').select('*').eq('user_id', currentUserId).order('created_at',{ascending:false}));
  let balance = transactions?.reduce((sum,t)=>sum+(t.type==='deposit'?t.amount:-t.amount),0)||0;
  let html = `<div class="card"><h2>${t('cash')}</h2><div class="stat-card"><strong>الرصيد</strong><br/>${formatCurrency(balance)}</div><input class="search-input" id="search-cash" placeholder="${t('search')}"/><ul>`;
  transactions?.forEach(t => {
    const sign = t.type==='deposit'?'+':'-';
    html += `<li style="color:${t.type==='deposit'?'green':'red'}">${sign}${t.amount} ل.س - ${sanitize(t.note||'')} <small>${new Date(t.created_at).toLocaleString()}</small></li>`;
  });
  html += `</ul><button class="btn" id="add-deposit-btn">+ إيداع</button> <button class="btn btn-outline" id="add-withdraw-btn">- سحب</button> <button class="btn btn-outline" id="export-cash-btn">📥 ${t('exportCSV')}</button></div>`;
  document.getElementById('view').innerHTML = html;
  document.getElementById('search-cash')?.addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('li').forEach(li => li.style.display = li.textContent.toLowerCase().includes(term) ? '' : 'none');
  });
  document.getElementById('add-deposit-btn')?.addEventListener('click', ()=>navigateTo('add-cash-transaction',{type:'deposit'}));
  document.getElementById('add-withdraw-btn')?.addEventListener('click', ()=>navigateTo('add-cash-transaction',{type:'withdraw'}));
  document.getElementById('export-cash-btn')?.addEventListener('click', exportCashCSV);
}
async function showAddCashTransactionForm(type) {
  tg.BackButton.show(); tg.MainButton.setText(t('save')); tg.MainButton.show(); tg.MainButton.onClick(()=>saveCashTransaction(type));
  document.getElementById('view').innerHTML = `<div class="card"><h3>${type==='deposit'?'إيداع':'سحب'} جديد</h3><input id="cash-amount" type="number" step="0.01" placeholder="المبلغ"/><textarea id="cash-note" placeholder="ملاحظات"></textarea></div>`;
}
async function saveCashTransaction(type) {
  const amount = parseFloat(document.getElementById('cash-amount')?.value);
  if(isNaN(amount)||amount<=0) { showToast('أدخل مبلغاً صحيحاً', true); return; }
  const note = document.getElementById('cash-note')?.value?.trim()||'';
  tg.MainButton.disable();
  try {
    await supaCall(()=>supabase.from('cash_register').insert({user_id:currentUserId, type, amount, reference_type:'manual', note}));
    showToast(t('saved')); tg.MainButton.hide(); goBack(); showCashRegister();
  } catch (err) { showToast(err.message,true); } finally { tg.MainButton.enable(); }
}
async function exportCashCSV() {
  const { data } = await supaCall(()=>supabase.from('cash_register').select('type, amount, note, created_at').eq('user_id', currentUserId));
  exportToCSV('الصندوق.csv',['النوع','المبلغ','ملاحظات','التاريخ'], data.map(t=>[t.type==='deposit'?'إيداع':'سحب', t.amount, t.note||'', new Date(t.created_at).toLocaleString()]));
}

// ========== EXPENSES ==========
async function showExpenses() {
  window.currentRefreshFunction = showExpenses; tg.MainButton.hide(); applyBackButton();
  const { data: expenses } = await supaCall(() => supabase.from('expenses').select('*').eq('user_id', currentUserId).order('expense_date',{ascending:false}));
  const { data: workers } = await supaCall(() => supabase.from('expenses').select('worker_name, amount').eq('user_id', currentUserId).not('worker_name','eq',''));
  const workerTotals = {};
  workers?.forEach(e => { const w = e.worker_name||'بدون'; workerTotals[w] = (workerTotals[w]||0)+parseFloat(e.amount); });
  const totalAll = expenses?.reduce((s,e)=>s+parseFloat(e.amount),0)||0;
  let html = `<div class="card"><h2>${t('expenses')}</h2><p>الإجمالي العام: ${formatCurrency(totalAll)}</p>
    <div class="worker-summary"><h4>توزيع حسب العامل</h4><ul>${Object.entries(workerTotals).map(([n,t])=>`<li><strong>${sanitize(n)}</strong>: ${formatCurrency(t)}</li>`).join('')||'<li>لا بيانات</li>'}</ul></div>
    <input class="search-input" id="search-expenses" placeholder="${t('search')}"/><table><thead><tr><th>التاريخ</th><th>الفئة</th><th>العامل</th><th>المبلغ</th><th>الوصف</th><th></th></tr></thead><tbody>
    ${expenses?.map(e=>`<tr><td>${new Date(e.expense_date).toLocaleDateString()}</td><td>${sanitize(e.category)}</td><td>${sanitize(e.worker_name||'-')}</td><td>${formatCurrency(e.amount)}</td><td>${sanitize(e.description||'')}</td><td><button class="btn btn-danger" onclick="window.deleteExpense(${e.id})">${t('delete')}</button></td></tr>`).join('')||`<tr><td colspan="6">${t('noData')}</td></tr>`}
    </tbody></table><button class="btn" id="add-expense-btn">+ إضافة مصروف</button> <button class="btn btn-outline" id="export-expenses-btn">📥 ${t('exportCSV')}</button></div>`;
  document.getElementById('view').innerHTML = html;
  document.getElementById('search-expenses')?.addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('table tbody tr').forEach(row => row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none');
  });
  document.getElementById('add-expense-btn')?.addEventListener('click', ()=>navigateTo('add-expense'));
  document.getElementById('export-expenses-btn')?.addEventListener('click', exportExpensesCSV);
}
window.deleteExpense = async id => { if(confirm(t('confirmDelete'))) { await supaCall(()=>supabase.from('expenses').delete().eq('id',id)); showToast(t('deleted')); showExpenses(); } };

async function showAddExpenseForm() {
  tg.BackButton.show(); tg.MainButton.setText(t('save')); tg.MainButton.show(); tg.MainButton.onClick(saveExpense);
  document.getElementById('view').innerHTML = `<div class="card"><h3>إضافة مصروف</h3><input id="expense-amount" type="number" step="0.01" placeholder="المبلغ"/><input id="expense-category" placeholder="الفئة" value="أخرى"/><input id="expense-worker" placeholder="اسم العامل"/><input id="expense-desc" placeholder="الوصف"/><input id="expense-date" type="date" value="${new Date().toISOString().split('T')[0]}"/></div>`;
}
async function saveExpense() {
  const amount = parseFloat(document.getElementById('expense-amount')?.value);
  if(isNaN(amount)||amount<=0) { showToast('أدخل مبلغاً صحيحاً', true); return; }
  const category = document.getElementById('expense-category')?.value?.trim()||'أخرى';
  const workerName = document.getElementById('expense-worker')?.value?.trim()||'';
  const description = document.getElementById('expense-desc')?.value?.trim()||'';
  const date = document.getElementById('expense-date')?.value || new Date().toISOString().split('T')[0];
  tg.MainButton.disable();
  try {
    const { data: record } = await supaCall(()=>supabase.from('expenses').insert({user_id:currentUserId,amount,category,worker_name:workerName,description,expense_date:date}).select('id').single());
    await recordCashTransaction('withdraw', amount, 'expense', record.id, `${category} - ${workerName}`);
    showToast(t('saved')); tg.MainButton.hide(); goBack(); showExpenses();
  } catch (err) { showToast(err.message,true); } finally { tg.MainButton.enable(); }
}
async function exportExpensesCSV() {
  const { data } = await supaCall(()=>supabase.from('expenses').select('amount, category, description, expense_date, worker_name').eq('user_id', currentUserId));
  exportToCSV('المصروفات.csv',['المبلغ','الفئة','الوصف','التاريخ','العامل'], data.map(e=>[e.amount, e.category, e.description||'', e.expense_date, e.worker_name||'']));
}

// ========== ALERTS ==========
async function showAlerts() {
  window.currentRefreshFunction = showAlerts; tg.MainButton.hide(); applyBackButton();
  const { data: variants } = await supaCall(() => supabase.from('variants').select('id, quantity, min_quantity, variant_name, products(name)').gt('min_quantity',0));
  const lowStock = variants?.filter(v => v.quantity <= v.min_quantity) || [];
  let html = `<div class="card"><h2>${t('alerts')}</h2>`;
  if(!lowStock.length) html += `<div class="empty-state">🔔<br>${t('noData')}</div>`;
  else { html += '<ul>'; lowStock.forEach(v => html += `<li><strong>${v.products.name}</strong> - ${v.variant_name||'غير مسمى'} – ${v.quantity} (حد ${v.min_quantity})</li>`); html += '</ul>'; }
  html += `<button class="btn btn-outline" onclick="window.setOwnerChatId()">تفعيل تنبيهات تيليجرام</button></div>`;
  document.getElementById('view').innerHTML = html;
}
window.setOwnerChatId = async () => {
  const userId = tg.initDataUnsafe.user.id.toString();
  await supaCall(()=>supabase.from('bot_settings').upsert({key:'owner_chat_id',value:userId},{onConflict:'key'}));
  showToast('تم تفعيل التنبيهات');
};
// ========== STARTUP ==========
(async () => {
  try {
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: tg.initData }) });
    if (!res.ok) { document.getElementById('view').innerHTML = '<div class="empty-state">❌ فشل المصادقة</div>'; return; }
    const { token, userId } = await res.json();
    supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
    await supabase.auth.setSession({ access_token: token, refresh_token: '' });
    currentUserId = userId;
    usdRate = 15000;
    initRouter();
    navigateTo('materials');
  } catch (err) {
    document.getElementById('view').innerHTML = `<div class="card" style="color:red;">⚠️ خطأ: ${err.message}</div>`;
  }
})();
