import { createClient } from '@supabase/supabase-js';
import { showToast } from './helpers.js';
import { t } from '../config/i18n.js';

let supabase;
let currentUserId = null;

export function initSupabase(url, anonKey) {
  supabase = createClient(url, anonKey);
  return supabase;
}

export function getSupabase() {
  if (!supabase) throw new Error('Supabase client not initialized');
  return supabase;
}

export function setCurrentUserId(id) { currentUserId = id; }
export function getCurrentUserId() { return currentUserId; }

// ... باقي الدوال (supaCall, refreshAuth, recordCashTransaction, logActivity) ...
