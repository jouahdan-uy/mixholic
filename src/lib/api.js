// Tiny fetch wrapper for talking to the Mixholic backend (server/index.ts).
// Set VITE_API_URL in .env if the API isn't running on localhost:3000.
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function apiRequest(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request gagal (${res.status})`);
  }
  return data;
}
