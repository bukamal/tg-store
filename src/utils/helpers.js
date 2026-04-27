import { t } from '../config/i18n.js';

export function sanitize(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;' };
  return String(str).replace(/[&<>"'/]/g, m => map[m]);
}

export function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.backgroundColor = isError ? '#d32f2f' : '#388e3c';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

export function formatCurrency(amountSYP) {
  const usd = amountSYP / (window.usdRate || 15000);
  return `${amountSYP.toFixed(2)} ل.س (≈ ${usd.toFixed(2)} $)`;
}

export function exportToCSV(filename, headers, rows) {
  const bom = '\uFEFF';
  const csv = bom + [headers.map(h => `"${h}"`).join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
