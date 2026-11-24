# Configuration

An admin sets everything in **Administration → Apps → Review Assigner → Settings**.

| Setting                                  | What it does                                                                                                                                                                                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub token**                         | A read-only token. It reads PRs, files, CODEOWNERS, reviews and team members. A classic token with `read:org` works for public repositories; private ones also need repository read access. If the org uses SSO, authorize the token for it. |
| **Repositories**                         | One `owner/repo` per line. `/review 1234` uses the first one; for the others, use `repo#1234` or the PR URL.                                                                                                                                 |
| **Review room**                          | Where the cards are posted. For a private room, add the app user to it first.                                                                                                                                                                |
| **Webhook secret**                       | Any random text. Put it at the end of the webhook URL as `?token=<secret>`.                                                                                                                                                                  |
| **GitHub webhook is set up**             | On: GitHub updates the cards as things happen, and the app also checks GitHub once an hour. Off: the app checks GitHub every 5 minutes.                                                                                                      |
| **Out of office**                        | People to skip when reviewers are drawn. One GitHub login per line, optionally `login until YYYY-MM-DD`. A line with a past date stops counting. You can still name them with `/review` or Reassign.                                         |
| **How reviewers are picked**             | _Balanced_ (default): fewest open reviews, then whoever covers more teams, then not recently picked, then random. _Random_: anyone in the team.                                                                                              |
| **One reviewer can cover several teams** | On (default): a person in more than one of the PR's teams covers all of them. Off: each team gets its own reviewer when someone else is available.                                                                                           |
| **Rocket.Chat and GitHub users**         | One `rocketchat-username github-login` pair per line. Linked people are mentioned on cards and can use Take it. Others show as their GitHub login. Unknown usernames are logged when you save.                                               |
| **Settings room**                        | Optional. People in this room can change **Out of office** and **Rocket.Chat and GitHub users** with slash commands. See below.                                                                                                              |

The PR author, deactivated users and people in **Out of office** are never drawn.

## Settings room

Run these commands in the **Settings room**. They change the same values as the settings page, so an admin still sees and edits them there. A change is posted in the room with the name of the person who made it. Elsewhere the commands are refused.

| Command                                                  | What it does                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `/review ooo`                                            | Lists **Out of office**.                                                        |
| `/review ooo <github-login or @user> [until YYYY-MM-DD]` | Adds the person, or changes their date. `@user` uses their linked GitHub login. |
| `/review ooo remove <github-login or @user>`             | Removes the person.                                                             |
| `/review link`                                           | Lists **Rocket.Chat and GitHub users**.                                         |
| `/review link @user <github-login>`                      | Links the user. It replaces an older line for the same user or the same login.  |
| `/review link remove <@user or github-login>`            | Removes the link.                                                               |

## GitHub webhook

Optional. Without it, polling keeps the cards up to date.

1. In GitHub, open the repository (or the organization) → **Settings → Webhooks → Add webhook**.
2. **Payload URL**: `https://<workspace>/api/apps/public/79a6aec5-9fcd-4c1f-8892-8a74ada7656b/github?token=<Webhook secret>`
3. **Content type**: `application/json`.
4. **Events**: _Pull requests_ and _Pull request reviews_.
5. In the app settings, turn on **GitHub webhook is set up**.

The app ignores events for repositories that are not in **Repositories** and for PRs it does not track.
