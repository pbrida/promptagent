import stripe
from flask import Flask, render_template, request, jsonify, session
from openai import OpenAI
from dotenv import load_dotenv
import os
import json
from PIL import Image
import pytesseract

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
# ✅ Load environment variables
load_dotenv()
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

client = OpenAI()
app = Flask(__name__, static_url_path='/static', static_folder='static')

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
@app.route("/regenerate", methods=["POST"])
def regenerate():
    data = request.get_json()
    tweak = data.get("tweak", "")
    last_output = data.get("last_output", "")

    if not last_output:
        return jsonify({"error": "No previous output provided."}), 400

    # ✅ Optional: check if user has exceeded limit
    if has_exceeded_prompt_limit():
        return jsonify({"error": "Prompt limit exceeded for free users. Please upgrade to Pro."}), 403

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

        # ✅ Count regenerate as usage
        if not session.get("is_pro", False):
            session["prompt_count"] = session.get("prompt_count", 0) + 1
            usage_data = {"count": session["prompt_count"], "limit": 5}
        else:
            usage_data = None

        return jsonify({"output": result, "usage": usage_data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/generate", methods=["POST"])
def generate():
    if has_exceeded_prompt_limit():
        return jsonify({"error": "Prompt limit exceeded for free users. Please upgrade to Pro."}), 403

    data = request.get_json()
    category_id = data.get("template_id")
    user_input = data.get("input", "")
    tone = data.get("tone", "")

    template_obj = next((tpl for tpl in prompt_templates if tpl["id"] == category_id), None)
    if not template_obj:
        return jsonify({"error": "Invalid category selected."}), 400

    prompt = template_obj['template']
    if user_input:
        prompt += f"\n\nUser Input: {user_input}"
    if tone:
        prompt += f"\n\nPlease write this in a {tone.lower()} tone."

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}]
        )
        result = response.choices[0].message.content

        session["prompt_count"] = session.get("prompt_count", 0) + 1

        usage_data = None
        if not session.get("is_pro", False):
            usage_data = {"count": session["prompt_count"], "limit": 5}

        return jsonify({"result": result, "usage": usage_data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/daily-post", methods=["POST"])
def daily_post():
    if not session.get("is_pro", False):
        if session.get("used_daily_post", False):
            return jsonify({"error": "Free users can only generate 1 Daily Post per day. Upgrade to Pro for unlimited access."}), 403

        # ✅ Track daily used + increment prompt count
        session["used_daily_post"] = True
        session["prompt_count"] = session.get("prompt_count", 0) + 1

        usage_data = {
            "count": session["prompt_count"],
            "limit": 5
        }
    else:
        usage_data = None

    prompt = "Write a short, engaging social media post for a real estate agent to post today. Make it time-relevant, helpful, and friendly."

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}]
        )
        result = response.choices[0].message.content
        return jsonify({"result": result, "usage": usage_data})  # ✅ Include usage
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

@app.route("/extract-text-from-image", methods=["POST"])
def extract_text_from_image():
    image = request.files.get("image")
    if not image:
        return jsonify({"error": "No image uploaded."}), 400

    try:
        img = Image.open(image.stream)
        text = pytesseract.image_to_string(img)
        return jsonify({"text": text.strip()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/draft-client-reply", methods=["POST"])
def draft_client_reply():
    if not session.get("is_pro", False) and session.get("used_client_reply", False):
        return jsonify({"error": "Client reply feature is limited to one-time use for free users. Please upgrade to Pro."}), 403

    session["used_client_reply"] = True
    data = request.get_json()
    message = data.get("message", "")
    if not message:
        return jsonify({"error": "No message provided."}), 400

    prompt = (
        "A real estate agent received the following message from a client. Draft a professional, helpful reply that addresses the question clearly.\n\n"
        f"Client Message:\n{message}"
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}]
        )
        return jsonify({"result": response.choices[0].message.content})
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
        session["used_client_reply"] = False
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
    session['used_client_reply'] = False
    return "Usage, daily post, and client reply have been reset."

@app.route("/dev/set-pro")
def dev_set_pro():
    session.permanent = True
    session["is_pro"] = True
    session["prompt_count"] = 0
    session["used_daily_post"] = False
    session["used_client_reply"] = False
    return jsonify({"status": "✅ Pro access granted", "session": dict(session)})

@app.route("/dev-set-free")
def dev_set_free():
    session["is_pro"] = False
    session["prompt_count"] = 0
    session["used_daily_post"] = False
    session["used_client_reply"] = False
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
        response["client"] = {
            "used": session.get("used_client_reply", False)
        }
    return jsonify(response)

@app.route("/check-session")
def check_session():
    return jsonify(dict(session))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
