document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOM ready, main.js running");

  let isProUser = false;
  let promptUsage = { count: 0, limit: 5 };
  let allTemplates = [];

  function showSpinner(show) {
    document.getElementById("loadingSpinner")?.classList.toggle("hidden", !show);
  }

  function updateUsageCounter(used, limit) {
    const el = document.getElementById("usageCounter");
    if (!el) return;
    el.classList.remove("hidden");
    el.innerHTML = used >= limit
      ? `🚫 Prompt limit reached: <span>${used}</span> of ${limit}`
      : `Prompts used: <span>${used}</span> of ${limit}`;
  }

  function incrementUsage() {
    if (!isProUser) {
      promptUsage.count++;
      updateUsageCounter(promptUsage.count, promptUsage.limit);
    }
  }

  function reflectProStatus(isPro) {
    const el = document.getElementById("usageCounter");
    if (!el) return;
    if (isPro) {
      el.innerHTML = "👑 Pro: <span class='text-green-700 font-bold'>Unlimited prompts</span>";
      el.classList.remove("hidden");
    }
  }

  function fetchUserStatus() {
    fetch("/api/user-status")
      .then(res => res.json())
      .then(data => {
        isProUser = data.isPro;
        promptUsage = data.usage || promptUsage;
        updateUsageCounter(promptUsage.count, promptUsage.limit);
        reflectProStatus(isProUser);
        if (!isProUser && data.client?.used) lockClientResponder();
      });
  }

  function lockClientResponder() {
    ["generateReplyBtn", "processImageBtn", "clientMessage"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = true;
    });
  }

  function getSelectedPromptTemplate() {
    return document.getElementById("category")?.value;
  }

  function getTone() {
    return document.getElementById("tone")?.value || "";
  }

  function getInput() {
    return document.getElementById("input")?.value.trim();
  }

  function getClientMessage() {
    return document.getElementById("clientMessage")?.value.trim();
  }

  function generate() {
    const input = getInput();
    const tone = getTone();
    const template_id = getSelectedPromptTemplate();
    if (!template_id) return alert("Please select a prompt.");

    showSpinner(true);
    fetch("/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, tone, template_id })
    })
      .then(res => res.json())
      .then(data => {
        if (data.result) {
          document.getElementById("output").textContent = data.result;
          document.getElementById("regenerateSection").classList.remove("hidden");
        } else {
          alert("⚠️ " + (data.error || "No response from server."));
        }
        if (data.usage) {
          promptUsage = data.usage;
          updateUsageCounter(promptUsage.count, promptUsage.limit);
        }
      })
      .catch(err => console.error("Generate error:", err))
      .finally(() => showSpinner(false));
  }

  function regenerate() {
    const tweak = document.getElementById("regenerateTweak")?.value;
    const lastOutput = document.getElementById("output")?.textContent;
    if (!lastOutput) return;

    const feedback = document.getElementById("tweakFeedback");
    if (feedback) feedback.classList.add("hidden");

    showSpinner(true);

    fetch("/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tweak, last_output: lastOutput })
    })
      .then(res => res.json())
      .then(data => {
        document.getElementById("output").textContent = data.output;
        document.getElementById("tweakFeedback").classList.remove("hidden");
        if (data.usage) {
          promptUsage = data.usage;
          updateUsageCounter(promptUsage.count, promptUsage.limit);
        }
      })
      .finally(() => showSpinner(false));
  }

function generateDailyPost() {
  showSpinner(true);
  fetch("/daily-post", { method: "POST" })
    .then(res => res.json())
    .then(data => {
      if (data.result) {
        document.getElementById("output").textContent = data.result;
        document.getElementById("regenerateSection").classList.remove("hidden");

        // ✅ Update usage if returned
        if (data.usage) {
          promptUsage = data.usage;
          updateUsageCounter(promptUsage.count, promptUsage.limit);
        }
      } else {
        alert("⚠️ " + (data.error || "No response from server."));
      }
    })
    .catch(err => {
      console.error("Daily post error:", err);
    })
    .finally(() => showSpinner(false));
}

  function generateReply() {
    const message = getClientMessage();
    if (!message) return alert("Paste a message to reply to.");
    showSpinner(true);
    fetch("/draft-client-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    })
      .then(res => res.json())
      .then(data => {
        if (data.result) {
          document.getElementById("output").textContent = data.result;
          document.getElementById("regenerateSection").classList.remove("hidden");
        } else {
          alert("⚠️ " + (data.error || "No response from server."));
        }
      })
      .finally(() => showSpinner(false));
  }

  function uploadImage() {
    const file = document.getElementById("imageUpload")?.files[0];
    if (!file) return alert("Please select an image.");

    const formData = new FormData();
    formData.append("image", file);

    showSpinner(true);
    fetch("/extract-text-from-image", {
      method: "POST",
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        if (data.text) {
          document.getElementById("clientMessage").value = data.text;
        } else {
          alert("⚠️ Failed to extract text from image.");
        }
      })
      .finally(() => showSpinner(false));
  }

  function getSmartSuggestions() {
    const output = document.getElementById("output")?.textContent.trim();
    if (!output) return;
    const btn = document.getElementById("getSuggestionsBtn");
    btn.textContent = "⏳ Getting suggestions...";
    btn.disabled = true;
    fetch("/smart-tweak-helper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ output })
    })
      .then(res => res.json())
      .then(data => {
        const wrap = document.getElementById("tweakSuggestions");
        wrap.innerHTML = "";
        data.suggestions.forEach(s => {
          const tag = document.createElement("span");
          tag.textContent = s;
          tag.className = "suggestion bg-gray-200 hover:bg-yellow-200 px-2 py-1 rounded cursor-pointer";
          tag.onclick = () => document.getElementById("regenerateTweak").value = s;
          wrap.appendChild(tag);
        });
      })
      .finally(() => {
        btn.textContent = "💡 Get Smart Suggestions";
        btn.disabled = false;
      });
  }

  function saveOutput() {
    const content = document.getElementById("output")?.textContent.trim();
    if (!content) return alert("Nothing to save.");
    const saved = JSON.parse(localStorage.getItem("library") || "[]");
    saved.push({ text: content, timestamp: new Date().toISOString() });
    localStorage.setItem("library", JSON.stringify(saved));
    alert("✅ Saved to library!");
  }

  const clickMap = {
    generateBtn: generate,
    regenerateBtn: regenerate,
    dailyPostBtn: generateDailyPost,
    generateReplyBtn: generateReply,
    processImageBtn: uploadImage,
    getSuggestionsBtn: getSmartSuggestions,
    saveBtn: saveOutput,
    resetUsageBtn: () => fetch("/reset-usage").then(() => location.reload())
  };

  Object.entries(clickMap).forEach(([id, fn]) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
  });

  fetch("/api/prompts")
    .then(res => res.json())
    .then(data => {
      allTemplates = data;
      const cats = ["All", ...new Set(data.map(t => t.category))];
      const filter = document.getElementById("categoryFilter");
      cats.forEach(c => {
        const o = document.createElement("option");
        o.value = c; o.textContent = c;
        filter?.appendChild(o);
      });
      renderTemplates("All");
    });

  function renderTemplates(category) {
    const dropdown = document.getElementById("category");
    if (!dropdown) return;
    dropdown.innerHTML = "";
    const filtered = category === "All" ? allTemplates : allTemplates.filter(t => t.category === category);
    filtered.forEach(t => {
      const o = document.createElement("option");
      o.value = t.id;
      o.textContent = t.label;
      dropdown.appendChild(o);
    });
  }

  document.getElementById("categoryFilter")?.addEventListener("change", e => {
    renderTemplates(e.target.value);
  });

  fetchUserStatus();

  document.getElementById("subscribeBtn")?.addEventListener("click", () => {
    const btn = document.getElementById("subscribeBtn");
    btn.disabled = true;
    btn.textContent = "⏳ Redirecting to Stripe...";

    fetch("/subscribe", { method: "POST" })
      .then(res => res.json())
      .then(data => {
        if (data.url) {
          window.location.href = data.url;
        } else {
          alert("⚠️ Failed to create Stripe session: " + (data.error || "Unknown error."));
          btn.disabled = false;
          btn.textContent = "🔐 Subscribe to PromptAgent Pro";
        }
      })
      .catch(err => {
        console.error("Stripe subscribe error:", err);
        alert("⚠️ Something went wrong subscribing.");
        btn.disabled = false;
        btn.textContent = "🔐 Subscribe to PromptAgent Pro";
      });
  });
});