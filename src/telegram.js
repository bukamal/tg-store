export function initTelegram() {
  const tg = window.Telegram.WebApp;
  tg.ready();
  tg.expand();

  document.body.style.backgroundColor = tg.themeParams.bg_color || '#fff';
  document.body.style.color = tg.themeParams.text_color || '#000';

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

  return tg;
}
