# kang-skills

A collection of Claude Code skills for developer workflows.

## Skills

### weekly-report

Automatically generate a Chinese weekly work report from git commit history across multiple repos, and commit it to your work journal.

**Usage**: `/weekly-report [YYYY-MM-DD]`
- No argument: generates last week's report
- With argument: generates the report for the week ending on that Sunday

## Installation

### Option 1: npx skills (recommended)

```bash
npx skills add kangzhao/kang-skills
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