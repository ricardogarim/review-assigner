# review-assigner

## 0.2.0

### Minor Changes

- a2c08eb: Take it asks which teams to take, with your own teams preselected and any team on the card allowed, and the card shows one line per team
- a2c08eb: `/review workload` lists who has open reviews, on which PRs, and for how long

### Patch Changes

- a2c08eb: One reviewer per CODEOWNERS team instead of per CODEOWNERS line, and a warning when the app cannot read a team's members

## 0.1.1

### Patch Changes

- 9830a46: Clearer setting names and a description for every setting
- 637459b: Mentions at the end of a message no longer get a dot that breaks them

## 0.1.0

### Minor Changes

- 7cb0b22: First version of the Review Assigner app:
  
  - `/review <pr> [@user ...]` picks one reviewer per CODEOWNERS team the PR touches, or uses the people you name, and posts one card per PR in the review room.
  - The card follows GitHub: approved, changes requested, commented, merged or closed. Updates come from a GitHub webhook, or from polling every 5 minutes.
  - Take it and Reassign on the card, including removing a reviewer or drawing again.
  - Settings: repositories, room, GitHub token, webhook, user links, not available, draw strategy, and one person covering several teams.
