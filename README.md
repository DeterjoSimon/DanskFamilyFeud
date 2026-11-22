# DanskFamilyFeud

New Year's game à la Family Feud — plus **Feud Collector**, a phone app for collecting the survey answers.

## Feud Collector (the phone app)

A small installable web app (PWA) in [`app/`](app/). It runs fully on the phone, works offline, and stores answers
in the phone's browser storage. There is no server and no account.

**What it does**

- **Interview someone new**: tap ♀ Woman or ♂ Man on the home screen and step through all 6 questions. Every answer is
  tagged with that person's id and gender. You can skip questions or give several answers.
- **Per-question view**: shows the question (with a Danish version to read aloud). The wording of questions 2 and 4
  switches between "guy" and "girl" depending on who is answering. Below it you see what has been answered so far,
  split by gender. Tap an existing answer to count it again, and use the suggestions while typing to avoid typos.
- **Categorise**: in *Results*, tap **Merge…**, tick duplicates ("Arrogance", "Arrogant") and merge them into one
  category. Tap a category to rename it, split a spelling back out, or delete single answers. Future answers with
  the same spelling land in the category automatically.
- **Feud board**: top 3–8 answers for all / women / men, with points scaled to 100 people. *Play mode* hides the
  answers so you can tap to reveal them during the game.
- **Export**: CSV with one row per answer (`id, respondent, question_no, question, gender, answer,
  answer_normalised, category, timestamp`) for pandas or Excel. Also a JSON backup that you can import again.

The answers collected before the app (from the original notes) are pre-loaded on first launch. `x4` was expanded into 4
answers.

### Getting it on your phone

1. Merge this branch into `main`.
2. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The workflow in
   `.github/workflows/pages.yml` then publishes `app/` to `https://<user>.github.io/<repo>/` on every push to `main`.
3. Open that URL on your phone.
   - **iPhone (Safari):** Share → *Add to Home Screen*.
   - **Android (Chrome):** ⋮ → *Install app*.

> Data lives only on the phone. Use **Data & backup → Save backup file** now and then.

### Development

```bash
npm test     # unit tests for the data logic (Node 20+)
npm start    # serve app/ on http://localhost:8080
```
