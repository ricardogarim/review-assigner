# Development

## Commands

```bash
npm ci
npm run check        # format, lint, typecheck, tests, package (same as CI)
npm test             # node --test on src/**/*.test.ts
npm run lint:fix
npm run format
```

| Step    | Command                | Notes                                                                        |
| ------- | ---------------------- | ---------------------------------------------------------------------------- |
| Format  | `npm run format:check` | Prettier, same settings as Rocket.Chat                                       |
| Lint    | `npm run lint`         | oxlint with `@rocket.chat/lint-config`, type-aware                           |
| Types   | `npm run typecheck`    | `tsc --noEmit`; `lib` is ES2020 to match the app compiler                    |
| Tests   | `npm test`             | Node test runner and `node:assert`, through `tsx`; no other test libraries   |
| Package | `npm run package`      | `rc-apps package` from a copy in `.build/` without tests and `core/fakes.ts` |

On a pull request, CI also requires a changeset. See [Release](release.md).

## Layout

| Folder        | Domain                                                                   |
| ------------- | ------------------------------------------------------------------------ |
| `src/review/` | Asking for a review: `/review`, PR references, CODEOWNERS, the draw      |
| `src/card/`   | The card and its buttons: blocks, labels, Take it, Reassign, permissions |
| `src/github/` | GitHub: REST client, webhook, polling, applying review status to a card  |
| `src/core/`   | Storage, chat messages, settings, types, utils, and the test fakes       |

Tests sit next to the file they test (`draw.ts` → `draw.test.ts`). `review/draw.ts`, `review/codeowners.ts`, `card/blocks.ts`, `card/labels.ts` and `github/status.ts` stay pure: no Apps-Engine runtime imports.

## Run on a local Rocket.Chat

You need Rocket.Chat 7.13 or later, with private apps allowed.

1. Create `.env.local` (git-ignored):

   ```
   RC_URL=http://localhost:3000
   RC_USER=<admin username>
   RC_PASS=<admin password>
   ```

2. Deploy: `set -a && . ./.env.local && set +a && npm run deploy`. The first run installs, later runs update and keep the settings.
3. Fill the settings (see [Configuration](configuration.md)) and run `/review <pr>` in the room.

Notes:

- Each deploy logs in again. Rocket.Chat keeps 50 sessions per user, so many deploys can log out your browser.
- To get GitHub webhooks locally, expose port 3000 with a tunnel and point the webhook at it. Close the tunnel after.
