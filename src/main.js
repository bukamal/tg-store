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

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: 'test' })
    });
    if (!res.ok) {
      viewEl.innerHTML = `<div class="card" style="color:red;">فشل الاتصال (${res.status})</div>`;
      return;
    }
    const { token, userId } = await res.json();

    // نبقي Supabase للاختبار (قد يفشل إن لم تكن المتغيرات موجودة لكن لا يهم)
    try {
      const supabase = initSupabase(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );
      await supabase.auth.setSession({ access_token: token, refresh_token: '' });
      setCurrentUserId(userId);
    } catch (e) {
      viewEl.innerHTML = `<div class="card" style="color:red;">فشل Supabase: ${e.message}</div>`;
      return;
    }

    // سعر صرف ثابت
    window.usdRate = 15000;
    setLanguage('ar');

    // تفعيل الواجهة مباشرة
    setTimeout(() => {
      initRouter();
      navigateTo('products');
    }, 50);
  } catch (globalError) {
    viewEl.innerHTML = `<div class="card" style="color:red;">⚠️ خطأ: ${globalError.message}</div>`;
  }
})();
