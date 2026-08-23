# GitHub Email History Rewrite Plan

Goal: remove work-account emails from this repository's reachable Git history by rewriting the affected commit metadata to use the personal GitHub email.

Known bad commits in local history:

| Commit | Email | Subject |
| --- | --- | --- |
| `0dc79e1` | `jake-yaya@yayacreations.com` | `Small change to README title` |
| `5f1911f` | `jake.l@yayacreations.com` | `Another major design overhaul` |

Target identity:

```text
jakelawrence <jakelawrence.dev@gmail.com>
```

## Phase 0: Stop Conditions

Do not rewrite or force-push if any of these are true:

- Another person is actively working from `main`.
- There are important open PRs based on current `main`.
- Local `main` is missing commits from `origin/main`.
- The email audit finds more work emails than the two listed above and they have not been reviewed.
- The rewrite causes file diffs, not just commit hash and metadata changes.

## Phase 1: Preflight Audit

1. Confirm the current branch and working tree.

   ```bash
   git status --short --branch
   git branch --show-current
   ```

2. Fetch remote state without changing local files.

   ```bash
   git fetch --all --prune
   ```

3. Confirm `main` matches `origin/main`.

   ```bash
   git switch main
   git status --short --branch
   git pull --ff-only
   ```

4. List every author and committer email in reachable history.

   ```bash
   git log --all --format='%ae%n%ce' | sort -u
   ```

5. Inspect the commits using work emails.

   ```bash
   git log --all --format='%h %an <%ae> %cn <%ce> %s' | grep -Ei 'yayacreations'
   ```

6. Confirm the bad commits are reachable from the branch that GitHub uses for contributors.

   ```bash
   git branch --all --contains 0dc79e1
   git branch --all --contains 5f1911f
   ```

Expected result: both bad commits are reachable from `main` / `origin/main`.

## Phase 2: Backups

1. Create local backup refs before changing history. Keep these local because they intentionally preserve the old commit metadata.

   ```bash
   git branch backup/main-before-email-rewrite main
   git tag backup-main-before-email-rewrite main
   ```

2. Save a local bundle for disaster recovery. Do not push this bundle anywhere public.

   ```bash
   git bundle create /tmp/what-do-i-watch-before-email-rewrite.bundle --all
   ```

3. Save the current commit map for comparison.

   ```bash
   git log --first-parent --format='%H %s' main > /tmp/main-before-email-rewrite.log
   ```

## Phase 3: Dry Run In A Throwaway Clone

Use a local throwaway clone so the first rewrite cannot damage the working repo.

```bash
cd /tmp
git clone /Users/jakelawrence/Desktop/FILES/Code/what-do-i-watch what-do-i-watch-email-rewrite-test
cd what-do-i-watch-email-rewrite-test
git switch main
git branch backup/main-before-email-rewrite main
```

Run the rewrite there first. This uses built-in Git and only rewrites `main`; backup refs are left alone.

```bash
git filter-branch --env-filter '
if [ "$GIT_AUTHOR_EMAIL" = "jake-yaya@yayacreations.com" ] || [ "$GIT_AUTHOR_EMAIL" = "jake.l@yayacreations.com" ]; then
  GIT_AUTHOR_NAME="jakelawrence"
  GIT_AUTHOR_EMAIL="jakelawrence.dev@gmail.com"
fi
if [ "$GIT_COMMITTER_EMAIL" = "jake-yaya@yayacreations.com" ] || [ "$GIT_COMMITTER_EMAIL" = "jake.l@yayacreations.com" ]; then
  GIT_COMMITTER_NAME="jakelawrence"
  GIT_COMMITTER_EMAIL="jakelawrence.dev@gmail.com"
fi
' -- main
```

## Phase 4: Dry Run Verification

1. Confirm the work emails are gone from rewritten `main`.

   ```bash
   git log main --format='%h %an <%ae> %cn <%ce> %s' | grep -Ei 'yayacreations'
   ```

   Expected result: no output.

2. Confirm the final tree is unchanged.

   ```bash
   git diff --stat backup/main-before-email-rewrite..main
   ```

   Expected result: no file changes.

3. Confirm the current app commit content matches the original branch content.

   ```bash
   git diff backup/main-before-email-rewrite main
   ```

   Expected result: no output.

4. Confirm the old bad commit hashes no longer exist in rewritten `main`.

   ```bash
   git rev-list main | grep -E "$(git rev-parse 0dc79e1)|$(git rev-parse 5f1911f)"
   ```

   Expected result: no output.

## Phase 5: Rewrite The Real Repository

Only start this phase after the dry run passes.

```bash
cd /Users/jakelawrence/Desktop/FILES/Code/what-do-i-watch
git switch main
git status --short --branch
```

Run the same `git filter-branch --env-filter` command that passed in the throwaway clone.

```bash
git filter-branch --env-filter '
if [ "$GIT_AUTHOR_EMAIL" = "jake-yaya@yayacreations.com" ] || [ "$GIT_AUTHOR_EMAIL" = "jake.l@yayacreations.com" ]; then
  GIT_AUTHOR_NAME="jakelawrence"
  GIT_AUTHOR_EMAIL="jakelawrence.dev@gmail.com"
fi
if [ "$GIT_COMMITTER_EMAIL" = "jake-yaya@yayacreations.com" ] || [ "$GIT_COMMITTER_EMAIL" = "jake.l@yayacreations.com" ]; then
  GIT_COMMITTER_NAME="jakelawrence"
  GIT_COMMITTER_EMAIL="jakelawrence.dev@gmail.com"
fi
' -- main
```

## Phase 6: Local Verification

1. Confirm no work emails remain on `main`.

   ```bash
   git log main --format='%h %an <%ae> %cn <%ce> %s' | grep -Ei 'yayacreations'
   ```

   Expected result: no output.

2. Confirm no file content changed.

   ```bash
   git diff backup/main-before-email-rewrite main
   ```

   Expected result: no output.

3. Confirm the branch still builds from the rewritten history.

   ```bash
   npm run build
   ```

4. Inspect the rewritten commits near the original subjects.

   ```bash
   git log main --format='%h %an <%ae> %cn <%ce> %s' --grep='Small change to README title'
   git log main --format='%h %an <%ae> %cn <%ce> %s' --grep='Another major design overhaul'
   ```

Expected result: the subjects still exist, but the emails are personal and the commit hashes are new.

## Phase 7: Push Gate

Before pushing:

- Confirm `git diff backup/main-before-email-rewrite main` is empty.
- Confirm `grep -Ei 'yayacreations'` against `git log main` has no output.
- Confirm there is no team dependency on the old `main` history.
- Confirm GitHub branch protection allows force-pushes, or temporarily allow them.
- Do not push backup refs, `refs/original/*`, or use `git push --mirror`.

Push with lease protection:

```bash
git push --force-with-lease origin main
```

If `release-1.2` or `codex/publish-current-project-state` must stay published and GitHub still attributes the work account from those branches, rewrite and push those branches too. Otherwise delete stale remote branches that still expose the old commits.

## Phase 8: GitHub Verification

1. Open the repository contributors page after GitHub finishes recalculating.
2. Confirm the work GitHub account is gone from the contributor list.
3. Open the rewritten commits on GitHub and append `.patch` to each URL.
4. Confirm the patch metadata shows only `jakelawrence.dev@gmail.com`.

GitHub may cache contributor data briefly. If the work account remains after the rewritten `main` is visible, check whether another branch, tag, pull request, or fork still exposes the old commits.

## Rollback

If anything looks wrong before pushing:

```bash
git switch main
git reset --hard backup/main-before-email-rewrite
```

If the bad rewrite was already pushed:

```bash
git switch main
git reset --hard backup/main-before-email-rewrite
git push --force-with-lease origin main
```

Keep the backup branch/tag until GitHub attribution is correct and the repository has been stable for a few days.
