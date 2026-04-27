import { createClient } from '@supabase/supabase-js';
import { showToast } from './helpers.js';
import { t } from '../config/i18n.js';

let supabase;
let currentUserId = null;

export function initSupabase(url, anonKey) {
  supabase = createClient(url, anonKey);
  return supabase;
}

export function getSupabase() { return supabase; }
export function setCurrentUserId(id) { currentUserId = id; }
export function getCurrentUserId() { return currentUserId; }

export async function supaCall(queryFn) {
  try {
    const { data, error } = await queryFn();
    if (error && (error.code === 'PGRST301' || error.message?.includes('JWT'))) {
      const refreshed = await refreshAuth();
      if (refreshed) {
        const retry = await queryFn();
        if (retry.error) throw retry.error;
        return retry;
      } else {
        showToast(t('sessionExpired'), true);
        throw error;
      }
    }
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    showToast(err.message, true);
    throw err;
  }
}

export async function refreshAuth() {
  try {
    const tg = window.tg;
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: tg.initData }) });
    if (res.ok) {
      const { token } = await res.json();
      await supabase.auth.setSession({ access_token: token, refresh_token: '' });
      return true;
    }
    return false;
  } catch (e) { return false; }
}

export async function recordCashTransaction(type, amount, refType, refId, note = '') {
  try {
    await supaCall(() => supabase.from('cash_register').insert({
      user_id: currentUserId, type, amount, reference_type: refType, reference_id: refId, note
    }));
  } catch (err) { console.error('Cash transaction error:', err); }
}

export async function logActivity(action, details = '') {
  try { await supaCall(() => supabase.rpc('add_activity', { action, details })); } catch (e) { console.warn('Activity log error:', e); }
}
