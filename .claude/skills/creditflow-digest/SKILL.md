---
name: creditflow-digest
description: Daily news digest for CreditFlow (KZ short-term business lending) — Нацбанк, АРРФР, банки, МФО, кредиты, факторинг, налоги, макро за последние 48 часов, с проверкой реальной даты публикации и отправкой письмом. Use for "дайджест новостей", "новости дня CreditFlow", or when run by a schedule.
---

# CreditFlow daily news digest

Port of the Cloudflare Worker (Tavily + Claude + Resend) to a Claude Code routine.
Tools used: built-in `WebSearch` / `WebFetch` (no API keys; the Tavily MCP needs interactive OAuth, which a
scheduled run can't do) and `scripts/digest.mjs` for deterministic date parsing and HTML rendering.
If Tavily MCP is authorized in the session, it may be used instead of WebSearch/WebFetch — the pipeline is the same.

Config: `config.json` (sources, queries, window, recipients).

## Pipeline

1. **Search.** For each query in `config.json` run `WebSearch` with `allowed_domains` = `sources`
   (batch queries in parallel, several per turn). Prefer queries rephrased with the current month/year.
   Collect `{title, url, snippet, published?}`; drop duplicate URLs.
2. **Coarse filter.** Drop anything whose search-result date is clearly older than `windowHours`. Keep undated.
3. **Verify dates on the real page** (search dates lie). For each remaining candidate (cap ~40, newest/undated first)
   `WebFetch` the URL with prompt: "Return the article's publication date/time exactly as shown, and a 3-sentence factual summary."
   Save results to `$SCRATCH/candidates.json` as `[{url,title,source,text,published}]` where `text` is the fetched
   text, then run:
   `node .claude/skills/creditflow-digest/scripts/digest.mjs filter $SCRATCH/candidates.json > $SCRATCH/fresh.json`
   (parses the date from `text`, overwrites `published`, drops items older than the window; undated stay flagged `н/д`.)
4. **Select.** From `fresh.json` pick 10–15 most relevant and important (Нацбанк, АРРФР, банки, МФО, кредиты/займы,
   факторинг, регулирование, налоги, макро). Drop ads and semantic duplicates. Undated items: keep only if the text
   unambiguously shows the event happened in the last 2 days. Newest first. Use only source data; never invent.
5. **Write** for each item: `{headline (1 sentence), source, date, summary (exactly 5 sentences, Russian), url}`
   → `$SCRATCH/selected.json`.
6. **Render:** `node .claude/skills/creditflow-digest/scripts/digest.mjs render $SCRATCH/selected.json` →
   prints JSON `{subject, html}` (handles the "no fresh news" case when the array is empty).
7. **Deliver.** Create a Gmail draft (`mcp__Gmail__create_draft`) to the `config.json` recipients with that subject/html.
   Send (`mcp__Gmail__send_message`) only if the routine prompt explicitly says to send. Never email anyone not in config.
   If sources return nothing or tools fail, report that clearly; don't fabricate news.
