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

## 执行步骤

### 0. 读取配置

读取 `.claude/skills/code-review-prep/config.json`，取 `scanDir` 和 `jiraBaseUrl` 的值。若文件不存在，提示用户参考同目录下的 `config.example.json` 创建。

### 1. 确定日期范围

运行 `date +%Y-%m-%d` 取今天日期，作为 `END_DATE`。
若用户提供了参数，该参数作为 `START_DATE`；否则 `START_DATE` = `END_DATE`（只看今天）。

本次运行的所有中间产物和最终报告都放在同一个按日期范围命名的目录 `RUN_DIR` 下，避免不同日期范围的多次运行互相覆盖：`START_DATE` = `END_DATE` 时 `RUN_DIR` = `code-review-prep/<END_DATE>`，否则 `RUN_DIR` = `code-review-prep/<START_DATE>_to_<END_DATE>`。

### 2. 获取 git 作者

运行：`git config --global user.email`

### 3. 采集提交与 diff

运行：

```bash
node .claude/skills/code-review-prep/collect-commits-range.js <START_DATE> <END_DATE> <email>
```

输出结构：每个有提交的仓库以 `=== REPO: <name> (github: <owner/repo>) ===` 开头（无 GitHub 远程时省略括号部分），每条 commit 以 `--- COMMIT <hash> ---` 分隔，先输出完整 commit message（subject + body），再输出 `--- DIFF ---` 及该 commit 的完整 diff（不截断）。message 是你判断改动内容、写叙事的参考；diff 除了同样作为参考，其原始文本还要原样嵌入最终 HTML 页面供 diff2html 渲染。

若所有仓库均无提交，直接告知用户"这段时间没有提交记录"并停止。

### 4. 查询 Jira 上下文

从每条 commit message 中提取 Jira 编号（形如 `TO-1234`），去重后，用 jira skill（`mcp-atlassian`）查询每个编号对应的标题/描述，作为该 commit 的背景上下文。查询失败的编号跳过，不阻断整体流程。

### 5. 生成每个（需求 × 仓库）组合的合并 diff，并落盘

把 3 采集到的 commit 先按 Jira 编号分组，再在组内按仓库分组。对每个有 Jira 编号的（需求 × 仓库）组合，运行（`code-review-prep/` 已加入 `.gitignore`，中转文件不需要清理）：

```bash
mkdir -p <RUN_DIR>/diffs
node .claude/skills/code-review-prep/merge-story-diff.js <repo路径> <hash1> <hash2> ... > <RUN_DIR>/diffs/<story>-<repo>.diff
```

hash 顺序不重要，脚本自己按 commit 时间排序；只有 1 个 commit 时也可以直接传，脚本会走单 commit 快路径。脚本内部处理 worktree 创建/cherry-pick/合并 diff/清理全过程（含 cherry-pick 冲突时的回退拼接），全程不接触用户实际的工作目录。

输出第一行是 `MODE: SINGLE` / `MODE: MERGED` / `MODE: FALLBACK_CONCAT` 之一，第 6 步组装 manifest 时原样填进对应 diff-block 的 `mode` 字段：
- `SINGLE`：单 commit，用它自己的 diff。
- `MERGED`：多 commit 合并成功。
- `FALLBACK_CONCAT`：cherry-pick 冲突，已自动清理现场退回按 commit 拼接——`render-report.js` 会在标题末尾自动注明"（合并失败，以下为按 commit 拼接的版本）"，不需要手动处理措辞。

没有 Jira 编号的"其他改动"每条 commit 保持独立、不与其他 commit 合并，但同样要把 diff 落盘（`mode` 固定填 `SINGLE`）：

```bash
git -C <repo路径> show --format="" <hash> > <RUN_DIR>/diffs/others-<repo>-<短hash>.diff
```

### 6. 生成内容

**分组单位是 Jira 需求，不是仓库**：把所有 commit 按提取到的 Jira 编号分组（同一个编号下的多条 commit，无论跨几个仓库，合并成一段完整叙事）；没有 Jira 编号的 commit 归入文档末尾单独的"其他改动"分组，逐条列出、不与任何需求合并。

**需求内部按仓库分段**：如果一个需求涉及多个仓库，叙事不按 commit 时间顺序逐条讲，而是按仓库拆成几段，对应第 6 步 manifest 里 `repos` 数组的一个元素（`<h3>仓库名</h3>` 小标题由 `render-report.js` 在 `repos.length > 1` 时自动加，不用在 `narrativeHtml` 里手写）。只涉及一个仓库的需求，`repos` 数组只有一个元素即可，脚本会自动省略小标题。

**写作视角（核心要求）**：正文一律用业务/产品语言描述"这个需求做了什么、代码层面动了什么"，**不出现函数名、变量名、文件路径、类名等代码符号**——想看这些细节的人展开下面的 diff 区块自己看。默认读者是没读过 diff、甚至不熟悉这块代码的同事，读完要能听懂"这个需求解决了什么问题、目前做到什么程度"。

**专有名词、特定业务术语不要翻译**：产品功能名、语言名、内部黑话这类团队日常就用原词（通常是英文）交流的词，直接保留原词嵌进中文叙事里，不要另造一个中文翻译（这类翻译反而增加同事识别成本）。判断"是不是这类词"时可以参考 diff/commit message 里出现的字段名、常量名、注释——例如 diff 里的 `InterfaceLanguage.JA` / `languageNames.Japanese` 说明这门语言在团队语境里就叫 Japanese，不必写成"日语"；`library`、`flashCards`、`certificatesBadges`、`allAccess`、`freeProducts`/`purchasedProducts` 这些 i18n key 或变量名，对应的正文提法就该是 Library、Flashcards、Certificates & Badges、All Access、Free/Purchased，而不是"资料库"、"闪卡"、"勋章证书"、"畅学套餐"、"免费/已购课程"；`function_version` 关联的是 CloudFront Function，就直接写 CloudFront Function 的 version，而不是"边缘计算函数的版本号"。

**不要单独摘出风险小节**：不再对每条打 🔴/🟢 分级，也不写"为什么算风险 + 会上要拍板"这种固定结构。如果某个需求里有值得注意的点（比如依赖后端确认的字段、内容团队还没给最终文案、已知会影响用户体验的临时状态、修复了一个已经上线的 bug），就作为叙事里自然的一句话带过，像讲一件事的来龙去脉一样，不要用醒目的标记单独拎出来。判断"值不值得一提"时可以参考（但不必是穷举）：是否涉及支付/权限相关逻辑、是否是数据库变更、改动是否很大且没有测试、是否是对之前改动的返工/修复、是否让用户看到了还没做完的内容。读大段纯数据/翻译文本类的 diff（比如一次性新增上千行翻译 key）时不需要逐行细读，扫一眼文件名和改动规模、判断出"这是批量翻译数据"即可。

**只讲结论，不讲原因**：叙事只说"改了什么、现在是什么状态"，不解释"为什么会这样/为什么这么改"——包括代码层面的技术根因（比如某个字段为什么是空值、某处比较逻辑为什么会误判）和业务层面的决策理由（比如为什么参考了哪个历史方案、为什么选择这种设计）都不展开，这类推导过程留给展开 diff 的人自己看。但事实性的待办/依赖（比如"文案还需内容团队确认""这个字段还需后端确认"）本身要保留，只是不解释为什么会有这个待办。

**组装 manifest，交给脚本渲染**：不手写 HTML，把结构信息和写好的叙事组织成一份 JSON，字段含义见 `.claude/skills/code-review-prep/render-report.js` 头部注释——大致形状：

```json
{
  "startDate": "<START_DATE>", "endDate": "<END_DATE>",
  "stories": [
    {
      "jiraKey": "TO-1234", "title": "需求一句话概括", "tocSummary": "汇总表格里的“做了什么”一列",
      "repos": [
        {
          "repoName": "pimsleur-learn-web", "slug": "<owner>/<repo>",
          "narrativeHtml": "<p>...这个仓库范围内的业务叙事...</p>",
          "diffFile": "<RUN_DIR>/diffs/TO-1234-pimsleur-learn-web.diff", "mode": "MERGED",
          "commits": [{ "hash": "<完整hash1>" }, { "hash": "<完整hash2>" }]
        }
      ]
    }
  ],
  "others": [
    {
      "summary": "一句话业务话术", "repoName": "...", "slug": "...",
      "diffFile": "<RUN_DIR>/diffs/others-....diff", "mode": "SINGLE",
      "commits": [{ "hash": "..." }]
    }
  ]
}
```

`narrativeHtml` 里可以用 `<a>`/`<strong>` 等行内标签，脚本原样嵌入不做二次转义；`repos` 数组只有 1 个元素时脚本自动省略 `<h3>`；commit 链接、短 hash、`（合并 N 个 commit）`/`（合并失败…）`等标题措辞全部由脚本按 `mode` + `commits` + `slug` 自动生成，manifest 里不用手写。

把这份 JSON 写到 `<RUN_DIR>/manifest.json`，然后运行：

```bash
node .claude/skills/code-review-prep/render-report.js <RUN_DIR>/manifest.json
```

脚本会自己读 `config.json` 的 `jiraBaseUrl`，拼好所有链接和 diff-block 结构，把最终 HTML 直接写到 `<RUN_DIR>/report.html`，并把写出的文件路径打印到 stdout。

格式要求（针对 `narrativeHtml`/`summary` 的行文本身，不是 HTML 结构）：
- 独立可读的说明性文字（完整句子），用第三人称/客观描述改动，不要写"我做了……"
- 不要"今日工作总结"之类的废话前缀

### 7. 完成

把 render-report.js 打印出的文件路径告知用户（HTML 不适合直接在终端展示，提示用浏览器打开）。**不 git commit**（这是会前准备材料，不是工作日志，`code-review-prep/` 已加入 `.gitignore`）。
