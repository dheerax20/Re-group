Design Strategy: The "Modern Sanctuary" Aesthetic
To make the platform feel genuinely tailored to churches rather than feeling like a generic SaaS template, the design needs to balance modern software efficiency with sacred visual cues.

┌─────────────────────────────────────────────────────────┐
│                    DESIGN PILLARS                       │
├──────────────────────────┬──────────────────────────────┤
│ Warm Sanctuary Palette   │ Soft, ambient, organic earth │
│                          │ tones over tech-monochrome   │
├──────────────────────────┼──────────────────────────────┤
│ Sacred Modern Typography │ Editorial serifs paired with │
│                          │ clean, highly legible sans   │
├──────────────────────────┼──────────────────────────────┤
│ Graceful Motion          │ Gentle, high-damping springs │
│                          │ (framer-motion physics)      │
├──────────────────────────┼──────────────────────────────┤
│ Community-First Dynamic  │ Media-rich event cards,      │
│                          │ sermon players & devotionals │
└──────────────────────────┴──────────────────────────────┘

Global Design Tokens & Theme Specification
Below are the visual tokens to feed into your Tailwind configuration and CSS custom properties:

JSON
{
  "themeName": "Modern Sanctuary",
  "colors": {
    "background": {
      "light": "#FAF8F5", // Warm linen white (never pure #FFFFFF)
      "dark": "#1A1817"    // Deep obsidian oak (never pure #000000)
    },
    "surface": {
      "light": "#FFFFFF",
      "muted": "#F3EFEA",
      "dark": "#24211F"
    },
    "primary": {
      "stainedGlassGold": "#D4A359",
      "sanctuaryNavy": "#1E293B",
      "deepBurgundy": "#6B21A8",
      "warmTerracotta": "#C2593F"
    },
    "text": {
      "primary": "#2D2926",
      "secondary": "#6B655F",
      "muted": "#9A938A"
    }
  },
  "typography": {
    "headings": "Playfair Display, Cormorant Garamond, or Newsreader",
    "body": "Plus Jakarta Sans, Inter, or Satoshi",
    "accents": "Cinzel or EB Garamond (Italic)"
  },
  "radius": {
    "card": "16px",
    "button": "12px",
    "badge": "9999px"
  },
  "shadows": {
    "ambient": "0 10px 30px -10px rgba(45, 41, 38, 0.05)",
    "floating": "0 20px 40px -15px rgba(45, 41, 38, 0.12)"
  }
}

You are a Principal Product Designer (L6) at Framer/Webflow specializing in domain-tailored SaaS builders. Your task is to design a high-converting, deeply atmospheric UI design system and component set for a Church Website Builder & SaaS Platform ("Church Builder").

### DESIGN DIRECTION & AESTHETIC
- Aesthetic: "Modern Sanctuary" — Warm, welcoming, sacred, editorial, yet modern and sleek.
- Avoid: Cold blue corporate tech vibes, harsh high-contrast black/white, rounded cartoonish "playful" UI.
- Color Palette: Warm linen backgrounds (#FAF8F5), deep oak/obsidian dark modes (#1A1817), stained-glass warm gold accents (#D4A359), and rich sanctuary slate (#1E293B).
- Typography Hierarchy: Serif display titles (Cormorant Garamond or Playfair Display style via Tailwind font-serif) paired with clean, warm sans-serif body text (Plus Jakarta Sans).

### KEY TECHNICAL SPECS
- Framework: Next.js (App Router), Tailwind CSS v3/v4, Framer Motion, Lucide Icons, Shadcn UI base.
- Motion Guidelines: Subtle ambient transitions. Duration: 0.4s-0.6s, Ease: [0.16, 1, 0.3, 1] (custom ease-out spring).
- Layout Architecture: Floating dock builder canvas, clean contextual inspector panels, live canvas preview with responsive viewport switching (Desktop/Tablet/Mobile).

Design a seamless, high-trust "Digital Tithing & Benevolence" card widget for a church SaaS. 
- Style: Warm, soft rounded corners (rounded-2xl), subtle gold-to-amber border stroke, backdrop blur.
- Features: Frequency toggle (One-time, Weekly, Monthly), Quick Amount pills ($25, $50, $100, Custom), Fund allocation dropdown (General Fund, Missions, Youth Ministry, Campus Expansion), and a subtle "100% Secure & Tax-Deductible" badge with a lock icon.
- Micro-interactions: Framer Motion scale spring effect when selecting amounts.

