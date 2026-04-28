import './style.css';
import { initTelegram } from './telegram.js';
import { initSupabase, setCurrentUserId, getSupabase, supaCall } from './utils/supabase-client.js';
import { setLanguage, toggleLanguage } from './config/i18n.js';
import { navigateTo, initRouter } from './navigation/router.js';
import { handleRealtimeUpdate } from './realtime.js';

(async () => {
  const tg = initTelegram();
  window.tg = tg;
  const viewEl = document.getElementById('view');
  viewEl.innerHTML = '<div class="empty-state"><div class="emoji">⚡</div>جاري التحميل...</div>';

  const API_URL = 'https://tg-store.vercel.app/api/auth'; // الرابط الكامل

  // دالة مشتركة لمعالجة الرد
  async function handleAuthResponse(responseData) {
    const { token, userId } = responseData;
    const supabase = initSupabase(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
    await supabase.auth.setSession({ access_token: token, refresh_token: '' });
    setCurrentUserId(userId);

    window.usdRate = 15000;
    setLanguage(tg.initDataUnsafe?.user?.language_code?.startsWith('ar') ? 'ar' : 'en');

    try {
      getSupabase().channel('public:variants').on('postgres_changes', { event: '*', schema: 'public', table: 'variants' }, handleRealtimeUpdate).subscribe();
      getSupabase().channel('public:orders').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, handleRealtimeUpdate).subscribe();
    } catch {}

    document.querySelector('[data-view="toggle-lang"]')?.addEventListener('click', () => {
      toggleLanguage();
      if (window.currentRefreshFunction) window.currentRefreshFunction();
    });

    setTimeout(() => {
      initRouter();
      navigateTo('products');
    }, 50);
  }

  // محاولة استخدام tg.WebApp.request إذا كنا داخل تيليجرام
  if (window.Telegram?.WebApp?.request) {
    tg.WebApp.request({
      url: API_URL,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ initData: tg.initData })
    }, async (err, res) => {
      if (err) {
        viewEl.innerHTML = `<div class="card" style="color:red;">⚠️ خطأ WebApp: ${err}</div>`;
        return;
      }
      try {
        const data = JSON.parse(res);
        await handleAuthResponse(data);
      } catch (e) {
        viewEl.innerHTML = `<div class="card" style="color:red;">⚠️ خطأ في الرد: ${e.message}</div>`;
      }
    });
  } else {
    // بيئة المتصفح العادي: نستخدم fetch
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData || 'test' })
      });
      if (!res.ok) {
        viewEl.innerHTML = `<div class="card" style="color:red;">❌ فشل المصادقة (${res.status})</div>`;
        return;
      }
      const data = await res.json();
      await handleAuthResponse(data);
    } catch (e) {
      viewEl.innerHTML = `<div class="card" style="color:red;">⚠️ خطأ fetch: ${e.message}</div>`;
    }
  }
})();
