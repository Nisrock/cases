# Ставит секреты TG_TOKEN и TG_CHAT в проект Pages «cases» из локального .dev.vars.
# Подготовка: 1) в .dev.vars добавить строку TG_TOKEN=<токен от @BotFather>;
#             2) написать боту @moya_zayavka_tg_BOT любое сообщение (нужно, чтобы узнать chat id).
# Запуск из папки resume\cases:  powershell -ExecutionPolicy Bypass -File .\set-tg.ps1
$ErrorActionPreference = 'Stop'
$env:XDG_CONFIG_HOME = "C:/Users/Nikita/.wrangler-personal"
$vars = Get-Content .dev.vars -Encoding utf8
$tok = ($vars | Where-Object { $_ -like 'TG_TOKEN=*' }) -replace '^TG_TOKEN=', ''
if (-not $tok) { Write-Host 'В .dev.vars нет строки TG_TOKEN=...'; exit 1 }
$me = Invoke-RestMethod "https://api.telegram.org/bot$tok/getMe"
Write-Host ("Бот: @" + $me.result.username)
$chat = ($vars | Where-Object { $_ -like 'TG_CHAT=*' }) -replace '^TG_CHAT=', ''
if (-not $chat) {
  try {
    $upd = Invoke-RestMethod "https://api.telegram.org/bot$tok/getUpdates"
    $chat = ($upd.result | ForEach-Object { $_.message.chat.id } | Where-Object { $_ } | Select-Object -Last 1)
  } catch {
    $wh = Invoke-RestMethod "https://api.telegram.org/bot$tok/getWebhookInfo"
    Write-Host ("У бота стоит вебхук: " + $wh.result.url + " — getUpdates недоступен.")
    Write-Host 'Узнай свой chat id у @userinfobot (просто напиши ему /start), добавь в .dev.vars строку TG_CHAT=<число> и запусти снова.'
    exit 1
  }
  if (-not $chat) { Write-Host 'Не вижу сообщений боту: напиши ему что-нибудь в Telegram и запусти снова'; exit 1 }
}
Write-Host ("chat id: " + $chat)
if (-not ($vars | Where-Object { $_ -like 'TG_CHAT=*' })) { Add-Content .dev.vars ("TG_CHAT=" + $chat) -Encoding utf8 }
$tok  | npx wrangler pages secret put TG_TOKEN --project-name cases
"$chat" | npx wrangler pages secret put TG_CHAT  --project-name cases
Invoke-RestMethod -Method Post "https://api.telegram.org/bot$tok/sendMessage" -ContentType 'application/json' -Body (@{chat_id=$chat; text='Секреты поставлены: заявки со страницы кейсов будут приходить сюда.'} | ConvertTo-Json) | Out-Null
Write-Host 'Готово. Проверь сообщение от бота.'
