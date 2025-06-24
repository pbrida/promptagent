// static/library.js

let openFolders = new Set();

function getFolders() {
  const raw = localStorage.getItem("folderList");
  return raw ? JSON.parse(raw) : [];
}

function saveFolders(folders) {
  localStorage.setItem("folderList", JSON.stringify(folders));
}

function loadLibrary(activeFolder = null) {
  const container = document.getElementById("libraryContainer");
  const raw = localStorage.getItem("library");
  const all = raw ? JSON.parse(raw) : [];
  const folders = getFolders();
  const selectedFolder =
    activeFolder ||
    document.querySelector(".folder-sidebar .active")?.dataset.folder ||
    "";

  container.innerHTML = "";

let items = [];

if (selectedFolder === "Favorites") {
  items = all.filter((item) => item.favorite);
} else if (selectedFolder) {
  items = all.filter((item) => (item.folder || "Uncategorized") === selectedFolder);
} else {
  // Default to showing "Uncategorized"
  const defaultFolder = "Uncategorized";
  document.querySelectorAll(".folder-sidebar li").forEach((el) => {
    el.classList.remove("active");
    if (el.dataset.folder === defaultFolder) el.classList.add("active");
  });
  loadLibrary(defaultFolder);
  return;
}



items.forEach((item, idx) => {
  const card = document.createElement("div");
  card.className = "p-4 bg-white rounded shadow border relative";

  // title input
  const titleInput = document.createElement("input");
  titleInput.className = "w-full font-semibold text-blue-800 text-sm mb-2 bg-transparent outline-none border-b border-dashed";
  titleInput.value = item.title || "Untitled Script";
  titleInput.addEventListener("blur", () => {
    const updated = JSON.parse(localStorage.getItem("library") || "[]");
    const match = updated.find((x) => x.timestamp === item.timestamp);
    if (match) {
      match.title = titleInput.value.trim() || "Untitled Script";
      localStorage.setItem("library", JSON.stringify(updated));
      populateSidebar();
    }
  });

  // top meta + actions
  const meta = document.createElement("div");
  meta.className = "flex justify-between items-start mb-2";
  meta.innerHTML = `
    <div class="text-xs text-gray-500">Saved: ${new Date(item.timestamp).toLocaleString()}</div>
    <div class="flex gap-2">
      <button onclick="toggleFavorite('${item.timestamp}')" class="text-yellow-500 text-lg">${item.favorite ? "★" : "☆"}</button>
      <button onclick="deleteItem('${item.timestamp}')" class="text-red-500 text-xs underline">Delete</button>
    </div>
  `;

  // main text content
  const pre = document.createElement("pre");
  pre.className = "whitespace-pre-wrap text-base text-gray-800 font-sans leading-7 my-2";
  pre.textContent = item.text;

  // copy button
  const copyBtn = document.createElement("button");
  copyBtn.className = "btn-mini";
  copyBtn.textContent = "📋 Copy";
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(item.text)
      .then(() => alert("Copied!"))
      .catch(() => alert("Failed to copy"));
  });

  const copyWrapper = document.createElement("div");
  copyWrapper.className = "flex justify-end mt-2";
  copyWrapper.appendChild(copyBtn);

  // folder dropdown
  const folderDropdown = document.createElement("select");
  folderDropdown.className = "border rounded text-sm px-2 py-1 mt-1";
  ["Uncategorized", ...folders].forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f;
    opt.textContent = f;
    if ((item.folder || "Uncategorized") === f) opt.selected = true;
    folderDropdown.appendChild(opt);
  });
  folderDropdown.addEventListener("change", (e) => {
    const updated = JSON.parse(localStorage.getItem("library") || "[]");
    const match = updated.find((x) => x.timestamp === item.timestamp);
    if (match) {
      match.folder = e.target.value;
      localStorage.setItem("library", JSON.stringify(updated));
      loadLibrary(e.target.value);
      populateSidebar();
    }
  });

  // assemble card
  card.appendChild(titleInput);
  card.appendChild(meta);
  card.appendChild(pre);
  card.appendChild(copyWrapper);
  card.appendChild(folderDropdown);
  container.appendChild(card);
});


  // 🔁 Add inner HTML with Copy button container
  card.innerHTML = `
    <div class="flex justify-between items-start mb-2">
      <div class="text-xs text-gray-500">Saved: ${new Date(item.timestamp).toLocaleString()}</div>
      <div class="flex gap-2">
        <button onclick="toggleFavorite('${item.timestamp}')" class="text-yellow-500 text-lg">${item.favorite ? "★" : "☆"}</button>
        <button onclick="deleteItem('${item.timestamp}')" class="text-red-500 text-xs underline">Delete</button>
      </div>
    </div>
    <pre class="whitespace-pre-wrap text-base text-gray-800 font-sans leading-7 my-2">${item.text}</pre>
    <div class="flex justify-end mt-2">
      <button class="btn-mini" onclick="navigator.clipboard.writeText(\`${item.text.replace(/`/g, '\\`')}\`).then(() => alert('Copied!'))">📋 Copy</button>
    </div>
  `;

  card.prepend(titleInput);
  card.appendChild(folderDropdown);
  container.appendChild(card);
  }

function populateSidebar() {
  const sidebar = document.getElementById("folderList");
  const folders = getFolders();
  sidebar.innerHTML = "";
  const all = JSON.parse(localStorage.getItem("library") || "[]");
  const foldersInUse = [...new Set(all.map((i) => i.folder || "Uncategorized"))];
  const allFolders = [...new Set(["Favorites", ...folders, ...foldersInUse, "Uncategorized"])]
    .filter(Boolean);

  allFolders.forEach((folder) => {
    const li = document.createElement("li");
    li.textContent = folder === "Favorites" ? "📌 Favorites" : `📁 ${folder}`;
    li.className = "cursor-pointer hover:bg-blue-100 rounded px-2 py-1 text-sm";
    li.dataset.folder = folder;
    li.addEventListener("click", () => {
      document.querySelectorAll(".folder-sidebar li").forEach((el) => el.classList.remove("active"));
      li.classList.add("active");
      loadLibrary(folder);
    });
    sidebar.appendChild(li);
  });
}

function toggleFavorite(timestamp) {
  const saved = JSON.parse(localStorage.getItem("library") || "[]");
  const i = saved.findIndex((item) => item.timestamp === timestamp);
  if (i > -1) {
    saved[i].favorite = !saved[i].favorite;
    localStorage.setItem("library", JSON.stringify(saved));
    loadLibrary();
  }
}

function deleteItem(timestamp) {
  let saved = JSON.parse(localStorage.getItem("library") || "[]");
  saved = saved.filter((item) => item.timestamp !== timestamp);
  localStorage.setItem("library", JSON.stringify(saved));
  loadLibrary();
  populateSidebar();
}

document.addEventListener("DOMContentLoaded", () => {
  const createBtn = document.getElementById("createFolderBtn");
  const deleteBtn = document.getElementById("deleteFolderBtn");
  const newFolderInput = document.getElementById("newFolderInput");

  createBtn?.addEventListener("click", () => {
    const name = newFolderInput.value.trim();
    if (!name) return;
    const folders = getFolders();
    if (!folders.includes(name)) {
      folders.push(name);
      saveFolders(folders);
      populateSidebar();
    }
    newFolderInput.value = "";
  });

  deleteBtn?.addEventListener("click", () => {
    const active = document.querySelector(".folder-sidebar .active")?.dataset.folder;
    if (!active || active === "Favorites") return;
    const folders = getFolders().filter((f) => f !== active);
    saveFolders(folders);
    const saved = JSON.parse(localStorage.getItem("library") || "[]");
    saved.forEach((item) => {
      if (item.folder === active) item.folder = "Uncategorized";
    });
    localStorage.setItem("library", JSON.stringify(saved));
    populateSidebar();
    loadLibrary("Uncategorized");
  });

  document.getElementById("clearLibrary")?.addEventListener("click", () => {
    if (confirm("Clear all saved items?")) {
      localStorage.removeItem("library");
      loadLibrary();
      populateSidebar();
    }
  });

  // ✅ Add Pro/Free badge status
  fetch("/api/user-status")
    .then(res => res.json())
    .then(data => {
      const badge = document.getElementById("userStatusBadge");
      const usageCounter = document.getElementById("usageCounter");

      if (data?.isPro) {
        badge.textContent = "Pro User";
        badge.classList.add("bg-green-100", "text-green-800");
      } else {
        badge.textContent = "Free User";
        badge.classList.add("bg-yellow-100", "text-yellow-800");
        if (usageCounter) {
          usageCounter.classList.remove("hidden");
          usageCounter.textContent = `Usage: ${data.usage.count} of ${data.usage.limit}`;
        }
      }
    })
    .catch(() => {
      const badge = document.getElementById("userStatusBadge");
      if (badge) badge.textContent = "⚠️ Error";
    });

  populateSidebar();
  loadLibrary();
});

