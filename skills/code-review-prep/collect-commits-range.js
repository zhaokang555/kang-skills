#!/usr/bin/env node
// collect-commits-range.js <START_DATE YYYY-MM-DD> <END_DATE YYYY-MM-DD> <AUTHOR_EMAIL>
// Unlike weekly-report's collect-commits.js, this always emits the full diff
// for every commit — the generated report renders it with diff2html, and
// risk/impact judgment needs the actual code change, not just the
// (AI-written) commit message describing it.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const [startDate, endDate, author] = process.argv.slice(2);
const { scanDir: BASE_DIR } = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'weekly-report', 'config.json'), 'utf8')
);

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 50 }).trim();
  } catch {
    return '';
  }
}

function githubSlug(repo) {
  const url = run(`git -C "${repo}" remote get-url origin`);
  const match = url.match(/github\.com[:/]([^/]+\/[^/]+?)(\.git)?$/);
  return match ? match[1] : null;
}

const repos = run(`find "${BASE_DIR}" -maxdepth 3 -name ".git" -type d -prune`)
  .split('\n')
  .filter(Boolean)
  .map(p => p.replace('/.git', ''));

for (const repo of repos) {
  const hashes = run(
    `git -C "${repo}" log --format="%H" --no-merges ` +
    `--after="${startDate} 00:00:00" --before="${endDate} 23:59:59" ` +
    `--author="${author}"`
  ).split('\n').filter(Boolean);

  if (hashes.length === 0) continue;

  const slug = githubSlug(repo);
  console.log(`=== REPO: ${path.basename(repo)}${slug ? ` (github: ${slug})` : ''} ===`);

  for (const hash of hashes) {
    const fullMessage = run(`git -C "${repo}" log -1 --format="%B" ${hash}`);
    const diff = run(`git -C "${repo}" show --format="" ${hash}`);

    console.log(`--- COMMIT ${hash} ---`);
    console.log(fullMessage);
    console.log('--- DIFF ---');
    console.log(diff);
  }

  console.log(`=== END REPO ===`);
}
