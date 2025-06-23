import os
from openai import OpenAI
from flask import Flask, render_template, request, jsonify, session, redirect
from dotenv import load_dotenv
import stripe
import json
from PIL import Image
import pytesseract
from datetime import datetime, timezone

pytesseract.pytesseract.tesseract_cmd = r"C:\\Program Files\\Tesseract-OCR\\tesseract.exe"

# ✅ Load environment variables
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

app = Flask(__name__, static_url_path='/static', static_folder='static')
app.secret_key = os.getenv("FLASK_SECRET_KEY", "fallback-secret")  # ✅ Required for session support

# ✅ Load prompt templates
with open("prompt_templates.json", "r") as f:
    prompt_templates = json.load(f)

# ✅ Limit check
MAX_USES = 5
def has_exceeded_usage():
    return session.get("usage_count", 0) >= MAX_USES and not session.get("is_pro", False)


def generate_daily_post_for_date(date_str):
    prompt = (
        f"Write a short, engaging real estate-related social media post for agents to share on {date_str}. "
        f"Make it inspirational, educational, or market-insightful—but not about a specific listing. "
        f"Limit it to under 280 characters and make it suitable for Instagram, Facebook, or Twitter."
    )
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content.strip()

@app.route("/daily-post", methods=["POST"])
def daily_post():
   
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if not session.get("is_pro", False):
        last_used_date = session.get("daily_post_date")
        if last_used_date == today_str:
            return jsonify({
            "error": "⛔ You've already used today's Daily Post. Upgrade to Pro for unlimited access.",
            "blocked": True,
            "usage": {"count": session.get("usage_count", 0), "limit": MAX_USES}
        }), 403  # Forcefully block regenerate attempts
    session["daily_post_date"] = today_str


    result = generate_daily_post_for_date(today_str)
    return jsonify({
        "result": result,
        "usage": {"count": session.get("usage_count", 0), "limit": MAX_USES}
    })

@app.route("/reset-usage")
def reset_usage():
    session["usage_count"] = 0
    session["daily_post_date"] = None
    return "Usage and daily post date reset."


@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/user-status")
def user_status():
    if "is_pro" in session:
        is_pro = session.get("is_pro", False)
    else:
        pro_param = request.args.get("pro", "true").lower()
        is_pro = pro_param == "true"
        session["is_pro"] = is_pro

    usage = {"count": session.get("usage_count", 0), "limit": MAX_USES} if not is_pro else {"count": 0, "limit": 9999}
    return jsonify({"isPro": is_pro, "usage": usage})

@app.route("/regenerate", methods=["POST"])
def regenerate():
    data = request.get_json()
    tweak = data.get("tweak", "")
    last_output = data.get("last_output", "")

    if not last_output:
        return jsonify({"error": "No previous output provided."}), 400

    if has_exceeded_usage():
        return jsonify({"error": "Usage limit reached. Please upgrade to Pro."}), 403

    prompt = "Improve or reword the following real estate content"
    if tweak:
        prompt += f" with this instruction: {tweak}"
    prompt += f"\n\nOriginal Content:\n{last_output}"

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}]
        )
        result = response.choices[0].message.content

        if not session.get("is_pro", False):
            session["usage_count"] = session.get("usage_count", 0) + 1
            usage_data = {"count": session["usage_count"], "limit": MAX_USES}
        else:
            usage_data = None

        return jsonify({"output": result, "usage": usage_data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/generate", methods=["POST"])
def generate():
    if has_exceeded_usage():
        return jsonify({"error": "Usage limit reached. Please upgrade to Pro."}), 403

    data = request.json
    template_id = data.get("template_id")
    tone = data.get("tone", "")
    user_input = data.get("input", "")

    with open("prompt_templates.json") as f:
        templates = json.load(f)

    template = next((t for t in templates if t["id"] == template_id), None)
    if not template:
        return jsonify({"error": "⚠️ Invalid prompt selected."})

    final_prompt = f"{template['template']}\n\nTone: {tone}\n\nExtra input: {user_input}"

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful AI for real estate agents."},
                {"role": "user", "content": final_prompt}
            ]
        )
        result = response.choices[0].message.content.strip()

        if not session.get("is_pro", False):
            session["usage_count"] = session.get("usage_count", 0) + 1
            usage_data = {"count": session["usage_count"], "limit": MAX_USES}
        else:
            usage_data = None

        return jsonify({"result": result, "usage": usage_data})
    except Exception as e:
        return jsonify({"error": str(e)})



@app.route("/draft-client-reply", methods=["POST"])
def draft_client_reply():
    if has_exceeded_usage():
        return jsonify({"error": "Usage limit reached. Upgrade to Pro to continue."}), 403

    data = request.get_json()
    message = data.get("message", "").strip()
    tone = data.get("tone", "Professional").strip()

    if not message:
        return jsonify({"error": "No message provided."}), 400

    prompt = (
        f"You are a helpful, experienced real estate agent. "
        f"Reply to the following client message in a {tone.lower()} tone. "
        f"Keep your response professional, reassuring, and appropriate to the situation.\n\n"
        f'Client Message: "{message}"\n\n'
        f"Your reply:"
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.7
        )
        reply = response.choices[0].message.content.strip()

        if not session.get("is_pro", False):
            session["usage_count"] = session.get("usage_count", 0) + 1
            usage_data = {
                "count": session["usage_count"],
                "limit": MAX_USES
            }
        else:
            usage_data = None

        return jsonify({"result": reply, "usage": usage_data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/smart-tweak-helper", methods=["POST"])
def smart_tweak_helper():
    data = request.get_json()
    current_output = data.get("output", "")

    if not current_output:
        return jsonify({"suggestions": []})

    prompt = (
        "Given the following AI-generated real estate content, suggest up to 5 useful refinements or tweaks a user might want to make.\n"
        "Focus on actionable ideas like tone changes, engagement boosters, or common real estate enhancements.\n\n"
        f"Content:\n{current_output}\n\n"
        "Return the tweaks as a numbered list."
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}]
        )
        result = response.choices[0].message.content

        suggestions = []
        for line in result.strip().split("\n"):
            if ". " in line:
                suggestions.append(line.split(". ", 1)[1].strip())
        return jsonify({"suggestions": suggestions[:5]})
    except Exception as e:
        return jsonify({"suggestions": [], "error": str(e)}), 500

@app.route("/api/prompts")
def api_prompts():
    with open("prompt_templates.json") as f:
        return jsonify(json.load(f))

@app.route("/library")
def library():
    return render_template("library.html")

@app.route("/subscribe", methods=["POST"])
def subscribe():
    try:
        session["is_pro"] = True
        session["usage_count"] = 0
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            mode='subscription',
            line_items=[{
                'price': os.getenv("STRIPE_PRICE_ID"),
                'quantity': 1
            }],
            success_url="https://promptagent.onrender.com?success=true",
            cancel_url="https://promptagent.onrender.com?canceled=true"
        )
        return jsonify({"url": checkout_session.url})
    except Exception as e:
        return jsonify({"error": str(e)}), 500



@app.route("/dev-pro")
def dev_pro():
    session.permanent = True
    session["is_pro"] = True
    session["usage_count"] = 0
    return redirect("/")

@app.route("/dev-nonpro")
def dev_nonpro():
    session.clear()
    session["is_pro"] = False
    return redirect("/")

@app.route("/check-session")
def check_session():
    return jsonify(dict(session))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
