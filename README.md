# brief.dev

**An AI Sales Engineering Agent.** Configure your product once, enter any prospect company, select your call type, and get a complete call prep package: account intelligence, custom demo script or discovery agenda, technical objection handling, and a ready-to-send follow-up email.

Built with Next.js, Claude API, Finnhub, and NewsAPI.

---

## Features

- **SE Profile** — save your product, strengths, weaknesses, and buyer persona once
- **3 Call Types** — Discovery Call, Product Demo, RFP Response
- **Account Intelligence** — live stock data, company snapshot, news with sentiment, pain signals, tech stack, red flags
- **Discovery Prep** — 5-point agenda with questions and why-it-matters for your product
- **Demo Script** — 5-act flow: Hook → Problem → Solution → Proof → CTA
- **RFP Answer Bank** — 8 pre-drafted answers covering security, scalability, pricing, ROI
- **Objection Handling** — 3-5 anticipated objections with product-specific counters
- **Follow-up Email** — ready-to-send email referencing the specific call
- **Opening Line** — one researched sentence to open the call showing you've done your homework

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Backend | Next.js API Routes |
| AI | Anthropic Claude (`claude-sonnet-4-6`) |
| Stock data | Finnhub API |
| News | NewsAPI |
| Fonts | Geist + Geist Mono (bundled) |

---

## Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd PrecislyProject
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your API keys:

```env
ANTHROPIC_API_KEY=sk-ant-...
FINNHUB_API_KEY=your_key_here
NEWS_API_KEY=your_key_here
```

**Where to get keys:**
- **Anthropic** → [console.anthropic.com](https://console.anthropic.com)
- **Finnhub** → [finnhub.io](https://finnhub.io) (free, 60 calls/min)
- **NewsAPI** → [newsapi.org/register](https://newsapi.org/register) (free dev tier)

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Usage

1. Fill in your product details in the left sidebar and click **[ SAVE PROFILE ]**
2. Enter a prospect company name and select your call type
3. Click **[ RUN AGENT ]**
4. Watch the brief assemble — company intel appears first, then call-specific prep

---

## Project Structure

```
/app
  layout.tsx                  # Root layout with Geist fonts
  page.tsx                    # Split layout — sidebar + main brief area
  globals.css                 # Animations (shimmer, pulse, fadeIn)
  /api/brief/route.ts         # Company intel: Finnhub + NewsAPI + Claude
  /api/agent/route.ts         # Call prep: discovery/demo/rfp via Claude

/components
  Sidebar.tsx                 # SE profile form + call config
  Navbar.tsx                  # Top bar with brand + badges
  CompanyHeader.tsx           # Company name, tags, fetched time
  StockCard.tsx               # Live price from Finnhub
  SnapshotCard.tsx            # Revenue, CEO, market cap
  NewsCard.tsx                # Headlines with sentiment badges
  PainSignalsCard.tsx         # 3 pain signals with orange dots
  OpeningLineCard.tsx         # "Say this first" money card
  TechStackCard.tsx           # Inferred tech as code tags
  RedFlagsCard.tsx            # Deal-killing risks
  TalkingPointsCard.tsx       # Evidence-backed talking points
  DiscoveryAgendaCard.tsx     # 5-point discovery agenda
  DemoScriptCard.tsx          # 5-act demo flow
  RFPAnswerBankCard.tsx       # 8 RFP Q&A pairs
  ObjectionsCard.tsx          # Objections with confidence badges
  EmailCard.tsx               # Copy-ready follow-up email
  SkeletonCard.tsx            # Loading shimmer placeholder

/lib
  alphaVantage.ts             # Finnhub stock + overview
  newsApi.ts                  # News search + sentiment
  claude.ts                   # Company resolution + deep brief
```
