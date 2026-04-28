import './style.css';
import { initTelegram } from './telegram.js';

(async () => {
  const tg = initTelegram();
  window.tg = tg;
  const viewEl = document.getElementById('view');
  viewEl.innerHTML = '<div class="empty-state"><div class="emoji">⚡</div>مرحلة 1: بدء التشغيل</div>';

  // اختبار بسيط: عرض initData
  if (!tg.initData) {
    viewEl.innerHTML = '<div class="card" style="color:red;">❌ initData فارغ</div>';
    return;
  }

  viewEl.innerHTML = '<div class="empty-state"><div class="emoji">⏳</div>مرحلة 2: الاتصال بالدالة...</div>';

  // استدعاء الدالة مع عرض النتيجة مباشرة
  tg.WebApp.request({
    url: 'https://tzxjmyfevzdjftzpypjf.supabase.co/functions/v1/telegram-auth',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ initData: tg.initData })
  }, (err, res) => {
    if (err) {
      viewEl.innerHTML = `<div class="card" style="color:red;">❌ فشل الاتصال بالدالة: ${err}</div>`;
      return;
    }

    viewEl.innerHTML = `<div class="card">✅ تم الاتصال بالدالة. الرد: ${res}</div>`;

    // محاولة تحليل الرد
    try {
      const data = JSON.parse(res);
      viewEl.innerHTML += `<br>الرمز: ${data.token ? 'موجود' : 'مفقود'}`;
    } catch (e) {
      viewEl.innerHTML += `<br>❌ فشل تحليل JSON: ${e.message}`;
    }
  });
})();
