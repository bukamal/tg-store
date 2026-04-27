import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { variantName, quantity, minQuantity } = req.body;
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data } = await supabase
    .from('bot_settings')
    .select('value')
    .eq('key', 'owner_chat_id')
    .single();

  const chatId = data?.value;
  if (!chatId) return res.json({ sent: false });

  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: `⚠️ تنبيه مخزون:\n${variantName}\nالكمية: ${quantity}\nالحد الأدنى: ${minQuantity}`
    })
  });

  res.json({ sent: true });
}
