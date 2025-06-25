import os
import json
import stripe
import logging
from flask import Flask, render_template, request, jsonify, session, redirect
from openai import OpenAI
from datetime import datetime, timezone
from dotenv import load_dotenv
import pytesseract

# Configurations
load_dotenv()
logging.basicConfig(level=logging.INFO)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
pytesseract.pytesseract.tesseract_cmd = r"C:\\Program Files\\Tesseract-OCR\\tesseract.exe"

app = Flask(__name__, static_url_path='/static', static_folder='static')
app.secret_key = os.getenv("FLASK_SECRET_KEY", "fallback-secret")

# Constants
MAX_USES = 5
with open("prompt_templates.json", "r") as f:
    prompt_templates = json.load(f)

# Helpers
def has_exceeded_usage():
    return session.get("usage_count", 0) >= MAX_USES and not session.get("is_pro", False)

def increment_usage():
    if not session.get("is_pro", False):
        session["usage_count"] = session.get("usage_count", 0) + 1
        logging.info(f"Usage incremented: {session['usage_count']}")

def current_usage():
    if session.get("is_pro", False):
        return {"count": 0, "limit": 9999}
    return {"count": session.get("usage_count", 0), "limit": MAX_USES}

@app.context_processor
def inject_request():
    from flask import request
    return dict(request=request)

# Page Routes
@app.route("/")
@app.route("/home")
def landing():
    return render_template("home.html")

@app.route("/dashboard")
def dashboard():
    return render_template("index.html")

@app.route("/client-response")
def client_response():
    return render_template("client_response.html")

@app.route("/script-generator")
def script_generator():
    return render_template("script_generator.html")

@app.route("/daily-post", methods=["GET"])
def daily_post_page():
    return render_template("daily-post.html")

@app.route("/library")
def library():
    return render_template("library.html")

@app.route("/legal")
def legal():
    return render_template("legal.html")

@app.route("/subscribe", methods=["GET"])
def subscribe_page():
    return render_template("subscribe.html")

# Logic Routes
@app.route("/generate", methods=["POST"])
def generate():
    if has_exceeded_usage():
        return jsonify({"error": "Usage limit reached. Please upgrade to Pro."}), 403

    data = request.get_json()
    template_id = data.get("template") or data.get("template_id")
    tone = data.get("tone", "")
    user_input = data.get("input", "")

    template = next((t for t in prompt_templates if t["id"] == template_id), None)
    if not template:
        return jsonify({"error": "⚠️ Invalid prompt selected."})

    system_prompt = (
        "You are a professional real estate marketing assistant working inside a web app called PromptAgent. "
        "Your job is to help real estate agents craft short, clear, persuasive scripts to engage leads, convert clients, and stand out. "
        "Avoid generic phrases or sounding robotic. Never say you're an AI. "
        "Be confident, helpful, and sound like a seasoned real estate professional."
    )

    final_prompt = f"{template['template']}\n\nTone: {tone}\n\nAgent Notes: {user_input}"
    model = "gpt-4" if session.get("is_pro", False) else "gpt-3.5-turbo"

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": final_prompt}
            ]
        )
        result = response.choices[0].message.content.strip()
        increment_usage()
        return jsonify({"result": result, "usage": current_usage()})
    except Exception as e:
        logging.error(f"Generate error: {e}")
        return jsonify({"error": str(e)})

@app.route("/daily-post", methods=["POST"])
def daily_post():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if not session.get("is_pro", False):
        if session.get("daily_post_date") == today:
            return jsonify({
                "error": "⛔️ You've already used today's Daily Post. Upgrade to Pro for unlimited access.",
                "blocked": True,
                "usage": current_usage()
            }), 403
        increment_usage()
        session["daily_post_date"] = today

    prompt = (
        f"Write a short, engaging real estate-related social media post for agents to share on {today}. "
        f"Make it inspirational, educational, or market-insightful—but not about a specific listing. "
        f"Limit to under 280 characters."
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}]
        )
        result = response.choices[0].message.content.strip()
        return jsonify({"result": result, "usage": current_usage()})
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route("/generate-random-caption", methods=["POST"])
def generate_random_caption():
    if has_exceeded_usage():
        return jsonify({"error": "Usage limit reached. Please upgrade to Pro."}), 403

    try:
        data = request.get_json(force=True) or {}
    except:
        data = {}

    platform = data.get("platform", "Instagram")

    prompt = (
        f"Write a short, engaging real estate caption for {platform}. "
        f"Make it catchy and under 280 characters. Avoid sounding robotic."
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}]
        )
        result = response.choices[0].message.content.strip()
        increment_usage()
        return jsonify({"result": result, "usage": current_usage()})
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route("/generate-weekly-plan", methods=["POST"])
def generate_weekly_plan():
    if has_exceeded_usage():
        return jsonify({"error": "Usage limit reached. Please upgrade to Pro."}), 403

    prompt = (
        "Create a weekly social media content plan for a real estate agent. "
        "Include 7 themed post ideas (Monday to Sunday). Use a mix of education, local tips, wins, listings, etc."
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}]
        )
        result = response.choices[0].message.content.strip()
        increment_usage()
        return jsonify({"result": result, "usage": current_usage()})
    except Exception as e:
        return jsonify({"error": str(e)})

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
        result = response.choices[0].message.content.strip()
        increment_usage()
        return jsonify({"output": result, "usage": current_usage()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
        f"Keep your response professional and reassuring.\n\n"
        f"Client Message: \"{message}\"\n\nYour reply:"
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}]
        )
        result = response.choices[0].message.content.strip()
        increment_usage()
        return jsonify({"result": result, "usage": current_usage()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/prompts")
def api_prompts():
    return jsonify(prompt_templates)

@app.route("/api/user-status")
def user_status():
    is_pro = session.get("is_pro", request.args.get("pro", "true").lower() == "true")
    session["is_pro"] = is_pro
    return jsonify({"isPro": is_pro, "usage": current_usage()})

@app.route("/subscribe", methods=["POST"])
def subscribe():
    try:
        session["is_pro"] = True
        session["usage_count"] = 0
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            mode='subscription',
            line_items=[{'price': os.getenv("STRIPE_PRICE_ID"), 'quantity': 1}],
            success_url="https://promptagent.onrender.com?success=true",
            cancel_url="https://promptagent.onrender.com?canceled=true"
        )
        return jsonify({"url": checkout_session.url})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Dev-only routes
@app.route("/dev-pro")
def dev_pro():
    session.update({"is_pro": True, "usage_count": 0})
    return redirect("/")

@app.route("/dev-nonpro")
def dev_nonpro():
    session.clear()
    session["is_pro"] = False
    return redirect("/")

@app.route("/check-session")
def check_session():
    return jsonify(dict(session))

@app.route("/reset-usage")
def reset_usage():
    session["usage_count"] = 0
    session["daily_post_date"] = None
    return "Usage and daily post date reset."

# Optional: allow cross-origin if ever needed
@app.after_request
def apply_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)
