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

# ✅ Daily post check
def has_used_daily_post():
    return session.get("used_daily_post", False) and not session.get("is_pro", False)

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

@app.route("/daily-post", methods=["POST"])
def daily_post():
    if not session.get("is_pro", False):
        if session.get("daily_used", False):
            return jsonify({"error": "Free users can only generate 1 Daily Post per day. Upgrade to Pro for unlimited access."}), 403
        session["daily_used"] = True  # Track that free user has used their one daily post

    prompt = "Write a short, engaging social media post for a real estate agent to post today. Make it time-relevant, helpful, and friendly."

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}]
        )
        result = response.choices[0].message.content
        return jsonify({"result": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/generate-daily", methods=["POST"])
def generate_daily():
    if has_used_daily_post():
        return jsonify({"error": "Daily post already used. Upgrade to regenerate or get unlimited."}), 403

    data = request.get_json()
    input_text = data.get("input")
    tone = data.get("tone", "")
    prompt = f"Write a daily social media post for a real estate agent.\n\nInput: {input_text}"
    if tone:
        prompt += f"\n\nTone: {tone}"

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}]
        )
        result = response.choices[0].message.content

        # ✅ Mark usage if not Pro
        if not session.get("is_pro", False):
            session["used_daily_post"] = True

        return jsonify({"result": result, "type": "daily", "canRegenerate": session.get("is_pro", False)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/prompts")
def get_prompts():
    return jsonify(prompt_templates)

@app.route("/library")
def library():
    return render_template("library.html")

@app.route("/subscribe", methods=["POST"])
def subscribe():
    try:
        session["is_pro"] = True
        session["prompt_count"] = 0
        session["used_daily_post"] = False
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

@app.route('/reset-usage')
def reset_usage():
    session['prompt_count'] = 0
    session['used_daily_post'] = False
    return "Usage and daily post have been reset."

@app.route("/dev/set-pro")
def dev_set_pro():
    session.permanent = True
    session["is_pro"] = True
    session["prompt_count"] = 0
    session["used_daily_post"] = False
    return jsonify({"status": "✅ Pro access granted", "session": dict(session)})

@app.route("/dev-set-free")
def dev_set_free():
    session["is_pro"] = False
    session["prompt_count"] = 0
    session["used_daily_post"] = False
    return "🆓 Free mode enabled"

@app.route("/api/user-status")
def user_status():
    is_pro = session.get("is_pro", False)
    response = {"isPro": is_pro}
    if not is_pro:
        response["usage"] = {
            "count": session.get("prompt_count", 0),
            "limit": 5
        }
        response["daily"] = {
            "used": session.get("used_daily_post", False)
        }
    return jsonify(response)

@app.route("/check-session")
def check_session():
    return jsonify(dict(session))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
