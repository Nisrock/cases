// POST /api/ev — события просмотра страницы (sendBeacon): просмотр, глубина прокрутки, время, клики, пасхалка.
// Ключ ev:<ISO-дата>:<ts>:<rand>, значение JSON. Хранится 180 дней. Персональных данных нет: случайный id посетителя из localStorage.
const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return new Response('bad', { status: 400 }); }
  const evs = Array.isArray(b.events) ? b.events.slice(0, 50) : [];
  if (!evs.length) return new Response('empty', { status: 400 });
  const base = {
    vid: clip(b.vid, 40), ref: clip(b.ref, 300), utm: clip(b.utm, 300), screen: clip(b.screen, 20), theme: clip(b.theme, 10),
    ua: clip(request.headers.get('user-agent'), 200), country: request.cf?.country || '', city: request.cf?.city || '',
  };
  const now = Date.now(); const day = new Date(now).toISOString().slice(0, 10);
  await Promise.all(evs.map((e, i) => env.CASES_KV.put(
    `ev:${day}:${now}:${i}:${Math.random().toString(36).slice(2, 6)}`,
    JSON.stringify({ ...base, ev: clip(e.ev, 40), data: clip(e.data, 200), t: now + i, ts: new Date(now).toISOString() }),
    { expirationTtl: 60 * 60 * 24 * 180 })));
  return new Response('ok');
}
