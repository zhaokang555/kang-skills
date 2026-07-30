---
name: code-review-prep
description: 生成本人一段时间内的编码情况说明，按 Jira 需求分组、业务视角叙事，用于代码 review 会议前的准备
---

采集指定日期（默认今天）本人在各 git 仓库的提交记录和完整 diff，结合 Jira 上下文，生成一份以"需求"为单位、业务视角、独立可读的 HTML 报告，用于代码 review 会议——报告本身要让同事不靠你口头补充也能看懂每个需求做了什么、代码层面动了什么，会议是大家对着它讨论，而不是你脱稿讲。diff 用 diff2html 直接渲染在页面里（默认收起，点击原地展开），不需要跳转到 GitHub 就能看到真正的对比视图。

**用法**：`/code-review-prep [START_DATE]`
- 无参数：只看今天
- 有参数：从该日期到今天（覆盖会议之间隔了几天的情况）

## 配置

配置文件 `.claude/skills/code-review-prep/config.json`（参考同目录下的 `config.example.json`，未加入 git 版本控制）：
- **扫描目录**：`scanDir` 字段
- **Jira 链接前缀**：`jiraBaseUrl` 字段

不翻译关键词表 `.claude/skills/code-review-prep/no-translate.json`（参考同目录下的 `no-translate.example.json`，未加入 git 版本控制，可直接编辑追加）：第 7 步把英文内容翻译成中文时，这份列表里的词保持英文原文不译。

## 执行步骤

第 3-7 步均通过 subagent 执行，且输入/输出尽量都走文件：每个 subagent 的最终回复只允许是简短的一句话统计或一个文件路径，不把文件/正文内容复述在回复里；主线程本身也不读取这些中间文件，只把路径原样传给下一步 subagent 的 prompt。第 0/1/2/8 步信息量很小（几个字符串、一个路径），主线程直接执行即可，不需要 subagent。

### 0. 读取配置

读取 `.claude/skills/code-review-prep/config.json`，取 `scanDir` 和 `jiraBaseUrl` 的值。若文件不存在，提示用户参考同目录下的 `config.example.json` 创建。

### 1. 确定日期范围

运行 `date +%Y-%m-%d` 取今天日期，作为 `END_DATE`。
若用户提供了参数，该参数作为 `START_DATE`；否则 `START_DATE` = `END_DATE`（只看今天）。

本次运行的所有中间产物和最终报告都放在同一个按日期范围命名的目录 `RUN_DIR` 下，避免不同日期范围的多次运行互相覆盖：`START_DATE` = `END_DATE` 时 `RUN_DIR` = `code-review-prep/<END_DATE>`，否则 `RUN_DIR` = `code-review-prep/<START_DATE>_to_<END_DATE>`。

### 2. 获取 git 作者

运行：`git config --global user.email`

### 3. 采集提交信息（不含 diff）

启动一个 subagent 执行：

```bash
node .claude/skills/code-review-prep/collect-commits-range.js <START_DATE> <END_DATE> <email> > <RUN_DIR>/commits.txt
```

告诉 subagent：这条命令本身就是完整任务，跑完之后不需要读取/复述文件内容，只需数一下有多少个 `=== REPO:` 段落、多少条 `--- COMMIT`，回复一句话，例如"commits.txt 已写入，N 个仓库共 M 条提交"。

输出结构（`commits.txt`）：每个有提交的仓库以 `=== REPO: <name> (github: <owner/repo>) ===` 开头（无 GitHub 远程时省略括号部分），每条 commit 以 `--- COMMIT <hash> ---` 分隔，后跟完整 commit message（subject + body），仓库结尾是 `=== END REPO ===`。不含 diff——diff 由第 6 步按需生成。

若 subagent 回报的提交总数为 0（所有仓库均无提交），主线程直接告知用户"这段时间没有提交记录"并停止，不再进行后续步骤。

### 4. 查询 Jira 上下文

启动一个 subagent 执行：读取 `<RUN_DIR>/commits.txt`，从每条 commit message 中提取 Jira 编号（形如 `TO-1234`）并去重，用 jira skill（`mcp-atlassian`）逐个查询标题/描述作为背景上下文；查询失败的编号跳过，不阻断整体流程。把结果写入 `<RUN_DIR>/jira-context.json`：

```json
{
  "TO-1234": { "title": "...", "description": "..." }
}
```

subagent 的最终回复只需一句话统计（例如"jira-context.json 已写入，K 个编号，J 个查询失败已跳过"），不把标题/描述内容复述在回复里。

### 5. 生成内容（英文）

启动一个 subagent 执行：读取 `<RUN_DIR>/commits.txt` 和 `<RUN_DIR>/jira-context.json`，完成分组与英文叙事撰写，写入 `<RUN_DIR>/manifest.en.json`。同时告诉它第 0 步读到的 `scanDir`（用于必要时拼出 `<scanDir>/<repoName>` 查看某个 commit 的实际 diff）。

**分组单位是 Jira 需求，不是仓库**：把所有 commit 按提取到的 Jira 编号分组（同一个编号下的多条 commit，无论跨几个仓库，合并成一段完整叙事）；没有 Jira 编号的 commit 归入 `others`，逐条列出、不与任何需求合并。

**需求内部按仓库分段**：如果一个需求涉及多个仓库，叙事不按 commit 时间顺序逐条讲，而是按仓库拆成几段，对应 `repos` 数组的一个元素（`<h3>仓库名</h3>` 小标题由 `render-report.js` 在 `repos.length > 1` 时自动加，不用在 `narrativeHtml` 里手写）。只涉及一个仓库的需求，`repos` 数组只有一个元素即可，脚本会自动省略小标题。

**判断改动内容**：默认基于 commit message 判断；message 描述不清楚，或需要判断是否有值得一提的线索（依赖后端确认的字段、内容团队还没给最终文案、已知会影响用户体验的临时状态、修复了一个已上线的 bug 等）时，用 `git -C <scanDir>/<repoName> show <hash>` 查看该 commit 的实际 diff。读大段纯数据/翻译文本类的 diff（比如一次性新增上千行翻译 key）时不需要逐行细读，扫一眼文件名和改动规模、判断出"这是批量翻译数据"即可。

**写作视角（核心要求，用英文撰写）**：正文一律用英文的业务/产品语言描述"这个需求做了什么、代码层面动了什么"，**不出现函数名、变量名、文件路径、类名等代码符号**——想看这些细节的人展开 diff 区块自己看。默认读者是没读过 diff、甚至不熟悉这块代码的同事，读完要能明白"这个需求解决了什么问题、目前做到什么程度"。

**不要单独摘出风险小节**：不再对每条打 🔴/🟢 分级，也不写"为什么算风险 + 会上要拍板"这种固定结构。如果某个需求里有值得注意的点，就作为叙事里自然的一句话带过，像讲一件事的来龙去脉一样，不要用醒目的标记单独拎出来。

**只讲结论，不讲原因**：叙事只说"改了什么、现在是什么状态"，不解释"为什么会这样/为什么这么改"——技术根因和业务决策理由都不展开，留给展开 diff 的人自己看。但事实性的待办/依赖（比如"copy still needs content team sign-off""this field still needs backend confirmation"）本身要保留，只是不解释为什么会有这个待办。

**组装 manifest（此时不含 diffFile/mode——diff 由第 6 步生成后回填）**：

```json
{
  "startDate": "<START_DATE>", "endDate": "<END_DATE>",
  "stories": [
    {
      "jiraKey": "TO-1234", "title": "One-line summary of the story", "tocSummary": "What was done, for the ToC table's third column",
      "repos": [
        {
          "repoName": "pimsleur-learn-web", "slug": "<owner>/<repo>",
          "narrativeHtml": "<p>...business narrative in English for this repo...</p>",
          "commits": [{ "hash": "<full hash1>" }, { "hash": "<full hash2>" }]
        }
      ]
    }
  ],
  "others": [
    {
      "summary": "One-line summary in English", "repoName": "...", "slug": "...",
      "commits": [{ "hash": "..." }]
    }
  ]
}
```

`narrativeHtml` 里可以用 `<a>`/`<strong>` 等行内标签，脚本原样嵌入不做二次转义。

格式要求（针对 `narrativeHtml`/`tocSummary`/`summary`/`title` 的行文本身，不是 HTML 结构）：
- 独立可读的说明性文字（完整句子），第三人称/客观描述改动，不要写"I did..."
- 不要"today's work summary"之类的废话前缀

把这份 JSON 写到 `<RUN_DIR>/manifest.en.json`。subagent 的最终回复只需一句话统计（例如"manifest.en.json 已写入，N 个需求 + M 条其他改动"），不把叙事正文复述在回复里。

### 6. 生成合并 diff，回填 manifest

启动一个 subagent 执行：读取 `<RUN_DIR>/manifest.en.json`，对每个 story 的每个 repo 条目、以及每条 `others` 条目，按里面列出的 commit hash 生成 diff 并落盘，然后把 `diffFile`/`mode` 字段直接回填进 `<RUN_DIR>/manifest.en.json`（覆盖同一个文件，不新建文件）。同时告诉它第 0 步读到的 `scanDir`（用于拼出 `<scanDir>/<repoName>` 定位仓库路径）。

对 `stories` 里的 repo 条目（`code-review-prep/` 已加入 `.gitignore`，中转文件不需要清理）：

```bash
mkdir -p <RUN_DIR>/diffs
node .claude/skills/code-review-prep/merge-story-diff.js <repo路径> <hash1> <hash2> ... > <RUN_DIR>/diffs/<story>-<repo>.diff
```

hash 顺序不重要，脚本自己按 commit 时间排序；只有 1 个 commit 时也可以直接传，脚本会走单 commit 快路径。脚本内部处理 worktree 创建/cherry-pick/合并 diff/清理全过程（含 cherry-pick 冲突时的回退拼接），全程不接触用户实际的工作目录。

输出第一行是 `MODE: SINGLE` / `MODE: MERGED` / `MODE: FALLBACK_CONCAT` 之一，原样填进对应条目的 `mode` 字段：
- `SINGLE`：单 commit，用它自己的 diff。
- `MERGED`：多 commit 合并成功。
- `FALLBACK_CONCAT`：cherry-pick 冲突，已自动清理现场退回按 commit 拼接——`render-report.js` 会在标题末尾自动注明"（合并失败，以下为按 commit 拼接的版本）"，不需要手动处理措辞。

对 `others` 里的条目（每条独立、不与其他 commit 合并），`mode` 固定填 `SINGLE`：

```bash
git -C <repo路径> show --format="" <hash> > <RUN_DIR>/diffs/others-<repo>-<短hash>.diff
```

`diffFile` 字段填对应生成的文件路径。subagent 的最终回复只需一句话统计（例如"N 个 diff 已生成，manifest.en.json 已回填"），不把 diff 内容复述在回复里。

### 7. 翻译成中文，生成报告

启动一个 subagent 执行：读取 `.claude/skills/code-review-prep/no-translate.json`（不翻译关键词列表）和 `<RUN_DIR>/manifest.en.json`，把 `title`/`tocSummary`/`narrativeHtml`/`summary` 这几类正文字段从英文翻译成中文；翻译时列表里出现的词（不区分大小写，只要能识别是同一个词）保持英文原文不译。其余结构字段（`jiraKey`、`repoName`、`slug`、`diffFile`、`mode`、`commits`、`startDate`、`endDate`）原样保留。把结果写入**新文件** `<RUN_DIR>/manifest.json`（不修改 `manifest.en.json`）。

写完后紧接着跑：

```bash
node .claude/skills/code-review-prep/render-report.js <RUN_DIR>/manifest.json
```

脚本会自己读 `config.json` 的 `jiraBaseUrl`，拼好所有链接和 diff-block 结构，把最终 HTML 直接写到 `<RUN_DIR>/report.html`，并把写出的文件路径打印到 stdout。

subagent 的最终回复**只返回这一个文件路径**，不附加其他内容。

### 8. 完成

把 subagent 返回的文件路径告知用户（HTML 不适合直接在终端展示，提示用浏览器打开）。**不 git commit**（这是会前准备材料，不是工作日志，`code-review-prep/` 已加入 `.gitignore`）。
