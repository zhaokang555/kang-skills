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

第 4-6 步均通过 subagent 执行，且输入/输出尽量都走文件：每个 subagent 的最终回复只允许是简短的一句话统计，不把文件/正文内容复述在回复里；主线程本身也不读取这些中间文件，只把路径原样传给下一步 subagent 的 prompt。第 0/1/2/3/7/8 步信息量很小，主线程直接执行即可，不需要 subagent。

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

本次运行的中间产物放在 `RUN_DIR` = `weekly-report/<周日>/`（已加入 `.gitignore`，不会被提交，不同于最终报告要 commit 到仓库）。

### 2. 幂等检查

检查 `<YYYY>/<MM>/<YYYY-MM-DD>-weekly-report.md`（日期取周日）是否已存在，若存在则输出"已存在，跳过"并停止——不创建 `RUN_DIR`，不启动任何 subagent。

### 3. 获取 git 作者

运行：`git config --global user.email`

### 4. 采集所有仓库的提交

启动一个 subagent 执行：

```bash
mkdir -p <RUN_DIR>
node .claude/skills/weekly-report/collect-commits.js <周一> <周日> <email> > <RUN_DIR>/commits.txt
```

告诉 subagent：这条命令本身就是完整任务，跑完之后不需要读取/复述文件内容，只需数一下有多少个 `=== REPO:` 段落、多少条 `--- COMMIT ---`，回复一句话，例如"commits.txt 已写入，N 个仓库共 M 条提交"。

输出结构（`commits.txt`）：每个有提交的仓库以 `=== REPO: <name> ===` 开头，每条 commit 以 `--- COMMIT ---` 分隔，内容为完整 commit message（subject + body）；若该 commit 只有 subject（无 body），额外输出 `--- STAT ---` 块（变更文件列表）。

若 subagent 回报的提交总数为 0（所有仓库均无提交），主线程跳过第 5、6 步，直接执行：

```bash
mkdir -p <YYYY>/<MM>
```

把 `本周无提交记录\n` 写入 `<YYYY>/<MM>/<YYYY-MM-DD>-weekly-report.md`，然后跳到第 7 步提交。

### 5. 查询 Jira 上下文

启动一个 subagent 执行：读取 `<RUN_DIR>/commits.txt`，从每条 commit message 中提取 Jira 编号（形如 `TO-1234`）并去重，通过 twg skill（`twg-jira`）逐个查询 Jira workitem 作为背景上下文。对每个编号运行 `twg jira workitem get <KEY> --comments -o json`，从结果中提取 summary、description 和完整 comments，分别写入 title、description 和 comments；查询失败的编号跳过，不阻断整体流程。把结果写入 `<RUN_DIR>/jira-context.json`：

```json
{
  "TO-1234": { "title": "...", "description": "...", "comments": ["...", "..."] }
}
```

subagent 的最终回复只需一句话统计（例如"jira-context.json 已写入，K 个编号，J 个查询失败已跳过"），不把标题/描述/评论内容复述在回复里。

### 6. 生成周报内容并写入文件

启动一个 subagent 执行：读取 `<RUN_DIR>/commits.txt` 和 `<RUN_DIR>/jira-context.json`，用自然语言写一段中文工作周报：

- 第一行固定为 `周报`，然后空一行，再写正文
- **按 Jira 需求分组**：把所有 commit 按提取到的 Jira 编号分组，一个编号写一段，哪怕跨多个仓库也合并成一段，不按仓库拆段；没有 Jira 编号的 commit 归入末尾单独一段"其他改动"，逐条列出
- **每段两句话**：第一句说这个需求做了什么、解决什么问题（用户价值/目标，可参考 Jira 标题/描述判断），第二句一句话点出用什么技术手段实现，不展开细节
- **不出现代码符号**：不写函数名、变量名、文件路径、类名——想看这些细节的人自己看 diff
- 涉及仓库名的地方要提到具体仓库名，尤其是一个需求跨多个仓库时
- **专有名词不翻译**：产品功能名、语言名、内部黑话这类团队日常就用原词交流的词，直接保留原词嵌进中文正文，不要另造中文翻译
- 若提交信息含 Jira 编号（如 `TO-1234`），转为完整 URL：`<jiraBaseUrl>/TO-1234`（`jiraBaseUrl` 是第 0 步读到的值，告诉 subagent）
- 不要"本周工作如下"、"总结如下"等废话前缀

写完后：

```bash
mkdir -p <YYYY>/<MM>
```

将生成内容（末尾加换行）写入 `<YYYY>/<MM>/<YYYY-MM-DD>-weekly-report.md`。

subagent 的最终回复只需一句话统计（例如"周报已写入，N 个需求 + M 条其他改动"），不把正文内容复述在回复里。

### 7. 提交

主线程直接执行（不需要 subagent）：

```bash
git add <YYYY>/<MM>/<YYYY-MM-DD>-weekly-report.md
git commit -m "weekly-report: <YYYY-MM-DD>"
```

### 8. 完成

把最终文件路径告知用户，确认提交成功。不读取/展示正文内容。
