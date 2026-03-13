# LLM Response Evaluator Dashboard

A clean, demo-ready web app that sends a prompt to **Claude** (Anthropic) and **GPT-4o** (OpenAI) simultaneously and compares their responses side-by-side — including response time, token usage, estimated cost, and star ratings.

## Screenshot

```
┌─────────────────────────────────────────────────────┐
│  LLM Response Evaluator   Claude vs GPT-4o          │
├─────────────────────────────────────────────────────┤
│  Your Prompt                                        │
│  ┌─────────────────────────────────────────────┐   │
│  │ Explain the difference between REST and ... │   │
│  └─────────────────────────────────────────────┘   │
│                      [Export Report]  [Test]        │
├──────────────────────┬──────────────────────────────┤
│  Claude (Anthropic)  │  GPT-4o (OpenAI)             │
│  2.1s | 312 tok | $0 │  3.4s | 289 tok | $0.003     │
│  ─────────────────── │  ────────────────────────    │
│  REST uses HTTP ...  │  REST is an architectural... │
│  ★★★★☆               │  ★★★☆☆                       │
└──────────────────────┴──────────────────────────────┘
```

## Features

- **Parallel API calls** — both models respond at the same time (no waiting)
- **Live metrics** — response time (seconds), token count, estimated cost per call
- **Star ratings** — rate each response 1–5 stars for easy comparison
- **Export report** — download a JSON file with everything (prompt, responses, metrics, ratings)
- **Dark UI** — clean, interview-ready design built with Tailwind CSS

## Quick Start

### 1. Clone & install dependencies

```bash
git clone <repo-url>
cd PrecislyProject

python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Set up API keys

```bash
cp .env.example .env
```

Edit `.env` and add your keys:

```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

Get your keys here:
- **Anthropic**: https://console.anthropic.com/account/keys
- **OpenAI**: https://platform.openai.com/api-keys

### 3. Run the app

```bash
python app.py
```

Open your browser at **http://localhost:5000**

## Project Structure

```
PrecislyProject/
├── app.py                 # Flask backend — API routes & LLM calls
├── templates/
│   └── index.html         # Frontend — Tailwind CSS + vanilla JS
├── requirements.txt       # Python dependencies
├── .env.example           # API key template
└── README.md
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/` | Serves the dashboard UI |
| `POST` | `/api/evaluate` | Sends prompt to both LLMs, returns results |
| `GET`  | `/api/healthz` | Health check |

### `/api/evaluate` request body

```json
{ "prompt": "Your question here" }
```

### `/api/evaluate` response

```json
{
  "prompt": "Your question here",
  "timestamp": "2025-01-15T10:30:00Z",
  "results": {
    "claude": {
      "model": "claude-opus-4-6",
      "provider": "Anthropic",
      "text": "...",
      "response_time": 2.14,
      "input_tokens": 12,
      "output_tokens": 300,
      "total_tokens": 312,
      "estimated_cost": 0.004512,
      "error": null
    },
    "gpt4": { "..." }
  }
}
```

## Exported Report Format

Clicking **Export Report** downloads a JSON file like:

```json
{
  "exported_at": "2025-01-15T10:31:00Z",
  "prompt": "Explain REST vs GraphQL",
  "tested_at": "2025-01-15T10:30:00Z",
  "results": {
    "claude": { "...all metrics...", "user_rating": 4 },
    "gpt4":   { "...all metrics...", "user_rating": 3 }
  }
}
```

## Pricing Reference

Costs are **estimates** based on public pricing (per 1M tokens):

| Model | Input | Output |
|-------|-------|--------|
| claude-opus-4-6 | $3.00 | $15.00 |
| gpt-4o          | $10.00 | $30.00 |

## Tips for Your Demo

1. Use an interesting, open-ended prompt to get substantive responses
2. Rate both responses before exporting — the JSON report includes your ratings
3. Point out the **parallel execution** — both APIs are called concurrently, so total wait time is ~max(claude_time, gpt4_time), not their sum
4. The keyboard shortcut **Ctrl+Enter** (or **Cmd+Enter**) triggers the test
