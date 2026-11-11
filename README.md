# EPR-Simex — UNICEF READY72 (static training demonstration)

**READY72 is an independent training prototype based on the attached JSX content. It is not an official UNICEF application or an authorized operational information system.**

## Quick publish with GitHub Pages

1. Create a repository named `EPR-Simex` on GitHub. **Do not select Add README, .gitignore, or license** when creating it.
2. Open **Add file → Upload files** in the repository.
3. From the extracted ZIP, upload `index.html`, `.nojekyll`, and `README.md` to the **root of `main`** (not a folder named EPR-Simex-Fresh). Ensure `index.html` appears alongside `README.md` in the Code tab.
4. Commit the files.
5. Open **Settings → Pages**. Under **Build and deployment**, change **Source** to **Deploy from a branch**. Choose **main** and **/(root)**. Save.
6. The site will be served at `https://<username>.github.io/EPR-Simex/` once GitHub Pages publishes.

**No Vite, npm, `src` folder, GitHub Actions workflow, or deployment YAML is needed.** One complete, standalone HTML file contains the training application, data, styles and JavaScript. The `.nojekyll` marker is optional but prevents Jekyll processing.

## Training functions

- Demonstration profile selection: participant, facilitator, observer, and 16 sample roles.
- Facilitator stage release for T-30 PREPARE, T-7 STRESS TEST, H0 ACTIVATE, H24 ADAPT, H72 LEARN.
- Scenario editing and activation, linked procedure references, group submissions and review notes.
- Three-day facilitator curriculum, slide presentation notes and exercise tasks.
- Simulated local mailbox, small local working documents, template downloads, and data export.

## Important limits

- This is a **single-browser demonstration**. Its user selection is **not authentication**. Data stays in browser localStorage. Do not use real names, credentials, or confidential information. Multiple participants on different devices do **not** share edits, releases, files or submissions.
- The links to UNICEF policies and procedures are carried over from the supplied prototype and may require UNICEF access; verify their applicability and currency.
- A genuine multi-user deployment requires authorized backend storage, sign-in, access controls, data protections, and institutional review. GitHub Pages alone cannot provide these capabilities.
- If browser data becomes corrupted, use the facilitator **Reset demo** button (after exporting a backup if needed).

## Local preview

Open `index.html` in any recent browser (internet is not required). For a local server, `python -m http.server 8000` and visit `http://localhost:8000/`.
