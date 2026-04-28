export const config = { runtime: 'edge' };
export default async function handler(request) {
  return new Response(JSON.stringify({ token: 'test-token', userId: '12345678' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
