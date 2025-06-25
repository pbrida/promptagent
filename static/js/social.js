document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Social Media Assistant ready");

  const $ = (id) => document.getElementById(id);
  let isProUser = false;

  const elIds = {
    output: "clientReplyOutput",
    captionOutput: "captionOutput",
    weeklyOutput: "weeklyPlanOutput",
    spinner: "clientLoadingSpinner",
    lockedMsg: "clientReplyLockedMsg",
    captionInput: "captionInput",
    platformSelect: "platformSelect",
    subscribeBtn: "subscribeBtn"
  };

  const safeText = (id) => $(id)?.textContent?.trim() || "";

  const clean = (text) =>
    text.replace(/As an AI[^.]*\./gi, "").replace(/I'm an AI[^.]*\./gi, "").trim();

  const showSpinner = (show) =>
    $(elIds.spinner)?.classList.toggle("hidden", !show);

  const updateUsageCounter = (count, limit) => {
    const usageEl = document.getElementById("usageCounter");
    if (usageEl) {
      usageEl.innerHTML = `Uses: <span>${count}</span> of ${limit}`;
    }
  };

  const incrementAndUpdateUsage = () => {
    fetch("/api/user-status")
      .then(res => res.json())
      .then(data => {
        updateUsageCounter(data.usage.count, data.usage.limit);
      });
  };

  const fetchUserStatus = () => {
    fetch("/api/user-status")
      .then((res) => res.json())
      .then((data) => {
        isProUser = data.isPro;
        updateUsageCounter(data.usage.count, data.usage.limit);
      })
      .catch((err) => console.error("❌ User status fetch failed", err));
  };

  const generateDailyPost = () => {
    showSpinner(true);
    fetch("/daily-post", { method: "POST" })
      .then((res) =>
        res.status === 403 ? res.json().then((data) => Promise.reject(data)) : res.json()
      )
      .then((data) => {
        $(elIds.output).textContent = data.result || "⚠️ Empty response.";
        $(elIds.lockedMsg)?.classList.add("hidden");
        updateUsageCounter(data.usage.count, data.usage.limit);
      })
      .catch((err) => {
        alert("⛔ " + (err.error || "Daily post already used."));
        $(elIds.lockedMsg)?.classList.remove("hidden");
      })
      .finally(() => showSpinner(false));
  };

  const saveText = (key, elId) => {
    const text = safeText(elId);
    if (!text) return alert("No content to save.");
    const saved = JSON.parse(localStorage.getItem(key) || "[]");
    saved.push({ text, timestamp: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(saved));
    alert("✅ Saved to library!");
  };

  const copyText = (elId, msg = "📋 Copied to clipboard!") => {
    const text = safeText(elId);
    if (!text) return alert("Nothing to copy.");
    navigator.clipboard.writeText(text).then(() => alert(msg));
  };

  const rewriteCaption = () => {
    const caption = $(elIds.captionInput)?.value.trim();
    const platform = $(elIds.platformSelect)?.value;
    const output = $(elIds.captionOutput);

    if (!caption) return alert("Paste a caption first.");
    output.textContent = "♻️ Rewriting...";

    fetch("/rewrite-caption", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption, platform }),
    })
      .then((res) => res.json())
      .then((data) => {
        output.textContent = clean(data.result || "⚠️ No result.");
        updateUsageCounter(data.usage.count, data.usage.limit);
      })
      .catch(() => {
        output.textContent = "⚠️ Failed to rewrite caption.";
      });
  };

  const generateRandomCaption = () => {
    const output = $(elIds.captionOutput);
    output.textContent = "🎲 Generating...";

    fetch("/generate-random-caption", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    })
      .then((res) => res.json())
      .then((data) => {
        output.textContent = clean(data.result || "⚠️ No result.");
        updateUsageCounter(data.usage.count, data.usage.limit);
      })
      .catch(() => {
        output.textContent = "⚠️ Failed to generate caption.";
      });
  };

  const generateWeeklyPlan = () => {
    const output = $(elIds.weeklyOutput);
    output.textContent = "🧠 Planning your week...";

    fetch("/generate-weekly-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    })
      .then((res) => res.json())
      .then((data) => {
        output.textContent = clean(data.result || "⚠️ No result.");
        updateUsageCounter(data.usage.count, data.usage.limit);
      })
      .catch(() => {
        output.textContent = "⚠️ Failed to generate weekly plan.";
      });
  };

  const subscribeToPro = () => {
    fetch("/subscribe", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data.url) window.location.href = data.url;
        else alert("⚠️ Failed to create Stripe checkout session.");
      })
      .catch((err) => {
        console.error("Subscribe error:", err);
        alert("⚠️ Something went wrong with subscription.");
      });
  };

  window.goPro = () => $(elIds.subscribeBtn)?.click();

  const clickMap = {
    generateDailyPostBtn: generateDailyPost,
    rewriteCaptionBtn: rewriteCaption,
    randomCaptionBtn: generateRandomCaption,
    generateWeeklyPlanBtn: generateWeeklyPlan,
    copyBtn: () => copyText(elIds.output),
    saveBtn: () => saveText("library", elIds.output),
    copyCaptionBtn: () => copyText(elIds.captionOutput, "📋 Caption copied!"),
    saveCaptionBtn: () => saveText("library", elIds.captionOutput),
    copyWeeklyBtn: () => copyText(elIds.weeklyOutput, "📋 Weekly plan copied!"),
    saveWeeklyBtn: () => saveText("library", elIds.weeklyOutput),
    subscribeBtn: subscribeToPro,
  };

  Object.entries(clickMap).forEach(([id, fn]) => {
    const el = $(id);
    if (el) el.addEventListener("click", fn);
  });

  fetchUserStatus();
});
