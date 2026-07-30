# kang-skills

A collection of Claude Code skills for developer workflows.

[中文](#中文)

## Skills

### weekly-report

Automatically generate a Chinese weekly work report from git commit history across multiple repos, and commit it to your work journal.

**Usage**: `/weekly-report [YYYY-MM-DD]`
- No argument: generates last week's report
- With argument: generates the report for the week ending on that Sunday

#### Installation

Install all skills:

```bash
npx skills add zhaokang555/kang-skills
```

Install just this skill:

```bash
npx skills add zhaokang555/kang-skills --skill weekly-report
```

Or copy it manually:

```bash
cp -r skills/weekly-report .claude/skills/
```

Then configure:

```bash
cp .claude/skills/weekly-report/config.example.json \
   .claude/skills/weekly-report/config.json
```

Edit `config.json`:

```json
{
  "scanDir": "/path/to/your/repos",
  "jiraBaseUrl": "https://yourcompany.atlassian.net/browse"
}
```

> `config.json` is gitignored — your personal paths won't be committed.

#### Required permissions

Add to your project's `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(git log:*)",
      "Bash(git config:*)",
      "Bash(git show:*)",
      "Bash(git -C:*)",
      "Bash(git rev-parse:*)",
      "Bash(find:*)",
      "Bash(mkdir:*)",
      "Bash(node:*)"
    ]
  }
}
```

#### How it works

1. Scans all git repos under `scanDir` (max depth 3)
2. Collects commits for the target week by the current git user
3. Uses Claude to generate a natural-language Chinese report
4. Writes to `YYYY/MM/YYYY-MM-DD-weekly-report.md` and commits

### code-review-prep

Generate an HTML report of your own coding activity over a date range, grouped by Jira issue and written from a business perspective, for use ahead of a code review meeting. Each diff is rendered inline via diff2html (collapsed by default, expandable in place) so reviewers don't need to jump to GitHub to see the real comparison.

> Requires an `mcp-atlassian` MCP server configured — it's used to fetch each Jira issue's title/description as narrative context.

**Usage**: `/code-review-prep [START_DATE]`
- No argument: only today
- With argument: from that date through today

#### Installation

Install just this skill:

```bash
npx skills add zhaokang555/kang-skills --skill code-review-prep
```

Or copy it manually:

```bash
cp -r skills/code-review-prep .claude/skills/
```

Then configure:

```bash
cp .claude/skills/code-review-prep/config.example.json \
   .claude/skills/code-review-prep/config.json
```

Edit `config.json`:

```json
{
  "scanDir": "/path/to/your/repos",
  "jiraBaseUrl": "https://yourcompany.atlassian.net/browse"
}
```

> `config.json` is gitignored — your personal paths won't be committed.

Optionally, list product/business terms that should stay in English when the report is translated to Chinese:

```bash
cp .claude/skills/code-review-prep/no-translate.example.json \
   .claude/skills/code-review-prep/no-translate.json
```

> `no-translate.json` is gitignored too — it's your own product terminology, not something to publish.

#### Required permissions

Add to your project's `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(git log:*)",
      "Bash(git config:*)",
      "Bash(git show:*)",
      "Bash(git -C:*)",
      "Bash(find:*)",
      "Bash(mkdir:*)",
      "Bash(node:*)"
    ]
  }
}
```

#### How it works

1. Collects your commit metadata (no diffs yet) across all git repos under `scanDir` for the date range
2. Looks up each commit's Jira issue context via `mcp-atlassian`
3. Groups commits by Jira issue key and writes an English business narrative for each, inspecting `git show` on demand when a commit message alone isn't clear enough
4. Merges each issue's commits into one clean diff per repo using a throwaway git worktree (falls back to per-commit diffs on cherry-pick conflicts)
5. Translates the narrative to Chinese, keeping any terms listed in `no-translate.json` in English
6. Renders a review-ready HTML report with collapsible diff2html diffs
7. Doesn't commit anything — this is meeting-prep material, not a work log

Steps 3-7 each run in their own subagent, reading/writing files on disk — the raw diffs, Jira context, and draft narrative never enter the main conversation's context.

---

## 中文

面向开发者工作流的 Claude Code Skills 合集。

### Skills

#### weekly-report

从多个 git 仓库的提交记录自动生成中文周报，并提交到你的工作日志仓库。

**用法**：`/weekly-report [YYYY-MM-DD]`
- 不带参数：生成上周周报
- 带参数：生成以该周日结尾的那一周的周报

##### 安装

安装全部 skills：

```bash
npx skills add zhaokang555/kang-skills
```

只安装这一个 skill：

```bash
npx skills add zhaokang555/kang-skills --skill weekly-report
```

或者手动复制：

```bash
cp -r skills/weekly-report .claude/skills/
```

然后配置：

```bash
cp .claude/skills/weekly-report/config.example.json \
   .claude/skills/weekly-report/config.json
```

编辑 `config.json`：

```json
{
  "scanDir": "/path/to/your/repos",
  "jiraBaseUrl": "https://yourcompany.atlassian.net/browse"
}
```

> `config.json` 已加入 `.gitignore`，个人路径不会被提交。

##### 所需权限

在项目的 `.claude/settings.json` 中添加：

```json
{
  "permissions": {
    "allow": [
      "Bash(git log:*)",
      "Bash(git config:*)",
      "Bash(git show:*)",
      "Bash(git -C:*)",
      "Bash(git rev-parse:*)",
      "Bash(find:*)",
      "Bash(mkdir:*)",
      "Bash(node:*)"
    ]
  }
}
```

##### 工作原理

1. 扫描 `scanDir` 下所有 git 仓库（最大深度 3）
2. 收集当前 git 用户在目标周内的所有提交
3. 由 Claude 生成自然语言中文周报
4. 写入 `YYYY/MM/YYYY-MM-DD-weekly-report.md` 并提交

#### code-review-prep

生成本人一段时间内的编码情况说明，按 Jira 需求分组、业务视角叙事，用于代码 review 会议前的准备。diff 用 diff2html 直接渲染在页面里（默认收起，点击原地展开），不需要跳转到 GitHub 就能看到真正的对比视图。

> 需要配置好 `mcp-atlassian` MCP 服务器——用于查询 commit 中提到的 Jira 编号对应的标题/描述，作为叙事的背景上下文。

**用法**：`/code-review-prep [START_DATE]`
- 无参数：只看今天
- 有参数：从该日期到今天

##### 安装

只安装这一个 skill：

```bash
npx skills add zhaokang555/kang-skills --skill code-review-prep
```

或者手动复制：

```bash
cp -r skills/code-review-prep .claude/skills/
```

然后配置：

```bash
cp .claude/skills/code-review-prep/config.example.json \
   .claude/skills/code-review-prep/config.json
```

编辑 `config.json`：

```json
{
  "scanDir": "/path/to/your/repos",
  "jiraBaseUrl": "https://yourcompany.atlassian.net/browse"
}
```

> `config.json` 已加入 `.gitignore`，个人路径不会被提交。

可选：配置翻译成中文时需要保留英文原文的产品/业务术语列表：

```bash
cp .claude/skills/code-review-prep/no-translate.example.json \
   .claude/skills/code-review-prep/no-translate.json
```

> `no-translate.json` 也已加入 `.gitignore`——这是你自己的产品术语，不适合公开发布。

##### 所需权限

在项目的 `.claude/settings.json` 中添加：

```json
{
  "permissions": {
    "allow": [
      "Bash(git log:*)",
      "Bash(git config:*)",
      "Bash(git show:*)",
      "Bash(git -C:*)",
      "Bash(find:*)",
      "Bash(mkdir:*)",
      "Bash(node:*)"
    ]
  }
}
```

##### 工作原理

1. 采集 `scanDir` 下所有 git 仓库在该日期范围内本人的提交元信息（不含 diff）
2. 用 `mcp-atlassian` 查询每条 commit 对应 Jira 编号的背景上下文
3. 按 Jira 编号给 commit 分组，为每组撰写英文业务叙事；commit message 描述不清楚时按需用 `git show` 查看实际 diff
4. 用一次性的 git worktree，把每个需求下的 commit 合并成一份干净的 diff（cherry-pick 冲突时自动回退为按 commit 拼接）
5. 把叙事翻译成中文，`no-translate.json` 里列出的词保持英文不译
6. 渲染出一份可用于会前的 HTML 报告，配可折叠的 diff2html diff
7. 不做任何提交——这是会前准备材料，不是工作日志

第 3-7 步都跑在各自独立的 subagent 里，输入输出走文件——原始 diff、Jira 上下文、英文叙事草稿都不会进入主对话的上下文。
