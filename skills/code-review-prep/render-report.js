#!/usr/bin/env node
// render-report.js <manifestPath>
//
// Assembles the final code-review-prep HTML report from a manifest the LLM
// authors (narrative text + structural metadata) plus diff files already on
// disk (produced by merge-story-diff.js, or `git show --format=""` for
// standalone commits), referenced by path only. This keeps diff content and
// the HTML/CSS/JS boilerplate out of the LLM's own context — it never has to
// read or re-emit either.
//
// Manifest schema:
// {
//   startDate, endDate,          // "YYYY-MM-DD"; equal dates collapse to a single date, used as the run's folder name
//   stories: [{
//     jiraKey,                   // e.g. "TO-3868"; link built from config.json's jiraBaseUrl
//     title,                     // one-line summary, used in <h2> and the ToC row
//     tocSummary,                // "做了什么", ToC row's third column
//     repos: [{
//       repoName, slug,          // slug is "owner/repo" (as emitted by collect-commits-range.js)
//       narrativeHtml,           // LLM-authored HTML fragment (<p> paragraphs, may include <a>/<strong>), embedded verbatim
//       diffFile, mode,          // mode: SINGLE | MERGED | FALLBACK_CONCAT (mirrors merge-story-diff.js)
//       commits: [{ hash }],
//     }],
//   }],
//   others: [{ summary, repoName, slug, diffFile, mode, commits: [{ hash }] }],  // commits with no Jira key; mode is always SINGLE
// }
// A story's <h3> per-repo heading is emitted only when it has more than one repo.
// Output: code-review-prep/<startDate>[_to_<endDate>]/report.html — one folder per run, so a run's
// manifest/diffs/report never collide with or get overwritten by a different date range's run.

const fs = require('fs');
const path = require('path');

const [manifestPath] = process.argv.slice(2);
if (!manifestPath) {
  console.error('usage: render-report.js <manifestPath>');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const { jiraBaseUrl } = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

function shortHash(hash) {
  return hash.slice(0, 7);
}

function commitUrl(slug, hash) {
  return `https://github.com/${slug}/commit/${hash}`;
}

function loadDiff(diffFile) {
  const text = fs.readFileSync(diffFile, 'utf8');
  // merge-story-diff.js prefixes its stdout with "MODE: X\n\n"; a plain `git show` has no such header.
  const stripped = text.replace(/^MODE: [A-Z_]+\n\n/, '');
  return stripped.split('</script').join('<\/script');
}

let diffBlockSeq = 0;
function renderDiffBlock({ repoName, slug, diffFile, mode, commits }) {
  const id = `diff-${++diffBlockSeq}`;
  const link = (hash) =>
    `<a href="${commitUrl(slug, hash)}" onclick="event.stopPropagation()" target="_blank">${shortHash(hash)}</a>`;

  let titleHtml;
  if (mode === 'SINGLE') {
    titleHtml = `${repoName}@${link(commits[0].hash)}`;
  } else {
    const suffix = mode === 'FALLBACK_CONCAT'
      ? '（合并失败，以下为按 commit 拼接的版本）'
      : `（合并 ${commits.length} 个 commit）`;
    titleHtml = `${repoName}${suffix}\n  ${commits.map(c => link(c.hash)).join('\n  ')}`;
  }

  return `<div class="diff-block">
<div class="diff-toggle" id="${id}-toggle" onclick="toggleDiff('${id}')"><span class="diff-arrow">▶</span> 查看 diff：${titleHtml}</div>
<div class="diff-body" id="${id}">
<div class="diff-body-content" id="${id}-content"></div>
</div>
<script type="text/plain" id="${id}-data">${loadDiff(diffFile)}</script>
</div>`;
}

function renderStory(story, index) {
  const anchor = `story-${index + 1}`;
  const showHeadings = story.repos.length > 1;
  const body = story.repos
    .map(repo => `${showHeadings ? `<h3>${repo.repoName}</h3>\n` : ''}${repo.narrativeHtml}\n${renderDiffBlock(repo)}`)
    .join('\n');

  return {
    tocRow: `<tr>
  <td><a href="#${anchor}">${story.title}（${story.jiraKey}）</a></td>
  <td>${story.repos.map(r => r.repoName).join(', ')}</td>
  <td>${story.tocSummary}</td>
</tr>`,
    sectionHtml: `<section id="${anchor}">
<h2>${story.title}（<a href="${jiraBaseUrl}/${story.jiraKey}">${story.jiraKey}</a>）</h2>
${body}
</section>`,
  };
}

const rendered = manifest.stories.map(renderStory);

const othersHtml = (manifest.others || []).length
  ? `<section id="others">
<h2>其他改动</h2>
${manifest.others.map(c => `<p>${c.summary}</p>\n${renderDiffBlock(c)}`).join('\n')}
</section>`
  : '';

const dateLabel = manifest.startDate === manifest.endDate
  ? manifest.startDate
  : `${manifest.startDate} 至 ${manifest.endDate}`;

const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<title>代码 review 提纲 - ${dateLabel}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/diff2html/bundles/css/diff2html.min.css">
<style>
body {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 20px 80px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  line-height: 1.7;
  color: #1a1a1a;
}
h1 { font-size: 22px; margin-bottom: 24px; }
h2 { font-size: 18px; margin-top: 48px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
h3 { font-size: 15px; margin-top: 28px; color: #444; }
p { margin: 12px 0; }
/* scoped to .toc-table, not a bare table/th/td selector, so this doesn't also style diff2html's internal tables */
.toc-table { border-collapse: collapse; width: 100%; margin-bottom: 24px; }
.toc-table th, .toc-table td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; vertical-align: top; }
.toc-table th { background: #f5f5f5; }
a { color: #0969da; text-decoration: none; }
a:hover { text-decoration: underline; }
.diff-block { position: relative; margin: 16px 0 28px; }
/* sticky: keeps the toggle reachable regardless of how far the expanded diff below it has been scrolled */
.diff-toggle {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #f0f2f5;
  border: 1px solid #d0d7de;
  border-radius: 6px 6px 0 0;
  padding: 8px 14px;
  cursor: pointer;
  font-size: 13px;
  user-select: none;
}
.diff-toggle:hover { background: #e6e9ed; }
.diff-toggle a { margin-left: 8px; font-size: 12px; }
.diff-arrow { display: inline-block; transition: transform 0.3s ease; }
.diff-toggle.expanded .diff-arrow { transform: rotate(90deg); }
/* break out of the 900px reading column so the side-by-side diff view isn't cramped */
.diff-body {
  width: 100vw;
  margin-left: 50%;
  transform: translateX(-50%);
  box-sizing: border-box;
  padding: 0 20px;
  border: 1px solid #d0d7de;
  border-top: none;
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s ease;
  /* without this, the browser miscomputes scrollable overflow while collapsed:
     the box itself shrinks to 0 but the page stays scrollable past where the
     diff used to be, because .diff-body-content's own overflow:hidden clip
     doesn't stop the (still overflow:visible) grid container from counting
     its child's un-clipped extent */
  overflow: hidden;
}
.diff-body.expanded { grid-template-rows: 1fr; }
/* overflow:hidden gives this grid item an automatic min size of 0, so the 0fr row can actually collapse */
.diff-body-content { overflow: hidden; }
</style>
</head>
<body>
<h1>代码 review 提纲 - ${dateLabel}</h1>

<table class="toc-table">
<tr><th>需求</th><th>涉及仓库</th><th>做了什么</th></tr>
${rendered.map(r => r.tocRow).join('\n')}
</table>

${rendered.map(r => r.sectionHtml).join('\n\n')}
${othersHtml}

<script src="https://cdn.jsdelivr.net/npm/diff2html/bundles/js/diff2html.min.js"></script>
<script>
function toggleDiff(id) {
  const content = document.getElementById(id + '-content');
  if (!content.dataset.rendered) {
    const raw = document.getElementById(id + '-data').textContent;
    content.innerHTML = Diff2Html.html(raw, { drawFileList: true, matching: 'lines', outputFormat: 'side-by-side' });
    content.dataset.rendered = '1';
  }
  document.getElementById(id).classList.toggle('expanded');
  document.getElementById(id + '-toggle').classList.toggle('expanded');
}
</script>
</body>
</html>
`;

const runDir = manifest.startDate === manifest.endDate
  ? manifest.endDate
  : `${manifest.startDate}_to_${manifest.endDate}`;
const outDir = path.join(process.cwd(), 'code-review-prep', runDir);
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'report.html');
fs.writeFileSync(outPath, html);
console.log(outPath);
