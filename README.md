# 天機 — FortuneFor.me

AI-powered destiny reading platform combining Chinese and Western divination systems.

[https://fortunefor.me](https://fortunefor.me)

## Features

### Divination Modes
- **Four Pillars (八字命理)** — Analyze destiny through Heavenly Stems & Earthly Branches, Five Elements, Ten Gods, and Major Luck Cycles
- **Purple Star (紫微斗數)** — Map fourteen major stars across twelve palaces with interactive visual chart
- **Western Astrology (西洋星座)** — Sun, Moon, Ascendant signs and planetary aspects via Moshier ephemeris
- **Three Masters Discussion (三師論道)** — Three AI masters debate from different perspectives (max 3 rounds), with PDF download and anonymous case study sharing

### User Experience
- **Multi-language** — Traditional Chinese, Simplified Chinese, English, Japanese (UI + AI responses)
- **Streaming responses** — Real-time AI streaming with reasoning process display
- **Follow-up conversations** — Multi-turn dialogue with @mention for synastry/compatibility analysis
- **Font size toggle** — Larger text mode for mobile readability
- **Dark/Light theme** — Auto-detects system preference
- **Mobile-first PWA** — Installable, floating controls on mobile, auto-collapse during AI responses
- **Markdown rendering** — Bold, italic, tables, lists in AI responses and PDF downloads

### Authentication
- **Google OAuth** — Sign in with Google via NextAuth.js v5
- **Credentials login** — Username/password registration with email verification
- **Password reset** — Forgot password flow via Resend email API

### Admin Panel
- **User management** — Approve/disable users, ambassador role assignment
- **AI engine settings** — Configure AI provider per master (BytePlus, OpenAI, Anthropic, Google Gemini, custom)
- **Thinking/reasoning config** — Adaptive thinking, effort levels, reasoning depth per model
- **Usage analytics** — API calls, input/output tokens per user with time range filtering (1D/1W/1M/3M/6M/1Y)
- **Credit system** — Free trial credits for individual Q&A and Three Masters sessions
- **Case library** — Browse anonymized case studies contributed by users
- **Ambassador system** — Designate users as ambassadors to send free trial invitations

### Credits & Invitations
- **Free trial credits** — Configurable default credits for individual Q&A rounds and Three Masters sessions
- **Send free trial** — Admin/ambassadors can invite users via email with customizable credit amounts
- **Pending credits** — Credits stored for unregistered users, auto-applied after registration approval
- **Soft reminders** — Usage displayed in avatar menu, gentle notification when credits run out

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Database | Neon Postgres + Drizzle ORM |
| Auth | NextAuth.js v5 (Google OAuth + Credentials) |
| AI Providers | Google Gemini, Anthropic Claude, OpenAI, BytePlus Seed (configurable per master) |
| Email | Resend API (verification, password reset, trial invitations, admin notifications) |
| PDF | jsPDF + html2canvas |
| Analytics | Vercel Analytics + Speed Insights |
| Divination Engines | bazi.js, fortel-ziweidoushu, iztro, circular-natal-horoscope-js, lunar-typescript |
| Deployment | Vercel |

## Quick Start

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
git clone https://github.com/samtu1985/fortune-telling.git
cd fortune-telling
npm install
```

### Environment Variables

Create `.env.local` in the project root:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
AUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=https://fortunefor.me

# Database (Neon Postgres)
POSTGRES_URL=your_neon_postgres_url
POSTGRES_HOST=your_host
POSTGRES_DATABASE=your_db
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password

# AI (default provider, can be overridden in admin panel)
BYTEPLUS_API_KEY=your_byteplus_api_key
BYTEPLUS_MODEL_ID=seed-2-0-pro-260328

# Email (optional, logs to console if not set)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@fortunefor.me

# Admin
ADMIN_EMAIL=your_admin_email
```

### Database Setup

```bash
npx drizzle-kit push
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
app/
├── api/
│   ├── auth/
│   │   ├── [...nextauth]/route.ts      # NextAuth API
│   │   ├── register/route.ts           # User registration
│   │   ├── check-username/route.ts     # Username availability
│   │   ├── verify-email/route.ts       # Email verification
│   │   ├── forgot-password/route.ts    # Password reset request
│   │   └── reset-password/route.ts     # Password reset
│   ├── divine/route.ts                 # Single master AI (streaming SSE)
│   ├── divine-multi/route.ts           # Three masters AI (streaming SSE)
│   ├── chart/route.ts                  # Chart generation
│   ├── credits/
│   │   ├── route.ts                    # User credits query
│   │   ├── consume/route.ts            # Credit consumption
│   │   └── send/route.ts              # Send trial credits
│   ├── case-studies/route.ts           # Anonymous case studies
│   ├── admin/
│   │   ├── users/route.ts             # User management
│   │   ├── ai-settings/route.ts       # AI provider config
│   │   ├── usage/route.ts             # Usage analytics
│   │   ├── credit-settings/route.ts   # Credit defaults
│   │   └── case-studies/              # Case library
│   ├── profiles/                      # Birth profiles CRUD
│   ├── saved-conversations/           # Saved conversations CRUD
│   └── settings/route.ts             # User settings
├── components/
│   ├── ComprehensiveMode.tsx          # Three Masters discussion UI
│   ├── DivinationCard.tsx             # Divination type card
│   ├── InputForm.tsx                  # Birth data form
│   ├── ResultDisplay.tsx              # AI response with Markdown
│   ├── ZiweiChart.tsx                 # Interactive Ziwei visual chart
│   ├── LocaleProvider.tsx             # i18n context
│   ├── LocaleSwitcher.tsx             # Language switcher
│   ├── ThemeProvider.tsx              # Dark/light theme
│   ├── FontSizeProvider.tsx           # Font size toggle
│   ├── SendTrialModal.tsx             # Free trial invitation modal
│   ├── UserMenu.tsx                   # User avatar menu
│   └── ...
├── lib/
│   ├── auth.ts                        # NextAuth config (Google + Credentials)
│   ├── ai-client.ts                   # AI API client (OpenAI-compatible + Anthropic)
│   ├── ai-settings.ts                 # AI config management
│   ├── bazi.ts                        # Four Pillars calculation
│   ├── ziwei.ts                       # Purple Star calculation
│   ├── astrology.ts                   # Western astrology (Moshier ephemeris)
│   ├── i18n.ts                        # Translations (4 locales)
│   ├── email.ts                       # Resend email helpers
│   ├── usage.ts                       # API usage logging
│   ├── users.ts                       # User management
│   └── db/
│       ├── index.ts                   # Drizzle + Neon connection
│       ├── schema.ts                  # Database schema
│       └── encryption.ts             # API key encryption
├── admin/page.tsx                     # Admin panel
├── login/page.tsx                     # Login page
├── register/page.tsx                  # Registration page
├── forgot-password/page.tsx           # Forgot password
├── reset-password/page.tsx            # Reset password
└── (protected)/
    ├── layout.tsx                     # Auth guard
    └── page.tsx                       # Main app
```

## Commands

| Command | Description |
|---------|------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx drizzle-kit push` | Push schema to database |

## License

MIT
