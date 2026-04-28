import { getSupabase, supaCall } from '../utils/supabase-client.js';
import { t } from '../config/i18n.js';
import { showToast } from '../utils/helpers.js';

const tg = window.tg;

export async function showAlerts() {
  window.currentRefreshFunction = showAlerts; tg.MainButton.hide();
  const { data: variants } = await supaCall(() => getSupabase().from('variants').select('id, quantity, min_quantity, variant_name, products(name)').gt('min_quantity',0));
  const lowStock = variants?.filter(v => v.quantity <= v.min_quantity) || [];
  let html = `<div class="card"><h2>${t('alerts')}</h2>`;
  if(!lowStock.length) html += `<div class="empty-state">🔔<br>${t('noData')}</div>`;
  else { html += '<ul>'; lowStock.forEach(v => html += `<li><strong>${v.products.name}</strong> - ${v.variant_name||'غير مسمى'} – ${v.quantity} (حد ${v.min_quantity})</li>`); html += '</ul>'; }
  html += `<button class="btn btn-outline" onclick="window.setOwnerChatId()">تفعيل تنبيهات تيليجرام</button></div>`;
  document.getElementById('view').innerHTML = html;
}
window.setOwnerChatId = async () => {
  const userId = window.tg.initDataUnsafe.user.id.toString();
  await supaCall(() => getSupabase().from('bot_settings').upsert({ key:'owner_chat_id', value:userId }, { onConflict:'key' }));
  showToast('تم تفعيل التنبيهات');
};
