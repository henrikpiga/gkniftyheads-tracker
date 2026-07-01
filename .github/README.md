# .github/ — GitHub Automation & Repository Health

This folder contains the configuration that makes the entire **GitOps Serverless Pipeline** work with zero ongoing cost or maintenance.

It is the "engine room" of the system: GitHub Actions provides free daily compute that keeps the data fresh, while everything stays versioned in Git and instantly available via CDN.

## Folder Contents

- `workflows/daily-sync.yml` — The production automation workflow (the heart of the zero-cost model).
- `README.md` — This file. Educational guide to the automation layer.

## The Daily Sync Workflow (`daily-sync.yml`)

This is what turns the repository into a living, self-updating data platform.

### What it does every night (or on manual trigger)

1. Checks out the latest code from `main`.
2. Runs `npm install` (lightweight — scripts have almost no dependencies).
3. Executes the delta sync (new mints + burns since last run).
4. Runs the rarity calculation engine (weighted scores, surviving mint ranks, trait exposure, leaderboards).
5. Commits any changed JSON files in `/data/` with a clean, descriptive message.
6. Pushes the updates back to `main`.

Because the workflow commits directly to the repository, the entire history of supply changes, rarity shifts, mint rank movements, and leaderboard updates is permanently preserved and visible to the whole WAXFAMs community.

### How to enable it

1. Go to the **Actions** tab on the repository page.
2. Find the `daily-sync` workflow.
3. Click **"Enable workflow"**.
4. (Optional but recommended) Run it manually once to verify everything works with your current data.

You can also edit the cron schedule directly in the YAML file if you want updates more or less frequently than once per day.

### Security & Permissions

The workflow uses GitHub's default `GITHUB_TOKEN`. It has permission to push to the repository. **No repository secrets are required** for the basic pipeline. This keeps setup simple and secure.

## Why This Architecture Is Powerful

- **Zero server cost** — GitHub Actions free tier easily handles even 500k+ asset collections.
- **Fully transparent & auditable** — Every change is a Git commit. Anyone can see exactly when data was updated and what changed.
- **Instant CDN delivery** — All generated JSONs are served worldwide via jsDelivr or GitHub Pages with no extra hosting.
- **Easy to extend** — Add more collections, change weights, or migrate to a full backend later (see root README migration section).

## Customization

- Change the schedule by editing the `cron` line in `daily-sync.yml`.
- Add more jobs (e.g., weekly full re-calculation, Discord notifications) by adding new workflow files.
- The workflow is intentionally simple so the WAXFAMs team or AI developers can understand and modify it quickly.

## Relation to the Rest of the Repo

- Root `README.md` — Big-picture handbook, requirements mapping, formulas, WAX best practices, and the complete file-by-file architecture guide.
- `scripts/` — The actual logic the workflow calls.
- `data/` — Where the workflow writes its results.
- `demo/` — The beautiful public dashboard that reads the data the workflow keeps fresh.

See the root `README.md` for the full educational overview and the `scripts/README.md` for details on what each script does.

---

**This automation layer is what makes the whole GK Nifty Heads tracker long-term sustainable and community-friendly.**

*Part of gkniftyheads-tracker — built for the WAXFAMs & GK Nifty Heads community.*