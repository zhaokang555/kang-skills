---
name: weekly-report
description: 根据 git 提交记录生成指定周（默认上周）的中文工作周报，并 commit 到 work-journal 仓库
---

收集指定周（周一到周日）各 git 仓库的提交记录，生成中文工作周报，写入文件并提交。

**用法**：`/weekly-report [YYYY-MM-DD]`
- 无参数：默认上周
- 有参数：指定某周的**周日**日期（必须是周日，否则报错）

## 配置

- **扫描目录**：从 `.claude/skills/weekly-report/config.json` 的 `scanDir` 字段读取
- **Jira 链接前缀**：从 `config.json` 的 `jiraBaseUrl` 字段读取
- **文件路径**：`YYYY/MM/YYYY-MM-DD-weekly-report.md`，日期取目标周的周日

## 执行步骤

### 0. 读取配置

读取 `.claude/skills/weekly-report/config.json`，取 `scanDir` 和 `jiraBaseUrl` 的值。

### 1. 计算日期

运行脚本（可选参数透传）：

```bash
node .claude/skills/weekly-report/calc-dates.js [YYYY-MM-DD]
```

脚本输出 JSON，例如 `{"monday":"2026-03-30","sunday":"2026-04-05"}`。
- 若参数不是周日，脚本会报错并以 exit code 1 退出，直接将错误信息转给用户并停止。
- 从输出中取 `monday` 和 `sunday` 两个值用于后续步骤。

### 2. 幂等检查

检查 `<YYYY>/<MM>/<YYYY-MM-DD>-weekly-report.md` 是否已存在，若存在则输出"已存在，跳过"并停止。

### 3. 获取 git 作者

运行：`git config --global user.email`

### 4. 采集所有仓库的提交

运行：

```bash
node .claude/skills/weekly-report/collect-commits.js <周一> <周日> <email>
```

输出结构：每个有提交的仓库以 `=== REPO: <name> ===` 开头，每条 commit 以 `--- COMMIT ---` 分隔，内容为完整 commit message（subject + body）；若该 commit 只有 subject（无 body），额外输出 `--- STAT ---` 块（变更文件列表）。

### 5. 生成周报内容

用自然语言写一段中文工作周报：
- 第一行固定为 `周报`，然后空一行，再写正文
- 每个有提交的仓库单独成段，内容包括：做了什么功能/修复/重构（对应哪个 Jira 或目标）、涉及哪些核心模块/文件/组件、关键技术决策或背景（如有）；整体像工程师写给自己半年后看的技术日志，不限行数
- 必须提到具体的仓库名和做了什么
- 若提交信息含 Jira 编号（如 `TO-1234`），转为完整 URL：`<jiraBaseUrl>/TO-1234`（`jiraBaseUrl` 来自 config.json）
- 不要"本周工作如下"、"总结如下"等废话前缀
- 若所有仓库均无提交，写：`本周无提交记录`

### 6. 写入文件

```bash
mkdir -p <YYYY>/<MM>
```

将生成内容（末尾加换行）写入 `<YYYY>/<MM>/<YYYY-MM-DD>-weekly-report.md`。

### 7. 提交

```bash
git add <YYYY>/<MM>/<YYYY-MM-DD>-weekly-report.md
git commit -m "weekly-report: <YYYY-MM-DD>"
```

输出周报内容并确认提交成功。
