#!/usr/bin/env node
// merge-story-diff.js <repoPath> <hash1> <hash2> ... <hashN>
//
// Squashes a set of commits belonging to the same Jira story into one net
// diff, so code-review-prep can show "what changed for this story" instead
// of commit-by-commit noise. Hashes may be passed in any order — this
// script sorts them by author date itself.
//
// Output contract (stdout):
//   line 1: "MODE: SINGLE" | "MODE: MERGED" | "MODE: FALLBACK_CONCAT"
//   line 2: blank
//   rest:   the diff text
// On FALLBACK_CONCAT, the diff text is the original per-commit diffs
// concatenated in chronological order (cherry-pick conflicted; caller
// should label the diff block as a failed-merge fallback).
// All worktree cleanup happens inside this script — callers never touch
// worktrees directly.
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const [repoPathArg, ...hashes] = process.argv.slice(2);
if (!repoPathArg || hashes.length === 0) {
  console.error('usage: merge-story-diff.js <repoPath> <hash1> [hash2 ...]');
  process.exit(1);
}
const repo = path.resolve(repoPathArg);

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 50 });
}

function runQuiet(cmd) {
  try {
    return run(cmd).trim();
  } catch {
    return '';
  }
}

function showDiff(repoDir, hash) {
  return runQuiet(`git -C "${repoDir}" show --format="" ${hash}`);
}

function concatFallback(sortedHashes) {
  return sortedHashes.map(h => showDiff(repo, h)).join('\n');
}

// Single commit: no merge needed, just its own diff.
if (hashes.length === 1) {
  console.log('MODE: SINGLE\n');
  console.log(showDiff(repo, hashes[0]));
  process.exit(0);
}

// git log's default (no --date-order) traversal never lists a parent before
// its children, so filtering that stream is a more reliable chronological
// order than sorting by %at — commit-time has only 1s resolution and ties
// break arbitrarily, which can invert parent/child order.
const wanted = new Set(hashes);
const newestFirst = run(`git -C "${repo}" log --format=%H --all`)
  .trim()
  .split('\n')
  .filter(h => wanted.has(h));
if (newestFirst.length !== hashes.length) {
  throw new Error('some commits not reachable from any ref');
}
const sorted = newestFirst.reverse();

const base = runQuiet(`git -C "${repo}" rev-parse ${sorted[0]}^`);

const worktreeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-review-prep-'));

function cleanupWorktree() {
  try {
    run(`git -C "${repo}" worktree remove "${worktreeDir}" --force`);
  } catch {
    fs.rmSync(worktreeDir, { recursive: true, force: true });
    runQuiet(`git -C "${repo}" worktree prune`);
  }
}

// Scoped to the cherry-pick calls via env vars, not `git config` — a linked
// worktree shares its local config with the main repo (only HEAD/index are
// worktree-private), so writing config here would either pick up unrelated
// repo-local settings (e.g. a stray user.name override) or permanently leak
// this placeholder identity into the real repo once the worktree is removed.
const GIT_IDENTITY_ENV = 'GIT_AUTHOR_NAME="code-review-prep" GIT_AUTHOR_EMAIL="code-review-prep@local" GIT_COMMITTER_NAME="code-review-prep" GIT_COMMITTER_EMAIL="code-review-prep@local"';

try {
  run(`git -C "${repo}" worktree add --detach "${worktreeDir}" ${base}`);

  for (const hash of sorted) {
    run(`${GIT_IDENTITY_ENV} git -C "${worktreeDir}" cherry-pick --keep-redundant-commits ${hash}`);
  }

  const diff = run(`git -C "${worktreeDir}" diff ${base} HEAD`);
  cleanupWorktree();
  console.log('MODE: MERGED\n');
  console.log(diff);
} catch {
  cleanupWorktree();
  console.log('MODE: FALLBACK_CONCAT\n');
  console.log(concatFallback(sorted));
}
