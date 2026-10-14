# news-digest

Аналог Cloudflare Worker «CreditFlow daily news digest», но без Worker, Tavily, Resend и ключей:

| Worker | Здесь |
|---|---|
| Tavily search + extract | встроенные WebSearch + WebFetch |
| Парсер дат (regex) + Claude-проверка | модель читает дату прямо со страницы/ленты раздела |
| Anthropic API (Sonnet) | сам Claude в Routine |
| Resend | Gmail-коннектор (`send_message`) |
| Cron Trigger | расписание Routine |

**Почему не Tavily:** его MCP в этой среде требует OAuth (его нельзя пройти из сессии), а `published_date` у него, как вы заметили, часто неверный.
Ленты разделов (kapital.kz/finance и т.п.) дают точное время публикации, поэтому встроенный браузер/WebFetch надёжнее для свежести.
Проверено: WebSearch с `allowed_domains` отдаёт казахстанские источники, WebFetch ленты kapital.kz вернул 10 статей с датой и временем.

## Запуск
1. Создайте Routine (cron, напр. `0 8 * * *` Asia/Almaty) на этом репозитории.
2. Промпт — содержимое `ROUTINE_PROMPT.md` (после `---`).
3. Убедитесь, что подключён Gmail-коннектор.

Ограничения: WebSearch ориентирован на US-выдачу — поэтому основной сбор идёт по лентам разделов, а поиск дополняет.
