import { getSupabase, supaCall, logActivity, getCurrentUserId, recordCashTransaction } from '../utils/supabase-client.js';
import { sanitize, formatCurrency, showToast, exportToCSV } from '../utils/helpers.js';
import { t } from '../config/i18n.js';
import { navigateTo, goBack } from '../navigation/router.js';

const tg = window.tg;

export async function showCustomers() {
  window.currentRefreshFunction = showCustomers; tg.MainButton.hide();
  const { data: customers } = await supaCall(() => getSupabase().from('customers').select('*').order('name'));
  let html = `<div class="card"><h2>${t('customers')}</h2><input class="search-input" id="search-customers" placeholder="${t('search')}"/><ul>`;
  customers?.forEach(c => html += `<li>${sanitize(c.name)} ${sanitize(c.phone||'')} <button class="btn btn-sm btn-outline" onclick="window.showEntityPayments('customer',${c.id})">💰 دفعات</button> <button class="btn btn-sm btn-danger" onclick="window.deleteCustomer(${c.id})">${t('delete')}</button></li>`);
  html += `</ul><button class="btn" id="add-customer-btn">+ ${t('addProduct')}</button><button class="btn btn-outline" id="export-customers-btn">📥 ${t('exportCSV')}</button></div>`;
  document.getElementById('view').innerHTML = html;
  document.getElementById('search-customers')?.addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('li').forEach(li => li.style.display = li.textContent.toLowerCase().includes(term) ? '' : 'none');
  });
  document.getElementById('add-customer-btn')?.addEventListener('click', () => navigateTo('add-customer'));
  document.getElementById('export-customers-btn')?.addEventListener('click', exportCustomersCSV);
}
window.deleteCustomer = async id => { if (confirm(t('confirmDelete'))) { await supaCall(() => getSupabase().from('customers').delete().eq('id', id)); showToast(t('deleted')); showCustomers(); } };

export async function showAddCustomerForm() {
  tg.BackButton.show(); tg.MainButton.setText(t('save')); tg.MainButton.show(); tg.MainButton.onClick(saveCustomer);
  document.getElementById('view').innerHTML = `<div class="card"><h3>إضافة عميل</h3><input id="cust-name" placeholder="الاسم"/><input id="cust-phone" placeholder="الهاتف"/><textarea id="cust-notes" placeholder="${t('notes')}"></textarea></div>`;
}
async function saveCustomer() {
  const name = document.getElementById('cust-name').value.trim();
  if (!name) { showToast('الاسم مطلوب', true); return; }
  tg.MainButton.disable();
  try {
    await supaCall(() => getSupabase().from('customers').insert({ user_id: getCurrentUserId(), name, phone: document.getElementById('cust-phone').value, notes: document.getElementById('cust-notes').value }));
    showToast(t('saved')); tg.MainButton.hide(); goBack(); showCustomers();
  } catch (err) { showToast(err.message, true); } finally { tg.MainButton.enable(); }
}
async function exportCustomersCSV() {
  const { data } = await supaCall(() => getSupabase().from('customers').select('name, phone, notes'));
  exportToCSV('العملاء.csv', ['الاسم','الهاتف','ملاحظات'], data.map(c => [c.name, c.phone||'', c.notes||'']));
}

window.showEntityPayments = async (type, entityId) => {
  const table = type === 'customer' ? 'orders' : 'purchases';
  const entityField = type === 'customer' ? 'customer_id' : 'supplier_id';
  const { data: invoices } = await supaCall(() => getSupabase().from(table).select('id, created_at, grand_total, paid_amount, total_amount').eq(entityField, entityId).neq('paid_amount', getSupabase().raw('COALESCE(grand_total, total_amount)')).order('created_at'));
  const totalRemaining = invoices?.reduce((sum, inv) => sum + ((inv.grand_total || inv.total_amount) - inv.paid_amount), 0) || 0;
  let html = `<div class="card"><h3>💰 دفعات ${type==='customer'?'العميل':'المورد'}</h3><p>إجمالي المتبقي: ${formatCurrency(totalRemaining)}</p><ul>`;
  invoices?.forEach(inv => { const due = (inv.grand_total||inv.total_amount) - inv.paid_amount; html += `<li>فاتورة #${inv.id} - ${new Date(inv.created_at).toLocaleDateString()} | المتبقي: ${formatCurrency(due)}</li>`; });
  html += `</ul><input id="payment-amount" type="number" step="0.01" placeholder="مبلغ الدفعة"/><button class="btn" id="submit-payment">تسديد</button> <button class="btn btn-secondary" id="cancel-payment">إلغاء</button></div>`;
  document.getElementById('view').innerHTML = html;
  document.getElementById('submit-payment').addEventListener('click', () => window.registerPayment(type, entityId));
  document.getElementById('cancel-payment').addEventListener('click', goBack);
};

window.registerPayment = async (type, entityId) => {
  const amount = parseFloat(document.getElementById('payment-amount')?.value);
  if (isNaN(amount) || amount <= 0) { showToast('أدخل مبلغاً صحيحاً', true); return; }
  const table = type === 'customer' ? 'orders' : 'purchases';
  const entityField = type === 'customer' ? 'customer_id' : 'supplier_id';
  const { data: invoices } = await supaCall(() => getSupabase().from(table).select('id, grand_total, paid_amount, total_amount').eq(entityField, entityId).neq('paid_amount', getSupabase().raw('COALESCE(grand_total, total_amount)')).order('created_at'));
  if (!invoices?.length) { showToast('لا توجد فواتير غير مسددة', true); return; }
  let remaining = amount;
  for (const inv of invoices) {
    const due = (inv.grand_total || inv.total_amount) - inv.paid_amount;
    if (remaining <= 0) break;
    const payNow = Math.min(remaining, due);
    await supaCall(() => getSupabase().from(table).update({ paid_amount: inv.paid_amount + payNow }).eq('id', inv.id));
    if (type === 'customer') await recordCashTransaction('deposit', payNow, 'payment', inv.id, `دفعة من عميل للفاتورة #${inv.id}`);
    else await recordCashTransaction('withdraw', payNow, 'payment', inv.id, `دفعة لمورد للفاتورة #${inv.id}`);
    remaining -= payNow;
  }
  await logActivity('payment', `${type} ID:${entityId}, Amount:${amount}`);
  showToast(`تم تسديد ${formatCurrency(amount - remaining)}`);
  goBack();
};
