import { getSupabase, supaCall } from '../utils/supabase-client.js';
import { formatCurrency, exportToCSV } from '../utils/helpers.js';
import { t } from '../config/i18n.js';
import { showInvoice } from './invoice.js';

const tg = window.tg;

export async function showHistory() {
  window.currentRefreshFunction = showHistory; tg.MainButton.hide();
  const { data: orders } = await supaCall(() => getSupabase().from('orders').select('id,created_at,total_amount,discount,tax,grand_total,paid_amount,customers(name),order_items(quantity,unit_price,variants(variant_name,products(name)))').order('created_at', { ascending: false }));
  let html = `<div class="card"><h2>${t('history')}</h2>`;
  if (!orders?.length) html += `<div class="empty-state">📋<br>${t('noData')}</div>`;
  else {
    orders.forEach(o => {
      const rem = o.grand_total - o.paid_amount;
      html += `<div style="border:1px solid var(--glass-border);margin:8px 0;padding:12px;border-radius:12px"><strong>طلب #${o.id}</strong> - ${new Date(o.created_at).toLocaleString()}<br/><small>${t('customer')}: ${o.customers?.name || t('cashCustomer')} | ${t('total')}: ${formatCurrency(o.total_amount)} | ${t('discount')}: ${formatCurrency(o.discount)} | ${t('tax')}: ${formatCurrency(o.tax)} | ${t('grandTotal')}: ${formatCurrency(o.grand_total)}</small><br/><small>${t('paid')}: ${formatCurrency(o.paid_amount)} | ${t('remaining')}: ${formatCurrency(rem)}</small><button class="btn btn-sm btn-outline" onclick="window.showInvoiceFromOrder(${o.id})">${t('invoice')}</button><ul>${o.order_items.map(i => `<li>${i.variants?.products?.name || ''} ${i.variants?.variant_name || ''} ×${i.quantity} (${formatCurrency(i.unit_price)})</li>`).join('')}</ul></div>`;
    });
    html += `<button class="btn btn-outline" id="export-sales-btn">📥 ${t('exportCSV')}</button>`;
  }
  html += '</div>'; document.getElementById('view').innerHTML = html;
  document.getElementById('export-sales-btn')?.addEventListener('click', exportSalesCSV);
}

window.showInvoiceFromOrder = async orderId => {
  const { data: order } = await supaCall(() => getSupabase().from('orders').select('*,customers(name),order_items(quantity,unit_price,variants(variant_name,products(name)))').eq('id', orderId).single());
  showInvoice({
    id: order.id, created_at: order.created_at, total_amount: order.total_amount, discount: order.discount, tax: order.tax, grand_total: order.grand_total, paid_amount: order.paid_amount,
    customer_name: order.customers?.name,
    items: order.order_items.map(i => ({ name: i.variants?.products?.name, variantName: i.variants?.variant_name, quantity: i.quantity, unit_price: i.unit_price }))
  });
};

async function exportSalesCSV() {
  const { data: orders } = await supaCall(() => getSupabase().from('orders').select('id,created_at,total_amount,discount,tax,grand_total,paid_amount,customers(name)').order('created_at', { ascending: false }));
  exportToCSV('المبيعات.csv', ['رقم الطلب', 'التاريخ', 'العميل', 'الإجمالي', 'الحسم', 'الضريبة', 'الصافي', 'المدفوع', 'المتبقي'],
    orders.map(o => [o.id, new Date(o.created_at).toLocaleString(), o.customers?.name || '', o.total_amount, o.discount, o.tax, o.grand_total, o.paid_amount, o.grand_total - o.paid_amount]));
}
