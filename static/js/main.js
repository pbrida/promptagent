document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOM ready, main.js running");

  let isProUser = false;
  let promptUsage = { count: 0, limit: 5 };

  const $ = (id) => document.getElementById(id);
  const getVal = (id) => ($(id) ? $(id).value.trim() : "");
  const setText = (id, text) => { if ($(id)) $(id).textContent = text; };

  function showSpinner(show) {
    $("loadingSpinner")?.classList.toggle("hidden", !show);
  }

  function updateUserStatusBadge() {
    const badge = $("userStatusBadge");
    if (!badge) return;
    badge.textContent = isProUser ? "Pro User" : "Free User";
    badge.classList.remove("bg-gray-100", "text-gray-700");
    badge.classList.add(isProUser ? "bg-green-100" : "bg-yellow-100");
    badge.classList.add(isProUser ? "text-green-800" : "text-yellow-800");
  }

  function updateUsageCounter(used, limit) {
    const el = $("usageCounter");
    const lockMsg = $("clientReplyLockedMsg");
    if (!el) return;

    const isLocked = !isProUser && used >= limit;
    el.innerHTML = isLocked
      ? `🚫 Use limit reached: <span>${used}</span> of ${limit}`
      : `Uses: <span>${used}</span> of ${limit}`;

    lockMsg?.classList.toggle("hidden", !isLocked);
    el.classList.remove("hidden");

    if (isLocked) {
      document.querySelectorAll("button").forEach(btn => {
        if (!btn.id.includes("subscribe")) btn.disabled = true;
      });
    }
  }

  function reflectProStatus(isPro) {
    const el = $("usageCounter");
    if (!el) return;
    el.innerHTML = "👑 Pro: <span class='text-green-700 font-bold'>Unlimited uses</span>";
    el.classList.remove("hidden");
  }

  function fetchUserStatus() {
    fetch("/api/user-status")
      .then(res => res.json())
      .then(data => {
        isProUser = data.isPro;
        promptUsage = data.usage || promptUsage;

        localStorage.setItem("promptUsageCount", promptUsage.count);
        localStorage.setItem("promptUsageLimit", promptUsage.limit);

        if (isProUser) {
          reflectProStatus(true);
        } else {
          updateUsageCounter(promptUsage.count, promptUsage.limit);
        }

        updateUserStatusBadge();
      })
      .catch(err => console.error("❌ Failed to fetch user status:", err));
  }

  function saveToLibrary(content, folderName = "Uncategorized") {
    if (!content) return alert("❌ Nothing to save.");
    let saved = JSON.parse(localStorage.getItem("library") || "[]");
    if (!Array.isArray(saved)) saved = [];
    saved.push({
      text: content.trim(),
      timestamp: new Date().toISOString(),
      folder: folderName,
      tags: [],
      favorite: false
    });
    localStorage.setItem("library", JSON.stringify(saved));
    alert("✅ Saved to Library!");
    window.dispatchEvent(new Event("library-updated"));
  }

  function loadTemplates() {
    fetch("/api/prompts")
      .then(res => res.json())
      .then(data => {
        const categories = [...new Set(data.map(t => t.category))];
        const categorySelect = $("categoryFilter");
        const promptSelect = $("promptTemplate");
        if (!categorySelect || !promptSelect) return;

        categorySelect.innerHTML = `<option value="">-- All Categories --</option>`;
        categories.forEach(cat => {
          const opt = document.createElement("option");
          opt.value = cat;
          opt.textContent = cat;
          categorySelect.appendChild(opt);
        });

        const populatePromptOptions = (filter = "") => {
          promptSelect.innerHTML = `<option value="">-- Select a prompt --</option>`;
          data
            .filter(t => !filter || t.category === filter)
            .forEach(t => {
              const opt = document.createElement("option");
              opt.value = t.id;
              opt.textContent = t.label;
              promptSelect.appendChild(opt);
            });
        };

        categorySelect.addEventListener("change", e => populatePromptOptions(e.target.value));
        populatePromptOptions();
      })
      .catch(err => console.error("❌ Failed to load prompts:", err));
  }

  function generate() {
    const input = getVal("input");
    const tone = getVal("tone");
    const template_id = getVal("promptTemplate");
    if (!template_id) return alert("⚠️ Please select a prompt.");

    showSpinner(true);
    setText("tweakSuggestions", "");

    fetch("/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, tone, template_id })
    })
      .then(res => res.json())
      .then(data => {
        if (data.result) {
          setText("promptOutput", data.result);
          $("regenerateSection")?.classList.remove("hidden");
        } else {
          alert("⚠️ " + (data.error || "No response from server."));
        }
        if (data.usage) {
          promptUsage = data.usage;
          updateUsageCounter(promptUsage.count, promptUsage.limit);
        }
      })
      .catch(err => console.error("❌ Generate error:", err))
      .finally(() => showSpinner(false));
  }

  // ✅ Button click mapping (NO Social Assistant buttons)
  const clickMap = {
    generateBtn: generate,
    regeneratePromptBtn: typeof regeneratePrompt !== "undefined" ? regeneratePrompt : () => {},
    regenerateClientReplyBtn: typeof regenerateClientReply !== "undefined" ? regenerateClientReply : () => {},
    generateReplyBtn: () => {
      if (!isProUser && promptUsage.count >= promptUsage.limit) {
        $("clientReplyLockedMsg")?.classList.remove("hidden");
        return;
      }
      if (typeof generateReply === "function") generateReply();
    },
    getSuggestionsBtn: typeof getSmartSuggestions === "function" ? getSmartSuggestions : () => {},
    saveBtn: () => saveToLibrary(getVal("clientReplyOutput")),
    savePromptBtn: () => saveToLibrary(getVal("promptOutput")),
    subscribeBtn: () => {
      fetch("/subscribe", { method: "POST" })
        .then(res => res.json())
        .then(data => {
          if (data.url) window.location.href = data.url;
          else alert("⚠️ Failed to create Stripe checkout session.");
        })
        .catch(() => alert("⚠️ Subscription error."));
    },
    resetUsageBtn: () => fetch("/reset-usage").then(() => location.reload())
  };

  Object.entries(clickMap).forEach(([id, fn]) => {
    const el = $(id);
    if (el && typeof fn === "function") el.addEventListener("click", fn);
  });

  loadTemplates();
  fetchUserStatus();
});
