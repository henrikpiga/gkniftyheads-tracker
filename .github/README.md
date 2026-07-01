# .github/

This folder contains GitHub-specific configuration for automation and repository health.

## workflows/

Contains the production automation:

- `daily-sync.yml` — The heart of the GitOps pipeline.

### What daily-sync.yml does

1. Triggers on a schedule (default: once per day at 02:00 UTC) **or** manually via the Actions tab.
2. Checks out the latest code.
3. Installs dependencies (`npm install`).
4. Runs the delta sync (once fully implemented) + rarity calculation.
5. Commits any changed JSON files in `/data/` with a clean message.
6. Pushes the updates back to the `main` branch.

Because everything is committed to Git, the entire history of supply changes, rarity shifts, and leaderboard movements is preserved forever and visible to the community.

### How to enable

1. Go to the **Actions** tab of the repository.
2. Click on the `daily-sync` workflow.
3. Click **"Enable workflow"** (or run it manually first to test).

You can also edit the cron schedule directly in the YAML file if you want more or less frequent updates.

### Security note

The workflow uses the default `GITHUB_TOKEN` which has permission to push to the repository. No secrets are required for the basic pipeline.

---

This automation is what makes the whole system **zero-maintenance** after the initial setup.

*Part of gkniftyheads-tracker v0.2*