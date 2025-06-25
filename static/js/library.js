// static/library.js

const $ = (id) => document.getElementById(id);

function getLibrary() {
  return JSON.parse(localStorage.getItem("library") || "[]");
}

function saveLibrary(data) {
  localStorage.setItem("library", JSON.stringify(data));
}

function getFolders() {
  const raw = localStorage.getItem("folderList");
  const folders = raw ? JSON.parse(raw) : [];
  if (!folders.includes("Uncategorized")) folders.push("Uncategorized");
  return folders;
}

function saveFolders(folders) {
  localStorage.setItem("folderList", JSON.stringify(folders));
}

function renderLibraryCard(item, folders) {
  const card = document.createElement("div");
  card.className = "p-4 bg-white rounded shadow border relative";

  const titleInput = document.createElement("input");
  titleInput.className =
    "w-full font-semibold text-blue-800 text-sm mb-2 bg-transparent outline-none border-b border-dashed focus:outline focus:ring-2 focus:ring-blue-400";
  titleInput.value = item.title || "Untitled Script";
  titleInput.setAttribute("aria-label", "Edit title");
  titleInput.addEventListener("blur", () => {
    const updated = getLibrary();
    const match = updated.find((x) => x.timestamp === item.timestamp);
    if (!match) return;
    match.title = titleInput.value.trim() || "Untitled Script";
    saveLibrary(updated);
    populateSidebar();
  });

  const meta = document.createElement("div");
  meta.className = "flex justify-between items-start mb-2";
  meta.innerHTML = `
    <div class="text-xs text-gray-500">Saved: ${new Date(item.timestamp).toLocaleString()}</div>
    <div class="flex gap-2">
      <button onclick="toggleFavorite('${item.timestamp}')" class="text-yellow-500 text-lg" aria-label="Toggle Favorite">${item.favorite ? "★" : "☆"}</button>
      <button onclick="deleteItem('${item.timestamp}')" class="text-red-500 text-xs underline" aria-label="Delete">Delete</button>
    </div>
  `;

  const pre = document.createElement("pre");
  pre.className = "whitespace-pre-wrap text-base text-gray-800 font-sans leading-7 my-2";
  pre.textContent = item.text;

  const copyBtn = document.createElement("button");
  copyBtn.className = "btn-mini focus:outline focus:ring-2 focus:ring-blue-400";
  copyBtn.textContent = "📋 Copy";
  copyBtn.setAttribute("aria-label", "Copy text");
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(item.text)
      .then(() => alert("Copied!"))
      .catch(() => alert("Failed to copy"));
  });

  const copyWrapper = document.createElement("div");
  copyWrapper.className = "flex justify-end mt-2";
  copyWrapper.appendChild(copyBtn);

  const folderDropdown = document.createElement("select");
  folderDropdown.className = "border rounded text-sm px-2 py-1 mt-1 focus:outline focus:ring-2 focus:ring-blue-400";
  const folderOptions = Array.from(new Set(["Uncategorized", ...folders]));
  folderOptions.forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f;
    opt.textContent = f;
    if ((item.folder || "Uncategorized") === f) opt.selected = true;
    folderDropdown.appendChild(opt);
  });
  folderDropdown.addEventListener("change", (e) => {
    const updated = getLibrary();
    const match = updated.find((x) => x.timestamp === item.timestamp);
    if (!match) return;
    match.folder = e.target.value;
    saveLibrary(updated);
    loadLibrary(e.target.value);
    populateSidebar();
  });

  card.appendChild(titleInput);
  card.appendChild(meta);
  card.appendChild(pre);
  card.appendChild(copyWrapper);
  card.appendChild(folderDropdown);
  return card;
}

function loadLibrary(activeFolder = null) {
  const container = $("libraryContainer");
  const all = getLibrary();
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
    const defaultFolder = "Uncategorized";
    document.querySelectorAll(".folder-sidebar li").forEach((el) => {
      el.classList.remove("active");
      if (el.dataset.folder === defaultFolder) el.classList.add("active");
    });
    loadLibrary(defaultFolder);
    return;
  }

  if (items.length === 0) {
    const msg = document.createElement("div");
    msg.className = "text-center text-gray-400 text-sm py-6";
    msg.textContent = "No saved items yet.";
    container.appendChild(msg);
    return;
  }

  items.forEach((item) => {
    const card = renderLibraryCard(item, folders);
    container.appendChild(card);
  });
}

function populateSidebar() {
  const sidebar = $("folderList");
  const folders = getFolders();
  sidebar.innerHTML = "";

  const all = getLibrary();
  const foldersInUse = [...new Set(all.map((i) => i.folder || "Uncategorized"))];
  const allFolders = Array.from(new Set(["Favorites", ...folders, ...foldersInUse])).filter(Boolean);

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
  const saved = getLibrary();
  const i = saved.findIndex((item) => item.timestamp === timestamp);
  if (i > -1) {
    saved[i].favorite = !saved[i].favorite;
    saveLibrary(saved);
    loadLibrary();
  }
}

function deleteItem(timestamp) {
  const saved = getLibrary().filter((item) => item.timestamp !== timestamp);
  saveLibrary(saved);
  loadLibrary();
  populateSidebar();
}

function setupLibraryUI() {
  $("createFolderBtn")?.addEventListener("click", () => {
    const name = $("newFolderInput").value.trim();
    if (!name) return;
    const folders = getFolders();
    if (!folders.includes(name)) {
      folders.push(name);
      saveFolders(folders);
      populateSidebar();
    }
    $("newFolderInput").value = "";
  });

  $("deleteFolderBtn")?.addEventListener("click", () => {
    const active = document.querySelector(".folder-sidebar .active")?.dataset.folder;
    if (!active || active === "Favorites") return;
    const folders = getFolders().filter((f) => f !== active);
    saveFolders(folders);
    const saved = getLibrary();
    saved.forEach((item) => {
      if (item.folder === active) item.folder = "Uncategorized";
    });
    saveLibrary(saved);
    populateSidebar();
    loadLibrary("Uncategorized");
  });

  $("clearLibrary")?.addEventListener("click", () => {
    if (confirm("Clear all saved items?")) {
      localStorage.removeItem("library");
      loadLibrary();
      populateSidebar();
    }
  });

  fetch("/api/user-status")
    .then((res) => res.json())
    .then((data) => {
      const badge = $("userStatusBadge");
      if (!badge) return;

      const usageCounter = $("usageCounter");
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
      const badge = $("userStatusBadge");
      if (badge) badge.textContent = "⚠️ Error";
    });
}

document.addEventListener("DOMContentLoaded", () => {
  setupLibraryUI();
  populateSidebar();
  loadLibrary();
});
