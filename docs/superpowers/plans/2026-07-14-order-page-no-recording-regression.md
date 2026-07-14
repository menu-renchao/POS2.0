# 点单页面无需录制用例实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建一个 Playwright spec，实现矩阵中的 5 条待补断言和 9 条可直接实现用例，并迁移同 Jira 旧用例避免重复。

**Architecture:** 14 条场景集中在 `tests/py-migrate/order-page-regression.spec.ts`，按菜单、折扣备注、分单小费、数量合单分组。只新增两个 Page 窄读取 API；其余动作复用现有 Flow，固定数据扩展到 `test-data/order-service.ts`，最终同步覆盖矩阵状态。

**Tech Stack:** TypeScript 5.9、Playwright Test 1.60、现有 Page/Flow/fixture/API setup。

## Global Constraints

- 所有场景从 POS 首页进入，禁止业务内页深链。
- `describe`、`test`、`test.step`、Page/Flow `@step(...)` 全部使用中文。
- Jira Key 同时保留在测试标题和 Playwright 原生 `annotation`。
- Page 只放 locator、动作和窄读取；Flow 放跨页面编排和业务策略。
- 新 locator 只使用成功 trace 已确认的单一 DOM 契约，不新增 `.or()`、多语言正则或候选链。
- 不使用 `waitForTimeout`；输入后确认沿用已有 200ms 稳定等待。
- 价格比较使用 Page 返回的 number，并转换为整数分断言。
- 48 条 `需要录制` 场景不进入本计划。

---

### Task 1: 建立新 spec 与两个 Page 窄读取 API

**Files:**
- Create: `tests/py-migrate/order-page-regression.spec.ts`
- Modify: `pages/order-dishes/order-dishes-locators.ts`
- Modify: `pages/order-dishes/order-dishes-menu.section.ts`
- Modify: `pages/order-dishes/order-dishes-reads.section.ts`
- Modify: `pages/order-dishes.page.ts`
- Modify: `test-data/order-service.ts`
- Modify: `tests/py-migrate/order.service.spec.ts`

**Interfaces:**
- Consumes: `HomeFlow.openHomeWithEmployeeContext`、`TakeoutFlow.startToGoOrder`、`RecallFlow` 现有回查能力。
- Produces: `readSelectedMenuGroupName(): Promise<string>`、`readCountText(): Promise<string>`、POS-15602/POS-32905 测试和新 spec 共享 helper。

- [ ] **Step 1: 先写失败测试并引用期望 API**

Create the new spec with these shared helpers and tests:

```ts
async function enterReadyHome(homePage: HomePage, employeeLoginPage: EmployeeLoginPage) {
  const ready = await new HomeFlow().openHomeWithEmployeeContext(homePage, employeeLoginPage);
  await ready.expectPrimaryFunctionCardsVisible();
  return ready;
}

async function saveAndReadLatestRecallDetails(orderDishesPage: OrderDishesPage) {
  const homePage = await orderDishesPage.saveOrder();
  const recallPage = await new RecallFlow().openRecallFromHome(homePage);
  const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
  await recallPage.openOrderDetails(orderNumber);
  return { details: await recallPage.readOrderDetailsSnapshot(), orderNumber, recallPage };
}

function toCents(value: number): number {
  return Math.round(value * 100);
}

test('[POS-15602] 应能切换菜单组并保存目标组菜品', {
  annotation: [jiraIssueAnnotation('POS-15602')],
}, async ({ homePage, employeeLoginPage }) => {
  const ready = await enterReadyHome(homePage, employeeLoginPage);
  const orderPage = await new TakeoutFlow().startToGoOrder(ready);
  await orderPage.switchMenu(orderServiceMenu.group, orderServiceMenu.category);
  expect(await orderPage.readSelectedMenuGroupName()).toBe(orderServiceMenu.group);
  await orderPage.clickDish(orderServiceDishes.regular.name);
  const before = (await orderPage.readOrderedItems()).find(
    (item) => item.name === orderServiceDishes.regular.name,
  );
  const { details } = await saveAndReadLatestRecallDetails(orderPage);
  const after = details.items.find((item) => item.name === orderServiceDishes.regular.name);
  expect(after?.name).toBe(before?.name);
  expect(after?.price).toBe(before?.price);
});

test('[POS-32905] 应能以整数原文展示累计菜品数量并保存', {
  annotation: [jiraIssueAnnotation('POS-32905')],
}, async ({ homePage, employeeLoginPage }) => {
  const ready = await enterReadyHome(homePage, employeeLoginPage);
  const orderPage = await new TakeoutFlow().startToGoOrder(ready);
  await new OrderDishesFlow().addDishToCart(orderPage, {
    ...orderServiceDishes.regular.menu,
    dishName: orderServiceDishes.regular.name,
    quantity: 3,
  });
  await new OrderDishesFlow().addRegularDish(
    orderPage,
    orderServiceDishes.test.name,
    orderServiceDishes.test.menu,
  );
  expect(await orderPage.readCountText()).toBe('4');
  const { details } = await saveAndReadLatestRecallDetails(orderPage);
  expect(details.items.find((item) => item.name === orderServiceDishes.regular.name)?.quantity).toBe('3');
  expect(details.items.find((item) => item.name === orderServiceDishes.test.name)?.quantity).toBe('1');
});
```

Use imports from the existing fixture, Page/Flow files, `orderServiceDishes`, `orderServiceMenu`, and `jiraIssueAnnotation`. Wrap business phases in Chinese `test.step` in the final code.

- [ ] **Step 2: 运行 RED**

```powershell
npx.cmd tsc --noEmit
```

Expected: FAIL because `readSelectedMenuGroupName` and `readCountText` do not exist.

- [ ] **Step 3: 集中实现 trace 已确认 locator 和 Page API**

Add to `OrderDishesLocators`:

```ts
readonly selectedMenuGroupName: Locator;
readonly countText: Locator;

this.selectedMenuGroupName = this.page.locator('#grplist .grplistbtAct .grplistbtText');
this.countText = this.page.locator('#ododttcnt');
```

Add to `OrderDishesMenuSection`:

```ts
@step('页面读取：读取当前选中的菜单组名称')
async readSelectedMenuGroupName(): Promise<string> {
  await this.host.expectLoaded();
  return (await this.locators.selectedMenuGroupName.innerText()).replace(/\s+/g, ' ').trim();
}
```

Add to `OrderDishesReadsSection`:

```ts
@step('页面读取：读取点单页 Count 原始文本')
async readCountText(): Promise<string> {
  await this.host.expectLoaded();
  return (await this.locators.countText.innerText()).trim();
}
```

Expose both methods through thin `OrderDishesPage` delegates using `Parameters<>` and `ReturnType<>`; do not add business logic to the facade.

- [ ] **Step 4: 添加集中测试数据**

Append to `test-data/order-service.ts`:

```ts
export const orderPageRegressionCases = {
  itemDiscount: { rate: 10 },
  modifier: { name: 'POS-42888', price: 0 },
  specialPriceDiscount: { price: 5.85, rate: 50, expectedSubtotal: 2.92 },
  splitTips: { tipAmountInCents: 200, splitTip: 1, mergedTip: 2 },
  splitEvenly: { count: 2 },
  splitBySeats: { guestCount: 2 },
  splitByAmount: { changedPrice: 10.6, amounts: [2, 8.6] },
  combineDecimal: { quantity: 2.55 },
  pricedDecimal: { price: 6.5, quantity: 1.5, expectedLineCents: 975 },
} as const;
```

- [ ] **Step 5: 运行 GREEN、迁移旧用例并提交**

```powershell
npx.cmd tsc --noEmit
npx.cmd playwright test tests/py-migrate/order-page-regression.spec.ts --project=py-migrate --grep "POS-15602|POS-32905" --reporter=line
```

Expected: 2 passed. Remove old POS-15602 data entry/test and old POS-32905 test from `order.service.spec.ts`; `rg -n "POS-15602|POS-32905" tests/py-migrate` must show only the new spec.

```powershell
git add -- pages/order-dishes test-data/order-service.ts tests/py-migrate/order-page-regression.spec.ts tests/py-migrate/order.service.spec.ts
git commit -m "test: add order page menu and count regressions"
```

---

### Task 2: 添加折扣与备注三条回归

**Files:**
- Modify: `tests/py-migrate/order-page-regression.spec.ts`

**Interfaces:**
- Consumes: `SelectTableFlow.enterDineInNoTableOrder`、`applyCustomItemPercentageDiscount`、`addCustomModifier`、`changeOrderedDishPrice`。
- Produces: POS-42886、POS-42888、POS-28674。

- [ ] **Step 1: 写三个真实 UI 测试**

Use these exact operations and assertions inside a Chinese `折扣与备注回归` describe:

```ts
// POS-42886
const before = (await orderPage.readPriceSummary()).Subtotal;
await orderFlow.applyCustomItemPercentageDiscount(orderPage, [dishName], 10);
const after = (await orderPage.readPriceSummary()).Subtotal;
expect(toCents(after)).toBe(Math.round(toCents(before) * 0.9));
expect((await orderPage.readOrderedItems()).flatMap(
  (item) => item.additions.map((addition) => addition.name),
)).toContain('Charge(10%)');

// POS-42888
await orderFlow.addCustomModifier(orderPage, {
  dishName,
  ...orderPageRegressionCases.modifier,
});
const { details } = await saveAndReadLatestRecallDetails(orderPage);
expect(details.items.find((item) => item.name === dishName)?.additions.map(
  (addition) => addition.name.trim(),
)).toContain('POS-42888');

// POS-28674
await orderPage.changeOrderedDishPrice(dishName, 5.85);
await orderFlow.applyCustomItemPercentageDiscount(orderPage, [dishName], 50);
expect((await orderPage.readPriceSummary()).Subtotal).toBe(2.92);
const saved = await saveAndReadLatestRecallDetails(orderPage);
expect(saved.details.priceSummary.Subtotal).toBe(2.92);
```

Each test starts from a fresh Dine In no-table order, adds `orderServiceDishes.regular`, uses its own Jira title/annotation, and has Chinese `test.step` phases.

- [ ] **Step 2: 定向运行并提交**

```powershell
npx.cmd playwright test tests/py-migrate/order-page-regression.spec.ts --project=py-migrate --grep "POS-42886|POS-42888|POS-28674" --reporter=line
```

Expected: 3 passed. Keep POS-23204 and POS-24394 in `split-order-operation.spec.ts`.

```powershell
git add -- tests/py-migrate/order-page-regression.spec.ts
git commit -m "test: add order page discount and modifier regressions"
```

---

### Task 3: 迁移五条分单用例并补完整持久化路径

**Files:**
- Modify: `tests/py-migrate/order-page-regression.spec.ts`
- Modify: `tests/py-migrate/order.service.spec.ts`

**Interfaces:**
- Consumes: `RecallFlow.openSplitOrder`、`SplitOrderFlow` 的 Even Order、按菜接收、By Amount、Unsplit、Even Item 和提交能力。
- Produces: POS-16303、POS-16314、POS-16316、POS-16318、POS-16325。

- [ ] **Step 1: 增加保存后进入分单和金额守恒 helper**

```ts
async function saveAndOpenSplit(orderPage: OrderDishesPage) {
  const homePage = await orderPage.saveOrder();
  const recallPage = await new RecallFlow().openRecallFromHome(homePage);
  const orderNumber = await new RecallFlow().readLatestVisibleOrderNumber(recallPage);
  const splitOrderPage = await new RecallFlow().openSplitOrder(recallPage, orderNumber);
  return { orderNumber, recallPage, splitOrderPage };
}

function suborderTotal(snapshot: SplitOrderSnapshot): number {
  return snapshot.suborders.reduce((sum, suborder) => sum + Number(suborder.total ?? 0), 0);
}
```

- [ ] **Step 2: 迁移并改写五条测试**

Implement these exact business paths:

```ts
// POS-16303: To Go 保存 -> Recall -> Even Order 2
await splitFlow.splitOrderEvenly(splitPage, 2);
const even = await splitPage.readSnapshot();
expect(even.suborders).toHaveLength(2);
expect(suborderTotal(even)).toBeCloseTo(Number(even.total), 2);

// POS-16314: 两个不同菜 -> 保存 -> Recall -> 将普通菜2接收到新子单
await splitFlow.moveDishToNewSuborder(splitPage, orderServiceDishes.test.name);
const moved = await splitPage.readSnapshot();
expect(moved.suborders).toHaveLength(2);
expect(moved.suborders.filter((order) => order.dishes.some(
  (dish) => dish.name === orderServiceDishes.test.name,
))).toHaveLength(1);
expect(suborderTotal(moved)).toBeCloseTo(Number(moved.total), 2);

// POS-16316: 菜价改为10.60 -> 保存 -> Recall -> By Amount 2/8.6
await splitFlow.splitOrderByAmounts(splitPage, [2, 8.6]);
const amounts = await splitPage.readSnapshot();
expect(amounts.suborders.map((order) => Number(order.total))).toEqual([2, 8.6]);

// POS-16318: 保存 -> 平分提交 -> Recall重新进入 -> Unsplit
const original = Number((await splitPage.readSnapshot()).total);
await splitFlow.splitOrderEvenly(splitPage, 2);
await splitFlow.submitAndReturnPage(splitPage);
const reopened = await new RecallFlow().openSplitOrder(recallPage, orderNumber);
await splitFlow.cancelSplit(reopened);
const restored = await reopened.readSnapshot();
expect(restored.suborders).toHaveLength(1);
expect(Number(restored.total)).toBeCloseTo(original, 2);

// POS-16325: 堂食选桌2人、两菜、保存 -> Recall -> Even Item
await splitFlow.evenSplitDishOnSuborder(splitPage, {
  dishName: orderServiceDishes.regular.name,
  splitCount: 2,
  suborderIndex: '1',
});
const items = await splitPage.readSnapshot();
expect(items.suborders.flatMap((order) => order.dishes)
  .filter((dish) => dish.name === orderServiceDishes.regular.name)
  .map((dish) => dish.proportion)).toEqual(['1/2', '1/2']);
```

Wrap every operation/assertion in Chinese steps, assert unpaid child status where present, and call `submitAndReturnPage` after the final snapshot.

- [ ] **Step 3: 删除旧测试、运行并提交**

Remove the same five Jira tests from `order.service.spec.ts`, then run:

```powershell
npx.cmd tsc --noEmit
npx.cmd playwright test tests/py-migrate/order-page-regression.spec.ts --project=py-migrate --grep "POS-16303|POS-16314|POS-16316|POS-16318|POS-16325" --reporter=line
rg -n "POS-16303|POS-16314|POS-16316|POS-16318|POS-16325" tests/py-migrate
```

Expected: 5 passed; each Jira only occurs in the new spec.

```powershell
git add -- tests/py-migrate/order-page-regression.spec.ts tests/py-migrate/order.service.spec.ts
git commit -m "test: migrate persisted split order regressions"
```

---

### Task 4: 添加按座位分单与小费平分合并

**Files:**
- Modify: `tests/py-migrate/order-page-regression.spec.ts`

**Interfaces:**
- Consumes: `SelectTableFlow.selectAnyAvailableTableAndEnterOrderDishes`、座位选择、By Seats、Tips、Combine suborders。
- Produces: POS-16315、POS-39762。

- [ ] **Step 1: 写按座位分单测试**

```ts
const selectTablePage = await readyHomePage.enterDineInEntry();
if (selectTablePage instanceof OrderDishesPage) {
  throw new Error('POS-16315 需要真实选桌入口，但当前环境直接进入了点单页。');
}
const { orderDishesPage } = await new SelectTableFlow()
  .selectAnyAvailableTableAndEnterOrderDishes(selectTablePage, 2);
await orderDishesPage.selectSharedSeat();
await orderFlow.addRegularDish(orderDishesPage, regular.name, regular.menu);
await orderDishesPage.selectSeat(1);
await orderFlow.addRegularDish(orderDishesPage, testDish.name, testDish.menu);
const { splitOrderPage } = await saveAndOpenSplit(orderDishesPage);
const before = await splitOrderPage.readSnapshot();
await splitFlow.splitOrderBySeats(splitOrderPage);
const after = await splitOrderPage.readSnapshot();
expect(after.suborders).toHaveLength(2);
expect(suborderTotal(after)).toBeCloseTo(Number(before.total), 2);
expect(after.suborders.every((order) => !order.paidStatus)).toBe(true);
```

- [ ] **Step 2: 写 2.00 小费平分再合并测试**

```ts
await orderPage.addTip(orderPageRegressionCases.splitTips.tipAmountInCents);
const { orderNumber, recallPage, splitOrderPage } = await saveAndOpenSplit(orderPage);
await splitFlow.splitOrderEvenly(splitOrderPage, 2);
const split = await splitOrderPage.readSnapshot();
const firstChild = split.suborders[0];
await splitFlow.submitAndReturnPage(splitOrderPage);
await recallPage.openOrderDetails(orderNumber, firstChild?.orderNumber);
expect((await recallPage.readDisplayedOrderPriceSummary()).Tips).toBe(1);
await recallPage.closeOrderDetailsDialog();
const reopened = await new RecallFlow().openSplitOrder(recallPage, orderNumber);
await splitFlow.combineSuborders(reopened);
await splitFlow.submitAndReturnPage(reopened);
await recallPage.openOrderDetails(orderNumber);
expect((await recallPage.readDisplayedOrderPriceSummary()).Tips).toBe(2);
```

- [ ] **Step 3: Run and commit**

```powershell
npx.cmd playwright test tests/py-migrate/order-page-regression.spec.ts --project=py-migrate --grep "POS-16315|POS-39762" --reporter=line
git add -- tests/py-migrate/order-page-regression.spec.ts
git commit -m "test: add seat split and tips merge regressions"
```

Expected: 2 passed.

---

### Task 5: 添加小数数量合单与改价数量回归

**Files:**
- Modify: `tests/py-migrate/order-page-regression.spec.ts`

**Interfaces:**
- Consumes: `changeOrderedDishQuantity`、`changeOrderedDishPrice`、`RecallFlow.combineOrders`、Recall 数量和 number 小计。
- Produces: POS-33244、POS-33600。

- [ ] **Step 1: 写双单合并测试**

Create the first To Go order with regular dish quantity `2.55`, save its exact order number and numeric Subtotal; create a second To Go order with the test dish, save its exact number and Subtotal; then:

```ts
await new RecallFlow().combineOrders(recallPage, firstOrderNumber, secondOrderNumber);
await recallPage.openOrderDetails(secondOrderNumber);
const combined = await recallPage.readOrderDetailsSnapshot();
expect(combined.items.find((item) => item.name === regular.name)?.quantity).toBe('2.55');
expect(combined.items.find((item) => item.name === testDish.name)?.quantity).toBe('1');
expect(combined.priceSummary.Subtotal).toBeCloseTo(firstSubtotal + secondSubtotal, 2);
```

Before creating the second order, execute the existing page action and reuse the fixture-backed home object:

```ts
await firstSaved.recallPage.exitRecall();
await homePage.expectPrimaryFunctionCardsVisible();
const secondPage = await new TakeoutFlow().startToGoOrder(homePage);
```

Do not navigate by URL.

- [ ] **Step 2: 写 6.50 × 1.5 测试**

```ts
await orderPage.changeOrderedDishPrice(regular.name, 6.5);
await orderPage.changeOrderedDishQuantity(regular.name, 1.5);
await orderFlow.addRegularDish(orderPage, testDish.name, testDish.menu);
const beforeSubtotal = (await orderPage.readPriceSummary()).Subtotal;
expect(toCents(6.5 * 1.5)).toBe(975);
const { details } = await saveAndReadLatestRecallDetails(orderPage);
expect(details.items.find((item) => item.name === regular.name)?.quantity).toBe('1.5');
expect(toCents(details.priceSummary.Subtotal)).toBe(toCents(beforeSubtotal));
```

- [ ] **Step 3: Run and commit**

```powershell
npx.cmd playwright test tests/py-migrate/order-page-regression.spec.ts --project=py-migrate --grep "POS-33244|POS-33600" --reporter=line
git add -- tests/py-migrate/order-page-regression.spec.ts
git commit -m "test: add decimal quantity order regressions"
```

Expected: 2 passed.

---

### Task 6: 去重、矩阵同步与最终验证

**Files:**
- Modify: `docs/plans/2026-07-14-order-page-prompt-coverage.md`
- Verify: `tests/py-migrate/order-page-regression.spec.ts`
- Verify: `tests/py-migrate/order.service.spec.ts`
- Verify: `tests/py-migrate/split-order-operation.spec.ts`

**Interfaces:**
- Consumes: Tasks 1～5 的 14 条 UI 结果。
- Produces: 新文件恰好 14 条、七个同 Jira 旧测试已删除、矩阵状态与真实运行一致。

- [ ] **Step 1: 验证 14 条和去重结果**

```powershell
$target = 'POS-15602','POS-42886','POS-42888','POS-28674','POS-39762','POS-16303','POS-16314','POS-16315','POS-16316','POS-16318','POS-16325','POS-32905','POS-33244','POS-33600'
$spec = Get-Content -Raw -Encoding UTF8 'tests\py-migrate\order-page-regression.spec.ts'
$found = @([regex]::Matches($spec, "\[($($target -join '|'))\]") | ForEach-Object { $_.Groups[1].Value })
[pscustomobject]@{
  Target = $target.Count
  Tests = $found.Count
  UniqueTests = @($found | Sort-Object -Unique).Count
  Missing = @(Compare-Object $target ($found | Sort-Object -Unique)).Count
}
```

Expected: `Target=14`、`Tests=14`、`UniqueTests=14`、`Missing=0`。

```powershell
rg -n "POS-15602|POS-16303|POS-16314|POS-16316|POS-16318|POS-16325|POS-32905" tests/py-migrate
rg -n "POS-23204|POS-24394" tests/py-migrate/split-order-operation.spec.ts
```

Expected: seven migrated Jira only occur in the new spec; POS-23204/POS-24394 remain.

- [ ] **Step 2: 运行全部验证**

```powershell
npx.cmd playwright test tests/py-migrate/order-page-regression.spec.ts --project=py-migrate --list
npx.cmd tsc --noEmit
npm.cmd run test:scripts
npx.cmd playwright test tests/py-migrate/order-page-regression.spec.ts --project=py-migrate --reporter=line
```

Expected: list shows 14 tests; TypeScript exits 0; script tests show 3 passed; UI run shows 14 passed. If UI environment is unavailable, record the real error and do not mark affected rows covered.

- [ ] **Step 3: 按真实通过行号更新矩阵**

```powershell
rg -n "POS-15602|POS-42886|POS-42888|POS-28674|POS-39762|POS-16303|POS-16314|POS-16315|POS-16316|POS-16318|POS-16325|POS-32905|POS-33244|POS-33600" tests/py-migrate/order-page-regression.spec.ts
```

For each passed test, set its row to `已等价覆盖` and record the observed `order-page-regression.spec.ts:<line>` plus the Page/Flow chain. If all 14 pass, summary becomes:

```text
18 / 0 / 0 / 48 / 0 / 0 = 66
```

Do not renumber or modify the 48 recording IDs.

- [ ] **Step 4: 最终检查与提交**

```powershell
git diff --check
git status --short
git add -- docs/plans/2026-07-14-order-page-prompt-coverage.md
git commit -m "docs: mark no-recording order page cases covered"
```

---

## Self-Review Notes

- 14 个 Jira 全部映射到一个任务；Task 6 用脚本验证完整集合。
- 七条同 Jira 旧用例迁出，POS-23204/POS-24394 保留。
- 两个 Page API 在 locator、section、facade、测试中的命名完全一致。
- POS-15602 成功 trace 证明菜单组选中态与 Count locator。
- POS-39762 严格执行源步骤：先加 2.00，子单断言 1.00，合并后断言 2.00。
- 占位符扫描已完成，所有代码步骤都给出了确定接口、数据和验证命令。
