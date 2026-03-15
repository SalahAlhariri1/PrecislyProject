from flask import Flask, render_template, request, jsonify
import json
import os
import uuid
from datetime import datetime

app = Flask(__name__)

# In-memory storage for evaluations (could be swapped for a DB)
evaluations = []


# ---------- Routes ----------

@app.route("/")
def index():
    return render_template("index.html")


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
        "responses": data["responses"],   # list of {model, text, rating, notes}
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
        import csv
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["id", "created_at", "prompt", "model", "response_text", "rating", "notes", "winner", "tags"])
        for ev in evaluations:
            for resp in ev.get("responses", []):
                writer.writerow([
                    ev["id"],
                    ev["created_at"],
                    ev["prompt"],
                    resp.get("model", ""),
                    resp.get("text", ""),
                    resp.get("rating", ""),
                    resp.get("notes", ""),
                    ev.get("winner", ""),
                    ",".join(ev.get("tags", [])),
                ])
        from flask import Response
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment; filename=evaluations.csv"},
        )
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

    avg_ratings = {
        m: round(ratings_sum[m] / ratings_count[m], 2)
        for m in ratings_count
    }
    return jsonify({
        "total_evaluations": total,
        "model_wins": model_wins,
        "average_ratings": avg_ratings,
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)
