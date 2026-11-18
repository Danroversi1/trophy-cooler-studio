// Pass-through for Google Slides references. Stores nothing: no database, no files, no CDN cache.
//   GET /api/slides?deck=<link or id>             → { deck, title, slides: [{ id, n, title }] }  (n = current position)
//   GET /api/slides?deck=<id>&page=<slideObjectId> → JPEG of that slide, streamed from Google
// The deck must be shared as "Anyone with the link can view". Slides are addressed by their
// permanent object ID, so pins survive reordering, inserts and edits.
const DECK = /^[A-Za-z0-9_-]{20,100}$/;
const PAGE = /^[A-Za-z0-9_.-]{1,100}$/;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const deckId = (v = '') => { const m = String(v).match(/\/presentation\/d\/([A-Za-z0-9_-]+)/); return m ? m[1] : String(v).trim(); };
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  const q = new URL(req.url, 'http://local').searchParams;
  const deck = deckId(q.get('deck')), page = q.get('page');
  if (!DECK.test(deck)) return res.status(400).json({ error: 'bad_deck', message: 'Paste a Google Slides link or deck ID.' });
  try {
    if (page) {
      if (!PAGE.test(page)) return res.status(400).json({ error: 'bad_page' });
      const r = await fetch(`https://docs.google.com/presentation/d/${deck}/export/jpeg?pageid=${encodeURIComponent(page)}`, { headers: { 'user-agent': UA }, redirect: 'follow' });
      const ct = r.headers.get('content-type') || '';
      if (!r.ok || !ct.startsWith('image/')) return res.status(r.status === 404 ? 404 : 403).json({ error: r.status === 404 ? 'missing' : 'not_public' });
      res.setHeader('Content-Type', ct);
      res.setHeader('Cache-Control', 'private, max-age=300'); // viewer's browser only
      return res.status(200).send(Buffer.from(await r.arrayBuffer()));
    }
    const r = await fetch(`https://docs.google.com/presentation/d/${deck}/edit`, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en' }, redirect: 'follow' });
    if (!r.ok || /accounts\.google\.com|ServiceLogin/.test(r.url)) return res.status(403).json({ error: 'not_public', message: 'Share the deck as "Anyone with the link can view".' });
    const html = await r.text(), ids = [];
    for (const m of html.matchAll(/"([A-Za-z0-9_-]+):notes"/g)) if (!ids.includes(m[1])) ids.push(m[1]);
    if (!ids.length) return res.status(422).json({ error: 'no_slides', message: 'No slides found. Is this a Google Slides link shared with "Anyone with the link"?' });
    // best-effort slide titles: first text inserted after each slide marker in the page model
    const titles = {}; let cur = null;
    for (const m of html.matchAll(/\[12,"([A-Za-z0-9_:-]+)"|\[15,"[A-Za-z0-9_-]+",null,0,"((?:[^"\\]|\\.){1,200})"/g)) {
      if (m[1]) { cur = m[1].endsWith(':notes') ? null : m[1]; continue; }
      if (!cur || titles[cur]) continue;
      let t; try { t = JSON.parse('"' + m[2] + '"'); } catch { t = m[2]; }
      t = t.replace(/[\u000b\n\r]+/g, ' ').trim();
      if (t && !/^image sources/i.test(t) && !/^https?:/i.test(t)) titles[cur] = t.slice(0, 80);
    }
    const title = decode(((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '').replace(/\s+-\s+Google [^-]+$/, '').trim());
    return res.status(200).json({ deck, title, slides: ids.map((id, i) => ({ id, n: i + 1, title: titles[id] || '' })) });
  } catch (e) {
    return res.status(502).json({ error: 'upstream', message: String((e && e.message) || e) });
  }
}
