export const i18n = {
  ar: {
    products: 'الأصناف', sell: 'بيع', history: 'المبيعات', analytics: 'تحليلات',
    purchases: 'المشتريات', customers: 'العملاء', cash: 'الصندوق', expenses: 'المصروفات',
    alerts: 'تنبيهات', addProduct: 'إضافة صنف', save: 'حفظ', cancel: 'إلغاء', delete: 'حذف',
    edit: 'تعديل', search: 'بحث...', noData: 'لا توجد بيانات', confirmDelete: 'هل أنت متأكد من الحذف؟',
    stock: 'المخزون', purchasePrice: 'سعر الشراء', sellingPrice: 'سعر البيع', quantity: 'الكمية',
    minAlert: 'حد التنبيه', total: 'الإجمالي', discount: 'حسم', tax: 'ضريبة', grandTotal: 'الصافي',
    customer: 'العميل', supplier: 'المورد', cashCustomer: 'نقدي', invoice: 'فاتورة', print: 'طباعة',
    downloadPDF: 'PDF', close: 'إغلاق', exportCSV: 'تصدير CSV', saved: 'تم الحفظ بنجاح',
    deleted: 'تم الحذف', fillAllFields: 'يرجى ملء جميع الحقول', quantityInsufficient: 'الكمية غير كافية',
    cartEmpty: 'العربة فارغة', sessionExpired: 'انتهت الجلسة', deposit: 'إيداع', withdraw: 'سحب',
    balance: 'الرصيد', paid: 'المدفوع', remaining: 'المتبقي', notes: 'ملاحظات', worker: 'العامل',
    category: 'الفئة', amount: 'المبلغ', date: 'التاريخ', description: 'الوصف',
    langSwitch: 'English'
  },
  en: {
    products: 'Products', sell: 'Sell', history: 'Sales', analytics: 'Analytics',
    purchases: 'Purchases', customers: 'Customers', cash: 'Cash', expenses: 'Expenses',
    alerts: 'Alerts', addProduct: 'Add Product', save: 'Save', cancel: 'Cancel', delete: 'Delete',
    edit: 'Edit', search: 'Search...', noData: 'No data', confirmDelete: 'Are you sure?',
    stock: 'Stock', purchasePrice: 'Purchase Price', sellingPrice: 'Selling Price', quantity: 'Qty',
    minAlert: 'Min Alert', total: 'Total', discount: 'Discount', tax: 'Tax', grandTotal: 'Grand Total',
    customer: 'Customer', supplier: 'Supplier', cashCustomer: 'Cash', invoice: 'Invoice', print: 'Print',
    downloadPDF: 'PDF', close: 'Close', exportCSV: 'Export CSV', saved: 'Saved successfully',
    deleted: 'Deleted', fillAllFields: 'Please fill all fields', quantityInsufficient: 'Insufficient quantity',
    cartEmpty: 'Cart is empty', sessionExpired: 'Session expired', deposit: 'Deposit', withdraw: 'Withdraw',
    balance: 'Balance', paid: 'Paid', remaining: 'Remaining', notes: 'Notes', worker: 'Worker',
    category: 'Category', amount: 'Amount', date: 'Date', description: 'Description',
    langSwitch: 'العربية'
  }
};

let currentLanguage = 'ar';
export function t(key) { return i18n[currentLanguage]?.[key] || key; }
export function setLanguage(lang) { currentLanguage = lang; }
export function getLanguage() { return currentLanguage; }
export function toggleLanguage() {
  currentLanguage = currentLanguage === 'ar' ? 'en' : 'ar';
  if (window.currentRefreshFunction) window.currentRefreshFunction();
}
