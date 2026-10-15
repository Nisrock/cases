# Утренний дайджест вакансий hh.ru под профиль AI-инженера.
# Запуск: python scripts/jobscan.py  (нужны TG_TOKEN, TG_CHAT в окружении; состояние в scripts/seen.json)
# Публичный API hh без авторизации. Новые = id, которых не было в seen.json. Шлёт в Telegram до 12 вакансий,
# отсортированных по «похожести» на профиль (ключевые слова в названии и сниппете), остальные одной строкой.
import json, os, re, sys, time, urllib.parse, urllib.request, pathlib, html

ROOT = pathlib.Path(__file__).parent
SEEN = ROOT / 'seen.json'
QUERIES = ['LLM инженер', 'AI инженер', 'AI engineer', 'разработчик AI агентов', 'LLM engineer', 'интеграция LLM',
           'prompt engineer', 'ИИ автоматизация бизнес-процессов', 'автоматизация n8n', 'AI агент CRM', 'GenAI',
           'ИИ-интегратор', 'AI automation', 'внедрение ИИ']
VARIANTS = [{'area': 1}, {'area': 113, 'schedule': 'remote'}]
GOOD = re.compile(r'автоматиз|внедрен|бизнес-процесс|агент|llm|rag|интеграц|crm|n8n|claude|gpt|ассистент|чат-бот|бот', re.I)
BAD = re.compile(r'mlops|inference|pretrain|research|исследовател|c\+\+|java\b|kotlin|scala|\.net|c#|devops|sre|qa\b|тестиров|security|безопасност|embedded|firmware|стаж[её]р|junior|frontend|ios|android|1с\b|computer vision|\bcv\b', re.I)
UA = {'User-Agent': 'jobscan/1.0 (gyglem@gmail.com)'}
# hh без авторизации отдаёт 403: нужен токен приложения (client_credentials, бессрочный), секрет HH_TOKEN.
if os.environ.get('HH_TOKEN'): UA['Authorization'] = 'Bearer ' + os.environ['HH_TOKEN'].strip()

def get(url, params):
    req = urllib.request.Request(f'{url}?{urllib.parse.urlencode(params)}', headers=UA)
    for _ in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r: return json.load(r)
        except Exception as e: err = e; time.sleep(2)
    print('fail', params, err, file=sys.stderr); return {'items': []}

def sal(it):
    s = it.get('salary') or {}
    if not s.get('from') and not s.get('to'): return ''
    f = f"{s['from']//1000}" if s.get('from') else ''; t = f"{s['to']//1000}" if s.get('to') else ''
    v = f'{f}–{t}' if f and t else (f'от {f}' if f else f'до {t}')
    return v + ' тыс.' + ('' if s.get('currency') == 'RUR' else ' ' + s.get('currency', '')) + (' gross' if s.get('gross') else '')

def score(it):
    text = it['name'] + ' ' + ((it.get('snippet') or {}).get('requirement') or '') + ' ' + ((it.get('snippet') or {}).get('responsibility') or '')
    sc = len(GOOD.findall(text)) - 3 * len(BAD.findall(it['name']))
    exp = (it.get('experience') or {}).get('id', '')
    if exp in ('between1And3', 'between3And6'): sc += 1
    if exp == 'moreThan6': sc -= 2
    s = it.get('salary') or {}
    if (s.get('from') or 0) >= 200000 or (s.get('to') or 0) >= 250000: sc += 2
    return sc

def main():
    seen = json.load(open(SEEN, encoding='utf-8')) if SEEN.exists() else {}
    found = {}
    for q in QUERIES:
        for v in VARIANTS:
            j = get('https://api.hh.ru/vacancies', {'text': q, 'per_page': 100, 'order_by': 'publication_time', 'search_field': 'name', **v})
            for it in j.get('items', []):
                found.setdefault(it['id'], it)
            time.sleep(0.3)
    new = [it for vid, it in found.items() if vid not in seen]
    today = time.strftime('%Y-%m-%d')
    for it in new: seen[it['id']] = today
    # чистим старше 120 дней
    cutoff = time.strftime('%Y-%m-%d', time.localtime(time.time() - 120 * 86400))
    seen = {k: v for k, v in seen.items() if v >= cutoff}
    json.dump(seen, open(SEEN, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    new.sort(key=score, reverse=True)
    top = [it for it in new if score(it) >= 1][:12]
    rest = [it for it in new if it not in top]
    print(f'всего {len(found)}, новых {len(new)}, в дайджест {len(top)}')
    if not new: return
    lines = [f'🧭 Вакансии за сутки: новых {len(new)}, под профиль {len(top)}']
    for it in top:
        fmt = ', '.join(x['name'] for x in (it.get('work_format') or [])) or (it.get('schedule') or {}).get('name', '')
        fmt = re.sub(r'на месте работодателя', 'офис', fmt, flags=re.I).replace('Удалённо', 'удалённо').replace('Гибрид', 'гибрид')
        exp = (it.get('experience') or {}).get('name', '')
        meta = ' · '.join(x for x in [fmt, exp, sal(it)] if x)
        lines.append(f"\n• <b>{html.escape(it['name'])}</b> — {html.escape((it.get('employer') or {}).get('name', ''))}\n  {html.escape(meta)}\n  {it['alternate_url'].split('?')[0]}")
    if rest:
        lines.append(f'\nОстальные {len(rest)}: ' + ', '.join(html.escape(it['name'][:40]) for it in rest[:10]) + ('…' if len(rest) > 10 else ''))
    lines.append('\nПолный список: python resume/targets/hh_scan.py')
    text = '\n'.join(lines)
    tok, chat = os.environ.get('TG_TOKEN'), os.environ.get('TG_CHAT')
    if not tok or not chat:
        print(text); return
    for chunk in [text[i:i + 3900] for i in range(0, len(text), 3900)]:
        body = json.dumps({'chat_id': chat, 'text': chunk, 'parse_mode': 'HTML', 'disable_web_page_preview': True}).encode('utf-8')
        req = urllib.request.Request(f'https://api.telegram.org/bot{tok}/sendMessage', data=body, headers={'content-type': 'application/json'})
        with urllib.request.urlopen(req, timeout=30) as r: print('tg', r.status)

if __name__ == '__main__':
    main()
