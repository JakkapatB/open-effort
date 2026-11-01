# Changesets

A changeset is a short note that says what a pull request changes for people who use open-effort, and whether that is a patch, minor or major change. Add one to any pull request that changes `hooks/`, `types/` or `.claude-plugin/plugin.json`:

```bash
npx changeset
```

When changesets reach `main`, a pull request titled **chore: release** opens. It raises the version in `package.json` and `.claude-plugin/plugin.json` and writes the notes into `CHANGELOG.md`. Merging it tags the release and publishes it on GitHub, and installed copies can then update.
