# Homepage Redesign: Cosmic Glassmorphism

## Context

The current homepage uses a flat dark background with solid-border cards. User feedback and design review identified it as too conservative and lacking visual appeal for modern audiences. The redesign adds a cosmic/starfield atmosphere with glassmorphism cards while preserving the trustworthy, sophisticated brand identity.

## Scope

First page only: the divination type selection screen (initial selection mode in `app/(protected)/page.tsx`). Login page, conversation pages, and admin panel are not in scope.

## Visual Changes

### Background (3 layers)

1. **Base**: Compressed starfield/nebula WebP image (~100KB), `background-size: cover`, fixed position
2. **Overlay**: CSS radial gradients for purple/blue nebula glow effects
3. **Particles**: Modify existing `SmokeParticles.tsx` — change from smoke to starfield (white/gold small dots, gentle twinkle animation, slower movement)

Dark mode and light mode each get their own background treatment:
- Dark: deep space starfield with blue/purple nebula
- Light: soft cloudy sky with warm golden tones (use a different image or CSS-only gradient)

### Cards: Glassmorphism

Replace current solid cards with glass effect:
```css
backdrop-filter: blur(12px);
background: rgba(255, 255, 255, 0.06);
border: 1px solid rgba(212, 173, 74, 0.2);
border-radius: 12px;
```

Hover state:
```css
border-color: rgba(212, 173, 74, 0.5);
transform: translateY(-2px);
box-shadow: 0 8px 32px rgba(212, 173, 74, 0.15);
```

### CTA Buttons

Each card gets a "開始分析 →" (or localized equivalent) text link at the bottom:
- Gold color, 12px font, tracking-wide
- Hover: brightens

Three Masters premium card keeps:
- PREMIUM badge
- Horizontal layout
- Gold top border accent
- Slightly more prominent glow

### Typography

- Title "天機" stays as-is (calligraphy font)
- "Destiny Reading by AI" stays italic serif
- Card titles remain serif gold
- Description text: slightly increase line-height for readability

## Files to Modify

| File | Changes |
|------|---------|
| `app/globals.css` | Add glass card styles, background layers, hover transitions |
| `app/(protected)/page.tsx` | Update header section + card grid + CTA links (initial selection mode only) |
| `app/components/DivinationCard.tsx` | Glass styles, hover effect, CTA text |
| `app/components/SmokeParticles.tsx` | Convert smoke to starfield particles |
| `public/bg-stars-dark.webp` | New: dark mode starfield background |

## What Stays the Same

- Navigation bar (locale switcher, theme toggle, user menu)
- All functional logic (type selection, conversation flow)
- Login page, conversation pages, admin panel
- Mobile responsive behavior
- All existing animations (fade-in-up)

## i18n

Add translation key for CTA:
- `type.cta`: "開始分析 →" / "开始分析 →" / "Start Analysis →" / "分析を開始 →"

## Light Mode Consideration

For light mode, the glass effect inverts:
```css
[data-theme="light"] .glass-card {
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid rgba(138, 109, 30, 0.15);
  backdrop-filter: blur(12px);
}
```

Background uses CSS gradients only (warm golden sky, no starfield image for light mode).
