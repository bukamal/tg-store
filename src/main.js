import './style.css';
import { initTelegram } from './telegram.js';
import { initSupabase, setCurrentUserId, getSupabase, supaCall } from './utils/supabase-client.js';
import { setLanguage, toggleLanguage } from './config/i18n.js';
import { navigateTo, initRouter } from './navigation/router.js';
import { handleRealtimeUpdate } from './realtime.js';

const tg = initTelegram();
window.tg = tg;

(async () => {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: tg.initData })
  });

  if (!res.ok) {
    document.getElementById('view').innerHTML = '<div class="empty-state">❌ فشل المصادقة</div>';
    return;
  }

  const { token, userId } = await res.json();
  const supabase = initSupabase(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
  await supabase.auth.setSession({ access_token: token, refresh_token: '' });
  setCurrentUserId(userId);

  // سعر الصرف
  const { data: rateData } = await supaCall(() =>
    getSupabase().from('bot_settings').select('value').eq('key', 'usd_rate').single()
  );
  window.usdRate = parseFloat(rateData?.value) || 15000;

  // اللغة
  setLanguage(tg.initDataUnsafe?.user?.language_code?.startsWith('ar') ? 'ar' : 'en');

  // Realtime
  getSupabase()
    .channel('public:variants')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'variants' }, handleRealtimeUpdate)
    .subscribe();
  getSupabase()
    .channel('public:orders')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, handleRealtimeUpdate)
    .subscribe();

  // تبديل اللغة
  document.querySelector('[data-view="toggle-lang"]')?.addEventListener('click', () => {
    toggleLanguage();
    if (window.currentRefreshFunction) window.currentRefreshFunction();
  });

  // ** تفعيل أزرار الشريط السفلي **
  initRouter();

  // الانتقال للواجهة الرئيسية
  navigateTo('products');
})();
