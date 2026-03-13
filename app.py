import os
import time
import json
import asyncio
import concurrent.futures
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
import anthropic
import openai

load_dotenv()

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Pricing (per 1M tokens, as of early 2025 – tweak if rates change)
# ---------------------------------------------------------------------------
PRICING = {
    "claude": {"input": 3.00, "output": 15.00},   # claude-opus-4-6
    "gpt4":   {"input": 10.00, "output": 30.00},  # gpt-4o
}

CLAUDE_MODEL = "claude-opus-4-6"
GPT_MODEL    = "gpt-4o"


def call_claude(prompt: str) -> dict:
    """Call Anthropic Claude and return structured result."""
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    start = time.time()
    try:
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        elapsed = round(time.time() - start, 2)
        input_tokens  = response.usage.input_tokens
        output_tokens = response.usage.output_tokens
        cost = (
            input_tokens  / 1_000_000 * PRICING["claude"]["input"] +
            output_tokens / 1_000_000 * PRICING["claude"]["output"]
        )
        return {
            "model":        CLAUDE_MODEL,
            "provider":     "Anthropic",
            "text":         response.content[0].text,
            "response_time": elapsed,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
            "estimated_cost": round(cost, 6),
            "error":        None,
        }
    except Exception as exc:
        return {
            "model":        CLAUDE_MODEL,
            "provider":     "Anthropic",
            "text":         None,
            "response_time": round(time.time() - start, 2),
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "estimated_cost": 0,
            "error":        str(exc),
        }


def call_gpt4(prompt: str) -> dict:
    """Call OpenAI GPT-4o and return structured result."""
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    start = time.time()
    try:
        response = client.chat.completions.create(
            model=GPT_MODEL,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        elapsed = round(time.time() - start, 2)
        input_tokens  = response.usage.prompt_tokens
        output_tokens = response.usage.completion_tokens
        cost = (
            input_tokens  / 1_000_000 * PRICING["gpt4"]["input"] +
            output_tokens / 1_000_000 * PRICING["gpt4"]["output"]
        )
        return {
            "model":        GPT_MODEL,
            "provider":     "OpenAI",
            "text":         response.choices[0].message.content,
            "response_time": elapsed,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
            "estimated_cost": round(cost, 6),
            "error":        None,
        }
    except Exception as exc:
        return {
            "model":        GPT_MODEL,
            "provider":     "OpenAI",
            "text":         None,
            "response_time": round(time.time() - start, 2),
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "estimated_cost": 0,
            "error":        str(exc),
        }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/evaluate", methods=["POST"])
def evaluate():
    """Run prompt against both LLMs in parallel and return results."""
    data = request.get_json(force=True)
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        future_claude = executor.submit(call_claude, prompt)
        future_gpt4   = executor.submit(call_gpt4,   prompt)
        claude_result = future_claude.result()
        gpt4_result   = future_gpt4.result()

    return jsonify({
        "prompt":    prompt,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "results": {
            "claude": claude_result,
            "gpt4":   gpt4_result,
        },
    })


@app.route("/api/healthz")
def healthz():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
