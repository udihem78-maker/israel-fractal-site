# 🇮🇱 Israel Fractal — Multi-Language Site & Reports

## Public monitor

The root and `/he/` now open a source-labeled national public directory with
search, filters, profiles, ministry coverage, historical committee figures and
collection provenance. The previous homepage is at `/research.html` and the
Hebrew report is at `/he/research.html`; English and Arabic reports remain in place.

This is **not a verified current roster or a live performance rating**.
The connected secondary source reports Knesset 25 / government 37 assignments;
committee activity currently ends on 2025-08-11. Missing present-day metrics,
directors-general and agency heads are explicitly marked as not connected.

See [public monitor setup and data limitations](docs/public-monitor.md) for the
Python-only synchronizer, tests, source semantics and daily GitHub Actions setup.
The new refresh/deploy workflow is inactive until merged into the default branch
and allowed by the repository's Actions/Pages protection settings.

---

Static multi-language website presenting the holistic research of Israel (1948-2026)
using Data Fluidity methodology. **Separate repo** from the research source.

Design inspired by [Apple Bento Grid](https://github.com/hubeiqiao/apple-bento-grid).

---

## 📂 Structure

```
israel-fractal-site/
├── index.html              — Language picker (dark bento landing)
├── he/
│   └── index.html          — Hebrew bento grid (RTL)
├── en/
│   └── index.html          — English bento grid (LTR)
├── ar/
│   └── index.html          — Arabic bento grid (RTL, Cairo font)
├── reports/
│   ├── israel-fractal-he.pdf       — Hebrew PDF (297K)
│   ├── israel-fractal-en.pdf       — English PDF (321K)
│   ├── israel-fractal-ar.pdf       — Arabic PDF (578K)
│   ├── israel-fractal-he.docx      — Hebrew Word
│   ├── israel-fractal-en.docx      — English Word
│   ├── israel-fractal-ar.docx      — Arabic Word
│   ├── israel-fractal.pptx         — PowerPoint
│   ├── israel-fractal.odt          — OpenDocument
│   ├── israel-fractal.epub         — EPUB eBook
│   ├── israel-fractal.md           — Markdown source
│   └── full-research-he/           — Full Hebrew research
└── README.md
```

---

## 🎨 Design System

**Apple Bento Grid** — dark theme (`#000` background, `#1a1a1a` cards):
- 4-column horizontal layout (1200px, aspect 52:25)
- 6px gap (not 8px)
- `aspect-ratio` locked, cards stretch via default `align-items: stretch`
- Max 3-4 accent colors (blue `#0071e3`, cyan `#00b4d8`, green `#34d399`, red `#ff6b6b`)
- Fonts: Sora (Latin display), Heebo (Hebrew), Cairo (Arabic), DM Sans (body)

### Card Types

| Card | Grid Area | Purpose |
|------|-----------|---------|
| Hero | `hero` (2x2) | Gradient blue, project title |
| Stat × 4 | `docs`, `points`, `metrics`, `leaders` | Big colored numbers |
| Chart | `chart` (1x2) | Bar chart of F over years |
| PM × 3 | `pm1-pm3` | Category-style with pill tag |
| Highlight | `highlight` (2x1) | Red gradient, massive ×170 |
| Quote | `quote` (3x1) | Dark card with final message |

---

## 🚀 Local Preview

Open `index.html` in any browser, or:

```bash
python3 -m http.server 8000
# or
npx serve .
```

---

## 🌍 Deployment

### GitHub Pages
1. Push this repo to GitHub
2. Settings → Pages → Source: `main` branch, folder: `/`
3. URL: `https://<user>.github.io/israel-fractal-site/`

### Netlify / Vercel
1. Connect repo
2. No build command needed (static)
3. Publish directory: `/`

### Custom Domain
Point A record to GitHub Pages / Netlify IP.
Recommended: `israel-fractal.com`

---

## 📊 Reports — 6 Formats

| Format | File | Size | Use |
|--------|------|------|-----|
| PDF (HE) | `israel-fractal-he.pdf` | 297K | Print, email, archive |
| PDF (EN) | `israel-fractal-en.pdf` | 321K | International distribution |
| PDF (AR) | `israel-fractal-ar.pdf` | 578K | Arabic-speaking audience |
| DOCX | `israel-fractal-*.docx` | 24K | Edit in Word |
| PPTX | `israel-fractal.pptx` | 70K | Present as slides |
| ODT | `israel-fractal.odt` | 22K | LibreOffice |
| EPUB | `israel-fractal.epub` | 30K | eReaders |
| Markdown | `israel-fractal.md` | 23K | Developers |

---

## 🔗 Related

- **Research source** (markdown, 32 docs): https://github.com/udihem78-maker/animated-eureka
- **Design system reference**: https://github.com/hubeiqiao/apple-bento-grid

---

## 📝 License

Content: © 2026 enh@hemligroups.com — Attribution required
Design system: MIT (Apple Bento Grid by Joe Hu)

---

> **"Israel is Fractal — and Possible"** 🇮🇱
