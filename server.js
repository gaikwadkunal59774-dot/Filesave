require("dotenv").config();
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const APP_PASSWORD = process.env.APP_PASSWORD;
if (!APP_PASSWORD) {
  console.error("APP_PASSWORD is missing. Add it to your .env file.");
  process.exit(1);
}
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.includes("replace-this")) {
  console.warn("WARNING: Set a long random SESSION_SECRET in .env before exposing this app to a network.");
}

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "savefile.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    kind TEXT NOT NULL CHECK(kind IN ('file','code')),
    language TEXT DEFAULT '',
    filename TEXT DEFAULT '',
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
const listEntries = db.prepare("SELECT id,title,description,kind,language,filename,created_at,updated_at FROM entries ORDER BY updated_at DESC");
const getEntry = db.prepare("SELECT * FROM entries WHERE id=?");
const insertEntry = db.prepare(`INSERT INTO entries(title,description,kind,language,filename,content)
 VALUES (@title,@description,@kind,@language,@filename,@content)`);
const updateEntry = db.prepare(`UPDATE entries SET title=@title,description=@description,kind=@kind,
 language=@language,filename=@filename,content=@content,updated_at=datetime('now') WHERE id=@id`);

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "2mb" }));
app.use(session({
  name: "savefile.sid",
  secret: process.env.SESSION_SECRET || "development-only-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: 8 * 60 * 60 * 1000 }
}));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: "draft-7", legacyHeaders: false });
const requireAuth = (req, res, next) => req.session.authenticated ? next() : res.status(401).json({ error: "Please log in first." });

app.post("/api/login", loginLimiter, (req, res) => {
  const password = String(req.body.password || "");
  if (password !== APP_PASSWORD) return res.status(401).json({ error: "Incorrect password." });
  req.session.authenticated = true;
  res.json({ ok: true });
});
app.post("/api/logout", requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("savefile.sid");
    res.json({ ok: true });
  });
});
app.get("/api/session", (req, res) => res.json({ authenticated: !!req.session.authenticated }));

app.get("/api/entries", requireAuth, (req, res) => res.json(listEntries.all()));
app.get("/api/entries/:id", requireAuth, (req, res) => {
  const entry = getEntry.get(Number(req.params.id));
  if (!entry) return res.status(404).json({ error: "Entry not found." });
  res.json(entry);
});
app.post("/api/entries", requireAuth, (req, res) => {
  const body = req.body || {};
  const title = String(body.title || "").trim().slice(0, 120);
  const content = String(body.content || "");
  const kind = body.kind === "file" ? "file" : "code";
  if (!title || !content.trim()) return res.status(400).json({ error: "Title and content are required." });
  if (content.length > 1_000_000) return res.status(413).json({ error: "Content is too large (maximum 1 MB)." });
  const result = insertEntry.run({
    title, description: String(body.description || "").slice(0, 1000),
    kind, language: String(body.language || "").slice(0, 40),
    filename: String(body.filename || "").slice(0, 180), content
  });
  res.status(201).json({ id: result.lastInsertRowid });
});
app.put("/api/entries/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!getEntry.get(id)) return res.status(404).json({ error: "Entry not found." });
  const body = req.body || {};
  const title = String(body.title || "").trim().slice(0, 120);
  const content = String(body.content || "");
  if (!title || !content.trim()) return res.status(400).json({ error: "Title and content are required." });
  if (content.length > 1_000_000) return res.status(413).json({ error: "Content is too large (maximum 1 MB)." });
  updateEntry.run({ id, title, description: String(body.description || "").slice(0,1000),
    kind: body.kind === "file" ? "file" : "code", language: String(body.language || "").slice(0,40),
    filename: String(body.filename || "").slice(0,180), content });
  res.json({ ok: true });
});
app.delete("/api/entries/:id", requireAuth, (req, res) => {
  const result = db.prepare("DELETE FROM entries WHERE id=?").run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Entry not found." });
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, "0.0.0.0", () => console.log(`SaveFile is running on http://localhost:${PORT}`));
