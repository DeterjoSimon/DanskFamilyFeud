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

### Android app (Samsung Galaxy etc.)

[`android/`](android/) is a small native Android project (Kotlin) that bundles the web app inside the APK. It runs
fully offline, with no hosting needed. On top of the web version it adds:

- **Share CSV / backup** via the Android share sheet (Drive, Gmail, Quick Share, …)
- **Save to Downloads** → `Downloads/FamilyFeud/`
- the system file picker for importing a backup
- the hardware/gesture **back** button (closes a sheet → goes up a level → exits on the home screen)

The web files in `app/` are copied into the APK on every build, so the phone app and the website never drift apart.

**Install from Android Studio (USB or wireless debugging)**

1. Android Studio → **File → Open** → choose the `android/` folder (not the repo root). Let Gradle sync finish.
2. On the phone: *Settings → Developer options → USB debugging* (or *Wireless debugging*) on, then connect it.
3. Pick the phone in the device dropdown and press **Run ▶**. The app *Feud Collector* stays installed afterwards.

**Or download the APK from GitHub:** the *Build Android APK* workflow uploads `feud-collector-debug-apk` as an
artifact on every PR and push to `main`. Unzip it, copy `app-debug.apk` to the phone, open it and allow installs
from that app.

> ⚠️ An APK built on GitHub and one built in your Android Studio are signed with different debug keys. Switching
> between them means uninstalling first, **which deletes the answers stored in the app**. Pick one route, or make a
> backup (*Data & backup → Save backup to Downloads*) before switching and import it afterwards.

Command line: `cd android && ./gradlew assembleDebug` (needs the Android SDK; Android Studio installs it).

### Web version (any phone, via GitHub Pages)

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
