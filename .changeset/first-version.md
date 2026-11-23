---
'review-assigner': minor
---

First version of the Review Assigner app:

- `/review <pr> [@user ...]` picks one reviewer per CODEOWNERS team the PR touches, or uses the people you name, and posts one card per PR in the review room.
- The card follows GitHub: approved, changes requested, commented, merged or closed. Updates come from a GitHub webhook, or from polling every 5 minutes.
- Take it and Reassign on the card, including removing a reviewer or drawing again.
- Settings: repositories, room, GitHub token, webhook, user links, not available, draw strategy, and one person covering several teams.
