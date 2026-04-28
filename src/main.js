import './style.css';
import { initTelegram } from './telegram.js';
import { initSupabase, setCurrentUserId, getSupabase, supaCall } from './utils/supabase-client.js';
import { setLanguage, toggleLanguage } from './config/i18n.js';
import { navigateTo, initRouter } from './navigation/router.js';
import { handleRealtimeUpdate } from './realtime.js';

// انتظر حتى يكون Telegram WebApp جاهزًا
function waitForTg() {
  return new Promise((resolve) => {
    if (window.tg) return resolve();
    const check = setInterval(() => {
      if (window.tg) { clearInterval(check); resolve(); }
    }, 100);
  });
}

(async () => {
  const tg = initTelegram();
  window.tg = tg;
  
  // تأكد من جاهزية tg
  await waitForTg();

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

  const { data: rateData } = await supaCall(() =>
    getSupabase().from('bot_settings').select('value').eq('key', 'usd_rate').single()
  );
  window.usdRate = parseFloat(rateData?.value) || 15000;

  setLanguage(tg.initDataUnsafe?.user?.language_code?.startsWith('ar') ? 'ar' : 'en');

  getSupabase()
    .channel('public:variants')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'variants' }, handleRealtimeUpdate)
    .subscribe();
  getSupabase()
    .channel('public:orders')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, handleRealtimeUpdate)
    .subscribe();

  document.querySelector('[data-view="toggle-lang"]')?.addEventListener('click', () => {
    toggleLanguage();
    if (window.currentRefreshFunction) window.currentRefreshFunction();
  });

  // تأخير استدعاء initRouter قليلاً للتأكد من وجود DOM
  setTimeout(() => {
    initRouter();
  }, 50);

  navigateTo('products');
})();
