// Thin fetch wrapper. Every call either returns data or throws an Error with a friendly message.
async function request(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error('Could not reach the TrustCheck server. Check your connection and try again.'), { network: true });
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) {
    throw Object.assign(new Error((data && data.error) || `Request failed (${res.status}).`), { status: res.status, fields: data && data.errors });
  }
  return data;
}

let metaCache = null;
export const api = {
  meta: async () => (metaCache ||= await request('GET', '/api/meta')),
  stats: () => request('GET', '/api/stats'),
  entities: () => request('GET', '/api/entities'),
  verify: (payload) => request('POST', '/api/verify', payload),
  reports: (params) => request('GET', '/api/reports?' + new URLSearchParams(params)),
  submitReport: (payload) => request('POST', '/api/reports', payload),
};
