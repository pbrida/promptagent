import stripe
from flask import Flask, render_template, request, jsonify, session
from openai import OpenAI
from dotenv import load_dotenv
import os
import json

# ✅ Load environment variables
load_dotenv()
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

client = OpenAI()
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "fallback-secret")  # ✅ Required for session support

# ✅ Load prompt templates
with open("prompt_templates.json", "r") as f:
    prompt_templates = json.load(f)

# ✅ Limit check
def has_exceeded_prompt_limit():
    return session.get("prompt_count", 0) >= 5 and not session.get("is_pro", False)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/generate", methods=["POST"])
def generate():
    if has_exceeded_prompt_limit():
        return jsonify({"error": "Prompt limit exceeded for free users. Please upgrade to Pro."}), 403

    data = request.get_json()
    category_id = data.get("category")
    user_input = data.get("input")
    tone = data.get("tone")
    template_obj = next((tpl for tpl in prompt_templates if tpl["id"] == category_id), None)
    if not template_obj:
        return jsonify({"error": "Invalid category selected."}), 400

    prompt = f"{template_obj['template']}\n\nUser Input: {user_input}"
    if tone:
        prompt += f"\n\nPlease write this in a {tone.lower()} tone."

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}]
        )
        result = response.choices[0].message.content
        session["prompt_count"] = session.get("prompt_count", 0) + 1

        # ✅ Ensure usage info only for non-Pro
        usage_data = None
        if not session.get("is_pro", False):
            usage_data = {"count": session["prompt_count"], "limit": 5}

        return jsonify({"result": result, "usage": usage_data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/prompts")
def get_prompts():
    return jsonify(prompt_templates)

@app.route("/library")
def library():
    return render_template("library.html")

# ✅ Stripe subscribe (return JSON URL for frontend to redirect)
@app.route("/subscribe", methods=["POST"])
def subscribe():
    try:
        session["is_pro"] = True
        session["prompt_count"] = 0  # Optional reset
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            mode='subscription',
            line_items=[{
                'price': os.getenv("STRIPE_PRICE_ID"),
                'quantity': 1,
            }],
            success_url="https://promptagent.onrender.com?success=true",
            cancel_url="https://promptagent.onrender.com?canceled=true",
        )
        return jsonify({"url": checkout_session.url})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ✅ ONE reset route (GET only)
@app.route("/reset-usage", methods=["GET"])
def reset_usage():
    session["prompt_count"] = 0
    session["is_pro"] = False
    return "✅ Usage counter reset."

# ✅ Dev-only route to simulate Pro mode
@app.route("/dev-set-pro")
def dev_set_pro():
    session["is_pro"] = True
    session["prompt_count"] = 0
    return "✅ Pro mode enabled"

# ✅ Dev-only route to simulate Free mode
@app.route("/dev-set-free")
def dev_set_free():
    session["is_pro"] = False
    session["prompt_count"] = 0  # Start fresh
    return "🆓 Free mode enabled"

@app.route("/api/user-status")
def user_status():
    return jsonify({"isPro": session.get("is_pro", False)})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
