#!/usr/bin/env node
// Helpers for the creditflow-digest skill.
//   node digest.mjs filter candidates.json  -> fresh.json on stdout
//   node digest.mjs render selected.json    -> {subject, html} on stdout
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const cfg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "config.json"), "utf8"));

const MONTHS_RU = {
  "январ": 0, "феврал": 1, "март": 2, "апрел": 3, "мая": 4, "май": 4,
  "июн": 5, "июл": 6, "август": 7, "сентябр": 8, "октябр": 9, "ноябр": 10, "декабр": 11,
};

// Publish date (ms) from page text, or null. Newest plausible date near the top wins.
export function extractDateFromText(text, now = Date.now()) {
  if (!text) return null;
  const s = text.slice(0, 4000);
  const c = [];
  for (const m of s.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/g))
    c.push(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)));
  for (const m of s.matchAll(/(?<![\p{L}\d])(\d{1,2})\s+([а-яё]+)\.?\s*(20\d{2})?/giu)) {
    const key = Object.keys(MONTHS_RU).find((k) => m[2].toLowerCase().startsWith(k));
    const day = +m[1];
    if (!key || day < 1 || day > 31) continue;
    c.push(Date.UTC(m[3] ? +m[3] : new Date(now).getUTCFullYear(), MONTHS_RU[key], day, 12, 0));
  }
  for (const m of s.matchAll(/\b(\d{2})\.(\d{2})\.(20\d{2})\b/g))
    c.push(Date.UTC(+m[3], +m[2] - 1, +m[1], 12, 0));
  const valid = c.filter((t) => !isNaN(t) && t <= now + 86400000 && t >= now - 730 * 86400000);
  return valid.length ? Math.max(...valid) : null;
}

export function filterFresh(items, now = Date.now(), hours = cfg.windowHours) {
  const cutoff = now - hours * 3600e3;
  const out = [];
  for (const x of items) {
    const t = extractDateFromText(x.text, now);
    if (t != null) {
      x.published = new Date(t).toISOString();
      x.dateSource = "page";
      if (t >= cutoff) out.push(x);
    } else {
      x.dateSource = "unverified";
      x.published = x.published || "н/д";
      out.push(x);
    }
  }
  return out.sort((a, b) => (Date.parse(b.published) || 0) - (Date.parse(a.published) || 0));
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const today = () => new Date().toLocaleDateString("ru-RU", { timeZone: "Asia/Almaty", day: "2-digit", month: "long", year: "numeric" });

export function render(items) {
  if (!items.length)
    return {
      subject: `CreditFlow: новости дня ${today()} — нет свежих новостей`,
      html: `<p>За последние ${cfg.windowHours} часов релевантных новостей по заданным источникам не найдено.</p>`,
    };
  const blocks = items.map((n) => `<div style="margin-bottom:20px">
<p style="font-weight:bold;margin:0 0 4px">${esc(n.headline)}</p>
<p style="color:#666;margin:0 0 4px;font-size:13px">Источник: ${esc(n.source)}${n.date ? " · " + esc(n.date) : ""}</p>
<p style="margin:0 0 4px">${esc(n.summary)}</p>
<p style="margin:0"><a href="${esc(n.url)}">Читать оригинал</a></p>
</div>`).join("\n");
  return {
    subject: `CreditFlow: новости дня ${today()}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:680px">
<h2 style="margin:0 0 16px">CreditFlow — новости дня, ${today()}</h2>
${blocks}
<hr style="margin-top:24px;border:none;border-top:1px solid #ddd">
<p style="color:#999;font-size:12px">Автоматический дайджест. Источники: ${cfg.sources.join(", ")}.</p>
</div>`,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, file] = process.argv.slice(2);
  const data = JSON.parse(readFileSync(file, "utf8"));
  if (cmd === "filter") console.log(JSON.stringify(filterFresh(data), null, 2));
  else if (cmd === "render") console.log(JSON.stringify(render(data)));
  else { console.error("usage: digest.mjs filter|render <file.json>"); process.exit(2); }
}
