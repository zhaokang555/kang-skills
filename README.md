# kang-skills

A collection of Claude Code skills for developer workflows.

[中文](#中文)

## Skills

### weekly-report

Automatically generate a Chinese weekly work report from git commit history across multiple repos, and commit it to your work journal.

**Usage**: `/weekly-report [YYYY-MM-DD]`
- No argument: generates last week's report
- With argument: generates the report for the week ending on that Sunday

## Installation

### Option 1: npx skills (recommended)

Install all skills:

```bash
npx skills add zhaokang555/kang-skills
```

Install a single skill:

```bash
npx skills add zhaokang555/kang-skills --skill weekly-report
```

### Option 2: manual

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

## Required permissions

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

## How it works

1. Scans all git repos under `scanDir` (max depth 3)
2. Collects commits for the target week by the current git user
3. Uses Claude to generate a natural-language Chinese report
4. Writes to `YYYY/MM/YYYY-MM-DD-weekly-report.md` and commits

---

## 中文

面向开发者工作流的 Claude Code Skills 合集。

### Skills

#### weekly-report

从多个 git 仓库的提交记录自动生成中文周报，并提交到你的工作日志仓库。

**用法**：`/weekly-report [YYYY-MM-DD]`
- 不带参数：生成上周周报
- 带参数：生成以该周日结尾的那一周的周报

### 安装

**方式一：npx skills（推荐）**

安装全部 skills：

```bash
npx skills add zhaokang555/kang-skills
```

单独安装某个 skill：

```bash
npx skills add zhaokang555/kang-skills --skill weekly-report
```

**方式二：手动复制**

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

### 所需权限

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

### 工作原理

1. 扫描 `scanDir` 下所有 git 仓库（最大深度 3）
2. 收集当前 git 用户在目标周内的所有提交
3. 由 Claude 生成自然语言中文周报
4. 写入 `YYYY/MM/YYYY-MM-DD-weekly-report.md` 并提交