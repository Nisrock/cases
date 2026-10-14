// GET /api/stats?key=ADMIN_KEY[&days=14] — сводка по событиям и список заявок.
const json = (o, s = 200) => new Response(JSON.stringify(o, null, 1), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

async function listAll(kv, prefix) {
  const out = []; let cursor;
  do {
    const r = await kv.list({ prefix, cursor, limit: 1000 });
    out.push(...r.keys); cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor && out.length < 20000);
  return out;
}

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  if (!env.ADMIN_KEY || u.searchParams.get('key') !== env.ADMIN_KEY) return json({ ok: false }, 401);
  if (u.searchParams.get('purge_tests') === '1') {
    // Удалить тестовые заявки (роль начинается с «Тест» или контакт self) и события тестового посетителя.
    const wk = await listAll(env.CASES_KV, 'wish:'); let n = 0;
    for (const k of wk) { const w = await env.CASES_KV.get(k.name, 'json'); if (w && (/^(Тест|test)/i.test(w.role || '') || w.contact === 'self')) { await env.CASES_KV.delete(k.name); n++; } }
    const ek = await listAll(env.CASES_KV, 'ev:');
    for (const k of ek) { const e = await env.CASES_KV.get(k.name, 'json'); if (e && e.vid === 'selftest') { await env.CASES_KV.delete(k.name); n++; } }
    return json({ ok: true, deleted: n });
  }
  const days = Math.min(90, +(u.searchParams.get('days') || 14));
  const since = Date.now() - days * 86400e3;
  const keys = (await listAll(env.CASES_KV, 'ev:')).filter(k => +k.name.split(':')[2] >= since);
  const evs = (await Promise.all(keys.map(k => env.CASES_KV.get(k.name, 'json')))).filter(Boolean);
  const visitors = {}; const byEv = {}; const byDay = {}; const byRef = {}; const byCity = {};
  for (const e of evs) {
    byEv[e.ev] = (byEv[e.ev] || 0) + 1;
    const d = e.ts.slice(0, 10); byDay[d] = byDay[d] || new Set(); byDay[d].add(e.vid);
    const v = visitors[e.vid] = visitors[e.vid] || { first: e.ts, last: e.ts, city: e.city || e.country, ref: e.ref, utm: e.utm, screen: e.screen, theme: e.theme, ua: e.ua, maxScroll: 0, seconds: 0, clicks: [], easter: false, views: 0 };
    if (e.ts < v.first) v.first = e.ts; if (e.ts > v.last) v.last = e.ts;
    if (e.ev === 'view') v.views++;
    if (e.ev === 'scroll') v.maxScroll = Math.max(v.maxScroll, +e.data || 0);
    if (e.ev === 'time') v.seconds = Math.max(v.seconds, +e.data || 0);
    if (e.ev === 'click') v.clicks.push(e.data);
    if (e.ev.startsWith('easter')) v.easter = true;
    if (e.ev === 'view') { byRef[e.ref || '(прямой)'] = (byRef[e.ref || '(прямой)'] || 0) + 1; byCity[e.city || e.country || '?'] = (byCity[e.city || e.country || '?'] || 0) + 1; }
  }
  const wishes = await Promise.all((await listAll(env.CASES_KV, 'wish:')).map(k => env.CASES_KV.get(k.name, 'json')));
  return json({
    days, events: evs.length, visitors: Object.keys(visitors).length,
    byDay: Object.fromEntries(Object.entries(byDay).sort().map(([d, s]) => [d, s.size])),
    byEv, byRef, byCity,
    visitorsList: Object.values(visitors).sort((a, b) => b.last.localeCompare(a.last)).slice(0, 200),
    wishes: wishes.filter(Boolean).sort((a, b) => b.ts.localeCompare(a.ts)),
  });
}
