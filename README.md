# Review Assigner

<img src="assets/icons/mascot-256.png" width="64" align="right" alt="Review Assigner mascot">

A Rocket.Chat App that picks code reviewers. `/review <pr>` reads the PR's CODEOWNERS teams, picks one reviewer per team (the one with the fewest open reviews), and posts one card per PR. The card follows GitHub until the PR is merged or closed.

```
/review 1234
/review Rocket.Chat.Electron#3604
/review https://github.com/RocketChat/Rocket.Chat/pull/1234 @alice
/review workload
/review ooo alice until 2026-12-01
/review link @alice AliceGh
```

On the card, **Take it** lets you pick the teams you will review for (yours come preselected), and **Reassign** replaces or removes a reviewer, or draws again. `/review workload` shows who has open reviews, and on which PRs. In the settings room, `/review ooo` and `/review link` change who is out of office and who is linked to which GitHub login, without admin access. Admins set everything else in the app settings.

## Requirements

- Rocket.Chat 7.13 or later, with private apps allowed
- A read-only GitHub token

## Getting started

```bash
npm ci
npm run check
```

## Documentation

| Doc                                    | What                                                  |
| -------------------------------------- | ----------------------------------------------------- |
| [Configuration](docs/configuration.md) | Settings, GitHub token and webhook                    |
| [Design](docs/design.md)               | How reviewers are drawn, the card, storage and limits |
| [Development](docs/development.md)     | Commands, checks, layout, running locally             |
| [Release](docs/release.md)             | Changesets, versions, install and update              |
