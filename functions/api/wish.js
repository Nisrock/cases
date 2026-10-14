// POST /api/wish — заявка из пасхалки: кто, контакт, рутинная задача.
// Пишет в KV (wish:<ts>) и, если заданы TG_TOKEN/TG_CHAT, шлёт сообщение в Telegram.
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });
const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ ok: false, error: 'bad json' }, 400); }
  const rec = {
    ts: new Date().toISOString(),
    role: clip(b.role, 40), name: clip(b.name, 80), contact: clip(b.contact, 120), task: clip(b.task, 2000),
    vid: clip(b.vid, 40), ref: clip(b.ref, 300), ua: clip(request.headers.get('user-agent'), 200),
    country: request.cf?.country || '', city: request.cf?.city || '',
  };
  if (!rec.task || !rec.contact) return json({ ok: false, error: 'нужны контакт и задача' }, 400);
  if (rec.task.length < 10) return json({ ok: false, error: 'опиши задачу чуть подробнее' }, 400);
  await env.CASES_KV.put(`wish:${Date.now()}`, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 365 });
  if (env.TG_TOKEN && env.TG_CHAT) {
    const text = `🐾 Заявка со страницы кейсов\n\nКто: ${rec.role || '—'} ${rec.name}\nКонтакт: ${rec.contact}\nОткуда: ${rec.city || rec.country || '?'}\n\nЗадача:\n${rec.task}`;
    await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TG_CHAT, text, disable_web_page_preview: true }),
    }).catch(() => {});
  }
  return json({ ok: true });
}
