import { QUESTIONS, seedAnswers } from "./data.js";
import * as L from "./logic.js";

const STORE_KEY = "feud.data.v1";
const PREFS_KEY = "feud.prefs.v1";
const SESSION_KEY = "feud.session.v1";
// Set by the Android app (android/), absent in the browser.
const Native = window.AndroidBridge || null;
const GENDER_NAME = { W: "Woman", M: "Man" };
const GENDER_PLURAL = { W: "Women", M: "Men" };
const g2c = (g) => (g === "W" ? "w" : "m");

const ICON = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>',
  data: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg>',
};

// ---------- storage ----------
let storageOk = true;
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    storageOk = false;
    return fallback;
  }
}
function writeJSON(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    storageOk = false;
  }
}

function loadDb() {
  const d = readJSON(STORE_KEY, null);
  if (d && Array.isArray(d.answers)) return { answers: d.answers, aliases: d.aliases || {}, lastBackup: d.lastBackup || null };
  const fresh = { answers: seedAnswers(), aliases: {}, lastBackup: null };
  writeJSON(STORE_KEY, fresh);
  return fresh;
}

let db = loadDb();
let prefs = { gender: "W", filter: "all", tab: "groups", boardSize: 5, hideInstall: false, ...readJSON(PREFS_KEY, {}) };
let session = readJSON(SESSION_KEY, null);

const save = () => writeJSON(STORE_KEY, db);
const savePrefs = () => writeJSON(PREFS_KEY, prefs);
const saveSession = () => writeJSON(SESSION_KEY, session);

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// ---------- helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const app = $("#app");
const qById = (id) => QUESTIONS.find((q) => q.id === id);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}
function timeAgo(ts) {
  if (!ts) return "";
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
function respondentIds() {
  return new Set(db.answers.map((a) => a.rid).filter(Boolean));
}

let toastTimer = null;
function toast(msg, opts = {}) {
  const el = $("#toast");
  el.innerHTML = `<span>${esc(msg)}</span>${opts.undo ? '<button type="button" data-toast-undo>Undo</button>' : ""}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  if (opts.undo) {
    el.querySelector("[data-toast-undo]").onclick = () => {
      opts.undo();
      el.hidden = true;
    };
  }
  toastTimer = setTimeout(() => (el.hidden = true), opts.ms ?? (opts.undo ? 4000 : 2600));
}

function topbar({ left, title, sub, right = "" }) {
  return `<header class="topbar">${left || ""}<h1>${esc(title)}${sub ? ` <span class="sub">${esc(sub)}</span>` : ""}</h1>${right}</header>`;
}
const backBtn = (href, icon = ICON.back, label = "Back") =>
  `<a class="icon-btn" href="${href}" aria-label="${label}">${icon}</a>`;

// ---------- answers ----------
function addAnswer(qid, g, text) {
  const t = String(text).trim().replace(/\s+/g, " ");
  if (!t) return null;
  const a = { id: uid(), q: qid, g, text: t, rid: session ? session.rid : null, ts: new Date().toISOString() };
  db.answers.push(a);
  save();
  if (navigator.vibrate) navigator.vibrate(15);
  toast(`Added “${t}” · ${GENDER_NAME[g]}`, {
    ms: 1000,
    undo: () => {
      removeAnswer(a.id);
      rerender();
    },
  });
  return a;
}
function removeAnswer(id) {
  db.answers = db.answers.filter((a) => a.id !== id);
  save();
}

// ---------- router ----------
function route() {
  const h = location.hash.replace(/^#\/?/, "");
  const [view, arg] = h.split("/");
  const id = Number(arg);
  return { view: view || "home", id: qById(id) ? id : 1 };
}
let current = route();
function rerender() {
  current = route();
  closeSheet();
  ({ home: viewHome, q: viewQuestion, stats: viewStats, data: viewData }[current.view] || viewHome)(current.id);
}
window.addEventListener("hashchange", () => {
  window.scrollTo(0, 0);
  rerender();
});

// ---------- home ----------
function viewHome() {
  const people = respondentIds().size;
  const isStandalone = Native || matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  const items = QUESTIONS.map((q) => {
    const c = L.countBy(db.answers, q.id);
    const top = L.groupAnswers(db.answers, db.aliases, q.id, "all").slice(0, 3).map((g) => g.label);
    return `<a class="q-item" href="#/q/${q.id}" style="text-decoration:none;color:inherit">
      <span class="q-num">${q.id}</span>
      <span style="min-width:0"><div class="q-title">${esc(q.short)}</div>
        <div class="q-top">${top.length ? esc(top.join(" · ")) : "No answers yet"}</div></span>
      <span class="q-counts"><span class="pill w">♀ ${c.W}</span><span class="pill m">♂ ${c.M}</span></span>
    </a>`;
  }).join("");

  const sessionCard = session
    ? `<div class="person-banner ${g2c(session.g)}"><span>Person #${session.no} (${GENDER_NAME[session.g]}) in progress</span>
        <span style="display:flex;gap:6px"><a class="btn" style="min-height:38px;color:var(--text)" href="#/q/${session.qid || 1}">Continue</a></span></div>`
    : "";

  app.innerHTML = `
    ${topbar({ title: "Feud Collector", sub: "DK", right: `<a class="icon-btn" href="#/data" aria-label="Data and export">${ICON.data}</a>` })}
    <main>
      ${!storageOk ? `<div class="card" style="border-color:var(--danger)"><b>Storage is blocked.</b> <span class="note">Answers will be lost when you close this tab. Turn off private browsing.</span></div>` : ""}
      ${sessionCard}
      <div class="section-title" style="margin-top:4px">Interview someone new</div>
      <div class="hero-actions">
        <button class="btn w" data-act="start" data-g="W">♀ Woman<small>Ask all 6 questions</small></button>
        <button class="btn m" data-act="start" data-g="M">♂ Man<small>Ask all 6 questions</small></button>
      </div>
      <div class="section-title">Questions · ${db.answers.length} answers${people ? ` · ${people} people interviewed` : ""}</div>
      <div class="q-list">${items}</div>
      ${
        !isStandalone && !prefs.hideInstall
          ? `<div class="card" style="margin-top:16px"><b>Put it on your home screen</b>
             <p class="note" style="margin:6px 0 10px">iPhone (Safari): tap <b>Share</b> → <b>Add to Home Screen</b>. Android (Chrome): menu <b>⋮</b> → <b>Install app</b>. It then opens full-screen and works offline.</p>
             <div class="two" style="display:flex;gap:8px">${deferredInstall ? '<button class="btn primary" data-act="install">Install</button>' : ""}<button class="btn" data-act="hide-install">Got it</button></div></div>`
          : ""
      }
    </main>`;
}

// ---------- question screen ----------
function viewQuestion(qid, keepTyped = false) {
  const q = qById(qid);
  const g = session ? session.g : prefs.gender;
  if (session) {
    session.qid = qid;
    saveSession();
  }
  const prevValue = keepTyped ? $("#entry")?.value || "" : "";
  const left = session
    ? `<button class="icon-btn" data-act="end-session" aria-label="End this person">${ICON.close}</button>`
    : backBtn("#/");
  const right = `<a class="icon-btn" href="#/stats/${qid}" aria-label="Results">${ICON.chart}</a>`;

  app.innerHTML = `
    ${topbar({ left, title: session ? `Person #${session.no}` : `Question ${qid}`, sub: session ? GENDER_NAME[g] : `of ${QUESTIONS.length}`, right })}
    <main>
      ${session ? personBanner(qid) : ""}
      <div class="card q-head">
        <div class="kicker">Q${qid} · ${esc(q.short)}</div>
        <div class="question">${esc(q.text[g])}</div>
        <div class="da">🇩🇰 ${esc(q.da[g])}</div>
        <div class="segmented">
          <button type="button" data-act="gender" data-g="W" class="w ${g === "W" ? "active" : ""}" ${session ? "disabled" : ""}>♀ Woman <span id="cnt-W"></span></button>
          <button type="button" data-act="gender" data-g="M" class="m ${g === "M" ? "active" : ""}" ${session ? "disabled" : ""}>♂ Man <span id="cnt-M"></span></button>
        </div>
        <form class="entry" id="entry-form" autocomplete="off">
          <input id="entry" type="text" placeholder="Type ${g === "W" ? "her" : "his"} answer…" enterkeyhint="send"
            autocapitalize="sentences" autocorrect="off" spellcheck="false" maxlength="120" aria-label="Answer">
          <button class="btn primary keep-focus" type="submit" aria-label="Add answer">+</button>
        </form>
        <div class="suggest" id="suggest"></div>
      </div>
      <div class="card" id="so-far"></div>
      <div class="card" id="recent"></div>
    </main>
    <nav class="bottombar" id="bottombar"></nav>`;

  const input = $("#entry");
  input.value = prevValue;
  $("#entry-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (addAnswer(qid, g, input.value)) {
      input.value = "";
      updateQuestionParts(qid);
    }
    input.focus();
  });
  input.addEventListener("input", () => renderSuggestions(qid, g, input.value));
  updateQuestionParts(qid);
}

function personBanner(qid) {
  const mine = new Set(db.answers.filter((a) => a.rid === session.rid).map((a) => a.q));
  const bars = QUESTIONS.map((q) => `<i class="${q.id === qid ? "cur" : mine.has(q.id) ? "done" : ""}"></i>`).join("");
  return `<div class="person-banner ${g2c(session.g)}"><span>${GENDER_NAME[session.g]} · question ${qid}/${QUESTIONS.length}</span><span class="progress">${bars}</span></div>`;
}

function chip(group, g, interactive) {
  const n = group[g] || 0;
  const inner = `<span class="t">${esc(group.label)}</span><span class="c">${n}</span>`;
  return interactive
    ? `<button type="button" class="chip ${g2c(g)} keep-focus" data-act="plus" data-text="${esc(group.label)}" title="Tap to add another “${esc(group.label)}”">${inner}</button>`
    : `<span class="chip ${g2c(g)}">${inner}</span>`;
}

let showOther = false;
function updateQuestionParts(qid) {
  const g = session ? session.g : prefs.gender;
  const other = g === "W" ? "M" : "W";
  const c = L.countBy(db.answers, qid);
  $("#cnt-W").textContent = `(${c.W})`;
  $("#cnt-M").textContent = `(${c.M})`;

  const mine = L.groupAnswers(db.answers, db.aliases, qid, g);
  const theirs = L.groupAnswers(db.answers, db.aliases, qid, other);
  $("#so-far").innerHTML = `
    <div class="so-far-head"><h2>So far · ${GENDER_PLURAL[g]} <span class="pill ${g2c(g)}">${c[g]}</span></h2>
      <a class="link" href="#/stats/${qid}">Results ›</a></div>
    ${mine.length ? `<div class="chips">${mine.map((x) => chip(x, g, true)).join("")}</div><p class="hint">Tap an answer to count it again.</p>` : `<div class="empty">No answers from ${GENDER_PLURAL[g].toLowerCase()} yet.</div>`}
    <div class="so-far-head" style="margin-top:14px;margin-bottom:${showOther ? 10 : 0}px"><h2 style="color:var(--muted)">${GENDER_PLURAL[other]} <span class="pill ${g2c(other)}">${c[other]}</span></h2>
      <button type="button" class="link" data-act="toggle-other">${showOther ? "Hide" : "Show"}</button></div>
    ${showOther ? (theirs.length ? `<div class="chips">${theirs.map((x) => chip(x, other, false)).join("")}</div>` : `<div class="empty">None yet.</div>`) : ""}`;

  const recent = db.answers
    .filter((a) => a.q === qid && (!session || a.rid === session.rid))
    .sort((a, b) => (b.ts || "").localeCompare(a.ts || ""))
    .slice(0, session ? 10 : 5);
  $("#recent").innerHTML = `
    <div class="so-far-head"><h2>${session ? "This person's answers" : "Latest entries"}</h2></div>
    ${
      recent.length
        ? `<ul class="recent">${recent
            .map(
              (a) => `<li><span class="pill ${g2c(a.g)}">${a.g === "W" ? "♀" : "♂"}</span><span class="t">${esc(a.text)}</span>
              <span class="time">${timeAgo(a.ts)}</span><button type="button" class="x-btn" data-act="del" data-id="${esc(a.id)}" aria-label="Delete ${esc(a.text)}">✕</button></li>`
            )
            .join("")}</ul>`
        : `<div class="empty">${session ? "Nothing yet — type the answer above, or skip." : "Nothing yet."}</div>`
    }`;

  const bb = $("#bottombar");
  if (session) {
    const answered = db.answers.some((a) => a.rid === session.rid && a.q === qid);
    const last = qid === QUESTIONS.length;
    bb.innerHTML = `<button class="btn" data-act="go" data-q="${qid - 1}" ${qid === 1 ? "disabled" : ""}>‹ Back</button>
      <button class="btn grow ${answered ? "primary" : ""}" data-act="${last ? "finish" : "go"}" data-q="${qid + 1}">
        ${last ? "Finish ✓" : answered ? "Next question ›" : "Skip ›"}</button>`;
    const banner = $(".person-banner");
    if (banner) banner.outerHTML = personBanner(qid);
  } else {
    bb.innerHTML = `<button class="btn" data-act="go" data-q="${qid - 1}" ${qid === 1 ? "disabled" : ""}>‹ Prev</button>
      <a class="btn" href="#/stats/${qid}" style="text-decoration:none;color:inherit">Results</a>
      <button class="btn" data-act="go" data-q="${qid + 1}" ${qid === QUESTIONS.length ? "disabled" : ""}>Next ›</button>`;
  }
  renderSuggestions(qid, g, $("#entry").value);
}

function renderSuggestions(qid, g, typed) {
  const box = $("#suggest");
  const n = L.norm(typed);
  if (n.length < 2) {
    box.innerHTML = "";
    return;
  }
  const groups = L.groupAnswers(db.answers, db.aliases, qid, "all");
  const hits = groups
    .filter((x) => x.key !== n && (L.norm(x.label).includes(n) || x.variants.some((v) => v.norm.includes(n))))
    .slice(0, 4);
  box.innerHTML = hits
    .map((x) => `<button type="button" class="keep-focus" data-act="plus" data-text="${esc(x.label)}" data-clear="1">+ ${esc(x.label)}</button>`)
    .join("");
}

// ---------- results / categorise ----------
let selectMode = false;
let selected = new Set();
let revealed = new Set();
let playMode = false;
let lastStatsQ = null;

function viewStats(qid) {
  const q = qById(qid);
  if (lastStatsQ !== qid) {
    selectMode = false;
    selected = new Set();
    revealed = new Set();
    lastStatsQ = qid;
  }
  const f = prefs.filter;
  const groups = L.groupAnswers(db.answers, db.aliases, qid, f);
  const c = L.countBy(db.answers, qid);
  const filterBtn = (val, label, cls = "") =>
    `<button type="button" data-act="filter" data-f="${val}" class="${cls} ${f === val ? "active" : ""}">${label}</button>`;

  let body;
  if (prefs.tab === "board") {
    const board = L.buildBoard(groups, f, prefs.boardSize);
    body = board.rows.length
      ? `<div class="board">${board.rows
          .map(
            (r) => `<button type="button" class="board-row ${playMode && !revealed.has(r.rank) ? "hidden" : ""}" data-act="reveal" data-rank="${r.rank}">
              <span class="n">${r.rank}</span><span class="a">${esc(r.label)}</span><span class="p">${r.points}</span></button>`
          )
          .join("")}</div>
         <p class="board-meta">Points = share of ${board.totalAnswers} answers, scaled to 100 people. The top ${board.rows.length} cover ${board.covered} of 100.</p>
         <div class="size-pick"><span>Answers on board</span>${[3, 4, 5, 6, 7, 8]
           .map((n) => `<button type="button" data-act="size" data-n="${n}" class="${prefs.boardSize === n ? "active" : ""}">${n}</button>`)
           .join("")}</div>
         <div style="display:flex;gap:8px;margin-top:12px">
           <button type="button" class="btn ${playMode ? "primary" : ""}" data-act="play" style="flex:1">${playMode ? "Play mode on · tap to reveal" : "Play mode (hide answers)"}</button>
         </div>`
      : `<div class="empty">No answers for this filter yet.</div>`;
  } else {
    const max = Math.max(1, ...groups.map((x) => x.total));
    body = groups.length
      ? `<div class="so-far-head"><span class="note">${groups.length} categories. Tap one to rename, split or delete.</span>
          <button type="button" class="link" data-act="select-mode">${selectMode ? "Done" : "Merge…"}</button></div>
        <ul class="group-list">${groups
          .map((x, i) => {
            const vtext = x.variants.length > 1 || x.alias ? x.variants.map((v) => v.text).join(", ") : "";
            return `<li><button type="button" class="group" data-act="${selectMode ? "toggle-sel" : "open-group"}" data-key="${esc(x.key)}">
              ${selectMode ? `<span class="check ${selected.has(x.key) ? "on" : ""}">${selected.has(x.key) ? "✓" : ""}</span>` : `<span class="rank">${i + 1}</span>`}
              <span style="min-width:0"><div class="label">${esc(x.label)}</div>${vtext ? `<div class="variants">${esc(vtext)}</div>` : ""}
                <div class="bar" style="width:${Math.max(8, (x.total / max) * 100)}%"><span class="bw" style="flex:${x.W}"></span><span class="bm" style="flex:${x.M}"></span></div></span>
              <span class="counts"><span class="pill w">${x.W}</span><span class="pill m">${x.M}</span></span>
            </button></li>`;
          })
          .join("")}</ul>`
      : `<div class="empty">No answers for this filter yet.</div>`;
  }

  app.innerHTML = `
    ${topbar({ left: backBtn(`#/q/${qid}`), title: `Q${qid} results`, sub: q.short })}
    <main>
      <div class="tabs">
        <button type="button" data-act="tab" data-t="groups" class="${prefs.tab !== "board" ? "active" : ""}">Categories</button>
        <button type="button" data-act="tab" data-t="board" class="${prefs.tab === "board" ? "active" : ""}">Feud board</button>
      </div>
      <div class="filters">${filterBtn("all", `All ${c.total}`)}${filterBtn("W", `♀ Women ${c.W}`, "w")}${filterBtn("M", `♂ Men ${c.M}`, "m")}</div>
      <div class="card">${body}</div>
    </main>
    ${
      selectMode && prefs.tab !== "board"
        ? `<div class="merge-bar"><button class="btn" data-act="select-mode">Cancel</button>
           <button class="btn primary" data-act="merge" ${selected.size < 2 ? "disabled" : ""}>Merge ${selected.size || ""}</button></div>`
        : `<nav class="bottombar"><button class="btn" data-act="stats-go" data-q="${qid - 1}" ${qid === 1 ? "disabled" : ""}>‹ Q${qid - 1 || ""}</button>
           <a class="btn grow" href="#/q/${qid}" style="text-decoration:none;color:inherit">Add answers</a>
           <button class="btn" data-act="stats-go" data-q="${qid + 1}" ${qid === QUESTIONS.length ? "disabled" : ""}>Q${qid < QUESTIONS.length ? qid + 1 : ""} ›</button></nav>`
    }`;
}

function groupsAll(qid) {
  return L.groupAnswers(db.answers, db.aliases, qid, "all");
}

function openGroupSheet(qid, key) {
  const x = groupsAll(qid).find((gr) => gr.key === key);
  if (!x) return closeSheet();
  const variants =
    x.variants.length > 1 || x.alias
      ? `<div class="section-title">Spellings in this category</div>${x.variants
          .map(
            (v) => `<div class="row"><span class="t">${esc(v.text)}</span><span class="pill n">${v.count}</span>
            ${db.aliases[qid] && db.aliases[qid][v.norm] && x.variants.length > 1 ? `<button class="small-btn" data-act="split" data-norm="${esc(v.norm)}" data-key="${esc(key)}">Split out</button>` : ""}</div>`
          )
          .join("")}`
      : "";
  openSheet(
    `<h2>${esc(x.label)}</h2>
     <div class="sub"><span class="pill w">♀ ${x.W}</span> <span class="pill m">♂ ${x.M}</span> · ${x.total} total</div>
     <form id="rename-form" style="display:flex;gap:8px"><input type="text" id="rename" value="${esc(x.label)}" aria-label="Category name" autocomplete="off">
       <button class="btn primary" type="submit">Rename</button></form>
     ${variants}
     <div class="section-title">Individual answers</div>
     ${x.answers
       .map(
         (a) => `<div class="row"><span class="pill ${g2c(a.g)}">${a.g === "W" ? "♀" : "♂"}</span><span class="t">${esc(a.text)}</span>
         <span class="time note" style="font-size:12px">${timeAgo(a.ts)}</span><button class="x-btn" data-act="del-in-sheet" data-id="${esc(a.id)}" data-key="${esc(key)}" aria-label="Delete">✕</button></div>`
       )
       .join("")}
     <div class="actions"><button class="btn" data-act="close-sheet">Close</button></div>`,
    () => {
      $("#rename-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const name = $("#rename").value.trim();
        if (!name) return;
        db.aliases = L.mergeGroups(db.aliases, qid, [x], name);
        save();
        toast(`Renamed to “${name}”`);
        rerender();
      });
    }
  );
}

function openMergeSheet(qid) {
  const gs = groupsAll(qid).filter((x) => selected.has(x.key)).sort((a, b) => b.total - a.total);
  if (gs.length < 2) return;
  openSheet(
    `<h2>Merge ${gs.length} categories</h2>
     <div class="sub">${esc(gs.map((x) => x.label).join(" + "))} = ${gs.reduce((s, x) => s + x.total, 0)} answers</div>
     <form id="merge-form"><input type="text" id="merge-name" value="${esc(gs[0].label)}" aria-label="New category name" autocomplete="off">
       <div class="suggest" style="margin:10px 0 4px">${gs.map((x) => `<button type="button" data-act="merge-pick" data-text="${esc(x.label)}">${esc(x.label)}</button>`).join("")}</div>
       <div class="actions two"><button type="button" class="btn" data-act="close-sheet">Cancel</button><button class="btn primary" type="submit">Merge</button></div></form>`,
    () => {
      $("#merge-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const name = $("#merge-name").value.trim();
        if (!name) return;
        db.aliases = L.mergeGroups(db.aliases, qid, gs, name);
        save();
        selectMode = false;
        selected = new Set();
        toast(`Merged into “${name}”`);
        rerender();
      });
    }
  );
}

// ---------- data / export ----------
function viewData() {
  const people = respondentIds().size;
  const w = db.answers.filter((a) => a.g === "W").length;
  app.innerHTML = `
    ${topbar({ left: backBtn("#/"), title: "Data & backup" })}
    <main>
      <div class="card"><div class="stat-grid">
        <div class="stat"><b>${db.answers.length}</b><span>answers</span></div>
        <div class="stat"><b style="color:var(--w)">${w}</b><span>from women</span></div>
        <div class="stat"><b style="color:var(--m)">${db.answers.length - w}</b><span>from men</span></div>
      </div><p class="note" style="margin:10px 2px 0">${people} ${people === 1 ? "person" : "people"} interviewed in the app. Last backup: ${db.lastBackup ? timeAgo(db.lastBackup) : "never"}.</p></div>

      <div class="section-title">Export for analysis</div>
      <div class="card data-actions">
        <button class="btn primary block" data-act="export" data-kind="csv" data-dest="share">${Native ? "Share CSV…" : "Export CSV (one row per answer)"}</button>
        ${Native ? '<button class="btn block" data-act="export" data-kind="csv" data-dest="downloads">Save CSV to Downloads</button>' : ""}
        <p class="note" style="margin:0">Columns: <code>respondent</code>, <code>question_no</code>, <code>gender</code>, <code>answer</code>, <code>answer_normalised</code>, <code>category</code>, <code>timestamp</code>. Open it in Excel or <code>pandas.read_csv</code>.</p>
      </div>

      <div class="section-title">Backup</div>
      <div class="card data-actions">
        <button class="btn block" data-act="export" data-kind="json" data-dest="share">${Native ? "Share backup file (.json)…" : "Save backup file (.json)"}</button>
        ${Native ? '<button class="btn block" data-act="export" data-kind="json" data-dest="downloads">Save backup to Downloads</button>' : ""}
        <button class="btn block" data-act="import" data-mode="merge">Import backup, keep current answers</button>
        <button class="btn block" data-act="import" data-mode="replace">Restore backup, replace everything</button>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
        <p class="note" style="margin:0">Answers are stored only on this phone. Save a backup now and then (to Files, Drive or e-mail) so nothing is lost if ${Native ? "the app is uninstalled" : "the browser data is cleared"}.</p>
      </div>

      <div class="section-title">Danger zone</div>
      <div class="card data-actions">
        <button class="btn block danger" data-act="reset-seed">Reset to the original answers</button>
        <button class="btn block danger" data-act="wipe">Delete all answers</button>
      </div>
    </main>`;

  $("#import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const incoming = L.parseBackup(await file.text());
      if (importMode === "replace") {
        if (!confirm(`Replace all ${db.answers.length} current answers with ${incoming.answers.length} from the backup?`)) return;
        db = { ...incoming, lastBackup: db.lastBackup };
      } else {
        const before = db.answers.length;
        db = { ...L.mergeBackup(db, incoming), lastBackup: db.lastBackup };
        toast(`Imported ${db.answers.length - before} new answers`);
      }
      save();
      rerender();
    } catch (err) {
      alert(`Could not import: ${err.message}`);
    }
  });
}
let importMode = "merge";

async function shareOrDownload(filename, mime, content, dest = "share") {
  if (Native) {
    if (dest === "downloads") {
      const err = Native.saveToDownloads(filename, mime, content);
      if (err) {
        alert(`Could not save: ${err}`);
        return false;
      }
      toast(`Saved to Downloads/FamilyFeud/${filename}`);
      return true;
    }
    Native.shareFile(filename, mime, content);
    return true;
  }
  const blob = new Blob([content], { type: mime });
  const file = new File([blob], filename, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return true;
    } catch (err) {
      if (err && err.name === "AbortError") return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

// ---------- sheet ----------
function openSheet(html, after) {
  const sheet = $("#sheet");
  sheet.innerHTML = `<div class="grab"></div>${html}`;
  sheet.hidden = false;
  $("#toast").hidden = true;
  $("#sheet-backdrop").hidden = false;
  if (after) after();
}
function closeSheet() {
  $("#sheet").hidden = true;
  $("#sheet-backdrop").hidden = true;
  $("#sheet").innerHTML = "";
}
$("#sheet-backdrop").addEventListener("click", closeSheet);

// ---------- actions ----------
function go(hash) {
  if (location.hash === hash) rerender();
  else location.hash = hash;
}

const actions = {
  start(el) {
    const g = el.dataset.g;
    if (session && !confirm(`Person #${session.no} is still in progress. Start a new person anyway? (Their answers are kept.)`)) return;
    session = { rid: "p-" + uid().slice(0, 8), g, no: respondentIds().size + 1, qid: 1, startedAt: new Date().toISOString() };
    saveSession();
    go("#/q/1");
  },
  "end-session"() {
    const n = db.answers.filter((a) => a.rid === session.rid).length;
    if (!confirm(`Stop interviewing person #${session.no}? Their ${n} answer${n === 1 ? "" : "s"} are kept.`)) return;
    session = null;
    saveSession();
    go("#/");
  },
  finish() {
    const n = db.answers.filter((a) => a.rid === session.rid).length;
    const no = session.no;
    session = null;
    saveSession();
    toast(`Person #${no} done · ${n} answer${n === 1 ? "" : "s"} saved`, { ms: 3000 });
    go("#/");
  },
  go(el) {
    const q = Number(el.dataset.q);
    if (qById(q)) go(`#/q/${q}`);
  },
  "stats-go"(el) {
    const q = Number(el.dataset.q);
    if (qById(q)) go(`#/stats/${q}`);
  },
  gender(el) {
    if (session) return;
    prefs.gender = el.dataset.g;
    savePrefs();
    viewQuestion(current.id, true);
  },
  plus(el) {
    const g = session ? session.g : prefs.gender;
    addAnswer(current.id, g, el.dataset.text);
    if (el.dataset.clear) $("#entry").value = "";
    updateQuestionParts(current.id);
  },
  del(el) {
    const a = db.answers.find((x) => x.id === el.dataset.id);
    if (!a) return;
    removeAnswer(a.id);
    toast(`Deleted “${a.text}”`, {
      undo: () => {
        db.answers.push(a);
        save();
        rerender();
      },
    });
    updateQuestionParts(current.id);
  },
  "toggle-other"() {
    showOther = !showOther;
    updateQuestionParts(current.id);
  },
  tab(el) {
    prefs.tab = el.dataset.t;
    savePrefs();
    viewStats(current.id);
  },
  filter(el) {
    prefs.filter = el.dataset.f;
    savePrefs();
    revealed = new Set();
    viewStats(current.id);
  },
  size(el) {
    prefs.boardSize = Number(el.dataset.n);
    savePrefs();
    viewStats(current.id);
  },
  play() {
    playMode = !playMode;
    revealed = new Set();
    viewStats(current.id);
  },
  reveal(el) {
    if (!playMode) return;
    const r = Number(el.dataset.rank);
    revealed.has(r) ? revealed.delete(r) : revealed.add(r);
    viewStats(current.id);
  },
  "select-mode"() {
    selectMode = !selectMode;
    selected = new Set();
    viewStats(current.id);
  },
  "toggle-sel"(el) {
    const k = el.dataset.key;
    selected.has(k) ? selected.delete(k) : selected.add(k);
    viewStats(current.id);
  },
  merge() {
    openMergeSheet(current.id);
  },
  "merge-pick"(el) {
    $("#merge-name").value = el.dataset.text;
  },
  "open-group"(el) {
    openGroupSheet(current.id, el.dataset.key);
  },
  split(el) {
    db.aliases = L.splitVariant(db.aliases, current.id, el.dataset.norm);
    save();
    viewStats(current.id);
    openGroupSheet(current.id, el.dataset.key);
  },
  "del-in-sheet"(el) {
    const a = db.answers.find((x) => x.id === el.dataset.id);
    if (!a || !confirm(`Delete the answer “${a.text}” (${GENDER_NAME[a.g]})?`)) return;
    removeAnswer(a.id);
    viewStats(current.id);
    openGroupSheet(current.id, el.dataset.key);
  },
  "close-sheet"() {
    closeSheet();
  },
  async export(el) {
    const dest = el.dataset.dest;
    if (el.dataset.kind === "csv") {
      await shareOrDownload(`family-feud-answers-${stamp()}.csv`, "text/csv", L.toCSV(db.answers, db.aliases, QUESTIONS), dest);
      return;
    }
    const payload = JSON.stringify({ app: "feud-collector", version: 1, exportedAt: new Date().toISOString(), questions: QUESTIONS, answers: db.answers, aliases: db.aliases }, null, 2);
    if (await shareOrDownload(`family-feud-backup-${stamp()}.json`, "application/json", payload, dest)) {
      db.lastBackup = new Date().toISOString();
      save();
      viewData();
    }
  },
  import(el) {
    importMode = el.dataset.mode;
    $("#import-file").click();
  },
  "reset-seed"() {
    if (!confirm("Throw away everything and go back to the answers you started with?")) return;
    db = { answers: seedAnswers(), aliases: {}, lastBackup: db.lastBackup };
    session = null;
    saveSession();
    save();
    toast("Reset to the original answers");
    viewData();
  },
  wipe() {
    if (!confirm(`Delete all ${db.answers.length} answers? This cannot be undone unless you have a backup.`)) return;
    db = { answers: [], aliases: {}, lastBackup: db.lastBackup };
    session = null;
    saveSession();
    save();
    toast("All answers deleted");
    viewData();
  },
  "hide-install"() {
    prefs.hideInstall = true;
    savePrefs();
    viewHome();
  },
  async install() {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice.catch(() => {});
    deferredInstall = null;
    viewHome();
  },
};

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) {
    e.preventDefault();
    fn(el);
  }
});
// Keep the keyboard open when tapping "+" or an answer chip while typing.
document.addEventListener("pointerdown", (e) => {
  if (e.target.closest(".keep-focus") && document.activeElement && document.activeElement.id === "entry") e.preventDefault();
});

let deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstall = e;
  if (current.view === "home") viewHome();
});

// Android back button: close what is open, else go one level up. Returns false on the home screen so the app exits.
window.feudBack = () => {
  if (!$("#sheet").hidden) {
    closeSheet();
    return true;
  }
  if (current.view === "stats" && selectMode) {
    selectMode = false;
    selected = new Set();
    viewStats(current.id);
    return true;
  }
  if (current.view === "stats") go(`#/q/${current.id}`);
  else if (current.view === "q" || current.view === "data") go("#/");
  else return false;
  return true;
};

if (!Native && "serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

rerender();
