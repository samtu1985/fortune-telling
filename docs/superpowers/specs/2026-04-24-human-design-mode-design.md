# 人類圖模式 (Human Design / Bodygraph) — Design Spec

**Date:** 2026-04-24
**Status:** Draft for review
**Scope:** 新增第四種命理模式「設計圖解讀師」，透過 humandesignhub.app REST API 計算本命 Bodygraph，自繪 SVG 呈現，交由管理員可設定的 AI 模型進行 Q&A 式解讀。同步新增後台「第三方整合」分頁以管理第三方計算 API 的金鑰與啟用狀態。

---

## 1. Goals & Non-Goals

### Goals
- 新增命理模式 `humandesign`，與既有 bazi / ziwei / zodiac 在架構上對稱。
- 以外部 REST API（humandesignhub.app `/v1/bodygraph`）做計算，避免引入 AGPL/GPL 星曆授權污染商用專案。
- 自繪 SVG 的 `HumanDesignChart` 元件，風格遵循 `DESIGN.md`（Tesla 極簡），IP 風險可控。
- 餵完整 Bodygraph JSON 給 LLM，支援管理員在後台獨立切換「設計圖解讀師」的 AI 模型、thinking mode、effort。
- 新增後台「第三方整合」分頁，CRUD `integrationSettings` 表；支援啟用/停用 + 連線測試。
- 4 locale i18n 完整支援（zh-Hant / zh-Hans / en / ja）。
- 每個新模組要有 unit test 覆蓋關鍵邏輯。

### Non-Goals（v1 不做）
- Transit（流年）/ Composite（合盤）/ Penta（團體）— humandesignhub 端點已備，但 UX 偏離既有「一人一盤一問答」架構，留 v2。
- Bodygraph 中 13 顆行星符號的詳細繪製 — v1 只畫「9 中心 + 36 條通道 + 啟動閘門編號」；行星符號 v2。
- PNG / PDF 匯出 — 繼續走現有 html2canvas 前端匯出模式，不另外做 server-side 圖檔。
- 使用 "Human Design" 商標用字於 UI — 中文用「設計圖解讀」/「設計圖」；英文傾向 `Bodygraph` / `Energy Map`，避開 Jovian Archive 商標爭議。
- 本地計算（自託管 ephemeris）— 不在 v1 範圍。

---

## 2. Licensing Context（此專案規避策略）

| 風險類別 | 應對 |
|---|---|
| Swiss Ephemeris AGPL 污染 | 不使用任何本地 ephemeris 庫；計算外包給 humandesignhub API |
| Moshier GPL-2/3 污染 | 同上 |
| "Human Design" 商標 | UI 中文用「設計圖解讀師」/「能量設計圖」；AI system prompt 明示不得使用商標名 |
| Bodygraph 視覺資產 | 自繪 SVG，不引用官方圖檔 / 不用第三方含版權樣式的 React 套件 |

---

## 3. Architecture Overview

```
[User input: date/time/city/gender]
        │
        ▼
[/api/chart?type=humandesign]
        ├ 讀 integrationSettings(service="humandesign")  ─► enabled? 否則 422
        ├ lunar → solar 轉換（復用 lunar-typescript，若 calendarType=lunar）
        ├ POST humandesignhub.app/v1/bodygraph  with X-API-KEY
        └ normalize → HumanDesignChartData
        │
        ▼
[HumanDesignChart.tsx]  ──render──▶  SVG Bodygraph + 摘要卡
        │
        ▼
[User 提問 → /api/divine with type="humandesign"]
        ├ auth + consumeQuota("single")
        ├ SYSTEM_PROMPTS.humandesign + <humandesign-chart>JSON</humandesign-chart>
        ├ getAIConfig("humandesign")
        └ SSE streaming reply
```

**Fault boundaries:**
- 第三方計算服務宕機 → 不影響其他三種命理模式。
- AI 模型未設定 → 繼續走既有預設 fallback（Gemini）。
- 前端 Bodygraph 渲染錯 → 以摘要文字卡降級顯示。

---

## 4. Database Schema Changes

### 4.1 新表 `integration_settings`
```ts
// app/lib/db/schema.ts
export const integrationSettings = pgTable("integration_settings", {
  id: serial("id").primaryKey(),
  service: text("service").notNull().unique(),        // e.g. "humandesign"
  apiUrl: text("api_url").notNull(),
  apiKeyEncrypted: text("api_key_encrypted"),         // 復用 encryptApiKey
  enabled: boolean("enabled").notNull().default(false),
  metadata: jsonb("metadata"),                         // 保留欄位
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

**Migration：** 單支 Drizzle migration — `CREATE TABLE integration_settings`。

### 4.2 擴充既有欄位（無 schema 改動）
- `conversations.type` 新增取值 `"humandesign"`（欄位已是 text）。
- `aiSettings.masterKey` 新增取值 `"humandesign"`（同上）。
- `profiles.savedCharts` JSON 新增 key `humandesign`。
- `/api/admin/ai-settings/route.ts` valid keys whitelist 加入 `"humandesign"`。

### 4.3 加密工具抽出
將 `app/lib/ai-settings.ts` 中的 `encryptApiKey` / `decryptApiKey` 抽出到 `app/lib/crypto.ts`，`integrationSettings` 與既有 `aiSettings` 共用。

---

## 5. 計算層 `app/lib/humandesign.ts`

```ts
export type HumanDesignInput = {
  date: string;      // ISO "YYYY-MM-DD"，Gregorian（lunar 由 caller 先轉）
  time: string;      // "HH:mm" (24h)
  city: string;      // 自由文字；humandesignhub 做 geocoding + tz resolution
  timezone?: string; // 可選 IANA，未來若 UI 收集可覆寫
};

export type HumanDesignChartData = {
  meta: { fetchedAt: string; service: "humandesign" };
  summary: {
    type: "Manifestor" | "Generator" | "Manifesting Generator" | "Projector" | "Reflector";
    strategy: string;
    authority: string;
    profile: string;            // "1/3", "5/1" …
    definition: string;         // "Single" / "Split" / "Triple Split" / "Quad Split" / "None"
    signature: string;
    notSelfTheme: string;
  };
  centers: Record<CenterKey, { defined: boolean; activatedGates: number[] }>;
  channels: Array<{ gates: [number, number]; label: string; active: boolean }>;
  gates: Array<{ number: number; line: number; source: "personality" | "design"; planet: Planet }>;
  planets: {
    personality: Record<Planet, { gate: number; line: number; color: number; tone: number; base: number }>;
    design:      Record<Planet, { gate: number; line: number; color: number; tone: number; base: number }>;
  };
  raw?: unknown; // 除錯用，不進 AI prompt
};

export async function generateHumanDesignChart(input: HumanDesignInput): Promise<HumanDesignChartData>;
export function serializeForPrompt(chart: HumanDesignChartData): string;
```

**錯誤碼（拋到 `/api/chart` catch）**
| 狀況 | HTTP | Code |
|---|---|---|
| integrationSettings 未設或 enabled=false | 422 | `humandesign_not_configured` |
| humandesignhub 401/403 | 502 | `calculation_service_auth_failed` |
| 逾時 >10s / 網路錯 | 503 | `calculation_service_unavailable` |
| 回傳 schema 驗證失敗 | 500 | `calculation_service_invalid_response`（log raw） |

前端一律透過 i18n key 顯示友善訊息，不洩漏技術細節。

---

## 6. 視覺元件 `app/components/HumanDesignChart.tsx`

### v1 範圍
- 9 中心標準位置：Head（三角頂）/ Ajna（倒三角）/ Throat（方塊）/ G-Center（菱形）/ Heart/Will（小三角）/ Solar Plexus（三角右下）/ Sacral（方塊中）/ Spleen（三角左）/ Root（方塊底）
- 36 條通道以直線連接兩端閘門座標；`channels[i].active === true` 使用 Electric Blue `#3E6AE1`，否則細灰線
- 中心 `defined: true` 填色、`false` 白底細邊
- 啟動閘門號碼以小字標示於中心旁
- 頂部摘要卡：Type / Strategy / Authority / Profile / Definition（5 行文字）
- SVG viewBox `0 0 800 1200`、桌面 `max-w-[640px]`、手機全寬等比縮放
- 遵循 `DESIGN.md`：無陰影、無漸層、`stroke-width: 1`

### v2（不在本 spec 範圍）
- 13 行星符號（人格紅 / 設計黑）於兩側欄位
- 閘門 line/color/tone/base 細節 tooltip
- 動畫（hover 高亮通道）

**檔案大小上限：** 500 行（超過請拆出常數表 `app/lib/humandesign-layout.ts`）。

---

## 7. AI 整合

### 7.1 SYSTEM_PROMPTS.humandesign
於 `app/api/divine/route.ts` 新增：
```
你是一位資深的設計圖解讀師。使用者的能量設計圖會以 <humandesign-chart>JSON</humandesign-chart> 提供。
- 起手以 Type / Strategy / Authority / Profile 做整體畫像。
- 解答問題時，引用相關的中心 / 通道 / 閘門作為依據。
- 語氣：溫和、具象、鼓勵實驗；避免命定式語言。
- 不使用「Human Design」商標名或 Ra Uru Hu 專屬文案；用中性語詞描述。
- 依 locale 指示的語言回應。
```
語言指示後綴沿用 `AI_LANGUAGE_DIRECTIVES[locale]`。

### 7.2 Chart → prompt 序列化
`serializeForPrompt()` 產出扁平 JSON（去掉 `raw` 與 `meta`），以 `<humandesign-chart>...</humandesign-chart>` 包住，與既有 bazi/ziwei/zodiac 對齊。

### 7.3 模型選擇
`getAIConfig("humandesign")` 路徑完全復用既有串流邏輯；管理員可於後台 AI Settings 分頁獨立設定 provider / modelId / apiKey / thinking mode / effort。

---

## 8. 後台 UI

### 8.1 新分頁「第三方整合 / Integrations」
- 檔：`app/components/admin/IntegrationsTab.tsx`
- API：`app/api/admin/integrations/route.ts`（GET 列表、PUT 建立或更新、DELETE）
- 權限：複用 `requireAdmin`
- UI：
  - 以表格列出所有 integration（v1 僅 humandesign）
  - 每列欄位：service、apiUrl（可編輯）、apiKey（屏蔽 `****`，進入編輯模式才能輸入）、enabled（toggle）、「測試連線」按鈕
  - 測試連線動作：後端以最小 payload 呼叫 humandesignhub，驗 API key 有效即回 ok；不消耗使用者 quota
- 加進 `app/admin/page.tsx` 的 tab 清單，位置於 AI Settings 之後

### 8.2 AI Settings 分頁擴充
- 新增 master 「設計圖解讀師」對應 `masterKey: "humandesign"`
- `/api/admin/ai-settings/route.ts` 的 whitelist 加 `"humandesign"`

---

## 9. i18n 新增鍵（`app/lib/i18n.ts`，4 locale）

```
# 首頁卡片
divinationType.humandesign
divinationType.humandesign.desc

# 摘要卡
humandesign.summary.type
humandesign.summary.strategy
humandesign.summary.authority
humandesign.summary.profile
humandesign.summary.definition
humandesign.summary.signature
humandesign.summary.notSelfTheme

# 中心名稱 × 9
humandesign.center.head
humandesign.center.ajna
humandesign.center.throat
humandesign.center.g
humandesign.center.heart
humandesign.center.solarPlexus
humandesign.center.sacral
humandesign.center.spleen
humandesign.center.root

# 錯誤訊息
humandesign.error.notConfigured
humandesign.error.serviceUnavailable
humandesign.error.authFailed
humandesign.error.invalidInput

# 後台
admin.integrations.title
admin.integrations.addBtn
admin.integrations.test.success
admin.integrations.test.failed
admin.integrations.service.humandesign
admin.integrations.service.humandesign.desc
admin.ai.master.humandesign

# 老師人設
humandesign.master.name       # zh-Hant: "設計圖解讀師"
humandesign.master.greeting
```

約 ~27 組鍵 × 4 locale ≈ 108 條字串。

---

## 10. 使用者體驗 / 錯誤處理

- 未配置 integration → 前端顯示 `humandesign.error.notConfigured`：「此功能尚未開通，請聯絡管理員」
- humandesignhub 逾時 → 友善訊息 + retry 按鈕；**若 quota 已消耗則呼叫 `refundQuota` 退回**（若工具尚未存在，需新增於 `app/lib/quota.ts`）
- AI 模型未設定 → 沿用既有 Gemini fallback
- 使用者輸入驗證：生日年份 1900–今年、時間必填、city 必填非空字串

---

## 11. 老師人設

| 欄位 | 值 |
|---|---|
| masterKey | `humandesign` |
| 顯示名稱（zh-Hant） | 設計圖解讀師 |
| 顯示名稱（zh-Hans） | 设计图解读师 |
| 顯示名稱（en） | Energy Design Guide |
| 顯示名稱（ja） | エネルギーデザインガイド |
| Avatar 風格 | 幾何抽象（Bodygraph 剪影），非具體人像；符合 Tesla 極簡 |
| 語氣 | 溫和、好奇、引導式；鼓勵「去實驗」的實用主義 |
| 開場模板 | 先點出 Type + Authority + Strategy，再回答使用者具體問題 |

---

## 12. 測試策略（每個新模組必備 unit test）

### Unit
- `app/lib/humandesign.ts`
  - `generateHumanDesignChart` — 以 fixture response 測 normalization 正確
  - `serializeForPrompt` — 序列化輸出穩定、不包含 `raw` / `meta`、token 預算合理（< 3k tokens）
  - lunar→solar 轉換（若 calendarType=lunar）
- `app/lib/crypto.ts`
  - encrypt/decrypt round-trip、空值處理、不同 key 解密失敗
- `app/components/HumanDesignChart.tsx`
  - 渲染 9 中心、啟動 channel 色差、摘要卡欄位正確
  - Snapshot test 至少 2 組 fixture（Generator 單一定義、Projector 多重 split）

### Integration
- `/api/chart` with `type=humandesign`、mocked humandesignhub response、覆蓋成功 + 4 種錯誤分支
- `/api/divine` with `type=humandesign`、驗證 SYSTEM_PROMPT + chart JSON 正確拼入、SSE 串流 happy path
- `/api/admin/integrations/route.ts` GET/PUT/DELETE、權限檢查、apiKey 加密存取

### Manual QA
- 真實呼叫 humandesignhub（使用測試 key），至少 3 組不同生日涵蓋 Generator / Projector / Manifestor
- 4 locale UI 切換驗證
- 後台 Integrations tab 新增 / 編輯 / 刪除 / 測試連線

### E2E（optional，排入 v1 若時間允許）
- Playwright：input → chart 呈現 → 提問 → AI stream 完整走一遍

---

## 13. 檔案清單

### 新增
- `app/lib/humandesign.ts`
- `app/lib/crypto.ts`
- `app/lib/humandesign-layout.ts`（若主元件超過 500 行才拆）
- `app/components/HumanDesignChart.tsx`
- `app/components/admin/IntegrationsTab.tsx`
- `app/api/admin/integrations/route.ts`
- `drizzle/migrations/XXXX_integration_settings.sql`
- 測試檔：`__tests__/humandesign.test.ts`、`__tests__/crypto.test.ts`、`__tests__/HumanDesignChart.test.tsx`、`__tests__/api/chart-humandesign.test.ts`、`__tests__/api/divine-humandesign.test.ts`、`__tests__/api/admin-integrations.test.ts`

### 修改
- `app/lib/db/schema.ts` — 加 `integrationSettings`
- `app/lib/ai-settings.ts` — encrypt/decrypt 搬去 `crypto.ts`
- `app/api/divine/route.ts` — 加 `humandesign` SYSTEM_PROMPT + type 白名單
- `app/api/chart/route.ts` — 加 humandesign 分支
- `app/api/admin/ai-settings/route.ts` — masterKey 白名單加入 `humandesign`
- `app/admin/page.tsx` — 新增 Integrations tab
- `app/components/DivinationCard.tsx` — 新增人類圖卡片
- `app/(protected)/page.tsx` — type 分派、input form 復用
- `app/lib/i18n.ts` — 新增翻譯（~108 條）
- `app/lib/quota.ts` — 若無 `refundQuota` 則新增

---

## 14. Rollout

1. 寫 migration、schema、crypto 抽出 + unit test
2. humandesign 計算層 + prompt 序列化 + unit test
3. 後台 Integrations tab + API + unit test
4. `app/admin/page.tsx` 整合 tab + AI Settings 加 master
5. HumanDesignChart.tsx + snapshot test
6. `/api/chart` + `/api/divine` 分支 + integration test
7. 前台 DivinationCard + 入口整合
8. i18n 4 locale 字串
9. Manual QA（真 API key）
10. E2E（optional）
11. 合併 feature branch 到 main

---

## 15. 開放問題 / 風險

| 項目 | 風險 | 緩解 |
|---|---|---|
| humandesignhub API rate limit | 未明 | Integrations 測試連線按鈕 + 後台 metadata 欄位記錄觀察用量 |
| humandesignhub 定價調整 | 月費變動 | Integration 抽象化讓未來可換 humandesignapi.com 等其他供應商 |
| Bodygraph 視覺還原度 | 自繪首版不完美 | v1 聚焦「核心正確」、v2 補行星 / tooltip |
| IP 爭議（商標、圖形） | 未知 | UI 命名避開 "Human Design"、視覺自繪、提供 disclaimer |
| 模型 token 成本 | 完整 JSON 餵 AI | 後台可選 Haiku / Gemini Flash 降本 |
