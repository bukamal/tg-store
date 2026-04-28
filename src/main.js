import './style.css';
import { createClient } from '@supabase/supabase-js';
import { initTelegram } from './telegram.js';
import { setLanguage, toggleLanguage } from './config/i18n.js';
import { navigateTo, initRouter } from './navigation/router.js';
import { handleRealtimeUpdate } from './realtime.js';

(async () => {
  const tg = initTelegram();
  window.tg = tg;
  const viewEl = document.getElementById('view');
  viewEl.innerHTML = '<div class="empty-state"><div class="emoji">⚡</div>جاري التحميل...</div>';

  try {
    // 1. الحصول على userId من دالة المصادقة
    const res = await fetch('https://tzxjmyfevzdjftzpypjf.supabase.co/functions/v1/telegram-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData })
    });
    if (!res.ok) {
      viewEl.innerHTML = `<div class="card" style="color:red;">❌ فشل المصادقة (${res.status})</div>`;
      return;
    }
    const { token, userId } = await res.json();   // token غير مستخدم الآن، نعتمد على service_role

    // 2. إنشاء عميل Supabase مع service_role (من متغير البيئة VITE_SUPABASE_SERVICE_ROLE_KEY)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY; // يجب إضافته في Vercel
    if (!supabaseUrl || !serviceRoleKey) {
      viewEl.innerHTML = '<div class="card" style="color:red;">❌ متغيرات البيئة غير مضبوطة</div>';
      return;
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
    });
    // ضبط معرف المستخدم يدوياً (ليس عبر جلسة JWT)
    supabase.userId = userId;

    // 3. تخزين مراجع عامة لتستخدمها باقي الوحدات
    window.supabase = supabase;
    window.currentUserId = userId;

    // 4. سعر الصرف
    try {
      const { data: rateData } = await supabase.from('bot_settings').select('value').eq('key', 'usd_rate').single();
      window.usdRate = parseFloat(rateData?.value) || 15000;
    } catch { window.usdRate = 15000; }

    setLanguage(tg.initDataUnsafe?.user?.language_code?.startsWith('ar') ? 'ar' : 'en');

    // 5. Realtime
    try {
      supabase.channel('public:variants').on('postgres_changes', { event: '*', schema: 'public', table: 'variants' }, handleRealtimeUpdate).subscribe();
      supabase.channel('public:orders').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, handleRealtimeUpdate).subscribe();
    } catch {}

    document.querySelector('[data-view="toggle-lang"]')?.addEventListener('click', () => {
      toggleLanguage();
      if (window.currentRefreshFunction) window.currentRefreshFunction();
    });

    setTimeout(() => {
      initRouter();
      navigateTo('products');
    }, 50);

  } catch (e) {
    viewEl.innerHTML = `<div class="card" style="color:red;">⚠️ خطأ عام: ${e.message}</div>`;
  }
})();
