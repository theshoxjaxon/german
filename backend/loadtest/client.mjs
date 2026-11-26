// The crowd: runs in its own process so it doesn't steal the server's CPU. Config arrives as JSON in argv[2].
import autocannon from 'autocannon';

const { base, connections, duration, kind, cookies = [] } = JSON.parse(process.argv[2]);
let n = 0;
const ip = () => `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`; // each request "comes from" another address
const request = {
  health: () => ({ method: 'GET', path: '/api/health' }),
  me: () => ({ method: 'GET', path: '/api/me' }),
  state: () => ({ method: 'GET', path: '/api/state' }),
  login: () => ({ method: 'POST', path: '/api/auth/login', headers: { 'content-type': 'application/json' } }),
}[kind]();
request.setupRequest = (req) => {
  n++;
  const headers = { ...req.headers, 'x-forwarded-for': ip() };
  if (kind === 'me' || kind === 'state') headers.cookie = cookies[n % cookies.length];
  const out = { ...req, headers };
  if (kind === 'login') out.body = JSON.stringify({ email: `nobody${n}@example.com`, password: `wrong-password-${n}` });
  return out;
};
const run = autocannon({ url: base, connections, duration, requests: [request] });
const why = {}; // what the failures were, by message
run.on('reqError', (e) => { why[e.message] = (why[e.message] ?? 0) + 1; });
const r = await run;
console.log(JSON.stringify({ rps: r.requests.average, p50: r.latency.p50, p99: r.latency.p99, ok: r['2xx'], refused: r.non2xx, failed: r.errors + r.timeouts, timeouts: r.timeouts, why }));
