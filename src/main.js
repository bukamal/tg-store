import './style.css';
import { initTelegram } from './telegram.js';
import { initSupabase, setCurrentUserId, getSupabase, supaCall } from './utils/supabase-client.js';
import { setLanguage, toggleLanguage } from './config/i18n.js';
import { navigateTo, initRouter } from './navigation/router.js';
import { handleRealtimeUpdate } from './realtime.js';

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
  await waitForTg();

  const viewEl = document.getElementById('view');
  viewEl.innerHTML = '<div class="empty-state"><div class="emoji">⚡</div>جاري التحميل...</div>';

  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: tg.initData })
  });

  if (!res.ok) {
    viewEl.innerHTML = '<div class="empty-state">❌ فشل المصادقة</div>';
    return;
  }

  const { token, userId } = await res.json();
  const supabase = initSupabase(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
  await supabase.auth.setSession({ access_token: token, refresh_token: '' });
  setCurrentUserId(userId);

  try {
    const { data: rateData } = await supaCall(() =>
      getSupabase().from('bot_settings').select('value').eq('key', 'usd_rate').single()
    );
    window.usdRate = parseFloat(rateData?.value) || 15000;
  } catch (e) {
    window.usdRate = 15000;
    console.warn('Failed to load usd_rate, using 15000');
  }

  setLanguage(tg.initDataUnsafe?.user?.language_code?.startsWith('ar') ? 'ar' : 'en');

  try {
    getSupabase().channel('public:variants')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'variants' }, handleRealtimeUpdate)
      .subscribe();
    getSupabase().channel('public:orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, handleRealtimeUpdate)
      .subscribe();
  } catch (e) {
    console.warn('Realtime subscriptions failed', e);
  }

  document.querySelector('[data-view="toggle-lang"]')?.addEventListener('click', () => {
    toggleLanguage();
    if (window.currentRefreshFunction) window.currentRefreshFunction();
  });

  setTimeout(() => {
    initRouter();
    navigateTo('products');
  }, 100);
})();
