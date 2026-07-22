# Order Page Prompt Coverage Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 `test_order_page_playwright_prompts.md` 全部 66 条需求的可审计覆盖矩阵，并把无法安全实现的场景同步为结构化脚本录制需求。

**Architecture:** 以提示词编号作为稳定主键，先机械导入 66 条标题，再按四个连续编号区间逐条核对现有测试、Page/Flow 能力和业务断言。覆盖矩阵保存最终状态与证据；`docs/playwright-recordings-needed.md` 只承载矩阵中 `需要录制` 的场景，两份文档通过稳定录制编号双向关联。

**Tech Stack:** Markdown、PowerShell、ripgrep、Git、Playwright Test、TypeScript 5.9

## Global Constraints

- 需求源固定为 `C:\Users\nhqrt\Desktop\test_order_page_playwright_prompts.md` 当前 66 条提示词。
- 已有用例只有在业务目标、关键前置、操作路径和核心断言均等价时才标记 `已等价覆盖`；Jira Key 命中本身不是完成证据。
- 覆盖矩阵最终状态只能是 `已等价覆盖`、`待补断言`、`可直接实现`、`需要录制`、`产品异常`、`环境阻塞`。
- 不猜测 DOM，不枚举候选选择器，不用 `.or()`、多语言兜底、脆弱 CSS 或 XPath 补齐缺失能力。
- 录制需求必须从 POS 首页开始，写清前置数据、完整路径、最终断言位置、所需 DOM/网络证据和计划新增的 Page/Flow API。
- 本计划只完成批次 0 的覆盖矩阵和录制需求清单，不实现业务测试；后续业务域分别制定实施计划，不能缩减 66 条总范围。
- 所有文档使用 UTF-8，提交前运行 `git diff --check`。

---

### Task 1: 建立 66 条需求注册表

**Files:**
- Create: `docs/plans/2026-07-14-order-page-prompt-coverage.md`
- Reference: `C:\Users\nhqrt\Desktop\test_order_page_playwright_prompts.md`
- Reference: `docs/superpowers/specs/2026-07-14-order-page-prompt-regression-design.md`

**Interfaces:**
- Consumes: 提示词标题格式 `## <编号>. <标题>`。
- Produces: 以编号 1～66 为主键的 Markdown 覆盖矩阵；Tasks 2～6 只更新该矩阵，不创建第二份状态表。

- [ ] **Step 1: 提取当前提示词标题并确认源文件基线**

Run:

```powershell
$prompt = 'C:\Users\nhqrt\Desktop\test_order_page_playwright_prompts.md'
$raw = Get-Content -Raw -LiteralPath $prompt -Encoding UTF8
$cases = [regex]::Matches($raw, '(?m)^## (?<n>\d+)\. (?<title>.+)$')
$numbers = @($cases | ForEach-Object { [int]$_.Groups['n'].Value })
[pscustomobject]@{
  Count = $cases.Count
  First = $numbers[0]
  Last = $numbers[-1]
  NumberingIssues = @(Compare-Object (1..66) $numbers).Count
}
$cases | ForEach-Object {
  '{0}|{1}' -f $_.Groups['n'].Value, $_.Groups['title'].Value.Trim()
}
```

Expected: `Count=66`、`First=1`、`Last=66`、`NumberingIssues=0`，随后输出 66 行编号与标题。

- [ ] **Step 2: 创建覆盖矩阵文档**

Create `docs/plans/2026-07-14-order-page-prompt-coverage.md` with this exact document structure:

```markdown
# 点单页面提示词覆盖矩阵

## 数据源

- 提示词：`C:\Users\nhqrt\Desktop\test_order_page_playwright_prompts.md`
- 设计：`docs/superpowers/specs/2026-07-14-order-page-prompt-regression-design.md`
- 基线：66 条，编号 1～66。

## 状态口径

| 状态 | 完成证据 |
|---|---|
| 已等价覆盖 | 具体 spec、中文测试标题和关键断言均与提示词等价 |
| 待补断言 | 已有路径可执行，但缺少提示词要求的核心可观察结果 |
| 可直接实现 | 真实 Page/Flow API 和稳定 DOM 契约已经存在 |
| 需要录制 | 缺真实路径、DOM、配置入口或业务预期；关联唯一录制编号 |
| 产品异常 | 已有可重复执行证据证明实际结果与需求冲突 |
| 环境阻塞 | 缺账号、权限、数据、打印目录或外部服务，并记录恢复条件 |

## 汇总

| 已等价覆盖 | 待补断言 | 可直接实现 | 需要录制 | 产品异常 | 环境阻塞 | 总数 |
|---:|---:|---:|---:|---:|---:|---:|
| 0 | 0 | 0 | 0 | 0 | 0 | 66 |

## 明细

| 编号 | Jira | 标题 | 业务域 | 状态 | 覆盖或缺口证据 | 计划落点 | 录制编号 | 最近验证 |
|---:|---|---|---|---|---|---|---|---|
```

Append exactly 66 table rows using the Step 1 output. Extract every Jira Key from each title; if a title has no Jira Key, use `—`. Set the intermediate fields to these explicit values until their domain task audits them:

```markdown
| <source number> | <all Jira keys from the source title or —> | <exact source title> | 未归类 | 未审计 | 尚未执行语义审计 | 本矩阵对应域任务 | — | 源文件基线检查通过 |
```

`<...>` denotes values taken directly from the Step 1 command output, not free-form text or an unresolved requirement.

- [ ] **Step 3: 验证矩阵行数与编号**

Run:

```powershell
$matrix = Get-Content -Raw -LiteralPath 'docs\plans\2026-07-14-order-page-prompt-coverage.md' -Encoding UTF8
$rows = [regex]::Matches($matrix, '(?m)^\| (?<n>\d+) \| (?:(?:POS-\d+)(?:,\s*POS-\d+)*|—) \|')
$numbers = @($rows | ForEach-Object { [int]$_.Groups['n'].Value })
[pscustomobject]@{
  Rows = $rows.Count
  First = $numbers[0]
  Last = $numbers[-1]
  NumberingIssues = @(Compare-Object (1..66) $numbers).Count
}
```

Expected: `Rows=66`、`First=1`、`Last=66`、`NumberingIssues=0`。

- [ ] **Step 4: Commit Task 1**

```powershell
git add -- 'docs/plans/2026-07-14-order-page-prompt-coverage.md'
git commit -m "docs: register order page prompt coverage"
```

---

### Task 2: 审计提示词 1～19（菜单、Option 与基础点单）

**Files:**
- Modify: `docs/plans/2026-07-14-order-page-prompt-coverage.md`
- Reference: `tests/py-migrate/order.service.spec.ts`
- Reference: `pages/order-dishes.page.ts`
- Reference: `pages/order-dishes/`
- Reference: `flows/order-dishes.flow.ts`
- Reference: `docs/plans/2026-05-20-order-page-py-migrate.md`

**Interfaces:**
- Consumes: Task 1 rows 1～19。
- Produces: 菜单组/分类、类级与菜级 option、改价、备注、Open Food、客户信息和基础权限场景的最终分类与证据。

- [ ] **Step 1: 查找 1～19 的现有 Jira 与语义覆盖**

Run:

```powershell
rg -n "POS-15602|POS-15605|POS-15641|POS-15643|POS-15737|POS-15758|POS-15759|POS-15760|POS-15761|POS-15762|POS-15763|open.food|option|备注|改价|客户信息|删菜权限" tests pages flows test-data docs/plans/2026-05-20-order-page-py-migrate.md
```

Expected: 返回现有测试、Page/Flow API、测试数据或历史能力缺口；没有命中的场景仍需检查对应提示词步骤，不能因搜索无结果自动标记 `需要录制`。

- [ ] **Step 2: 逐条核对已有测试的关键断言**

For every candidate hit, inspect the full test body and its called Page/Flow methods. Apply these exact decisions:

```text
业务目标、前置、路径、最终断言全部等价 -> 已等价覆盖
路径等价但最终断言缺失或断言对象不同 -> 待补断言
没有现有测试，但真实 API 与 DOM 契约完整 -> 可直接实现
入口、DOM、配置或预期任一无法确定 -> 需要录制
已有可复现实际结果与需求冲突 -> 产品异常
仅缺外部账号、权限、数据或服务 -> 环境阻塞
```

Evidence for `已等价覆盖` must use this exact shape in the matrix cell:

```text
tests/py-migrate/<file>.spec.ts:<line>；<完整中文测试标题>；关键断言：<被断言的数据及期望>
```

Evidence for every other status must name the missing or conflicting behavior and the exact target file or recovery condition.

- [ ] **Step 3: 更新行 1～19 与汇总计数**

Use `apply_patch` to replace `未归类`、`未审计` and generic evidence in rows 1～19. Use business domains only from this set: `菜单与语言`、`Option`、`改价折扣备注`、`Open Food`、`客户信息`、`权限与 Void`、`分单与小费`、`送厨与合并菜`。

Recalculate the summary row by counting all current final statuses; keep remaining unaudited rows outside that total distribution but keep total fixed at 66.

- [ ] **Step 4: 验证行 1～19 无未审计状态**

Run:

```powershell
$matrix = Get-Content -LiteralPath 'docs\plans\2026-07-14-order-page-prompt-coverage.md' -Encoding UTF8
$targetRows = $matrix | Where-Object { $_ -match '^\| (?<n>\d+) \| (?:(?:POS-\d+)(?:,\s*POS-\d+)*|—) \|' -and [int]$Matches.n -le 19 }
$unaudited = @($targetRows | Where-Object { $_ -match '未审计|未归类|尚未执行语义审计' })
[pscustomobject]@{ Rows = $targetRows.Count; Unaudited = $unaudited.Count }
```

Expected: `Rows=19`、`Unaudited=0`。

- [ ] **Step 5: Commit Task 2**

```powershell
git add -- 'docs/plans/2026-07-14-order-page-prompt-coverage.md'
git commit -m "docs: audit order page menu and option coverage"
```

---

### Task 3: 审计提示词 20～39（分单、搜索、Modify 与小费）

**Files:**
- Modify: `docs/plans/2026-07-14-order-page-prompt-coverage.md`
- Reference: `tests/py-migrate/order.service.spec.ts`
- Reference: `tests/py-migrate/split-order-operation.spec.ts`
- Reference: `pages/split-order.page.ts`
- Reference: `pages/recall.page.ts`
- Reference: `pages/order-dishes/`
- Reference: `flows/split-order.flow.ts`
- Reference: `flows/recall.flow.ts`
- Reference: `flows/payment.flow.ts`

**Interfaces:**
- Consumes: Task 1 rows 20～39 and Task 2 evidence format。
- Produces: 平分、拖动/座位/金额分单、部分子单支付、搜索、Global Option Modify、整数数量和大额小费场景的最终分类与证据。

- [ ] **Step 1: 查找 20～39 的现有覆盖与能力**

Run:

```powershell
rg -n "POS-16303|POS-16314|POS-16315|POS-16316|POS-16318|POS-16324|POS-16325|POS-28674|POS-30575|POS-30762|POS-31045|POS-31662|POS-31663|POS-31664|POS-32905|POS-33110|POS-33122|POS-33447|POS-33456|split|suborder|global option|search" tests/py-migrate pages flows test-data
```

Expected: 能定位已迁移分单、大额小费、Delivery 信息和整数数量测试，以及仍缺失的搜索、套餐 option 与 Modify 行为。

- [ ] **Step 2: 按 Task 2 的六项决策规则完成语义审计**

Inspect complete bodies, not only titles. For split tests, evidence must state split mode, suborder count/payment state, and amount/tip assertion. For Modify tests, evidence must state whether the panel remains visible and whether add/count/reduce reaches zero.

- [ ] **Step 3: 更新行 20～39 与汇总计数**

Use business domains only from this set: `分单与小费`、`Open Food`、`改价折扣备注`、`客户信息`、`菜单与搜索`、`Modify`、`数量`、`支付与小费`。

For every `需要录制` row, temporarily set the recording cell to `待 Task 6 分配` and name the exact missing UI action in the evidence cell. This phrase is an explicit cross-task state and must be absent after Task 6.

- [ ] **Step 4: 验证行 20～39 无未审计状态**

Run:

```powershell
$matrix = Get-Content -LiteralPath 'docs\plans\2026-07-14-order-page-prompt-coverage.md' -Encoding UTF8
$targetRows = $matrix | Where-Object { $_ -match '^\| (?<n>\d+) \| (?:(?:POS-\d+)(?:,\s*POS-\d+)*|—) \|' -and [int]$Matches.n -ge 20 -and [int]$Matches.n -le 39 }
$unaudited = @($targetRows | Where-Object { $_ -match '未审计|未归类|尚未执行语义审计' })
[pscustomobject]@{ Rows = $targetRows.Count; Unaudited = $unaudited.Count }
```

Expected: `Rows=20`、`Unaudited=0`。

- [ ] **Step 5: Commit Task 3**

```powershell
git add -- 'docs/plans/2026-07-14-order-page-prompt-coverage.md'
git commit -m "docs: audit order page split and modify coverage"
```

---

### Task 4: 审计提示词 40～53（权限、送厨、合并菜与小数数量）

**Files:**
- Modify: `docs/plans/2026-07-14-order-page-prompt-coverage.md`
- Reference: `tests/py-migrate/order.service.spec.ts`
- Reference: `tests/py-migrate/split-order-operation.spec.ts`
- Reference: `api/clients/system-configuration-api.client.ts`
- Reference: `api/setup/system-configuration.setup.ts`
- Reference: `pages/order-dishes/`
- Reference: `flows/order-dishes.flow.ts`

**Interfaces:**
- Consumes: Task 1 rows 40～53 and established evidence format。
- Produces: 礼品卡、权限口令、Hold/Delay、合并相同菜、小数数量和指定价格场景的最终分类与证据。

- [ ] **Step 1: 查找 40～53 的测试、配置 API 与页面能力**

Run:

```powershell
rg -n "POS-34106|POS-34873|POS-35325|POS-34895|POS-34903|POS-34910|POS-34842|POS-33186|POS-33241|POS-33244|POS-33600|POS-35129|POS-35660|decimal|combine.same|hold|delay|gift" tests pages flows api test-data
```

Expected: 显示可复用的数量读写与系统配置 API，并暴露礼品卡、Hold/Delay、行级权限和合并菜显示的真实能力缺口。

- [ ] **Step 2: 按 Task 2 的六项决策规则完成语义审计**

For cases 50 and 51, preserve them as separate decimal quantity inputs only if their source steps or expected subtotal boundary differs; record the difference explicitly. Never recreate the removed exact duplicate. For kitchen/permission cases, do not infer Hold/Delay or permission-dialog selectors from Recall order-void APIs.

- [ ] **Step 3: 更新行 40～53 与汇总计数**

Use business domains only from this set: `礼品卡`、`权限与 Void`、`送厨与合并菜`、`数量`、`分单与合单`、`Modify`。

Every `环境阻塞` row must state a concrete missing resource and the exact rerun condition; “环境不可用” alone is invalid.

- [ ] **Step 4: 验证行 40～53 无未审计状态**

Run:

```powershell
$matrix = Get-Content -LiteralPath 'docs\plans\2026-07-14-order-page-prompt-coverage.md' -Encoding UTF8
$targetRows = $matrix | Where-Object { $_ -match '^\| (?<n>\d+) \| (?:(?:POS-\d+)(?:,\s*POS-\d+)*|—) \|' -and [int]$Matches.n -ge 40 -and [int]$Matches.n -le 53 }
$unaudited = @($targetRows | Where-Object { $_ -match '未审计|未归类|尚未执行语义审计' })
[pscustomobject]@{ Rows = $targetRows.Count; Unaudited = $unaudited.Count }
```

Expected: `Rows=14`、`Unaudited=0`。

- [ ] **Step 5: Commit Task 4**

```powershell
git add -- 'docs/plans/2026-07-14-order-page-prompt-coverage.md'
git commit -m "docs: audit order page quantity and kitchen coverage"
```

---

### Task 5: 审计提示词 54～66（自定义类型、套餐、报表与语言）

**Files:**
- Modify: `docs/plans/2026-07-14-order-page-prompt-coverage.md`
- Reference: `pages/delivery.page.ts`
- Reference: `pages/report.page.ts`
- Reference: `pages/order-dishes/`
- Reference: `flows/takeout.flow.ts`
- Reference: `tests/py-migrate/order.service.spec.ts`
- Reference: `docs/plans/2026-05-20-order-page-py-migrate.md`

**Interfaces:**
- Consumes: Task 1 rows 54～66 and established evidence format。
- Produces: 自定义 Delivery/报表、搜索唯一性、套餐权限/改价/编辑、必选类、POS Name 和中文首字母搜索场景的最终分类与证据。

- [ ] **Step 1: 查找 54～66 的现有覆盖与能力**

Run:

```powershell
rg -n "POS-22640|POS-36286|POS-36255|POS-37804|custom.order|Report.Overview|POS NAME|display all one time|combo|套餐|首字母|必选类|限制折扣" tests pages flows api test-data docs/plans/2026-05-20-order-page-py-migrate.md
```

Expected: 定位现有 Delivery/Takeout、Report 和套餐相关能力，并明确打印、云报表、套餐子菜与后台菜单配置的缺口。

- [ ] **Step 2: 按 Task 2 的六项决策规则完成语义审计**

Printing and Report Overview are separate assertions even when they share a custom order type. Combo parent option and combo subitem option are different DOM contracts. Chinese initial search is not equivalent to switching display language.

- [ ] **Step 3: 更新行 54～66 与最终汇总计数**

Use business domains only from this set: `自定义类型与打印`、`客户信息`、`菜单与搜索`、`权限与 Void`、`菜单配置`、`套餐`、`分单与折扣`、`报表`、`语言与搜索`。

Recalculate all six status counts across rows 1～66. Their sum must be 66.

- [ ] **Step 4: 验证全部 66 行已经完成语义审计**

Run:

```powershell
$matrix = Get-Content -LiteralPath 'docs\plans\2026-07-14-order-page-prompt-coverage.md' -Encoding UTF8
$rows = @($matrix | Where-Object { $_ -match '^\| (?<n>\d+) \| (?:(?:POS-\d+)(?:,\s*POS-\d+)*|—) \|' })
$unaudited = @($rows | Where-Object { $_ -match '未审计|未归类|尚未执行语义审计' })
[pscustomobject]@{ Rows = $rows.Count; Unaudited = $unaudited.Count }
```

Expected: `Rows=66`、`Unaudited=0`。

- [ ] **Step 5: Commit Task 5**

```powershell
git add -- 'docs/plans/2026-07-14-order-page-prompt-coverage.md'
git commit -m "docs: audit order page custom and combo coverage"
```

---

### Task 6: 同步脚本录制需求

**Files:**
- Modify: `docs/plans/2026-07-14-order-page-prompt-coverage.md`
- Modify: `docs/playwright-recordings-needed.md`

**Interfaces:**
- Consumes: Tasks 2～5 中所有状态为 `需要录制` 的矩阵行。
- Produces: 稳定编号 `ORDER-PAGE-001` 起的录制需求，以及矩阵到录制文档的一对一关联。

- [ ] **Step 1: 提取所有需要录制的矩阵行**

Run:

```powershell
$rows = Get-Content -LiteralPath 'docs\plans\2026-07-14-order-page-prompt-coverage.md' -Encoding UTF8
$recordingRows = @($rows | Where-Object { $_ -match '^\| (?<n>\d+) \| (?:(?:POS-\d+)(?:,\s*POS-\d+)*|—) \|' -and $_ -match '\| 需要录制 \|' })
$recordingRows
'RecordingCount={0}' -f $recordingRows.Count
```

Expected: 输出每一条需要录制的完整矩阵行和非负 `RecordingCount`；数量必须与矩阵汇总中的 `需要录制` 一致。

- [ ] **Step 2: 为每条需求分配稳定编号并写入录制文档**

Append a new section `## 点单页面提示词待补充` under the active pending area of `docs/playwright-recordings-needed.md`. Assign IDs in matrix-number order, beginning with `ORDER-PAGE-001`. Every entry must use this exact structure with values copied from the audited matrix and source prompt:

```markdown
### ORDER-PAGE-001：提示词 <编号> <标题>

- Jira：`<Jira Key>`；无 Key 时写“无”。
- 已知前置：<提示词中的订单类型、数据、账号、权限和配置>。
- 请从 POS 首页开始录制：
  1. <提示词要求的完整入口与操作范围>；
  2. <必须展示的中间弹窗或状态变化>；
  3. <最终断言所在页面和需要读取的数据>。
- 请保留证据：目标元素的 `data-testid`、role、label、可见文本，以及影响最终结果的关键网络请求。
- 当前阻塞：<矩阵中已经确认的具体缺口>。
- 录制返回后计划补充：`<准确 Page/Flow 文件>` 中的 `<拟新增职责>`。
```

The angle-bracket fields are direct values from the audited prompt and matrix. Do not copy the example ID to every entry; increment it sequentially and write the same ID into the corresponding matrix recording cell.

- [ ] **Step 3: 验证矩阵与录制文档双向一致**

Run:

```powershell
$matrix = Get-Content -Raw -LiteralPath 'docs\plans\2026-07-14-order-page-prompt-coverage.md' -Encoding UTF8
$recordings = Get-Content -Raw -LiteralPath 'docs\playwright-recordings-needed.md' -Encoding UTF8
$matrixIds = @([regex]::Matches($matrix, 'ORDER-PAGE-\d{3}') | ForEach-Object Value | Sort-Object -Unique)
$recordingIds = @([regex]::Matches($recordings, '(?m)^### (ORDER-PAGE-\d{3})：') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
[pscustomobject]@{
  MatrixIds = $matrixIds.Count
  RecordingIds = $recordingIds.Count
  MissingFromRecordings = @(Compare-Object $matrixIds $recordingIds | Where-Object SideIndicator -eq '<=').Count
  MissingFromMatrix = @(Compare-Object $matrixIds $recordingIds | Where-Object SideIndicator -eq '=>').Count
  DeferredMarkers = ([regex]::Matches($matrix, '待 Task 6 分配')).Count
}
```

Expected: `MatrixIds` 等于 `RecordingIds`，两个 Missing 均为 `0`，`DeferredMarkers=0`。

- [ ] **Step 4: Commit Task 6**

```powershell
git add -- 'docs/plans/2026-07-14-order-page-prompt-coverage.md' 'docs/playwright-recordings-needed.md'
git commit -m "docs: request order page Playwright recordings"
```

---

### Task 7: 完成批次 0 审计与验证

**Files:**
- Modify: `docs/plans/2026-07-14-order-page-prompt-coverage.md`
- Verify: `docs/playwright-recordings-needed.md`
- Verify: `tests/py-migrate/*.spec.ts`

**Interfaces:**
- Consumes: Tasks 1～6 的完整矩阵和录制关联。
- Produces: 可作为后续业务批次唯一范围入口的批次 0 基线。

- [ ] **Step 1: 验证 66 行、编号和最终状态集合**

Run:

```powershell
$matrix = Get-Content -Raw -LiteralPath 'docs\plans\2026-07-14-order-page-prompt-coverage.md' -Encoding UTF8
$rows = [regex]::Matches($matrix, '(?m)^\| (?<n>\d+) \| (?:(?:POS-\d+)(?:,\s*POS-\d+)*|—) \|(?<body>.+)$')
$numbers = @($rows | ForEach-Object { [int]$_.Groups['n'].Value })
$allowed = '已等价覆盖|待补断言|可直接实现|需要录制|产品异常|环境阻塞'
$invalid = @($rows | Where-Object { $_.Groups['body'].Value -notmatch "\| ($allowed) \|" })
[pscustomobject]@{
  Rows = $rows.Count
  NumberingIssues = @(Compare-Object (1..66) $numbers).Count
  InvalidStatuses = $invalid.Count
}
```

Expected: `Rows=66`、`NumberingIssues=0`、`InvalidStatuses=0`。

- [ ] **Step 2: 验证状态证据完整性**

Run:

```powershell
$rows = Get-Content -LiteralPath 'docs\plans\2026-07-14-order-page-prompt-coverage.md' -Encoding UTF8 | Where-Object { $_ -match '^\| (?<n>\d+) \| (?:(?:POS-\d+)(?:,\s*POS-\d+)*|—) \|' }
$invalidCovered = @($rows | Where-Object { $_ -match '\| 已等价覆盖 \|' -and $_ -notmatch 'tests/py-migrate/.+\.spec\.ts:\d+' })
$invalidRecording = @($rows | Where-Object { $_ -match '\| 需要录制 \|' -and $_ -notmatch 'ORDER-PAGE-\d{3}' })
$vagueEnvironment = @($rows | Where-Object { $_ -match '\| 环境阻塞 \|' -and $_ -match '环境不可用' })
[pscustomobject]@{
  CoveredWithoutSpecEvidence = $invalidCovered.Count
  RecordingWithoutId = $invalidRecording.Count
  VagueEnvironmentBlockers = $vagueEnvironment.Count
}
```

Expected: 三个计数均为 `0`。

- [ ] **Step 3: 验证提示词仍无完全重复正文**

Run:

```powershell
$raw = Get-Content -Raw -LiteralPath 'C:\Users\nhqrt\Desktop\test_order_page_playwright_prompts.md' -Encoding UTF8
$cases = [regex]::Matches($raw, '(?ms)^## (?<n>\d+)\. (?<title>.+?)\r?\n(?<body>.*?)(?=^## \d+\. |\z)')
$duplicates = @($cases | Group-Object { $_.Groups['body'].Value } | Where-Object Count -gt 1)
[pscustomobject]@{ Cases = $cases.Count; ExactDuplicateGroups = $duplicates.Count }
```

Expected: `Cases=66`、`ExactDuplicateGroups=0`。

- [ ] **Step 4: 运行仓库静态验证**

Run:

```powershell
npx tsc --noEmit
```

Expected: exit code `0`，无 TypeScript 错误。

Run:

```powershell
git diff --check
```

Expected: exit code `0`，无空白错误。

- [ ] **Step 5: 在矩阵顶部记录批次 0 验证结果**

Add a `## 批次 0 验证` section immediately before `## 汇总` with the exact commands from Steps 1～4, execution date `2026-07-14`, exit code, and observed counts. Do not write `PASS` for a command that was not executed successfully.

- [ ] **Step 6: Commit Task 7**

```powershell
git add -- 'docs/plans/2026-07-14-order-page-prompt-coverage.md' 'docs/playwright-recordings-needed.md'
git commit -m "docs: finalize order page prompt coverage baseline"
```

---

## Self-Review Notes

- Spec coverage: Task 1 creates the stable 66-row registry; Tasks 2～5 classify every row; Task 6 creates all required recording requests; Task 7 verifies numbering, status evidence, recording links, duplicate removal, type safety and whitespace.
- Scope: This plan implements only design batch 0. It deliberately does not add business tests; each business batch receives a separate implementation plan after this evidence baseline exists.
- Type consistency: All tasks use the same six final statuses, the same matrix path, and recording IDs matching `ORDER-PAGE-\d{3}`.
- Placeholder audit: Angle-bracket values in Tasks 1 and 6 are explicitly sourced fields filled during execution; no unresolved design or implementation decision remains in this plan.
