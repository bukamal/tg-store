export default async function handler(req, res) {
  return res.status(200).json({ token: 'test-token', userId: '12345678' });
}
