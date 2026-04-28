import { getSupabase, supaCall, logActivity, getCurrentUserId } from '../utils/supabase-client.js';
import { sanitize, formatCurrency, showToast, exportToCSV } from '../utils/helpers.js';
import { t } from '../config/i18n.js';
import { navigateTo, goBack } from '../navigation/router.js';

const tg = window.tg;

export async function showCashRegister() {
  window.currentRefreshFunction = showCashRegister; tg.MainButton.hide();
  const { data: transactions } = await supaCall(() => getSupabase().from('cash_register').select('*').order('created_at',{ascending:false}));
  let balance = transactions?.reduce((sum,t)=>sum+(t.type==='deposit'?t.amount:-t.amount),0)||0;
  let html = `<div class="card"><h2>${t('cash')}</h2><div class="stat-card"><strong>${t('balance')}</strong><br/>${formatCurrency(balance)}</div><input class="search-input" id="search-cash" placeholder="${t('search')}"/><ul>`;
  transactions?.forEach(t=>{
    const sign = t.type==='deposit'?'+':'-';
    html += `<li style="color:${t.type==='deposit'?'green':'red'}">${sign}${t.amount} ل.س - ${sanitize(t.note||'')} <small>${new Date(t.created_at).toLocaleString()}</small></li>`;
  });
  html += `</ul><button class="btn" id="add-deposit-btn">+ ${t('deposit')}</button> <button class="btn btn-outline" id="add-withdraw-btn">- ${t('withdraw')}</button> <button class="btn btn-outline" id="export-cash-btn">📥 ${t('exportCSV')}</button></div>`;
  document.getElementById('view').innerHTML = html;
  document.getElementById('search-cash')?.addEventListener('input', e=>{
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('li').forEach(li=>li.style.display = li.textContent.toLowerCase().includes(term)?'':'none');
  });
  document.getElementById('add-deposit-btn')?.addEventListener('click', ()=>navigateTo('add-cash-transaction',{type:'deposit'}));
  document.getElementById('add-withdraw-btn')?.addEventListener('click', ()=>navigateTo('add-cash-transaction',{type:'withdraw'}));
  document.getElementById('export-cash-btn')?.addEventListener('click', exportCashCSV);
}

export async function showAddCashTransactionForm(type) {
  tg.BackButton.show(); tg.MainButton.setText(t('save')); tg.MainButton.show(); tg.MainButton.onClick(()=>saveCashTransaction(type));
  document.getElementById('view').innerHTML = `<div class="card"><h3>${type==='deposit'?'إيداع':'سحب'} جديد</h3><input id="cash-amount" type="number" step="0.01" placeholder="${t('amount')}"/><textarea id="cash-note" placeholder="${t('notes')}"></textarea></div>`;
}
async function saveCashTransaction(type) {
  const amount = parseFloat(document.getElementById('cash-amount')?.value);
  if(isNaN(amount)||amount<=0){ showToast('أدخل مبلغاً صحيحاً',true); return; }
  const note = document.getElementById('cash-note')?.value?.trim()||'';
  tg.MainButton.disable();
  try {
    await supaCall(()=>getSupabase().from('cash_register').insert({user_id:getCurrentUserId(),type,amount,reference_type:'manual',note}));
    await logActivity('cash_'+type, `Amount: ${amount}`);
    showToast(t('saved')); tg.MainButton.hide(); goBack(); showCashRegister();
  } catch(err){ showToast(err.message,true); } finally { tg.MainButton.enable(); }
}
async function exportCashCSV() {
  const { data } = await supaCall(()=>getSupabase().from('cash_register').select('type, amount, note, created_at'));
  exportToCSV('الصندوق.csv',['النوع','المبلغ','ملاحظات','التاريخ'], data.map(t=>[t.type==='deposit'?'إيداع':'سحب', t.amount, t.note||'', new Date(t.created_at).toLocaleString()]));
}
