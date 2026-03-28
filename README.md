# 天命 — 命理推算

結合八字、紫微斗數與西洋星座的 AI 命理分析應用。

## 功能特色

- **八字命理** — 根據出生年月日時排四柱，分析五行、十神、大運流年（含真太陽時校正）
- **紫微斗數** — 排列十四主星命盤，解析十二宮位與大限流年
- **西洋星座** — 太陽、月亮、上升星座與行星相位解讀
- **串流回應** — AI 分析結果即時串流顯示，含推理過程展示
- **Google OAuth 登入** — 透過 NextAuth.js 整合 Google 帳號驗證
- **明暗主題切換** — 支援淺色/深色模式，自動偵測系統偏好
- **行動裝置優先** — PWA 支援，可安裝至手機主畫面
- **煙霧粒子動畫** — 東方美學風格的背景視覺效果

## 技術架構

- **框架**: [Next.js 16](https://nextjs.org/) (App Router)
- **語言**: TypeScript
- **樣式**: Tailwind CSS 4
- **驗證**: NextAuth.js (Google OAuth)
- **AI 模型**: BytePlus Seed 2.0 Pro (串流 SSE)
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
│   └── divine/route.ts               # AI 命理推算 API（串流）
├── components/
│   ├── DivinationCard.tsx             # 命理類型選擇卡片
│   ├── InputForm.tsx                  # 使用者輸入表單
│   ├── ResultDisplay.tsx              # 結果顯示（含推理過程）
│   ├── SessionProvider.tsx            # NextAuth Session Provider
│   ├── SmokeParticles.tsx             # 煙霧粒子動畫
│   ├── ThemeProvider.tsx              # 主題切換 Context
│   ├── ThemeToggle.tsx                # 明暗模式切換按鈕
│   └── UserMenu.tsx                   # 使用者選單
├── lib/auth.ts                        # NextAuth 設定
├── login/page.tsx                     # 登入頁面
├── (protected)/
│   ├── layout.tsx                     # 受保護路由 Layout
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
