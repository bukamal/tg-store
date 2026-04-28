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

  try {
    const res = await fetch('https://tzxjmyfevzdjftzpypjf.supabase.co/functions/v1/telegram-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData })
    });

    if (!res.ok) {
      viewEl.innerHTML = `<div class="card" style="color:red;">❌ فشل المصادقة (${res.status})</div>`;
      return;
    }

    const { token, userId } = await res.json();

    const supabase = initSupabase(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
    await supabase.auth.setSession({ access_token: token, refresh_token: '' });
    setCurrentUserId(userId);

    window.usdRate = 15000;
    setLanguage('ar');

    setTimeout(() => {
      initRouter();
      navigateTo('products');
    }, 50);
  } catch (e) {
    viewEl.innerHTML = `<div class="card" style="color:red;">⚠️ خطأ: ${e.message}</div>`;
  }
})();
