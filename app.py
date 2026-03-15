from flask import Flask, render_template, request, jsonify, Response
import json
import os
import uuid
import time
import csv
import io
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

app = Flask(__name__)

# In-memory storage
evaluations = []
api_keys = {
    "openai": os.environ.get("OPENAI_API_KEY", ""),
    "anthropic": os.environ.get("ANTHROPIC_API_KEY", ""),
}

# Model registry: model_id -> {name, provider, api_model}
MODELS = {
    "gpt-4o": {"name": "GPT-4o", "provider": "openai", "api_model": "gpt-4o"},
    "gpt-4o-mini": {"name": "GPT-4o Mini", "provider": "openai", "api_model": "gpt-4o-mini"},
    "gpt-3.5-turbo": {"name": "GPT-3.5 Turbo", "provider": "openai", "api_model": "gpt-3.5-turbo"},
    "claude-sonnet": {"name": "Claude Sonnet", "provider": "anthropic", "api_model": "claude-sonnet-4-20250514"},
    "claude-haiku": {"name": "Claude Haiku", "provider": "anthropic", "api_model": "claude-haiku-4-5-20251001"},
}

executor = ThreadPoolExecutor(max_workers=5)


# ---------- LLM API calls ----------

def call_openai(api_key, model, prompt):
    import urllib.request
    url = "https://api.openai.com/v1/chat/completions"
    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 1024,
    }).encode()
    req = urllib.request.Request(url, data=payload, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    })
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())
        elapsed = round(time.time() - start, 2)
        choice = data["choices"][0]
        text = choice["message"]["content"]
        usage = data.get("usage", {})
        return {
            "text": text,
            "response_time": elapsed,
            "tokens": usage.get("total_tokens", 0),
            "output_tokens": usage.get("completion_tokens", 0),
            "input_tokens": usage.get("prompt_tokens", 0),
            "error": None,
        }
    except Exception as e:
        elapsed = round(time.time() - start, 2)
        return {"text": None, "response_time": elapsed, "tokens": 0, "output_tokens": 0, "input_tokens": 0, "error": str(e)}


def call_anthropic(api_key, model, prompt):
    import urllib.request
    url = "https://api.anthropic.com/v1/messages"
    payload = json.dumps({
        "model": model,
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()
    req = urllib.request.Request(url, data=payload, headers={
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
    })
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())
        elapsed = round(time.time() - start, 2)
        text = data["content"][0]["text"]
        usage = data.get("usage", {})
        return {
            "text": text,
            "response_time": elapsed,
            "tokens": usage.get("input_tokens", 0) + usage.get("output_tokens", 0),
            "output_tokens": usage.get("output_tokens", 0),
            "input_tokens": usage.get("input_tokens", 0),
            "error": None,
        }
    except Exception as e:
        elapsed = round(time.time() - start, 2)
        return {"text": None, "response_time": elapsed, "tokens": 0, "output_tokens": 0, "input_tokens": 0, "error": str(e)}


def call_model(model_id, prompt):
    """Route to the correct provider."""
    info = MODELS.get(model_id)
    if not info:
        return {"text": None, "error": f"Unknown model: {model_id}", "response_time": 0, "tokens": 0, "output_tokens": 0, "input_tokens": 0}

    provider = info["provider"]
    key = api_keys.get(provider, "")
    if not key:
        return {"text": None, "error": f"No API key set for {provider}. Add it in Settings.", "response_time": 0, "tokens": 0, "output_tokens": 0, "input_tokens": 0}

    if provider == "openai":
        return call_openai(key, info["api_model"], prompt)
    elif provider == "anthropic":
        return call_anthropic(key, info["api_model"], prompt)
    return {"text": None, "error": "Unsupported provider", "response_time": 0, "tokens": 0, "output_tokens": 0, "input_tokens": 0}


# Rough cost estimates per 1K tokens
COST_PER_1K = {
    "gpt-4o": {"input": 0.0025, "output": 0.01},
    "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
    "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015},
    "claude-sonnet": {"input": 0.003, "output": 0.015},
    "claude-haiku": {"input": 0.0008, "output": 0.004},
}


def estimate_cost(model_id, input_tokens, output_tokens):
    rates = COST_PER_1K.get(model_id, {"input": 0, "output": 0})
    return round((input_tokens / 1000) * rates["input"] + (output_tokens / 1000) * rates["output"], 6)


# ---------- Routes ----------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/models", methods=["GET"])
def get_models():
    return jsonify({mid: {"name": m["name"], "provider": m["provider"]} for mid, m in MODELS.items()})


@app.route("/api/keys", methods=["GET"])
def get_keys():
    """Return which providers have keys set (not the keys themselves)."""
    return jsonify({provider: bool(key) for provider, key in api_keys.items()})


@app.route("/api/keys", methods=["POST"])
def set_keys():
    data = request.get_json()
    if "openai" in data:
        api_keys["openai"] = data["openai"]
    if "anthropic" in data:
        api_keys["anthropic"] = data["anthropic"]
    return jsonify({"status": "ok", "keys_set": {p: bool(k) for p, k in api_keys.items()}})


@app.route("/api/compare", methods=["POST"])
def compare():
    """Send a prompt to selected models in parallel, return results."""
    data = request.get_json()
    prompt = data.get("prompt", "").strip()
    model_ids = data.get("models", [])

    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400
    if not model_ids:
        return jsonify({"error": "Select at least one model"}), 400

    results = {}
    futures = {executor.submit(call_model, mid, prompt): mid for mid in model_ids}
    for future in as_completed(futures):
        mid = futures[future]
        result = future.result()
        result["model_id"] = mid
        result["model_name"] = MODELS[mid]["name"]
        result["provider"] = MODELS[mid]["provider"]
        result["est_cost"] = estimate_cost(mid, result.get("input_tokens", 0), result.get("output_tokens", 0))
        results[mid] = result

    # Determine badges
    successful = {k: v for k, v in results.items() if not v.get("error")}
    badges = {"fastest": None, "cheapest": None, "most_concise": None}
    if successful:
        badges["fastest"] = min(successful, key=lambda k: successful[k]["response_time"])
        badges["cheapest"] = min(successful, key=lambda k: successful[k]["est_cost"])
        badges["most_concise"] = min(successful, key=lambda k: successful[k]["output_tokens"])

    return jsonify({"results": results, "badges": badges})


@app.route("/api/evaluations", methods=["GET"])
def get_evaluations():
    return jsonify(evaluations)


@app.route("/api/evaluations", methods=["POST"])
def add_evaluation():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    required = ["prompt", "responses"]
    for field in required:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400
    evaluation = {
        "id": str(uuid.uuid4()),
        "created_at": datetime.utcnow().isoformat() + "Z",
        "prompt": data["prompt"],
        "responses": data["responses"],
        "tags": data.get("tags", []),
        "winner": data.get("winner", None),
    }
    evaluations.append(evaluation)
    return jsonify(evaluation), 201


@app.route("/api/evaluations/<eval_id>", methods=["PUT"])
def update_evaluation(eval_id):
    data = request.get_json()
    for ev in evaluations:
        if ev["id"] == eval_id:
            ev.update({k: v for k, v in data.items() if k != "id"})
            return jsonify(ev)
    return jsonify({"error": "Not found"}), 404


@app.route("/api/evaluations/<eval_id>", methods=["DELETE"])
def delete_evaluation(eval_id):
    global evaluations
    before = len(evaluations)
    evaluations = [ev for ev in evaluations if ev["id"] != eval_id]
    if len(evaluations) == before:
        return jsonify({"error": "Not found"}), 404
    return jsonify({"deleted": eval_id})


@app.route("/api/export", methods=["GET"])
def export_evaluations():
    fmt = request.args.get("format", "json")
    if fmt == "json":
        return jsonify(evaluations)
    elif fmt == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["id", "created_at", "prompt", "model", "response_text", "rating", "notes", "winner", "tags"])
        for ev in evaluations:
            for resp in ev.get("responses", []):
                writer.writerow([
                    ev["id"], ev["created_at"], ev["prompt"],
                    resp.get("model", ""), resp.get("text", ""),
                    resp.get("rating", ""), resp.get("notes", ""),
                    ev.get("winner", ""), ",".join(ev.get("tags", [])),
                ])
        return Response(output.getvalue(), mimetype="text/csv",
                        headers={"Content-Disposition": "attachment; filename=evaluations.csv"})
    return jsonify({"error": "Unsupported format"}), 400


@app.route("/api/stats", methods=["GET"])
def stats():
    total = len(evaluations)
    model_wins = {}
    ratings_sum = {}
    ratings_count = {}
    for ev in evaluations:
        if ev.get("winner"):
            model_wins[ev["winner"]] = model_wins.get(ev["winner"], 0) + 1
        for resp in ev.get("responses", []):
            model = resp.get("model", "Unknown")
            rating = resp.get("rating")
            if rating is not None:
                ratings_sum[model] = ratings_sum.get(model, 0) + rating
                ratings_count[model] = ratings_count.get(model, 0) + 1
    avg_ratings = {m: round(ratings_sum[m] / ratings_count[m], 2) for m in ratings_count}
    return jsonify({"total_evaluations": total, "model_wins": model_wins, "average_ratings": avg_ratings})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
