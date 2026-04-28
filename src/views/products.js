import { getSupabase, supaCall, logActivity, getCurrentUserId } from '../utils/supabase-client.js';
import { sanitize, formatCurrency, showToast, exportToCSV } from '../utils/helpers.js';
import { t } from '../config/i18n.js';
import { navigateTo, goBack } from '../navigation/router.js';

const tg = window.tg;

export async function showProducts() {
  window.currentRefreshFunction = showProducts;
  tg.MainButton.hide();
  try {
    const { data: products } = await supaCall(() =>
      getSupabase().from('products').select('id, name, variants(id, variant_name, purchase_price, selling_price, quantity, min_quantity)').order('name')
    );
    let html = `<div class="card"><h2>${t('products')}</h2><input class="search-input" id="search-products" placeholder="${t('search')}"/><div id="products-list">`;
    if (!products?.length) {
      html += `<div class="empty-state"><div class="emoji">📦</div>${t('noData')}</div>`;
    } else {
      products.forEach(p => {
        html += `<div class="product-card"><strong>${sanitize(p.name)}</strong> <button class="btn btn-sm btn-outline" onclick="navigateTo('edit-product',{productId:${p.id}})">${t('edit')}</button> <button class="btn btn-sm btn-danger" onclick="window.deleteProduct(${p.id})">${t('delete')}</button><ul>`;
        p.variants?.forEach(v => {
          const warn = (v.min_quantity > 0 && v.quantity <= v.min_quantity) ? ' ⚠️' : '';
          html += `<li>${sanitize(v.variant_name || 'غير مسمى')} - شراء: ${formatCurrency(v.purchase_price)} / بيع: ${formatCurrency(v.selling_price)} (${v.quantity}) ${t('minAlert')}: ${v.min_quantity}${warn} <button class="btn btn-sm btn-danger" onclick="window.deleteVariant(${v.id})">${t('delete')}</button></li>`;
        });
        html += '</ul></div>';
      });
    }
    html += `</div><button class="btn" id="add-product-btn">+ ${t('addProduct')}</button> <button class="btn btn-outline" id="export-stock-btn">📥 ${t('exportCSV')}</button></div>`;
    document.getElementById('view').innerHTML = html;
    document.getElementById('search-products').addEventListener('input', e => {
      const term = e.target.value.toLowerCase();
      document.querySelectorAll('.product-card').forEach(card => card.style.display = card.textContent.toLowerCase().includes(term) ? '' : 'none');
    });
    document.getElementById('add-product-btn').addEventListener('click', () => navigateTo('add-product'));
    document.getElementById('export-stock-btn').addEventListener('click', exportStockCSV);
  } catch (e) {
    document.getElementById('view').innerHTML = `<div class="card" style="background:#fff3cd; color:#856404; padding:20px;"><strong>⚠️ خطأ في تحميل الأصناف</strong><br>${e.message}</div>`;
    console.error(e);
  }
}
// ... بقية الدوال (deleteProduct, deleteVariant, exportStockCSV, showAddProductForm, showEditProductForm, ...) تبقى كما هي ...
