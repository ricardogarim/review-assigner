# Review Assigner

A Rocket.Chat App (Apps-Engine 1.58) that picks code reviewers from CODEOWNERS and keeps one card per PR up to date. One npm package, no runtime dependencies.

## Commands

```bash
npm run check                                          # same as CI
npm test                                               # all tests
node --test --require tsx src/review/draw.test.ts  # one file
npm run changeset                                      # every PR needs one
```

## Rules

- Follow Rocket.Chat conventions: `@rocket.chat/lint-config`, its Prettier settings, `type` over `interface`, `const` unless reassigned.
- Tests sit next to their file as `*.test.ts`, use `node:test` and `node:assert` only, and fake Apps-Engine accessors with `src/core/fakes.ts`.
- `src/` is split by domain: `review/`, `card/`, `github/`, `core/`. Keep `review/draw.ts`, `review/codeowners.ts`, `card/blocks.ts`, `card/labels.ts` and `github/status.ts` free of Apps-Engine runtime imports.
- Runtime code targets ES2020: the app compiler has no newer library methods.
- Never rename or remove a setting id after a release.
- Never commit `.env.local`.

## Docs

| Doc                     | When to load                             |
| ----------------------- | ---------------------------------------- |
| `docs/design.md`        | Before changing behavior                 |
| `docs/configuration.md` | Settings, token, webhook                 |
| `docs/development.md`   | Checks, layout, running locally          |
| `docs/release.md`       | Changesets, versions, install and update |
