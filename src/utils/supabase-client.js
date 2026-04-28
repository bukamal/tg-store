// لم نعد نحتاج إلى most of this, but we keep the interface
export function getSupabase() {
  if (!window.supabase) throw new Error('Supabase client not initialized');
  return window.supabase;
}
export function getCurrentUserId() { return window.currentUserId; }
export async function supaCall(queryFn) {
  // نمرر userId يدوياً في الاستعلامات (لم تعد السياسات تعتمد على auth.uid())
  // لكننا نحتاج إلى تعديل RLS أو تجاوزه باستخدام service_role (وهو ما نفعله)
  return queryFn();
}
// إضافات مساعدة
export async function recordCashTransaction(type, amount, refType, refId, note = '') {
  await getSupabase().from('cash_register').insert({
    user_id: getCurrentUserId(), type, amount, reference_type: refType, reference_id: refId, note
  });
}
export async function logActivity(action, details = '') {
  await getSupabase().rpc('add_activity', { action, details });
}
