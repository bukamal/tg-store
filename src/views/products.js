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
    // ... نفس محتوى العرض السابق ...
    html += `</div><button class="btn" id="add-product-btn">+ ${t('addProduct')}</button> <button class="btn btn-outline" id="export-stock-btn">📥 ${t('exportCSV')}</button></div>`;
    document.getElementById('view').innerHTML = html;
    // ربط أحداث البحث والأزرار...
  } catch (e) {
    document.getElementById('view').innerHTML = `<div class="card" style="color:red;">فشل تحميل الأصناف: ${e.message}</div>`;
  }
}
// ... الدوال الأخرى
