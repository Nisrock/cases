# Кейсы · Никита Каганович

Страница с боевыми кейсами AI-инженера: https://cases-cc2.pages.dev/

## Структура
- `public/` — статика: index.html, og.png, screens/ (экраны систем с размытыми именами), cats/ (видео пасхалки), nikita-kaganovich-cases.pdf
- `functions/api/` — Pages Functions: wish.js (заявка из пасхалки → KV + Telegram), ev.js (события просмотров → KV), stats.js (сводка по ключу)
- `wrangler.toml` — проект `cases`, KV `CASES_KV`

## Локально
`npx wrangler pages dev public --port 8795 --kv CASES_KV` (в приложении Claude: preview `cases`).

## PDF
Печатная версия включается параметром `?print=1`. Пересборка при запущенном локальном сервере:

```
msedge --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=12000 --print-to-pdf="public/nikita-kaganovich-cases.pdf" "http://localhost:8795/?print=1"
```

## Выкладка
Личный Cloudflare (gyglem@gmail.com), проект Pages `cases`.

```powershell
$env:XDG_CONFIG_HOME = "C:/Users/Nikita/.wrangler-personal"; npx wrangler pages deploy
```

Push в GitHub (аккаунт Nisrock): `gh auth switch -u Nisrock`, затем `git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin main`. Переменную XDG_CONFIG_HOME при этом не задавать: gh тоже её читает.

## Секреты Pages
Ставятся командой `npx wrangler pages secret put NAME --project-name cases` (с тем же XDG_CONFIG_HOME).
- `ADMIN_KEY` — поставлен, значение в `.dev.vars` (вне git). Сводка: `https://cases-cc2.pages.dev/api/stats?key=...&days=14`
- `TG_TOKEN`, `TG_CHAT` — токен личного бота и chat id для уведомлений о заявках из пасхалки. Пока не заданы, заявки копятся в KV и видны в сводке.

## Аналитика
Своя: события view / scroll / time / click / easter_* пишутся в KV через `/api/ev`, без персональных данных (случайный id посетителя). Яндекс Метрика и VK-пиксель включаются, если вписать номера в константы `YM_ID` и `VK_PIXEL` в index.html.

## Пасхалка
Открывается тремя способами: лапка 🐾 после заголовка «Кейс 03», строка в конце «Как устроено внутри» кейса 02, набор «cat» или «кот» на клавиатуре. Внутри лента видео с котиками и форма «опиши рутинную задачу» → `/api/wish`.
