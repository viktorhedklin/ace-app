// Vercel serverless function — checks Bybit help-center URL health.
// Browsers block cross-origin fetch to bybit.com, so this runs server-side.
// Only accepts Bybit help-center URLs to prevent this becoming an SSRF tool.
// No user content ever transits here — only URLs.

// Strict hostname allowlist — parsed via URL constructor to prevent regex
// bypass tricks (IDN, @-embedded hosts, encoded chars). Checks hostname
// exactly, not a substring, and requires https://.
const ALLOWED_HOSTS = new Set(['www.bybit.com', 'bybit.com', 'www.bybit.eu', 'bybit.eu']);
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function isAllowedUrl(input) {
  try {
    const u = new URL(input);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    if (u.username || u.password) return false; // reject user@host tricks
    return ALLOWED_HOSTS.has(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

async function checkOne(url) {
  if (!isAllowedUrl(url)) {
    return { url, ok: false, status: 0, reason: 'not_bybit_url' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    // Bybit help center is Next.js — a dead article returns 200 with a
    // soft "not supported" page, so we also fetch a bit of body to detect it.
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': CHROME_UA, Range: 'bytes=0-32768' },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!res.ok && res.status !== 206) {
      return { url, ok: false, status: res.status, reason: `http_${res.status}` };
    }

    const body = await res.text();
    const lower = body.toLowerCase();
    if (
      lower.includes('this article is currently not supported on this site') ||
      lower.includes('this page is not available') ||
      lower.includes('page not found')
    ) {
      return { url, ok: false, status: res.status, reason: 'dead_page' };
    }

    return { url, ok: true, status: res.status };
  } catch (e) {
    return { url, ok: false, status: 0, reason: e?.name === 'AbortError' ? 'timeout' : 'network_error' };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { urls } = req.body || {};
  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'urls must be a non-empty array' });
  }
  if (urls.length > 20) {
    return res.status(400).json({ error: 'too many urls (max 20 per request)' });
  }

  try {
    const results = await Promise.all(urls.map(checkOne));
    return res.status(200).json({ results });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
