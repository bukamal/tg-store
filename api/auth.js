export default async function handler(req, res) {
  // رد ثابت للاختبار
  return res.json({ token: 'test-token', userId: '12345678' });
}
