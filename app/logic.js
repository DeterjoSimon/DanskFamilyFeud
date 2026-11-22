// Pure data functions (no DOM), so they can be unit tested with `node --test`.

export const GENDERS = ["W", "M"];

/** Normalise free text so "Arrogance", " arrogance." and "ARROGANCE" count as the same answer. */
export function norm(s) {
  return String(s ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?,;:]+$/, "")
    .trim();
}

/** Category name for an answer: the alias set by merging/renaming, otherwise the answer itself. */
export function categoryOf(text, qAliases) {
  const n = norm(text);
  return (qAliases && qAliases[n]) || null;
}

/**
 * Group the answers to question `q` into categories.
 * Returns groups sorted by count (for `filter`: "W", "M" or "all"), each:
 * { key, label, W, M, total, variants: [{ norm, text, count }], answers: [...] }
 */
export function groupAnswers(answers, aliases, q, filter = "all") {
  const qa = (aliases && aliases[q]) || {};
  const groups = new Map();
  for (const a of answers) {
    if (a.q !== q) continue;
    const n = norm(a.text);
    if (!n) continue;
    const alias = qa[n];
    const key = alias ? norm(alias) : n;
    let g = groups.get(key);
    if (!g) {
      g = { key, label: null, alias: null, W: 0, M: 0, total: 0, variantMap: new Map(), answers: [] };
      groups.set(key, g);
    }
    if (alias) g.alias = alias;
    g[a.g] = (g[a.g] || 0) + 1;
    g.total++;
    g.answers.push(a);
    let v = g.variantMap.get(n);
    if (!v) {
      v = { norm: n, count: 0, spellings: new Map() };
      g.variantMap.set(n, v);
    }
    v.count++;
    v.spellings.set(a.text.trim(), (v.spellings.get(a.text.trim()) || 0) + 1);
  }

  const out = [];
  for (const g of groups.values()) {
    const variants = [...g.variantMap.values()]
      .map((v) => ({ norm: v.norm, count: v.count, text: mostCommon(v.spellings) }))
      .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
    g.label = g.alias || variants[0].text;
    delete g.variantMap;
    g.variants = variants;
    g.answers.sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
    out.push(g);
  }
  const score = (g) => (filter === "all" ? g.total : g[filter] || 0);
  return out
    .filter((g) => score(g) > 0)
    .sort((a, b) => score(b) - score(a) || b.total - a.total || a.label.localeCompare(b.label));
}

function mostCommon(map) {
  let best = null;
  let bestN = -1;
  for (const [k, n] of map) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

/** Merge (or rename, with one group) groups into a single category called `name`. Returns new aliases. */
export function mergeGroups(aliases, q, groups, name) {
  const label = String(name).trim();
  if (!label) return aliases;
  const next = { ...aliases, [q]: { ...(aliases[q] || {}) } };
  for (const g of groups) {
    for (const v of g.variants) next[q][v.norm] = label;
  }
  // Make sure a future answer typed exactly as the category name lands in it too.
  next[q][norm(label)] = label;
  return next;
}

/** Take one spelling variant back out of its category. */
export function splitVariant(aliases, q, variantNorm) {
  const next = { ...aliases, [q]: { ...(aliases[q] || {}) } };
  delete next[q][variantNorm];
  return next;
}

/**
 * Family Feud board: top `size` categories, points scaled as if 100 people were surveyed.
 */
export function buildBoard(groups, filter, size) {
  const count = (g) => (filter === "all" ? g.total : g[filter] || 0);
  const totalAnswers = groups.reduce((s, g) => s + count(g), 0);
  if (!totalAnswers) return { rows: [], totalAnswers: 0, covered: 0 };
  const rows = groups.slice(0, size).map((g, i) => ({
    rank: i + 1,
    label: g.label,
    count: count(g),
    points: Math.round((count(g) / totalAnswers) * 100),
  }));
  const covered = rows.reduce((s, r) => s + r.points, 0);
  return { rows, totalAnswers, covered };
}

export function countBy(answers, q) {
  const c = { W: 0, M: 0, total: 0 };
  for (const a of answers) {
    if (a.q !== q) continue;
    c[a.g]++;
    c.total++;
  }
  return c;
}

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per answer — ready for pandas / Excel. */
export function toCSV(answers, aliases, questions) {
  const qText = Object.fromEntries(questions.map((q) => [q.id, q.short]));
  const header = ["id", "respondent", "question_no", "question", "gender", "answer", "answer_normalised", "category", "timestamp"];
  const lines = [header.join(",")];
  const sorted = [...answers].sort((a, b) => a.q - b.q || (a.ts || "").localeCompare(b.ts || ""));
  for (const a of sorted) {
    const n = norm(a.text);
    const cat = categoryOf(a.text, aliases[a.q]) || a.text.trim();
    lines.push(
      [a.id, a.rid || "", a.q, qText[a.q] || "", a.g === "W" ? "woman" : "man", a.text, n, cat, a.ts || ""]
        .map(csvCell)
        .join(",")
    );
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** Validate an imported backup. Throws on bad input. */
export function parseBackup(json) {
  const data = typeof json === "string" ? JSON.parse(json) : json;
  if (!data || !Array.isArray(data.answers)) throw new Error("Not a Family Feud backup (no answers list).");
  for (const a of data.answers) {
    if (!a || typeof a.id !== "string" || typeof a.text !== "string" || !GENDERS.includes(a.g) || !Number.isInteger(a.q)) {
      throw new Error("Backup contains an invalid answer.");
    }
  }
  return { answers: data.answers, aliases: data.aliases && typeof data.aliases === "object" ? data.aliases : {} };
}

/** Combine a backup into the current data without duplicating answers (matched by id). */
export function mergeBackup(current, incoming) {
  const seen = new Set(current.answers.map((a) => a.id));
  const answers = [...current.answers, ...incoming.answers.filter((a) => !seen.has(a.id))];
  const aliases = { ...current.aliases };
  for (const [q, map] of Object.entries(incoming.aliases || {})) {
    aliases[q] = { ...(map || {}), ...(aliases[q] || {}) };
  }
  return { answers, aliases };
}
