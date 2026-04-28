import { showProducts, showAddProductForm, showEditProductForm } from '../views/products.js';
import { showSellForm } from '../views/sell.js';
import { showHistory } from '../views/history.js';
import { showAnalytics } from '../views/analytics.js';
import { showPurchases, showAddPurchaseForm, showSuppliers, showPurchasesHistory } from '../views/purchases.js';
import { showCustomers, showAddCustomerForm } from '../views/customers.js';
import { showCashRegister, showAddCashTransactionForm } from '../views/cash.js';
import { showExpenses, showAddExpenseForm } from '../views/expenses.js';
import { showAlerts } from '../views/alerts.js';

const tg = window.tg;
let viewStack = [];
let currentView = 'products';

export function getCurrentView() { return currentView; }

export function navigateTo(viewName, params) {
  try {
    if (currentView) viewStack.push({ name: currentView, params: window.currentViewParams });
    window.currentViewParams = params;
    currentView = viewName;
    setActiveNav(viewName);
    applyBackButton();
    switch (viewName) {
      case 'products': showProducts(); break;
      case 'sell': showSellForm(); break;
      case 'history': showHistory(); break;
      case 'analytics': showAnalytics(); break;
      case 'purchases': showPurchases(); break;
      case 'customers': showCustomers(); break;
      case 'cash': showCashRegister(); break;
      case 'expenses': showExpenses(); break;
      case 'alerts': showAlerts(); break;
      case 'add-product': showAddProductForm(); break;
      case 'edit-product': showEditProductForm(params?.productId); break;
      case 'add-expense': showAddExpenseForm(); break;
      case 'add-cash-transaction': showAddCashTransactionForm(params?.type); break;
      case 'add-purchase': showAddPurchaseForm(); break;
      case 'add-customer': showAddCustomerForm(); break;
      default: console.warn('Unknown view:', viewName);
    }
  } catch (error) {
    document.getElementById('view').innerHTML = `<div class="card"><p style="color:red;">⚠️ خطأ: ${error.message}</p></div>`;
    console.error(error);
  }
}

export function goBack() {
  if (viewStack.length === 0) { navigateTo('products'); return; }
  const prev = viewStack.pop();
  currentView = prev.name;
  window.currentViewParams = prev.params;
  setActiveNav(currentView);
  applyBackButton();
  try {
    switch (currentView) {
      case 'products': showProducts(); break;
      case 'sell': showSellForm(); break;
      case 'history': showHistory(); break;
      case 'analytics': showAnalytics(); break;
      case 'purchases': showPurchases(); break;
      case 'customers': showCustomers(); break;
      case 'cash': showCashRegister(); break;
      case 'expenses': showExpenses(); break;
      case 'alerts': showAlerts(); break;
      case 'add-product': showAddProductForm(); break;
      case 'edit-product': showEditProductForm(window.currentViewParams?.productId); break;
      case 'add-expense': showAddExpenseForm(); break;
      case 'add-cash-transaction': showAddCashTransactionForm(window.currentViewParams?.type); break;
      case 'add-purchase': showAddPurchaseForm(); break;
      case 'add-customer': showAddCustomerForm(); break;
      default: navigateTo('products');
    }
  } catch (error) {
    document.getElementById('view').innerHTML = `<div class="card"><p style="color:red;">⚠️ خطأ: ${error.message}</p></div>`;
    console.error(error);
  }
}
window.goBack = goBack;

function applyBackButton() {
  const tg = window.tg;
  if (!tg) return;
  const mainViews = ['products', 'sell', 'history', 'analytics', 'purchases', 'customers', 'cash', 'expenses', 'alerts'];
  if (!mainViews.includes(currentView) || viewStack.length > 0) {
    tg.BackButton.show();
  } else {
    tg.BackButton.hide();
  }
}

function setActiveNav(viewName) {
  document.querySelectorAll('#bottom-nav button').forEach(b => {
    b.classList.toggle('active', b.dataset.view === viewName);
  });
}

export function initRouter() {
  document.querySelectorAll('#bottom-nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view) navigateTo(view);
    });
  });
}
