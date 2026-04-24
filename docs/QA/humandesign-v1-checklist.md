# Human Design Mode — v1 Manual QA Checklist

**Branch:** feature/human-design-mode
**Spec:** docs/superpowers/specs/2026-04-24-human-design-mode-design.md
**Plan:** docs/superpowers/plans/2026-04-24-human-design-mode.md

## Pre-flight
- [ ] `HUMANDESIGN_API_KEY` and `HUMANDESIGN_API_URL` set in `.env.local`
- [ ] API key has humandesignhub **Standard** plan or higher (Free plan returns 403 for `/v1/bodygraph`)
- [ ] Admin account logged in (email matches `ADMIN_EMAIL`)
- [ ] Dev server running: `npm run dev`
- [ ] `integration_settings` row for `humandesign` **not yet** created (so the first QA step covers first-time setup)

## Admin — Integrations tab (backend behavior)
- [ ] Admin page shows a new "第三方整合" tab after "付款管理"
- [ ] Tab opens; "人類圖計算服務" card is visible with description
- [ ] Enter API URL (default `https://api.humandesignhub.app/v1`) + real API key; toggle Enabled; click "儲存"
- [ ] Card refresh: key field now shows `••••XXXX` (masked last 4)
- [ ] Click "測試連線" → should return "測試成功" within ~2-5s
- [ ] Temporarily edit API URL to a garbage value; save; test → "測試失敗" with some error code
- [ ] Restore correct URL; re-enter key; save; test → success
- [ ] Toggle Enabled off; save; trying to generate an HD chart (see Front-end section) should return a friendly "此功能尚未開通" message
- [ ] Toggle Enabled back on; save; HD chart flow should work again

## Admin — AI Settings
- [ ] "設計圖解讀師" appears in the AI Settings master list alongside 八字/紫微/星座
- [ ] Set Google Gemini Flash (or current default), save
- [ ] Try setting a different provider/model (e.g., BytePlus, Claude); persists after refresh
- [ ] Invalid master key is rejected 400 by the API whitelist (spot-check via DevTools or curl)

## Front-end — Basic flow
- [ ] Home page (protected) shows a **fourth card** "設計圖解讀" with symbol "能"
- [ ] Click card → input form appears (shared form)
- [ ] Enter birth date, time, place (city name), gender; submit
- [ ] Loading indicator shows ("載入中…" or equivalent) while chart fetches
- [ ] Bodygraph SVG renders once chart loads:
  - 9 centers drawn in canonical positions
  - Defined centers filled (Electric Blue)
  - Undefined centers white/transparent
  - Active channels drawn in accent color, stroke-width ~2.5
  - Inactive channels drawn in light grey, stroke-width 1
  - Gate numbers visible as small labels next to each activated gate dot
- [ ] Summary card above chart shows: Type / Strategy / Authority / Profile / Definition with real values
- [ ] Enter a question, click "開始分析" → SSE streams back a reading
- [ ] AI reading references the chart data (e.g., mentions Type, specific channels, gates)

## Test with multiple birth profiles
Try 3 charts covering different Types:

- [ ] **Generator** (e.g., any common birth chart; humandesignhub returns Type)
- [ ] **Projector** (we verified 1990-05-15 14:30 Taipei → Projector)
- [ ] **Manifestor** (find a known Manifestor birth data online or test until one appears)

For each: chart renders, summary shows correct Type, active channels differ, AI reading is coherent.

## i18n — all 4 locales
Switch locale from the UI menu (top-right):
- [ ] **zh-Hant** — "設計圖解讀" card + reading in 繁體中文
- [ ] **zh-Hans** — "设计图解读" card + reading in 簡體中文
- [ ] **en** — "Energy Design" card + reading in English
- [ ] **ja** — "エネルギーデザイン" card + reading in 日本語
- [ ] No raw i18n keys visible in UI (e.g., `humandesign.error.notConfigured` literal text means the key is missing from that locale)

## Error paths
- [ ] **Not configured:** disable integration in admin, submit a chart → friendly "此功能尚未開通" message, no API call made, quota NOT consumed (check `SELECT single_used FROM users WHERE email='...'` before/after)
- [ ] **Bad API URL:** with integration enabled but API URL edited to `https://api.invalid.example/v1` → 503 serviceUnavailable, quota NOT consumed
- [ ] **Wrong API key:** save a bogus key → 502 authFailed, quota NOT consumed
- [ ] **Invalid city:** enter "zzz12345" as city → 400 invalidInput, quota NOT consumed
- [ ] Each error path's message is localized per current locale

## Regressions — other modes still work
- [ ] **八字** end-to-end (input → chart → Q&A)
- [ ] **紫微斗數** end-to-end
- [ ] **西洋星座** end-to-end
- [ ] **三師論道** end-to-end

## Regressions — profile/chart save paths
- [ ] Save an HD chart to a profile → reloads correctly with the SVG preserved
- [ ] Conversation history persists (saved conversation round-trip with humandesign type)
- [ ] Mention feature (if applicable) for HD type — smoke test only; document any issues

## Post-QA
- [ ] **Rotate humandesignhub API key** in the humandesignhub dashboard (the dev-time key was exposed in conversation history)
- [ ] Update `.env.local` with the new key
- [ ] Update the admin Integrations tab with the new key; re-test connection
- [ ] Delete `backup/pre-reset-main` tag if no longer needed (`git tag -d backup/pre-reset-main`)

## Known gotchas / non-blockers
- **Timezone default:** v1 hardcodes `+08:00` (Asia/Taipei) unless the caller passes an explicit IANA timezone. Other-locale birth charts may show shifted gate/line values until a tz picker or city→tz lookup is added.
- **Gate anchor placement** is deterministic pseudo-arc for v1; not the canonical per-gate positions. Visually acceptable but upgrade target for v2.
- **Planet symbols** (Sun/Earth/Moon/etc. on the two sides) are not drawn in v1 — only center shapes, channels, gate numbers, and summary card.
- **`profiles.savedCharts`** type only lists `bazi | ziwei | zodiac` keys; humandesign saves as `humandesign` at runtime but the type is stale. Low-risk; storage is JSON.
- **Chart data shape:** humandesign returns a structured JSON object from `/api/chart` (unlike bazi/ziwei/zodiac's HTML string). Client code paths that assumed a string for all types have been guarded (`typeof chartPreview.chart === "string"` gate) — watch for regressions.
