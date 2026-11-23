# Configuration

An admin sets everything in **Administration → Apps → Review Assigner → Settings**.

| Setting                                | What it does                                                                                                                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **GitHub token (read-only)**           | Reads PRs, files, CODEOWNERS, reviews and team members. A classic token with `read:org` is enough for public repositories. Add repository read access for private ones. If the org uses SSO, authorize the token for it. |
| **Repositories**                       | One `owner/repo` per line. The first one is used for a bare number (`/review 123`). Use `repo#123` or the PR URL for the others.                                                                                         |
| **Room for the cards**                 | The room where cards are posted. The app user must be a member if the room is private.                                                                                                                                   |
| **Webhook URL token**                  | A secret that GitHub sends in the webhook URL.                                                                                                                                                                           |
| **Webhook active**                     | On: the webhook updates the cards and polling runs every 60 minutes. Off: polling runs every 5 minutes.                                                                                                                  |
| **Not available**                      | One GitHub login per line, optionally `login until YYYY-MM-DD`. These people are not drawn. A line with a past date stops counting.                                                                                      |
| **Draw strategy**                      | _Balanced_ (default): fewest open reviews, then whoever covers more teams, then not recently picked, then random. _Pure random_: any eligible team member.                                                               |
| **One person can cover several teams** | On (default): someone in several of the PR's teams covers all of them. Off: each team gets its own reviewer when it has someone else to pick.                                                                            |
| **User links**                         | One `rocketchat-username github-login` pair per line. Linked people are mentioned on cards and can use Take it for their teams. Unknown usernames are logged when you save.                                              |

The PR author, deactivated users and people in **Not available** are never drawn.

## GitHub webhook

Optional. Without it, polling keeps the cards up to date.

1. In GitHub, open the repository (or the organization) → **Settings → Webhooks → Add webhook**.
2. **Payload URL**: `https://<workspace>/api/apps/public/79a6aec5-9fcd-4c1f-8892-8a74ada7656b/github?token=<Webhook URL token>`
3. **Content type**: `application/json`.
4. **Events**: _Pull requests_ and _Pull request reviews_.
5. In the app settings, turn on **Webhook active**.

The app ignores events for repositories that are not in **Repositories** and for PRs it does not track.
