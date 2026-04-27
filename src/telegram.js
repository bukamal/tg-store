export function initTelegram() {
  const tg = window.Telegram.WebApp;
  tg.ready();
  tg.expand();

  document.body.style.backgroundColor = tg.themeParams.bg_color || '#ffffff';
  document.body.style.color = tg.themeParams.text_color || '#1a1a1a';

  tg.BackButton.hide();
  tg.BackButton.onClick(() => {
    if (window.goBack) window.goBack();
  });

  tg.MainButton.hide();

  if (tg.onEvent) {
    tg.onEvent('pullToRefresh', async () => {
      if (window.currentRefreshFunction) {
        await window.currentRefreshFunction();
      }
      tg.ready();
    });
  }

  // تخزين مرجع عام لتسهيل الوصول
  window.tg = tg;
  return tg;
}
