document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOM ready, main.js running");

  let isProUser = false;
  let promptUsage = { count: 0, limit: 5 };
  let allTemplates = [];

  function showSpinner(show) {
    document.getElementById("loadingSpinner")?.classList.toggle("hidden", !show);
  }

function saveToLibrary(content, folderName = "Uncategorized") {
  if (!content || content.trim() === "") {
    alert("❌ Nothing to save.");
    return;
  }

  let saved;
  try {
    saved = JSON.parse(localStorage.getItem("library")) || [];
    if (!Array.isArray(saved)) saved = [];
  } catch {
    saved = [];
  }

  saved.push({
    text: content.trim(),
    timestamp: new Date().toISOString(),
    folder: folderName,
    tags: [],
    favorite: false
  });

  localStorage.setItem("library", JSON.stringify(saved));
  alert("✅ Saved to Library!");
}


function updateUsageCounter(used, limit) {
  const el = document.getElementById("usageCounter");
  const lockMsg = document.getElementById("clientReplyLockedMsg");

  if (!el) return;

  // Show or hide locked message
  if (!isProUser && used >= limit) {
    lockMsg?.classList.remove("hidden");
  } else {
    lockMsg?.classList.add("hidden");
  }

  // Update usage counter text
  el.classList.remove("hidden");
  el.innerHTML = used >= limit
    ? `🚫 Use limit reached: <span>${used}</span> of ${limit}`
    : `🧠 Uses: <span>${used}</span> of ${limit}`;
}

  function reflectProStatus(isPro) {
    const el = document.getElementById("usageCounter");
    if (!el) return;
    if (isPro) {
      el.innerHTML = "👑 Pro: <span class='text-green-700 font-bold'>Unlimited uses</span>";
      el.classList.remove("hidden");
    }
  }

function fetchUserStatus() {
  fetch("/api/user-status")
    .then(res => res.json())
    .then(data => {
      isProUser = data.isPro;
      promptUsage = data.usage || promptUsage;

      if (isProUser) {
        reflectProStatus(true);
      } else {
        updateUsageCounter(promptUsage.count, promptUsage.limit);
      }
    })
    .catch(err => {
      console.error("Failed to fetch user status:", err);
    });
}


  function getInput() {
    return document.getElementById("input")?.value.trim();
  }

  function getTone() {
    return document.getElementById("tone")?.value || "";
  }

  function getClientMessage() {
    return document.getElementById("clientMessage")?.value.trim();
  }

  function getSelectedPromptTemplate() {
    return document.getElementById("promptTemplate")?.value;
  }

  function generate() {
    const input = getInput();
    const tone = getTone();
    const template_id = getSelectedPromptTemplate();

    if (!template_id || template_id === "") return alert("Please select a prompt.");
    showSpinner(true);
    document.getElementById("tweakSuggestions").innerHTML = "";

    fetch("/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, tone, template_id })
    })
      .then(res => res.json())
      .then(data => {
        if (data.result) {
          document.getElementById("promptOutput").textContent = data.result;
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

  function generateReply() {
    const message = getClientMessage();
    const tone = document.getElementById("templateTone")?.value || getTone();
    if (!message) return alert("Paste a client message to reply to.");

    document.getElementById("clientLoadingSpinner")?.classList.remove("hidden");

    fetch("/draft-client-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, tone })
    })
      .then(res => res.json())
      .then(data => {
        if (data.result) {
          document.getElementById("clientReplyOutput").textContent = data.result;
        } else {
          alert("⚠️ " + (data.error || "No response from server."));
        }

        if (data.usage) {
          promptUsage = data.usage;
          updateUsageCounter(promptUsage.count, promptUsage.limit);
        }

        if (promptUsage?.count >= promptUsage?.limit) {
          document.getElementById("clientReplyLockedMsg")?.classList.remove("hidden");
        }
      })
      .catch(err => console.error("Client reply error:", err))
      .finally(() => {
        document.getElementById("clientLoadingSpinner")?.classList.add("hidden");
      });
  }

function regeneratePrompt() {
  if (!isProUser && promptUsage.count >= promptUsage.limit) {
    document.getElementById("clientReplyLockedMsg")?.classList.remove("hidden");
    return alert("🚫 You’ve used all 5 free regenerations. Upgrade to Pro to unlock unlimited access!");
  }

  const tweak = document.getElementById("regenerateTweak")?.value;
  const lastOutput = document.getElementById("promptOutput")?.textContent;
  if (!lastOutput) return alert("No previous prompt output to tweak.");

  showSpinner(true);

  fetch("/regenerate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tweak, last_output: lastOutput })
  })
    .then(res => res.json())
    .then(data => {
if (data.output) {
  document.getElementById("promptOutput").textContent = data.output;

  // Only show tweak feedback if result was actually modified
  if (!isProUser && promptUsage.count >= promptUsage.limit) return;

  const feedback = document.getElementById("tweakFeedback");
  if (feedback) {
    feedback.classList.remove("hidden");
    setTimeout(() => feedback.classList.add("hidden"), 3000);
  }
}
 else {
        alert("⚠️ " + (data.error || "No response from server."));
      }

      if (data.usage) {
        promptUsage = data.usage;
        updateUsageCounter(promptUsage.count, promptUsage.limit);
      }
    })
    .catch(err => alert("⚠️ Regenerate failed."))
    .finally(() => showSpinner(false));
}


  function regenerateClientReply() {
    const lastClientMsg = getClientMessage();
    const tone = document.getElementById("templateTone")?.value;
    if (!lastClientMsg) return alert("Paste a client message first.");
    document.getElementById("clientLoadingSpinner")?.classList.remove("hidden");
    fetch("/draft-client-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: lastClientMsg, tone })
    })
      .then(res => res.json())
      .then(data => {
        if (data.result) {
          document.getElementById("clientReplyOutput").textContent = data.result;
        }
        if (data.usage) {
          promptUsage = data.usage;
          updateUsageCounter(promptUsage.count, promptUsage.limit);
        }
      })
      .catch(err => alert("⚠️ Client reply regenerate failed."))
      .finally(() => {
        document.getElementById("clientLoadingSpinner")?.classList.add("hidden");
      });
  }

function generateDailyPost() {
  if (!isProUser && promptUsage.dailyPostUsed) {
    return alert("🚫 You've already used your free Daily Post. Upgrade to Pro for unlimited posts.");
  }

  showSpinner(true);

  fetch("/daily-post", { method: "POST" })
    .then(res => {
      if (res.status === 403) return res.json().then(data => { throw data; });
      return res.json();
    })
    .then(data => {
      if (data.result) {
        document.getElementById("promptOutput").textContent = data.result;
        document.getElementById("regenerateSection").classList.remove("hidden");
        document.getElementById("tweakSuggestions").innerHTML = "";

if (data.usage) {
  promptUsage = data.usage;
  if (isProUser) {
    reflectProStatus(true);
  } else {
    updateUsageCounter(promptUsage.count, promptUsage.limit);
  }
}

      } else {
        alert("⚠️ " + (data.error || "No response from server."));
      }
    })
    .catch(err => {
      alert("⛔ " + (err.error || "Daily post already used."));
    })
    .finally(() => showSpinner(false));
}



  function getSmartSuggestions() {
    const output = document.getElementById("promptOutput")?.textContent.trim();
    const container = document.getElementById("tweakSuggestions");
    container.innerHTML = "<span class='text-gray-500 text-sm animate-pulse'>⏳ Loading suggestions...</span>";

    if (!output) {
      container.innerHTML = "";
      return alert("No generated output to suggest from.");
    }

    fetch("/smart-tweak-helper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ output })
    })
      .then(res => res.json())
      .then(data => {
        container.innerHTML = "";
        if (data.suggestions?.length > 0) {
          data.suggestions.forEach(s => {
            const btn = document.createElement("button");
            btn.textContent = s;
            btn.className = "bg-gray-200 hover:bg-yellow-200 text-xs px-2 py-1 rounded";
            btn.addEventListener("click", () => {
              document.getElementById("regenerateTweak").value = s;
            });
            container.appendChild(btn);
          });
        } else {
          container.innerHTML = "<span class='text-red-500 text-sm'>⚠️ No suggestions received.</span>";
        }
      })
      .catch(err => {
        console.error("Suggestions error:", err);
        container.innerHTML = "<span class='text-red-500 text-sm'>⚠️ Failed to load suggestions.</span>";
      });
  }

  const clickMap = {
    generateBtn: generate,
    dailyPostBtn: generateDailyPost,
    regeneratePromptBtn: regeneratePrompt,
    regenerateClientReplyBtn: regenerateClientReply,
generateReplyBtn: () => {
  if (!isProUser && promptUsage.count >= promptUsage.limit) {
    document.getElementById("clientReplyLockedMsg")?.classList.remove("hidden");
    return;
  }
  generateReply();
},

    getSuggestionsBtn: getSmartSuggestions,
    saveBtn: () => {
      const content = document.getElementById("clientReplyOutput")?.textContent.trim();
      saveToLibrary(content);
    },
    savePromptBtn: () => {
      const content = document.getElementById("promptOutput")?.textContent.trim();
      saveToLibrary(content);
    },
    subscribeBtn: () => {
      fetch("/subscribe", { method: "POST" })
        .then(res => res.json())
        .then(data => {
          if (data.url) window.location.href = data.url;
          else alert("⚠️ Failed to create Stripe checkout session.");
        })
        .catch(err => {
          console.error("Subscribe error:", err);
          alert("⚠️ Something went wrong with subscription.");
        });
    },
    resetUsageBtn: () => fetch("/reset-usage").then(() => location.reload())
  };

  Object.entries(clickMap).forEach(([id, fn]) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
  });

// 🎙️ Voice-to-text for "Your Input"
(() => {
  const micBtn = document.getElementById("voiceBtn");
  if (!micBtn) {
    console.warn("⚠️ voiceBtn not found in DOM.");
    return;
  }

  if ("webkitSpeechRecognition" in window) {
    const recognitionInput = new webkitSpeechRecognition();
    recognitionInput.lang = "en-US";
    recognitionInput.continuous = false;
    recognitionInput.interimResults = false;

    micBtn.addEventListener("click", () => {
      console.log("🎙️ Starting voice recognition for 'Your Input'");
      recognitionInput.start();
    });

    recognitionInput.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const inputField = document.getElementById("input");
      if (inputField) {
        inputField.value = inputField.value.trim() + " " + transcript;
      }
    };

    recognitionInput.onerror = (event) => {
      console.error("Voice input error (Input):", event.error);
      alert("🎤 Voice recognition for 'Your Input' failed or was blocked.");
    };
  } else {
    console.warn("🎤 Speech recognition not supported in this browser.");
  }
})();


// 🎙️ Voice-to-text for "Client Message"
(() => {
  const micClientBtn = document.getElementById("micClientBtn");
  if (micClientBtn && "webkitSpeechRecognition" in window) {
    const recognitionClient = new webkitSpeechRecognition();
    recognitionClient.lang = "en-US";
    recognitionClient.continuous = false;
    recognitionClient.interimResults = false;

    micClientBtn.addEventListener("click", () => {
      recognitionClient.start();
    });

    recognitionClient.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const clientField = document.getElementById("clientMessage");
      if (clientField) {
        clientField.value = clientField.value.trim() + " " + transcript;
      }
    };

    recognitionClient.onerror = (event) => {
      console.error("Voice input error (Client Msg):", event.error);
      alert("🎤 Voice recognition for 'Client Message' failed or was blocked.");
    };
  }
})();

  fetchUserStatus();
});
