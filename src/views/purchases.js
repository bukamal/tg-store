import { getSupabase, supaCall, logActivity, getCurrentUserId, recordCashTransaction } from '../utils/supabase-client.js';
import { sanitize, formatCurrency, showToast } from '../utils/helpers.js';
import { t } from '../config/i18n.js';
import { navigateTo, goBack } from '../navigation/router.js';
import { showInvoice } from './invoice.js';

const tg = window.tg;
let purchaseCart = [];

export async function showPurchases() {
  window.currentRefreshFunction = showPurchases; tg.MainButton.hide();
  document.getElementById('view').innerHTML = `<div class="card"><h2>${t('purchases')}</h2><button class="btn" id="suppliers-tab-btn">الموردين</button> <button class="btn" id="new-purchase-btn">شراء جديد</button> <button class="btn btn-outline" id="purchases-history-btn">سجل المشتريات</button><div id="purchases-subview" class="card"></div></div>`;
  document.getElementById('suppliers-tab-btn').addEventListener('click', showSuppliers);
  document.getElementById('new-purchase-btn').addEventListener('click', () => navigateTo('add-purchase'));
  document.getElementById('purchases-history-btn').addEventListener('click', showPurchasesHistory);
  showSuppliers();
}

export async function showSuppliers() {
  const { data: supp } = await supaCall(() => getSupabase().from('suppliers').select('*').order('name'));
  let html = `<h3>الموردين</h3><ul>`;
  supp?.forEach(s => html += `<li>${sanitize(s.name)} ${sanitize(s.phone || '')} <button class="btn btn-sm btn-outline" onclick="window.showEntityPayments('supplier',${s.id})">💰 دفعات</button> <button class="btn btn-sm btn-danger" onclick="window.deleteSupplier(${s.id})">${t('delete')}</button></li>`);
  html += `</ul><button class="btn btn-outline" id="add-supplier-btn">+ إضافة مورد</button>`;
  document.getElementById('purchases-subview').innerHTML = html;
  document.getElementById('add-supplier-btn').addEventListener('click', () => {
    document.getElementById('purchases-subview').innerHTML = `<input id="supp-name" placeholder="الاسم"/><input id="supp-phone" placeholder="الهاتف"/><button class="btn" id="save-supplier-btn">حفظ</button>`;
    document.getElementById('save-supplier-btn').addEventListener('click', async () => {
      const name = document.getElementById('supp-name').value.trim();
      if (!name) { showToast('الاسم مطلوب', true); return; }
      await supaCall(() => getSupabase().from('suppliers').insert({ user_id: getCurrentUserId(), name, phone: document.getElementById('supp-phone').value }));
      showToast('تم الحفظ'); showSuppliers();
    });
  });
}
window.deleteSupplier = async id => { if (confirm(t('confirmDelete'))) { await supaCall(() => getSupabase().from('suppliers').delete().eq('id', id)); showToast(t('deleted')); showSuppliers(); } };

export async function showPurchasesHistory() {
  const { data } = await supaCall(() => getSupabase().from('purchases').select('id,total_cost,discount,paid_amount,note,created_at,suppliers(name),purchase_items(quantity,unit_cost,variants(variant_name,products(name)))').order('created_at', { ascending: false }));
  let html = `<h3>سجل المشتريات</h3>`;
  data?.forEach(p => {
    const net = p.total_cost - (p.discount || 0); const rem = net - (p.paid_amount || 0);
    html += `<div style="border:1px solid var(--glass-border);margin:8px 0;padding:12px;border-radius:12px"><strong>شراء #${p.id}</strong> - ${new Date(p.created_at).toLocaleString()}<br/>${t('supplier')}: ${p.suppliers?.name || 'غير محدد'} | الإجمالي: ${formatCurrency(p.total_cost)} | حسم: ${formatCurrency(p.discount || 0)}<br/>المستحق: ${formatCurrency(net)} | مدفوع: ${formatCurrency(p.paid_amount || 0)} | متبقي: ${formatCurrency(rem)}<ul>${p.purchase_items.map(i => `<li>${i.variants?.products?.name || ''} ${i.variants?.variant_name || ''} ×${i.quantity} (${formatCurrency(i.unit_cost)})</li>`).join('')}</ul></div>`;
  });
  document.getElementById('purchases-subview').innerHTML = html;
}

export async function showAddPurchaseForm() {
  tg.BackButton.show(); tg.MainButton.setText('إتمام الشراء'); tg.MainButton.show(); tg.MainButton.onClick(completePurchase);
  const { data: products } = await supaCall(() => getSupabase().from('products').select('id, name, variants(id, variant_name)'));
  let prodOptions = '';
  products.forEach(p => p.variants.forEach(v => prodOptions += `<option value="${p.id}_${v.id}">${p.name} - ${v.variant_name || 'غير مسمى'}</option>`));
  const { data: suppliers } = await supaCall(() => getSupabase().from('suppliers').select('id, name').order('name'));
  let supplierOpts = '<option value="">بدون مورد</option>';
  suppliers.forEach(s => supplierOpts += `<option value="${s.id}">${s.name}</option>`);
  document.getElementById('view').innerHTML = `<div class="card"><h3>تسجيل شراء جديد</h3>
    <div style="display:flex;gap:8px"><select id="purchase-variant">${prodOptions}</select><input id="purchase-qty" type="number" value="1" min="1" style="width:60px"/><input id="purchase-cost" type="number" step="0.01" placeholder="تكلفة الوحدة"/><button class="btn btn-sm" id="add-to-purchase-cart">أضف</button></div>
    <table id="purchase-cart-table"><thead><tr><th>الصنف</th><th>تكلفة</th><th>كمية</th><th>إجمالي</th><th></th></tr></thead><tbody></tbody></table>
    <p>الإجمالي: <span id="purchase-total">0</span></p>
    <div><label>حسم مكتسب:</label><input id="purchase-discount" type="number" step="0.01" value="0"/></div>
    <div><label>المدفوع:</label><input id="purchase-paid" type="number" step="0.01" value="0"/></div>
    <div><label>${t('supplier')}:</label><select id="purchase-supplier">${supplierOpts}</select></div>
    <textarea id="purchase-note" placeholder="ملاحظات"></textarea>
    <div id="purchase-msg"></div></div>`;
  document.getElementById('add-to-purchase-cart').addEventListener('click', addToPurchaseCart);
  renderPurchaseCart();
}

function addToPurchaseCart() {
  const select = document.getElementById('purchase-variant');
  const [productId, variantId] = select.value.split('_');
  const qty = parseInt(document.getElementById('purchase-qty').value) || 1;
  const unitCost = parseFloat(document.getElementById('purchase-cost').value);
  if (isNaN(unitCost) || unitCost <= 0) { showToast('أدخل تكلفة صحيحة', true); return; }
  supaCall(() => getSupabase().from('variants').select('variant_name, products(name)').eq('id', variantId).single())
    .then(({ data }) => {
      purchaseCart.push({ productId, variantId, name: data.products.name, variantName: data.variant_name, unitCost, quantity: qty });
      renderPurchaseCart();
    });
}

function removeFromPurchaseCart(idx) { purchaseCart.splice(idx, 1); renderPurchaseCart(); }
window.removeFromPurchaseCart = removeFromPurchaseCart;

function renderPurchaseCart() {
  const tbody = document.querySelector('#purchase-cart-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  let total = 0;
  purchaseCart.forEach((item, idx) => {
    const line = item.unitCost * item.quantity;
    total += line;
    tbody.innerHTML += `<tr><td>${item.name} ${item.variantName || ''}</td><td>${formatCurrency(item.unitCost)}</td><td>${item.quantity}</td><td>${formatCurrency(line)}</td><td><button class="btn btn-sm btn-danger" onclick="window.removeFromPurchaseCart(${idx})">X</button></td></tr>`;
  });
  document.getElementById('purchase-total').textContent = formatCurrency(total);
}

async function completePurchase() {
  if (!purchaseCart.length) { showToast('عربة المشتريات فارغة', true); return; }
  tg.MainButton.disable(); tg.MainButton.showProgress();
  try {
    const totalCost = purchaseCart.reduce((s, i) => s + i.unitCost * i.quantity, 0);
    const discount = parseFloat(document.getElementById('purchase-discount')?.value) || 0;
    const paidAmount = parseFloat(document.getElementById('purchase-paid')?.value) || 0;
    const supplierId = document.getElementById('purchase-supplier')?.value || null;
    const note = document.getElementById('purchase-note')?.value || '';
    if (paidAmount > totalCost - discount + 0.001) { showToast('المدفوع أكبر من المستحق', true); tg.MainButton.enable(); return; }
    const { data: purchase, error } = await supaCall(() => getSupabase().from('purchases').insert({
      user_id: getCurrentUserId(), supplier_id: supplierId, total_cost: totalCost, discount, paid_amount: paidAmount, note
    }).select().single());
    if (error) throw error;
    const itemsData = purchaseCart.map(item => ({
      purchase_id: purchase.id, product_id: item.productId, variant_id: item.variantId,
      quantity: item.quantity, unit_cost: item.unitCost
    }));
    const { error: itemsError } = await supaCall(() => getSupabase().from('purchase_items').insert(itemsData));
    if (itemsError) { await supaCall(() => getSupabase().from('purchases').delete().eq('id', purchase.id)); throw itemsError; }
    for (const item of purchaseCart) {
      const { data: variant } = await supaCall(() => getSupabase().from('variants').select('quantity').eq('id', item.variantId).single());
      if (variant) await supaCall(() => getSupabase().from('variants').update({ quantity: variant.quantity + item.quantity }).eq('id', item.variantId));
    }
    await recordCashTransaction('withdraw', paidAmount, 'purchase', purchase.id, `شراء #${purchase.id}`);
    await logActivity('purchase', `Purchase #${purchase.id}, Total: ${totalCost}`);
    showToast(`تم الشراء! رقم العملية: ${purchase.id}`);
    purchaseCart = []; tg.MainButton.hide(); goBack();
  } catch (err) { showToast(err.message, true); } finally { tg.MainButton.hideProgress(); tg.MainButton.enable(); }
}
