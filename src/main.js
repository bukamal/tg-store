import './style.css';
import { initTelegram } from './telegram.js';
import { initSupabase, setCurrentUserId } from './utils/supabase-client.js';
import { setLanguage } from './config/i18n.js';
import { navigateTo, initRouter } from './navigation/router.js';

(async () => {
  const tg = initTelegram();
  window.tg = tg;
  const viewEl = document.getElementById('view');
  viewEl.innerHTML = '<div class="empty-state"><div class="emoji">⚡</div>جاري التحميل...</div>';

  // استخدام tg.WebApp.request بدلاً من fetch
  tg.WebApp.request({
    url: '/api/auth',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: { initData: tg.initData }
  }, async (err, res) => {
    if (err) {
      viewEl.innerHTML = `<div class="card" style="color:red;">فشل الاتصال: ${err}</div>`;
      return;
    }
    try {
      const { token, userId } = JSON.parse(res);
      const supabase = initSupabase(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );
      await supabase.auth.setSession({ access_token: token, refresh_token: '' });
      setCurrentUserId(userId);
      window.usdRate = 15000;
      setLanguage('ar');
      setTimeout(() => {
        initRouter();
        navigateTo('products');
      }, 50);
    } catch (e) {
      viewEl.innerHTML = `<div class="card" style="color:red;">خطأ في البيانات: ${e.message}</div>`;
    }
  });
})();
