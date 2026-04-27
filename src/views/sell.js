import { getSupabase, supaCall, logActivity, getCurrentUserId, recordCashTransaction } from '../utils/supabase-client.js';
import { sanitize, formatCurrency, showToast } from '../utils/helpers.js';
import { t } from '../config/i18n.js';
import { navigateTo, goBack } from '../navigation/router.js';
import { showInvoice } from './invoice.js';

const tg = window.tg;
let cart = [];

export async function showSellForm() {
  window.currentRefreshFunction = showSellForm;
  tg.MainButton.setText('إتمام البيع'); tg.MainButton.show(); tg.MainButton.onClick(checkout);
  const { data: products } = await supaCall(() => getSupabase().from('products').select('id, name, variants!inner(id, variant_name, selling_price, quantity)').gt('variants.quantity', 0).order('name'));
  let prodOptions = '';
  products.forEach(p => p.variants.forEach(v => prodOptions += `<option value="${p.id}_${v.id}">${p.name} - ${v.variant_name || 'غير مسمى'} (${formatCurrency(v.selling_price)})</option>`));
  const { data: customers } = await supaCall(() => getSupabase().from('customers').select('id, name').order('name'));
  let custOptions = `<option value="">${t('cashCustomer')}</option>`;
  customers.forEach(c => custOptions += `<option value="${c.id}">${c.name}</option>`);
  document.getElementById('view').innerHTML = `<div class="card"><h2>${t('sell')}</h2>
    <div style="display:flex;gap:8px"><select id="prod-select">${prodOptions}</select><input id="cart-qty" type="number" value="1" min="1" style="width:60px"/><button class="btn btn-sm" id="add-to-cart">أضف</button></div>
    <table id="cart-table"><thead><tr><th>الصنف</th><th>سعر</th><th>كمية</th><th>إجمالي</th><th></th></tr></thead><tbody></tbody></table>
    <p>${t('total')}: <span id="cart-total">0</span></p>
    <div><label>${t('discount')}:</label><input id="discount" type="number" value="0" step="0.01"/></div>
    <div><label>${t('tax')}:</label><input id="tax" type="number" value="0" step="0.01"/></div>
    <div><label>${t('paid')}:</label><input id="paid-amount" type="number" value="0" step="0.01"/></div>
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
  if (isNaN(qty) || qty <= 0) { showToast(t('quantityInsufficient'), true); return; }
  const { data: v } = await supaCall(() => getSupabase().from('variants').select('id,selling_price,variant_name,quantity,products(name)').eq('id', vid).single());
  if (!v || v.quantity < qty) { showToast(t('quantityInsufficient'), true); return; }
  const ex = cart.find(i => i.variantId === vid);
  if (ex) ex.quantity += qty;
  else cart.push({ productId: pid, variantId: vid, name: v.products.name, variantName: v.variant_name, price: v.selling_price, quantity: qty, max: v.quantity });
  renderCart(); showToast('تمت الإضافة');
}

function renderCart() {
  const tbody = document.querySelector('#cart-table tbody'); if (!tbody) return;
  tbody.innerHTML = ''; let total = 0;
  cart.forEach((item, idx) => {
    const line = item.price * item.quantity; total += line;
    tbody.innerHTML += `<tr><td>${item.name} ${item.variantName || ''}</td><td>${formatCurrency(item.price)}</td><td>${item.quantity}</td><td>${formatCurrency(line)}</td><td><button class="btn btn-sm btn-danger" onclick="window.removeFromCart(${idx})">X</button></td></tr>`;
  });
  document.getElementById('cart-total').textContent = formatCurrency(total);
  const discount = parseFloat(document.getElementById('discount')?.value) || 0;
  const tax = parseFloat(document.getElementById('tax')?.value) || 0;
  const paid = parseFloat(document.getElementById('paid-amount')?.value) || 0;
  const grand = total - discount + tax;
  document.getElementById('grand-total').textContent = `${formatCurrency(grand)} (${t('remaining')}: ${formatCurrency(grand - paid)})`;
}
window.removeFromCart = idx => { cart.splice(idx, 1); renderCart(); };

async function checkout() {
  if (!cart.length) { showToast(t('cartEmpty'), true); return; }
  tg.MainButton.disable(); tg.MainButton.showProgress();
  try {
    const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const discount = parseFloat(document.getElementById('discount')?.value) || 0;
    const tax = parseFloat(document.getElementById('tax')?.value) || 0;
    const paid = parseFloat(document.getElementById('paid-amount')?.value) || 0;
    const grand = total - discount + tax;
    const custId = document.getElementById('customer-select')?.value || null;
    const { data: order, error } = await supaCall(() => getSupabase().from('orders').insert({
      user_id: getCurrentUserId(), total_amount: total, discount, tax, paid_amount: paid, customer_id: custId
    }).select().single());
    if (error) throw error;
    const itemsData = cart.map(i => ({
      order_id: order.id, product_id: i.productId, variant_id: i.variantId,
      quantity: i.quantity, unit_price: i.price
    }));
    const { error: itemErr } = await supaCall(() => getSupabase().from('order_items').insert(itemsData));
    if (itemErr) { await supaCall(() => getSupabase().from('orders').delete().eq('id', order.id)); throw itemErr; }
    for (const it of cart) {
      const { data: v } = await supaCall(() => getSupabase().from('variants').select('quantity,min_quantity,variant_name,products(name)').eq('id', it.variantId).single());
      if (!v) continue;
      const newQty = v.quantity - it.quantity;
      await supaCall(() => getSupabase().from('variants').update({ quantity: newQty }).eq('id', it.variantId));
      if (v.min_quantity > 0 && newQty <= v.min_quantity) {
        fetch('/api/stock-alert', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variantName: `${v.products.name} ${v.variant_name || ''}`, quantity: newQty, minQuantity: v.min_quantity })
        }).catch(console.error);
      }
    }
    await recordCashTransaction('deposit', paid, 'sale', order.id, `بيع #${order.id}`);
    await logActivity('sale', `Order #${order.id}, Total: ${grand}`);
    const invItems = cart.map(i => ({ name: i.name, variantName: i.variantName, quantity: i.quantity, unit_price: i.price }));
    const custName = custId ? (await supaCall(() => getSupabase().from('customers').select('name').eq('id', custId).single())).data?.name : null;
    showToast(`تم البيع! رقم الإيصال: ${order.id}`);
    cart = []; renderCart(); tg.MainButton.hide();
    showInvoice({
      id: order.id, created_at: order.created_at || new Date().toISOString(),
      total_amount: total, discount, tax, grand_total: grand, paid_amount: paid,
      customer_name: custName, items: invItems
    });
  } catch (err) { showToast(err.message, true); } finally { tg.MainButton.hideProgress(); tg.MainButton.enable(); }
}
