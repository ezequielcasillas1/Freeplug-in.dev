# Freeplug development plan (recurring, weekly), v1, Oct 12, 2026

Owner: Aria (decisions). Coordinator: Jace (assigns and tracks). Approval gate: Cheke.
Rules: nothing goes to main or live, gets deployed, has DNS changed, or gets bought without Cheke's OK. Arkitect runs before changes and before handoff. Each delivery is a PR plus the review localhost (admin pages stay on :3000).

## Credit rule
If credits run out, Freeplug work pauses for the rest of the week and resumes the following Monday. So every task has to be able to stop cleanly at any checkpoint.

## Checkpoint rule (every task, every stopping point)
1. Commit and push the work to its own feature branch, never main. Push at least every 2 hours of work and at each checkpoint below.
2. Update `/workspace/aria/dev-checkpoints/<task>.md` with: branch and last commit, what's done, the exact next step, open questions, and how to run it (port and commands).
3. Leave review servers on their current ports, and record each port in the notes.
4. Don't leave a half-applied migration or a running data job. Finish it or roll it back before stopping.
Resuming means reading the notes, checking out the branch, and continuing from the "next step". Nothing gets redone.

## Priority order (work top down; nothing lower starts until the item above is at a checkpoint)
Order changed by Cheke on Oct 12 at 12:00 PM CT: the picker goes first.
1. **Envato picker phase 1** (Owen builds; Lina's shortlist runs alongside). It starts only after Aria's pre-build research signs it off. Do the admin page for Lina first, then the client picker (2 to 3 days). Checkpoints: (a) Arkitect diagnose, (b) a server-only catalog cache with the 3-hour refresh (the token never reaches logs or the browser), (c) the Lina admin page on :3000, (d) the business-type filter over the 20 types and the client picker, (e) a PR plus the review localhost.
2. **Spanish dashboard fix** (Owen builds, Vera retests). Checkpoints: (a) the remaining strings are wired, (b) Vera's retest passes, (c) a PR plus localhost.
3. **City photo fix** (small; the photos and copy are ready).
4. **Change-request webhook QA** (Vera and Owen). Close out the open QA on :3381.
5. **Add-ons fixes** (915391e wasn't clean), plus **Vera's r18/r19 recheck**. The hosted DB apply needs her r19 marker.
6. **Uptime alerts** (Owen). Confirm whether the check got built; if not, build it to my Oct 4 rules using Sable's copy.
7. **Test-mode deploy prep**. Config and secrets list only. The deploy waits for Cheke's OK.
8. **Picker phases 2 to 4**, in card order.
9. **Legal page drafts** (Sable), once Cheke answers the 11 legal questions.

## Waiting on Cheke (not blocking items 1 to 5)
The live Stripe keys, the backup screenshot, the 11 legal answers, the 4 help-chat answers, a Spanish reviewer, the URGENTE filter, his Envato app sign-in, and the go-live and DNS OK.

## Weekly loop
- Monday: Jace posts the week's targets from this list and the checkpoint notes.
- Daily: a status line per active item (branch, checkpoint reached, next step).
- Friday, or when credits run out: everything goes to a checkpoint and Jace sends a one-paragraph wrap-up of what's ready for Cheke to review.
