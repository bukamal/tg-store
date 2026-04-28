import { getSupabase, supaCall } from '../utils/supabase-client.js';
import { formatCurrency } from '../utils/helpers.js';

const tg = window.tg;

export async function showAnalytics() {
  window.currentRefreshFunction = showAnalytics; tg.MainButton.hide();
  const now = new Date(); const days = [];
  for(let i=6;i>=0;i--){const d=new Date(now);d.setDate(now.getDate()-i);days.push(d.toISOString().split('T')[0]);}
  const { data: orders } = await supaCall(() => getSupabase().from('orders').select('grand_total,created_at').gte('created_at',days[0]));
  const dayTotals = days.map(d=>orders?.filter(o=>o.created_at.startsWith(d)).reduce((s,o)=>s+parseFloat(o.grand_total),0)||0);
  const totalSales = dayTotals.reduce((a,b)=>a+b,0);
  const { data: oi } = await supaCall(() => getSupabase().from('order_items').select('quantity,variant_id,variants(purchase_price)'));
  let totalCost=0; oi?.forEach(i=>{if(i.variants) totalCost+=i.quantity*i.variants.purchase_price;});
  const { data: expenses } = await supaCall(() => getSupabase().from('expenses').select('amount').gte('expense_date',days[0]));
  const totalExp = expenses?.reduce((s,e)=>s+parseFloat(e.amount),0)||0;
  const netProfit = totalSales - totalCost - totalExp;
  const { data: topItems } = await supaCall(() => getSupabase().from('order_items').select('quantity,variants!inner(variant_name,products!inner(name))').limit(1000));
  const prodMap = {}; topItems?.forEach(i=>{const label=(i.variants?.products?.name||'')+' '+(i.variants?.variant_name||''); prodMap[label]=(prodMap[label]||0)+i.quantity;});
  const sorted = Object.entries(prodMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  document.getElementById('view').innerHTML = `<div class="card"><h2>📊 تحليلات</h2><div class="stats-grid"><div class="stat-card"><strong>إجمالي المبيعات</strong><br/>${formatCurrency(totalSales)}</div><div class="stat-card"><strong>تكلفة المبيعات</strong><br/>${formatCurrency(totalCost)}</div><div class="stat-card"><strong>المصروفات</strong><br/>${formatCurrency(totalExp)}</div><div class="stat-card" style="color:${netProfit>=0?'green':'red'}"><strong>صافي الربح</strong><br/>${formatCurrency(netProfit)}</div></div><canvas id="salesChart"></canvas><canvas id="topProductsChart"></canvas><button class="btn btn-outline" id="refresh-analytics">🔄 تحديث</button></div>`;
  new Chart(document.getElementById('salesChart'),{type:'line',data:{labels:days,datasets:[{label:'مبيعات',data:dayTotals,borderColor:'#007aff',backgroundColor:'rgba(0,122,255,0.1)',fill:true}]},options:{plugins:{legend:{display:false}}}});
  new Chart(document.getElementById('topProductsChart'),{type:'pie',data:{labels:sorted.map(e=>e[0]),datasets:[{data:sorted.map(e=>e[1]),backgroundColor:['#ff6384','#36a2eb','#ffce56','#4bc0c0','#9966ff']}]}});
  document.getElementById('refresh-analytics').addEventListener('click',showAnalytics);
}
