import os
import requests
from flask import Flask, render_template, jsonify, request, Response
from openpyxl import load_workbook

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
QUESTIONS_FILE = os.path.join(BASE_DIR, "data", "quiz_questions.xlsx")

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, "templates"),
    static_folder=os.path.join(BASE_DIR, "static"),
    static_url_path="/static"
)


@app.route("/")
def home():
    return """
    <h1>Dziesiątka</h1>
    <p>Teleturniej wiedzy</p>
    <p><a href="/admin">Panel prowadzącego</a></p>
    <p><a href="/audience">Ekran publiczności</a></p>
    """


@app.route("/admin")
def admin():
    return render_template("admin.html")


@app.route("/audience")
def audience():
    return render_template("audience.html")


@app.route("/api/questions")
def api_questions():
    if not os.path.exists(QUESTIONS_FILE):
        return jsonify({
            "ok": False,
            "error": f"Nie znaleziono pliku: {QUESTIONS_FILE}",
            "questions": []
        }), 404

    wb = load_workbook(QUESTIONS_FILE, data_only=True)
    ws = wb.active

    headers = []
    for cell in ws[1]:
        headers.append(str(cell.value).strip() if cell.value is not None else "")

    questions = []

    for row in ws.iter_rows(min_row=2, values_only=True):
        item = {}

        for index, header in enumerate(headers):
            value = row[index] if index < len(row) else None
            item[header] = value

        if not item.get("question"):
            continue

        questions.append({
            "round": str(item.get("round", "")).strip(),
            "id": str(item.get("id", "")).strip(),
            "question": str(item.get("question", "")).strip(),
            "answer": str(item.get("answer", "")).strip(),
            "type": str(item.get("type", "")).strip(),
            "lodz": str(item.get("Łódź", "") or "").strip().lower(),
            "tychy": str(item.get("Tychy", "") or "").strip().lower(),
            "mosina": str(item.get("Mosina", "") or "").strip().lower(),
            "ostroleka": str(item.get("Ostrołęka", "") or "").strip().lower(),
        })

    return jsonify({
        "ok": True,
        "count": len(questions),
        "questions": questions
    })
@app.route("/api/elevenlabs-tts", methods=["POST"])
def elevenlabs_tts():
    api_key = os.getenv("ELEVENLABS_API_KEY")

    if not api_key:
        return jsonify({
            "ok": False,
            "error": "Brak zmiennej środowiskowej ELEVENLABS_API_KEY"
        }), 500

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()

    if not text:
        return jsonify({
            "ok": False,
            "error": "Brak tekstu do przeczytania"
        }), 400

    voice_id = "JBFqnCBsd6RMkjVDRZzb"

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128"

    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2"
    }

    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json"
    }

    eleven_response = requests.post(url, json=payload, headers=headers, timeout=30)

    if eleven_response.status_code != 200:
        return jsonify({
            "ok": False,
            "error": eleven_response.text
        }), eleven_response.status_code

    return Response(eleven_response.content, mimetype="audio/mpeg")

if __name__ == "__main__":
    app.run(debug=True)