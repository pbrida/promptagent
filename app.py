import stripe
from flask import Flask, render_template, request, jsonify
from openai import OpenAI
from dotenv import load_dotenv
import os
import json

# ✅ Load environment variables
load_dotenv()
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

client = OpenAI()
app = Flask(__name__)

# ✅ Load prompt templates
with open("prompt_templates.json", "r") as f:
    prompt_templates = json.load(f)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/generate", methods=["POST"])
def generate():
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
        return jsonify({"result": result})
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
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            mode='subscription',
            line_items=[{
                'price': os.getenv("STRIPE_PRICE_ID"),
                'quantity': 1,
            }],
            success_url="https://promptagent.onrender.com?success=true",
            cancel_url="https://promptagent.onrender.com?canceled=true",
        )
        return jsonify({"url": session.url})  # ✅ Return JSON, not redirect
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)


