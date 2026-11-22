import { test } from "node:test";
import assert from "node:assert/strict";
import * as L from "../app/logic.js";
import { QUESTIONS, seedAnswers } from "../app/data.js";

test("seed expands 'x4' into four answers and keeps gender", () => {
  const seed = seedAnswers();
  const sport = seed.filter((a) => a.q === 4 && a.g === "W" && a.text === "Sport");
  assert.equal(sport.length, 4);
  assert.equal(L.countBy(seed, 4).W, 7);
  assert.equal(L.countBy(seed, 4).M, 4);
  assert.equal(L.countBy(seed, 6).M, 4);
  assert.equal(new Set(seed.map((a) => a.id)).size, seed.length);
});

test("grouping is case/whitespace insensitive and sorted by count", () => {
  const a = [
    { id: "1", q: 2, g: "W", text: "Arrogance" },
    { id: "2", q: 2, g: "W", text: " arrogance." },
    { id: "3", q: 2, g: "M", text: "Astrologi" },
  ];
  const gs = L.groupAnswers(a, {}, 2, "all");
  assert.equal(gs.length, 2);
  assert.deepEqual([gs[0].label, gs[0].W, gs[0].M, gs[0].total], ["Arrogance", 2, 0, 2]);
  assert.equal(L.groupAnswers(a, {}, 2, "M")[0].label, "Astrologi");
  assert.equal(L.groupAnswers(a, {}, 2, "M").length, 1);
});

test("merge, rename and split categories", () => {
  const a = [
    { id: "1", q: 5, g: "W", text: "Skinny bitch med tequila" },
    { id: "2", q: 5, g: "M", text: "Skinny bitch" },
    { id: "3", q: 5, g: "M", text: "Sjus" },
  ];
  let aliases = {};
  const gs = L.groupAnswers(a, aliases, 5);
  const sb = gs.filter((g) => g.label.startsWith("Skinny"));
  aliases = L.mergeGroups(aliases, 5, sb, "Skinny bitch");
  let after = L.groupAnswers(a, aliases, 5);
  assert.equal(after.length, 2);
  assert.deepEqual([after[0].label, after[0].W, after[0].M], ["Skinny bitch", 1, 1]);
  // a new answer typed as the category name joins it
  after = L.groupAnswers([...a, { id: "4", q: 5, g: "W", text: "skinny BITCH" }], aliases, 5);
  assert.equal(after[0].total, 3);
  aliases = L.splitVariant(aliases, 5, "skinny bitch med tequila");
  assert.equal(L.groupAnswers(a, aliases, 5).length, 3);
});

test("board scales points to 100", () => {
  const a = [
    ...Array.from({ length: 4 }, (_, i) => ({ id: "s" + i, q: 4, g: "W", text: "Sport" })),
    ...Array.from({ length: 2 }, (_, i) => ({ id: "r" + i, q: 4, g: "W", text: "Read" })),
    { id: "b", q: 4, g: "W", text: "Brætspil" },
    { id: "m", q: 4, g: "M", text: "Musik" },
  ];
  const b = L.buildBoard(L.groupAnswers(a, {}, 4, "W"), "W", 2);
  assert.equal(b.totalAnswers, 7);
  assert.deepEqual(b.rows.map((r) => [r.label, r.points]), [["Sport", 57], ["Read", 29]]);
});

test("CSV escapes values and includes category", () => {
  const a = [{ id: "1", q: 6, g: "W", text: 'Dip & dip, "leave"', rid: "p-1", ts: "2026-01-01T00:00:00Z" }];
  const csv = L.toCSV(a, { 6: { [L.norm('Dip & dip, "leave"')]: "Dip & dip" } }, QUESTIONS);
  const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
  assert.equal(lines.length, 2);
  assert.match(lines[1], /^1,p-1,6,Worst thing after first-time sex,woman,"Dip & dip, ""leave""",/);
  assert.match(lines[1], /,Dip & dip,2026-01-01T00:00:00Z$/);
});

test("backup parse and merge by id", () => {
  assert.throws(() => L.parseBackup("{}"));
  const cur = { answers: [{ id: "1", q: 1, g: "W", text: "Bloom" }], aliases: {} };
  const inc = L.parseBackup({ answers: [{ id: "1", q: 1, g: "W", text: "Bloom" }, { id: "2", q: 1, g: "M", text: "Bar" }], aliases: { 1: { bar: "Bar" } } });
  const m = L.mergeBackup(cur, inc);
  assert.equal(m.answers.length, 2);
  assert.equal(m.aliases[1].bar, "Bar");
});
