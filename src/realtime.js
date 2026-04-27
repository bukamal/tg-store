import { getCurrentView } from './navigation/router.js';

export function handleRealtimeUpdate() {
  const currentView = getCurrentView();
  // نعيد تحميل المشهد الحالي فقط إن كان من المشاهد التي تحتاج تحديثاً فورياً
  if (['products', 'sell', 'history', 'analytics', 'cash', 'expenses'].includes(currentView)) {
    if (window.currentRefreshFunction) {
      window.currentRefreshFunction();
    }
  }
}
