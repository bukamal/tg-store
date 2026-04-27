import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { initData } = req.body;
  if (!initData) return res.status(400).json({ error: 'Missing initData' });

  // 1. التحقق من صحة initData القادم من تيليجرام
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');

  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const crypto = await import('crypto');
  const secretKey = crypto.createHmac('sha256', 'WebAppData')
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest();

  const calculatedHash = crypto.createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (calculatedHash !== hash) {
    return res.status(401).json({ error: 'Invalid data' });
  }

  const user = JSON.parse(urlParams.get('user'));
  const userId = user.id.toString();

  // 2. الاتصال بـ Supabase
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 3. تأكد من وجود إعداد سعر الصرف الافتراضي (usd_rate)
  await supabase.from('bot_settings').upsert(
    { key: 'usd_rate', value: '15000' },
    { onConflict: 'key' }
  );

  // 4. توليد JWT مخصص لـ Supabase - sub هو معرف المستخدم الرقمي من تيليجرام
  const supabaseJwt = jwt.sign(
    {
      sub: userId,
      aud: 'authenticated',
      role: 'authenticated'
    },
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { algorithm: 'HS256', expiresIn: '1d' }
  );

  return res.json({ token: supabaseJwt, userId });
}
