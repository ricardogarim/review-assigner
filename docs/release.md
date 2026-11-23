# Release

Versions come from [Changesets](https://github.com/changesets/changesets).

## In each pull request

```bash
npm run changeset
```

Choose `patch` for a fix, `minor` for a new feature, `major` for a change that needs admins to act. Write one or two lines for admins. Commit the new file in `.changeset/`.

A change with nothing to release (docs, CI) still needs one: `npx changeset add --empty`.

## Release

When pull requests with changesets reach `main`, the **Release** workflow opens or updates a pull request named "chore: version packages". It runs `npm run version`, which:

1. bumps the version in `package.json` and writes `CHANGELOG.md`,
2. copies the version to `app.json` (Rocket.Chat reads it from there).

When you merge that pull request, the workflow packages the app and creates a GitHub release `vX.Y.Z` with `review-assigner_X.Y.Z.zip` and the changelog section.

To do the same by hand: `npm run version`, then `npm run package`. The zip is in `dist/`.

## Install or update a workspace

1. Download the zip from the GitHub release.
2. In **Administration → Apps → Private apps**, upload it. An update keeps the settings.
3. Read the release notes for new settings.

The bot avatar comes from `icon.png` only at the first install. Do not rename or remove a setting after a release: Rocket.Chat keeps old settings on the settings page.
