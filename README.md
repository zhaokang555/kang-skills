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

1. Collects your commits and full diffs across all git repos under `scanDir` for the date range
2. Groups commits by Jira issue key and looks up each issue's context via `mcp-atlassian`
3. Merges each issue's commits into one clean diff per repo, using a throwaway git worktree
4. Renders a review-ready HTML report — business-narrative summaries per issue, with collapsible diff2html diffs
5. Doesn't commit anything — this is meeting-prep material, not a work log

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

1. 采集 `scanDir` 下所有 git 仓库在该日期范围内本人的提交和完整 diff
2. 按 Jira 编号给 commit 分组，用 `mcp-atlassian` 查询每个编号对应的背景上下文
3. 用一次性的 git worktree，把每个需求下的 commit 合并成一份干净的 diff
4. 渲染出一份可用于会前的 HTML 报告——按需求分组的业务视角叙事，配可折叠的 diff2html diff
5. 不做任何提交——这是会前准备材料，不是工作日志
