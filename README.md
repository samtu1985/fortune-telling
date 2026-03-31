# 天命 — 命理推算

結合八字、紫微斗數與西洋星座的 AI 命理分析應用。

## 功能特色

- **八字命理** — 根據出生年月日時排四柱，分析五行、十神、大運流年（含真太陽時校正）
- **紫微斗數** — 自製紫微命盤元件，排列十四主星、解析十二宮位與大限流年
- **西洋星座** — 太陽、月亮、上升星座與行星相位解讀
- **串流回應** — AI 分析結果即時串流顯示，含推理過程展示
- **追問對話** — 可針對結果進行追問，支援多輪對話
- **Google OAuth 登入** — 透過 NextAuth.js 整合 Google 帳號驗證
- **使用者管理** — 管理員後台可檢視與管理使用者權限
- **個人檔案** — 使用者可設定暱稱與個人資料
- **明暗主題切換** — 支援淺色/深色模式，自動偵測系統偏好
- **行動裝置優先** — PWA 支援，可安裝至手機主畫面
- **煙霧粒子動畫** — 東方美學風格的背景視覺效果

## 技術架構

- **框架**: [Next.js 16](https://nextjs.org/) (App Router)
- **語言**: TypeScript
- **樣式**: Tailwind CSS 4
- **驗證**: NextAuth.js v5 (Google OAuth)
- **AI 模型**: BytePlus Seed 2.0 Pro (串流 SSE)
- **儲存**: Vercel Blob (使用者資料)
- **分析**: Vercel Analytics + Speed Insights
- **命理引擎**: bazi.js、fortel-ziweidoushu、iztro、circular-natal-horoscope-js、lunar-typescript
- **部署**: Vercel

## 快速開始

### 環境需求

- Node.js 20+
- npm

### 安裝

```bash
git clone https://github.com/<your-username>/fortune-telling.git
cd fortune-telling
npm install
```

### 環境變數

在專案根目錄建立 `.env.local`：

```env
# Google OAuth (https://console.cloud.google.com/)
AUTH_GOOGLE_ID=your_google_client_id
AUTH_GOOGLE_SECRET=your_google_client_secret
AUTH_SECRET=your_nextauth_secret

# BytePlus AI API
BYTEPLUS_API_KEY=your_byteplus_api_key
BYTEPLUS_MODEL_ID=seed-2-0-pro-260328  # 可選，有預設值

# Vercel Blob（用於使用者資料儲存）
BLOB_READ_WRITE_TOKEN=your_blob_token
```

### 啟動開發伺服器

```bash
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000) 即可使用。

## 專案結構

```
app/
├── api/
│   ├── auth/[...nextauth]/route.ts   # NextAuth API 路由
│   ├── divine/route.ts               # AI 命理推算 API（串流）
│   ├── profile/route.ts              # 使用者個人檔案 API
│   └── admin/users/route.ts          # 管理員：使用者管理 API
├── components/
│   ├── DivinationCard.tsx             # 命理類型選擇卡片
│   ├── InputForm.tsx                  # 使用者輸入表單
│   ├── PendingScreen.tsx              # 等待審核畫面
│   ├── ProfileModal.tsx               # 個人檔案彈窗
│   ├── ResultDisplay.tsx              # 結果顯示（含推理過程）
│   ├── SessionProvider.tsx            # NextAuth Session Provider
│   ├── SmokeParticles.tsx             # 煙霧粒子動畫
│   ├── ThemeProvider.tsx              # 主題切換 Context
│   ├── ThemeToggle.tsx                # 明暗模式切換按鈕
│   ├── UserMenu.tsx                   # 使用者選單
│   └── ZiweiChart.tsx                 # 自製紫微斗數命盤元件
├── lib/
│   ├── auth.ts                        # NextAuth 設定
│   ├── astrology.ts                   # 西洋星座計算
│   ├── bazi.ts                        # 八字排盤計算
│   ├── users.ts                       # 使用者資料管理（Vercel Blob）
│   └── ziwei.ts                       # 紫微斗數排盤計算
├── admin/                             # 管理員後台
│   ├── layout.tsx
│   └── page.tsx
├── login/page.tsx                     # 登入頁面
├── (protected)/
│   ├── layout.tsx                     # 受保護路由 Layout
│   ├── error.tsx                      # 錯誤邊界
│   └── page.tsx                       # 主頁面
├── layout.tsx                         # 根 Layout
└── globals.css                        # 全域樣式
```

## 指令

| 指令 | 說明 |
|------|------|
| `npm run dev` | 啟動開發伺服器 |
| `npm run build` | 建置生產版本 |
| `npm run start` | 啟動生產伺服器 |
| `npm run lint` | 執行 ESLint 檢查 |

## 授權

MIT
