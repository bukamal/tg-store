import { sanitize, formatCurrency } from '../utils/helpers.js';
import { t } from '../config/i18n.js';

export function showInvoice(order, type='sale') {
  const {id,created_at,total_amount,discount,tax,grand_total,paid_amount,customer_name,supplier_name,items}=order;
  const net = type==='sale'? grand_total : total_amount-(discount||0);
  const remaining = net - paid_amount;
  const title = type==='sale'?'فاتورة مبيعات':'فاتورة مشتريات';
  const entityLabel = type==='sale'?t('customer'):t('supplier');
  const entityName = type==='sale'?(customer_name||t('cashCustomer')):(supplier_name||'غير محدد');
  const html = `<div id="invoice-modal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;display:flex;justify-content:center;align-items:center;"><div id="invoice-printable" style="background:#fff;padding:20px;border-radius:18px;max-width:400px;width:90%;color:#000;" dir="rtl"><h2>${title} #${id}</h2><p>${t('date')}: ${new Date(created_at).toLocaleString()}</p><p>${entityLabel}: ${entityName}</p><table><tr><th>الصنف</th><th>كمية</th><th>سعر</th><th>إجمالي</th></tr>${items.map(i=>`<tr><td>${sanitize(i.name)} ${sanitize(i.variantName||'')}</td><td>${i.quantity}</td><td>${formatCurrency(i.unit_price)}</td><td>${formatCurrency(i.quantity*i.unit_price)}</td></tr>`).join('')}</table><p>الإجمالي: ${formatCurrency(total_amount)}</p><p>${t('discount')}: ${formatCurrency(discount||0)}</p>${type==='sale'?`<p>${t('tax')}: ${formatCurrency(tax)}</p>`:''}<p><strong>المستحق: ${formatCurrency(net)}</strong></p><p>${t('paid')}: ${formatCurrency(paid_amount)}</p><p>${t('remaining')}: ${formatCurrency(remaining)}</p><div style="text-align:center;margin-top:10px"><button class="btn btn-sm" id="print-invoice">${t('print')}</button><button class="btn btn-sm" id="download-pdf-invoice">${t('downloadPDF')}</button><button class="btn btn-sm btn-secondary" id="close-invoice">${t('close')}</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
  document.getElementById('close-invoice').addEventListener('click',()=>document.getElementById('invoice-modal').remove());
  document.getElementById('print-invoice').addEventListener('click',()=>{const w=window.open('','_blank');w.document.write(`<html dir="rtl"><head><title>${title} #${id}</title></head><body>${document.getElementById('invoice-printable').innerHTML}</body></html>`);w.print();});
  document.getElementById('download-pdf-invoice').addEventListener('click',async()=>{const canvas=await html2canvas(document.getElementById('invoice-printable'),{scale:2});const{jsPDF}=window.jspdf;const pdf=new jsPDF('p','mm','a4');pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,pdf.internal.pageSize.getWidth(),pdf.internal.pageSize.getHeight());pdf.save(`${title}_${id}.pdf`);});
}
