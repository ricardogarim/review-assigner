# Design

## Flow

1. Someone runs `/review <pr> [@user ...]`.
2. The app reads the PR from GitHub. It refuses drafts and closed PRs.
3. Named users become the reviewers. Otherwise the app reads CODEOWNERS and the changed files, and draws one reviewer per **slot** (see below). If no file has an owner, it asks for a name.
4. The app posts one card in the review room and stores the PR.
5. GitHub events (webhook) or polling update the card: review status, then merged or closed. If the card message is deleted, the app stops tracking the PR.

Running `/review` again on a tracked PR adds the named users to the same card.

## Slots

Each changed file matches at most one CODEOWNERS line; the last match wins, as on GitHub. Each team named on a matched line is a slot, once per PR however many lines name it: `@org/architecture @org/backend` gives two slots, as GitHub requests both teams. A user owner (`@login`) is a one-person team.

If the app cannot read a team's members from GitHub, its slot stays without a reviewer and the person who ran `/review` is told.

## Draw

For each slot, candidates are the members of its teams, minus the PR author, deactivated Rocket.Chat users and the **Out of office** list.

- **Balanced** (default) sorts candidates by: fewest open reviews, then whoever covers more of the remaining slots, then not among the last 5 picked for that team, then random.
- **Random** picks any candidate.

Open reviews = tracked open PRs where the person is a reviewer and has not approved. They drop when the person approves or the PR closes, so there is no counter to reset.

With **One reviewer can cover several teams** on, a person who fills one slot also fills every other slot they can. Off, each team gets its own person, and one person covers two teams only when nobody else can.

## Workload

`/review workload` answers only the person who runs it. It lists everyone with open reviews, busiest first, with each PR, its review status and how many days ago it was requested. People in **Out of office** are marked. It counts the same open reviews as the draw, so review requests made only on GitHub are not in it.

## Card

```
#1234 fix: keep the unread badge in threads        ➜
by @dana · +42 −8
`backend` @alice (approved)
`frontend` bob-gh
Other reviewers: @carol
[Take it] [Reassign]
```

- Linked users show as `@username` and are mentioned. Others show as their GitHub login.
- Status shows only after a review: approved, changes requested, commented.
- One line per team, sorted by team. Someone who reviews for two teams shows on both lines.
- **Take it** opens a modal with every team on the card, the user's own teams preselected. The user can pick any team, even one they are not in, and replaces whoever had it. With no team picked, they join as an extra reviewer. **Reassign** replaces or removes a reviewer, or draws again.
- Each change from the card adds a reply in the card's thread, which also notifies the people it names.

## Storage

App persistence, by exact association:

| Record     | Key                        | Holds                                    |
| ---------- | -------------------------- | ---------------------------------------- |
| PR         | `pr:owner/repo#n`, card id | reviewers, slots, status, state, card id |
| Open PRs   | `pr-open`                  | the same records, while open             |
| Last picks | `team:<slug>`              | the last 5 logins picked for a team      |

User links, the Out of office list and the draw options live in the app settings.

## Limits

- The app never writes to GitHub. GitHub keeps its own CODEOWNERS team requests.
- The webhook URL carries a token, because the app endpoint cannot read the raw body that GitHub signs.
- The bot avatar is set from `icon.png` only when the app is installed.
- Rocket.Chat keeps a removed or renamed setting on the settings page after an update.
