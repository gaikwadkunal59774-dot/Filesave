const $ = (id) => document.getElementById(id);
let entries = [];
let activeEntry = null;

async function api(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) showLogin();
    throw new Error(data.error || "Something went wrong.");
  }
  return data;
}
function showLogin() { $("appScreen").classList.add("hidden"); $("loginScreen").classList.remove("hidden"); }
function showApp() { $("loginScreen").classList.add("hidden"); $("appScreen").classList.remove("hidden"); }
function go(page) {
  ["dashboard","save","files"].forEach(p => $(p+"Page").classList.toggle("hidden", p !== page));
  document.querySelectorAll(".nav-link").forEach(b => b.classList.toggle("active", b.dataset.page === page));
  $("pageTitle").textContent = page === "files" ? "View files & code" : page === "save" ? "Save a file" : "Overview";
  if (page === "files") renderEntries();
  if (page === "dashboard") renderDashboard();
}
document.querySelectorAll("[data-page]").forEach(b => b.addEventListener("click", () => go(b.dataset.page)));
document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => { resetForm(); go(b.dataset.go); }));
$("loginForm").addEventListener("submit", async e => {
  e.preventDefault(); $("loginError").textContent = "";
  try { await api("/api/login", { method:"POST", body:JSON.stringify({password:$("password").value}) }); $("password").value=""; showApp(); await refresh(); }
  catch(err) { $("loginError").textContent = err.message; }
});
$("logoutBtn").addEventListener("click", async () => { try { await api("/api/logout",{method:"POST"}); } finally { showLogin(); } });
async function refresh() { entries = await api("/api/entries"); renderDashboard(); renderEntries(); }
function escapeHtml(s="") { return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function dateText(s) { return s ? new Date(s.replace(" ","T")+"Z").toLocaleDateString() : ""; }
function entryMarkup(e) {
  return `<article class="entry" data-open="${e.id}"><div class="entry-icon">${e.kind==="code"?"⌘":"▤"}</div><div class="entry-main"><strong>${escapeHtml(e.title)}</strong><small>${e.kind==="code"?"Code":"Text / file"}${e.language?" · "+escapeHtml(e.language):""}${e.filename?" · "+escapeHtml(e.filename):""}</small></div><span class="entry-date">${dateText(e.updated_at)}</span></article>`;
}
function attachOpen(container) { container.querySelectorAll("[data-open]").forEach(el => el.addEventListener("click", () => openEntry(Number(el.dataset.open)))); }
function renderDashboard() {
  $("totalCount").textContent=entries.length;
  $("codeCount").textContent=entries.filter(e=>e.kind==="code").length;
  $("fileCount").textContent=entries.filter(e=>e.kind==="file").length;
  const recent=entries.slice(0,5);
  $("recentList").innerHTML=recent.length?recent.map(entryMarkup).join(""):'<div class="empty">No saved items yet. Choose “Save new item” to get started.</div>';
  attachOpen($("recentList"));
}
function renderEntries() {
  const q=($("searchInput").value||"").toLowerCase(), kind=$("filterKind").value;
  const filtered=entries.filter(e=>(kind==="all"||e.kind===kind)&&[e.title,e.description,e.filename,e.language].join(" ").toLowerCase().includes(q));
  $("allList").innerHTML=filtered.length?filtered.map(entryMarkup).join(""):'<div class="empty">No matching items found.</div>';
  attachOpen($("allList"));
}
$("searchInput").addEventListener("input",renderEntries); $("filterKind").addEventListener("change",renderEntries);
function resetForm() {
  $("entryForm").reset(); $("entryId").value=""; $("formHeading").textContent="Save a new item";
  $("cancelEdit").classList.add("hidden"); $("saveMessage").textContent="";
}
$("cancelEdit").addEventListener("click",()=>{resetForm();go("files");});
$("entryForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const id=$("entryId").value;
  const payload={title:$("title").value,description:$("description").value,kind:$("kind").value,filename:$("filename").value,language:$("language").value,content:$("content").value};
  try {
    if(id) await api("/api/entries/"+id,{method:"PUT",body:JSON.stringify(payload)});
    else await api("/api/entries",{method:"POST",body:JSON.stringify(payload)});
    await refresh(); resetForm(); go("files"); $("saveMessage").textContent="Saved successfully.";
  } catch(err) { $("saveMessage").textContent=err.message; }
});
async function openEntry(id) {
  try {
    activeEntry=await api("/api/entries/"+id);
    $("viewerTitle").textContent=activeEntry.title;
    $("viewerMeta").textContent=[activeEntry.kind==="code"?"Code":"Text / file",activeEntry.language,activeEntry.filename,dateText(activeEntry.updated_at)].filter(Boolean).join(" · ");
    $("viewerDescription").textContent=activeEntry.description;
    $("viewerContent").textContent=activeEntry.content;
    $("viewer").classList.remove("hidden");
  } catch(err) { alert(err.message); }
}
function closeViewer() { $("viewer").classList.add("hidden"); activeEntry=null; }
$("closeViewer").addEventListener("click",closeViewer);
$("viewer").addEventListener("click",e=>{if(e.target===$("viewer"))closeViewer();});
$("copyBtn").addEventListener("click",async()=>{if(!activeEntry)return;try{await navigator.clipboard.writeText(activeEntry.content);$("copyBtn").textContent="Copied!";setTimeout(()=>$("copyBtn").textContent="Copy content",1200);}catch{alert("Clipboard access is unavailable in this browser.");}});
$("editBtn").addEventListener("click",()=>{if(!activeEntry)return;const e=activeEntry;closeViewer();$("entryId").value=e.id;$("title").value=e.title;$("description").value=e.description;$("kind").value=e.kind;$("filename").value=e.filename;$("language").value=e.language;$("content").value=e.content;$("formHeading").textContent="Edit saved item";$("cancelEdit").classList.remove("hidden");go("save");});
$("deleteBtn").addEventListener("click",async()=>{if(!activeEntry||!confirm("Delete this saved item permanently?"))return;try{await api("/api/entries/"+activeEntry.id,{method:"DELETE"});closeViewer();await refresh();}catch(err){alert(err.message);}});
(async()=>{try{const s=await api("/api/session");if(s.authenticated){showApp();await refresh();}else showLogin();}catch{showLogin();}})();
