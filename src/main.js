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

  // الرابط المباشر لدالة Supabase
  const SUPABASE_FUNCTION_URL = 'https://tzxjmyfevzdjftzpypjf.supabase.co/functions/v1/telegram-auth';

  // الدالة التي تعالج الرد بعد المصادقة
  async function onAuthSuccess(token, userId) {
    const supabase = initSupabase(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
    await supabase.auth.setSession({ access_token: token, refresh_token: '' });
    setCurrentUserId(userId);

    try {
      const { data: rateData } = await supaCall(() =>
        getSupabase().from('bot_settings').select('value').eq('key', 'usd_rate').single()
      );
      window.usdRate = parseFloat(rateData?.value) || 15000;
    } catch { window.usdRate = 15000; }

    setLanguage(tg.initDataUnsafe?.user?.language_code?.startsWith('ar') ? 'ar' : 'en');

    try {
      getSupabase().channel('public:variants')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'variants' }, handleRealtimeUpdate)
        .subscribe();
      getSupabase().channel('public:orders')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, handleRealtimeUpdate)
        .subscribe();
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

  // استخدام tg.WebApp.request إذا كنا داخل تيليجرام
  if (window.Telegram?.WebApp?.request) {
    tg.WebApp.request({
      url: SUPABASE_FUNCTION_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY}`
      },
      data: JSON.stringify({ initData: tg.initData })
    }, async (err, res) => {
      if (err) {
        viewEl.innerHTML = `<div class="card" style="color:red;">⚠️ خطأ WebApp: ${err}</div>`;
        return;
      }
      try {
        const { token, userId } = JSON.parse(res);
        await onAuthSuccess(token, userId);
      } catch (e) {
        viewEl.innerHTML = `<div class="card" style="color:red;">⚠️ خطأ في الرد: ${e.message}</div>`;
      }
    });
  } else {
    // بيئة المتصفح العادي: نستخدم fetch مع الرابط المباشر (لن يفيد هنا لكن نبقيه للاختبار)
    try {
      const res = await fetch(SUPABASE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ initData: tg.initData || 'test' })
      });
      if (!res.ok) {
        viewEl.innerHTML = `<div class="card" style="color:red;">❌ فشل المصادقة (${res.status})</div>`;
        return;
      }
      const { token, userId } = await res.json();
      await onAuthSuccess(token, userId);
    } catch (e) {
      viewEl.innerHTML = `<div class="card" style="color:red;">⚠️ خطأ fetch: ${e.message}</div>`;
    }
  }
})();
