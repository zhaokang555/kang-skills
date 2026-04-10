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

**若携带参数 `YYYY-MM-DD`**：
1. 将该参数解析为目标周日
2. 用 Node.js 验证该日期是周日（`new Date(y, m-1, d).getDay() === 0`，其中 0=Sun），否则输出"错误：参数必须是周日（如 2026-03-29）"并停止
3. 目标周一 = 目标周日 - 6 天

**若无参数**：用本地时区计算上周周一和周日的日期，文件名用周日日期。

示例（无参数）：今天是 2026-04-09（周四），则上周是 2026-03-30（周一）到 2026-04-05（周日），文件为 `2026/04/2026-04-05-weekly-report.md`。

示例（有参数）：`/weekly-report 2026-03-29` → 覆盖 2026-03-23（周一）到 2026-03-29（周日），文件为 `2026/03/2026-03-29-weekly-report.md`。

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
