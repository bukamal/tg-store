import { getSupabase, supaCall, logActivity, getCurrentUserId, recordCashTransaction } from '../utils/supabase-client.js';
import { sanitize, formatCurrency, showToast, exportToCSV } from '../utils/helpers.js';
import { t } from '../config/i18n.js';
import { navigateTo, goBack } from '../navigation/router.js';

const tg = window.tg;

export async function showExpenses() {
  window.currentRefreshFunction = showExpenses; tg.MainButton.hide();
  const { data: expenses } = await supaCall(() => getSupabase().from('expenses').select('*').order('expense_date', { ascending: false }));
  const { data: workers } = await supaCall(() => getSupabase().from('expenses').select('worker_name, amount').not('worker_name', 'eq', ''));
  const workerTotals = {};
  workers?.forEach(e => { const w = e.worker_name || 'بدون'; workerTotals[w] = (workerTotals[w] || 0) + parseFloat(e.amount); });
  const totalAll = expenses?.reduce((s, e) => s + parseFloat(e.amount), 0) || 0;
  let html = `<div class="card"><h2>${t('expenses')}</h2><p>الإجمالي العام: ${formatCurrency(totalAll)}</p>
    <div class="worker-summary card"><h4>توزيع حسب العامل</h4><ul>${Object.entries(workerTotals).map(([n, t]) => `<li><strong>${sanitize(n)}</strong>: ${formatCurrency(t)}</li>`).join('') || '<li>لا بيانات</li>'}</ul></div>
    <input class="search-input" id="search-expenses" placeholder="${t('search')}"/><table id="expenses-table"><thead><tr><th>التاريخ</th><th>الفئة</th><th>العامل</th><th>المبلغ</th><th>الوصف</th><th></th></tr></thead><tbody>
    ${expenses?.map(e => `<tr><td>${new Date(e.expense_date).toLocaleDateString()}</td><td>${sanitize(e.category)}</td><td>${sanitize(e.worker_name || '-')}</td><td>${formatCurrency(e.amount)}</td><td>${sanitize(e.description || '')}</td><td><button class="btn btn-sm btn-danger" onclick="window.deleteExpense(${e.id})">${t('delete')}</button></td></tr>`).join('') || `<tr><td colspan="6">${t('noData')}</td></tr>`}
    </tbody></table><button class="btn" id="add-expense-btn">+ إضافة مصروف</button> <button class="btn btn-outline" id="export-expenses-btn">📥 ${t('exportCSV')}</button></div>`;
  document.getElementById('view').innerHTML = html;
  document.getElementById('search-expenses')?.addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('#expenses-table tbody tr').forEach(row => row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none');
  });
  document.getElementById('add-expense-btn')?.addEventListener('click', () => navigateTo('add-expense'));
  document.getElementById('export-expenses-btn')?.addEventListener('click', exportExpensesCSV);
}
window.deleteExpense = async id => { if (confirm(t('confirmDelete'))) { await supaCall(() => getSupabase().from('expenses').delete().eq('id', id)); await logActivity('delete_expense', `ID:${id}`); showToast(t('deleted')); showExpenses(); } };

export async function showAddExpenseForm() {
  tg.BackButton.show(); tg.MainButton.setText(t('save')); tg.MainButton.show(); tg.MainButton.onClick(saveExpense);
  document.getElementById('view').innerHTML = `<div class="card"><h3>إضافة مصروف</h3><input id="expense-amount" type="number" step="0.01" placeholder="${t('amount')}"/><input id="expense-category" placeholder="${t('category')}" value="أخرى"/><input id="expense-worker" placeholder="${t('worker')}"/><input id="expense-desc" placeholder="${t('description')}"/><input id="expense-date" type="date" value="${new Date().toISOString().split('T')[0]}"/></div>`;
}

async function saveExpense() {
  const amount = parseFloat(document.getElementById('expense-amount')?.value);
  if (isNaN(amount) || amount <= 0) { showToast('أدخل مبلغاً صحيحاً', true); return; }
  const category = document.getElementById('expense-category')?.value?.trim() || 'أخرى';
  const workerName = document.getElementById('expense-worker')?.value?.trim() || '';
  const description = document.getElementById('expense-desc')?.value?.trim() || '';
  const date = document.getElementById('expense-date')?.value || new Date().toISOString().split('T')[0];
  tg.MainButton.disable();
  try {
    const { data: record, error } = await supaCall(() => getSupabase().from('expenses').insert({ user_id: getCurrentUserId(), amount, category, worker_name: workerName, description, expense_date: date }).select('id').single());
    if (error) throw error;
    await recordCashTransaction('withdraw', amount, 'expense', record.id, `${category} - ${workerName}`);
    await logActivity('add_expense', `Amount: ${amount}, Worker: ${workerName}`);
    showToast(t('saved')); tg.MainButton.hide(); goBack(); showExpenses();
  } catch (err) { showToast(err.message, true); } finally { tg.MainButton.enable(); }
}

async function exportExpensesCSV() {
  const { data } = await supaCall(() => getSupabase().from('expenses').select('amount, category, description, expense_date, worker_name'));
  exportToCSV('المصروفات.csv', ['المبلغ', 'الفئة', 'الوصف', 'التاريخ', 'العامل'], data.map(e => [e.amount, e.category, e.description || '', e.expense_date, e.worker_name || '']));
}
