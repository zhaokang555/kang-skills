#!/usr/bin/env node
// collect-commits.js <MONDAY> <SUNDAY> <AUTHOR_EMAIL>
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const [monday, sunday, author] = process.argv.slice(2);
const { scanDir: BASE_DIR } = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

// Find all git repos (maxdepth 3)
const repos = run(`find "${BASE_DIR}" -maxdepth 3 -name ".git" -type d -prune`)
  .split('\n')
  .filter(Boolean)
  .map(p => p.replace('/.git', ''));

for (const repo of repos) {
  const hashes = run(
    `git -C "${repo}" log --format="%H" --no-merges ` +
    `--after="${monday} 00:00:00" --before="${sunday} 23:59:59" ` +
    `--author="${author}"`
  ).split('\n').filter(Boolean);

  if (hashes.length === 0) continue;

  console.log(`=== REPO: ${path.basename(repo)} ===`);

  for (const hash of hashes) {
    const fullMessage = run(`git -C "${repo}" log -1 --format="%B" ${hash}`);
    const bodyOnly    = run(`git -C "${repo}" log -1 --format="%b" ${hash}`);
    const isSubjectOnly = bodyOnly.length === 0;

    console.log('--- COMMIT ---');
    console.log(fullMessage);

    if (isSubjectOnly) {
      console.log('--- STAT ---');
      // --format="" suppresses commit header, leaving only file change list
      const lines = run(`git -C "${repo}" show --stat --format="" ${hash}`)
        .split('\n').filter(Boolean);
      const stat = lines.length <= 20
        ? lines.join('\n')
        : [...lines.slice(0, 19), lines[lines.length - 1]].join('\n');
      console.log(stat);
    }
  }

  console.log(`=== END REPO ===`);
}