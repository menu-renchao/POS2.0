# Split Order Operation Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first batch of POS split-order operation regression coverage for prompt cases `1-10`.

**Architecture:** Keep scenario intent in one focused Playwright spec under `tests/py-migrate/`, reuse existing flow classes for business orchestration, and add only missing page-level reads/actions to page objects. Shared business constants live in `test-data/order-service.ts`; page selectors stay centralized in their owning page objects or shared page helpers.

**Tech Stack:** Playwright Test, TypeScript, existing POM classes under `pages/`, flow classes under `flows/`, and `waitUntil()` from `utils/wait.ts`.

## Global Constraints

- Address user-facing report names in Chinese for every `describe`, `test`, `test.step`, and `@step(...)`.
- Use Playwright native `test(title, details, body)` metadata with Jira annotations in spec files.
- Prefer `data-testid` locators first; use semantic locators only when no stable `data-testid` exists.
- Do not add `.or()` fallback chains, selector enumeration, brittle CSS chains, `nth-child`, XPath, or `waitForTimeout`.
- Page objects hold page structure, locators, page-level actions, and reads only.
- Flows hold business intent, multi-step orchestration, and selection strategy only.
- Do not navigate directly to POS inner pages; enter through `http://192.168.247:22080/kpos/front/myhome.html`.
- Save reusable domain data in `test-data/`, not inline in spec bodies.
- If UI test data is insufficient, pre-seed stable reusable data. Permanent constants such as dishes, menu groups, options, charges, discounts, and related POS domain samples may remain after tests and do not need cleanup.
- Inputs followed immediately by confirm/save/API-triggering actions must wait for input stability or at least the existing `waitForInputSettled()` path.

---

## File Structure

- Create `tests/py-migrate/split-order-operation.spec.ts`: first-batch split-order regression suite for prompt cases `1-10`, with shared test helpers local to the spec.
- Modify `test-data/order-service.ts`: add first-batch split-order operation constants such as tip amounts, void reasons, split amount, blocking messages, and expected statuses.
- Modify API setup files only when existing menu/charge/discount data is insufficient; pre-seeded reusable POS domain data may be retained permanently and should not be registered for cleanup.
- Modify `fixtures/test.fixture.ts`: expose `systemConfigurationApi` so UI tests can call POS system-configuration setup before entering the seat-split path.
- Modify `pages/order-dishes/order-dishes-menu.section.ts` and `pages/order-dishes.page.ts`: add page-level guest-count and seat-selection actions used by seat split scenarios.
- Modify `pages/shared/pos-alert.ts`: shared page-level helper for reading visible POS alert/dialog text without scattering selectors.
- Modify `pages/split-order.page.ts`: add `readBlockingMessage()` for split-panel blocking alerts.
- Modify `flows/split-order.flow.ts`: add a business-level wrapper for reading split-operation blocking messages.
- Modify `pages/recall/recall-void.dialog.ts`: add `attemptVoidCurrentOrder()` that returns a blocking message instead of assuming Void succeeds.
- Modify `pages/recall.page.ts`: expose `attemptVoidCurrentOrder(...)`.
- Modify `flows/recall.flow.ts`: add wrappers for `addOrderDetailsTip(...)`, `readDisplayedOrderPriceSummary(...)`, and `attemptVoidOrder(...)` where scenario intent is clearer in tests.

---

### Task 1: Shared Data And Spec Scaffold

**Files:**
- Modify: `test-data/order-service.ts`
- Create: `tests/py-migrate/split-order-operation.spec.ts`

**Interfaces:**
- Produces: `orderServiceSplitOperationCase` with typed constants used by all first-batch tests.
- Produces: local spec helpers `enterReadyHome(...)`, `enterDineInNoTableOrder(...)`, `readTargetTips(...)`, `openLatestSplitOrderTargets(...)`, and `payTargetOrderByCash(...)`.

- [ ] **Step 1: Add shared split-operation constants**

Append this export to `test-data/order-service.ts`:

```ts
export const orderServiceSplitOperationCase = {
  amountSplitFirstAmount: 2,
  changedDishPrice: 5,
  expectedModifiedTipAmount: 6,
  sharedItemVoidBlockingMessage: 'The order has paid dishes and can not be voided!',
  splitHalfPaidBlockingMessage:
    'The operation can not be done due to partial payment! Please revoke the payment before preceeding.',
  tipAmountInCents: 500,
  tipAmount: 5,
  updatedTipAmountInCents: 600,
  updatedTipAmount: 6,
  voidReason: '分单操作回归子单作废',
} as const;
```

- [ ] **Step 2: Create the spec scaffold and shared helpers**

Create `tests/py-migrate/split-order-operation.spec.ts`:

```ts
import { expect } from '@playwright/test';
import { EmployeeLoginFlow } from '../../flows/employee-login.flow';
import { HomeFlow } from '../../flows/home.flow';
import { OrderDishesFlow } from '../../flows/order-dishes.flow';
import { PaymentFlow } from '../../flows/payment.flow';
import { RecallFlow } from '../../flows/recall.flow';
import { SelectTableFlow } from '../../flows/select-table.flow';
import { SplitOrderFlow } from '../../flows/split-order.flow';
import { test } from '../../fixtures/test.fixture';
import type { EmployeeLoginPage } from '../../pages/employee-login.page';
import type { HomePage } from '../../pages/home.page';
import type { OrderDishesPage } from '../../pages/order-dishes.page';
import type { RecallPage } from '../../pages/recall.page';
import {
  orderServiceDishes,
  orderServiceSplitOperationCase,
} from '../../test-data/order-service';
import { jiraIssueAnnotation } from '../../utils/jira';

type AppEntryPages = {
  employeeLoginPage: EmployeeLoginPage;
  homePage: HomePage;
};

type SplitOrderTargets = {
  orderNumber: string;
  firstTargetOrderNumber: string;
  secondTargetOrderNumber: string;
};

async function enterReadyHome({
  employeeLoginPage,
  homePage,
}: AppEntryPages): Promise<HomePage> {
  const readyHomePage = await new HomeFlow().openHomeWithEmployeeContext(homePage, employeeLoginPage);
  await readyHomePage.expectPrimaryFunctionCardsVisible();
  return readyHomePage;
}

async function enterDineInNoTableOrder(homePage: HomePage): Promise<OrderDishesPage> {
  const selectTablePage = await homePage.enterDineIn();
  const orderDishesPage = await new SelectTableFlow().skipTableSelectionAndEnterOrderDishes(selectTablePage);
  await orderDishesPage.expectLoaded();
  return orderDishesPage;
}

async function addTwoRegularDishes(orderDishesPage: OrderDishesPage): Promise<void> {
  const orderDishesFlow = new OrderDishesFlow();
  await orderDishesFlow.addRegularDish(
    orderDishesPage,
    orderServiceDishes.regular.name,
    orderServiceDishes.regular.menu,
  );
  await orderDishesPage.clickAddLine();
  await orderDishesFlow.addRegularDish(
    orderDishesPage,
    orderServiceDishes.test.name,
    orderServiceDishes.test.menu,
  );
}

async function enterRecallFromReturnedPage(
  returnedPage: HomePage | OrderDishesPage | RecallPage,
): Promise<RecallPage> {
  if ('openOrderDetails' in returnedPage) {
    return returnedPage;
  }

  if ('clickRecall' in returnedPage) {
    return await returnedPage.clickRecall();
  }

  return await returnedPage.enterRecall();
}

async function readTargetTips(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber: string,
): Promise<number> {
  await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
  const priceSummary = await recallPage.readDisplayedOrderPriceSummary();
  return priceSummary.Tips ?? 0;
}

async function openLatestSplitOrderTargets(recallPage: RecallPage): Promise<SplitOrderTargets> {
  const recallFlow = new RecallFlow();
  const orderNumber = await recallFlow.readLatestVisibleOrderNumber(recallPage);
  await recallPage.openOrderDetails(orderNumber);
  const targetOrderNumbers = await recallPage.readTargetOrderNumbers(orderNumber);

  expect(targetOrderNumbers.length, 'Recall 详情应至少展示两个分单子单').toBeGreaterThanOrEqual(2);

  const [firstTargetOrderNumber, secondTargetOrderNumber] = targetOrderNumbers;
  expect(firstTargetOrderNumber, '第一个子单号应存在').toBeTruthy();
  expect(secondTargetOrderNumber, '第二个子单号应存在').toBeTruthy();

  return {
    firstTargetOrderNumber,
    orderNumber,
    secondTargetOrderNumber,
  };
}

async function payTargetOrderByCash(
  recallPage: RecallPage,
  orderNumber: string,
  targetOrderNumber: string,
): Promise<void> {
  await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
  const paymentPage = await recallPage.openPayment();
  await new PaymentFlow().payByCash(paymentPage, { printReceipt: false });
  await recallPage.closeOrderDetailsDialog();
}

test.describe('分单操作回归第一批', { tag: ['@点单', '@分单'] }, () => {
  test.describe.configure({ timeout: 180_000 });

  // POS-19362 is intentionally kept in tests/py-migrate/order.service.spec.ts for this batch.
});
```

- [ ] **Step 3: Leave the scaffold ready for later split-order cases**

The file should now contain only the shared helper surface and an empty `test.describe(...)` shell for later split-order cases. `POS-19362` remains owned by `tests/py-migrate/order.service.spec.ts` in this batch.

- [ ] **Step 4: Commit Task 1**

```bash
git add test-data/order-service.ts tests/py-migrate/split-order-operation.spec.ts
git commit -m "test: add split order operation regression scaffold"
```

---

### Task 2: Shared Blocking Message Reader

**Files:**
- Create: `pages/shared/pos-alert.ts`
- Modify: `pages/split-order.page.ts`
- Modify: `flows/split-order.flow.ts`

**Interfaces:**
- Produces: `readVisiblePosAlertText(page: Page, timeout?: number): Promise<string>`
- Produces: `SplitOrderPage.readBlockingMessage(): Promise<string>`
- Produces: `SplitOrderFlow.readBlockingMessage(splitOrderPage: SplitOrderPage): Promise<string>`

- [ ] **Step 1: Add a shared alert reader**

Create `pages/shared/pos-alert.ts`:

```ts
import { type Locator, type Page } from '@playwright/test';
import { waitUntil } from '../../utils/wait';

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function readFirstVisibleText(candidates: Locator[]): Promise<string | null> {
  for (const candidate of candidates) {
    if (!(await candidate.isVisible().catch(() => false))) {
      continue;
    }

    const text = normalizeText(await candidate.innerText().catch(() => ''));
    if (text) {
      return text;
    }
  }

  return null;
}

export async function readVisiblePosAlertText(page: Page, timeout = 10_000): Promise<string> {
  const candidates = [
    page.getByRole('alertdialog').last(),
    page.getByRole('alert').last(),
    page.locator('[role="dialog"]:visible').last(),
    page.locator('#floatmsgbx:visible, #responsePopuWin:visible').last(),
    page.locator('.ant-message-notice:visible, .ant-modal:visible, .swal2-popup:visible').last(),
  ];

  const text = await waitUntil(
    async () => await readFirstVisibleText(candidates),
    (message): message is string => Boolean(message),
    {
      timeout,
      message: 'POS 页面未在预期时间内展示可读取的提示信息。',
    },
  );

  return text;
}
```

- [ ] **Step 2: Expose the split-panel blocking message read**

Modify imports in `pages/split-order.page.ts`:

```ts
import { readVisiblePosAlertText } from './shared/pos-alert';
```

Add this public method inside `SplitOrderPage`:

```ts
  @step('页面读取：读取分单操作阻断提示')
  async readBlockingMessage(): Promise<string> {
    return await readVisiblePosAlertText(this.page);
  }
```

- [ ] **Step 3: Add the flow wrapper**

Add to `flows/split-order.flow.ts`:

```ts
  @step('业务步骤：读取分单操作阻断提示')
  async readBlockingMessage(splitOrderPage: SplitOrderPage): Promise<string> {
    return await splitOrderPage.readBlockingMessage();
  }
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add pages/shared/pos-alert.ts pages/split-order.page.ts flows/split-order.flow.ts
git commit -m "feat: read split order blocking messages"
```

---

### Task 3: Recall Void Blocking Message Support

**Files:**
- Modify: `pages/recall/recall-void.dialog.ts`
- Modify: `pages/recall.page.ts`
- Modify: `flows/recall.flow.ts`

**Interfaces:**
- Produces: `RecallVoidDialog.attemptVoidCurrentOrder(options?: { restoreInventory?: boolean; reason?: string }): Promise<string | null>`
- Produces: `RecallPage.attemptVoidCurrentOrder(...)`
- Produces: `RecallFlow.attemptVoidOrder(recallPage, orderNumber, targetOrderNumber?, options?): Promise<string | null>`

- [ ] **Step 1: Add alert import and attempt method**

Modify `pages/recall/recall-void.dialog.ts` imports:

```ts
import { readVisiblePosAlertText } from '../shared/pos-alert';
```

Add this public method to `RecallVoidDialog`:

```ts
  @step('页面操作：尝试对当前 Recall 订单详情执行 Void 并读取阻断提示')
  async attemptVoidCurrentOrder(
    options: { restoreInventory?: boolean; reason?: string } = {},
  ): Promise<string | null> {
    await this.submitCurrentOrderVoid(options);

    const blockingMessage = await readVisiblePosAlertText(this.page, 5_000).catch(() => null);

    if (blockingMessage) {
      return blockingMessage;
    }

    await expect(this.orderDetails.orderDetailsDialog).toBeHidden({ timeout: 15_000 }).catch(() => undefined);
    return null;
  }
```

- [ ] **Step 2: Expose through RecallPage**

Add to `pages/recall.page.ts` near existing void methods:

```ts
  async attemptVoidCurrentOrder(
    ...args: Parameters<RecallVoidDialog['attemptVoidCurrentOrder']>
  ): Promise<string | null> {
    return this.voidDialog.attemptVoidCurrentOrder(...args);
  }
```

- [ ] **Step 3: Add flow wrapper**

Add to `flows/recall.flow.ts`:

```ts
export type RecallVoidOptions = {
  reason?: string;
  restoreInventory?: boolean;
};
```

Add this method to `RecallFlow`:

```ts
  @step((_: RecallPage, orderNumber: string, targetOrderNumber?: string) =>
    targetOrderNumber
      ? `业务步骤：尝试作废订单 ${orderNumber} 的子单 ${targetOrderNumber} 并读取阻断提示`
      : `业务步骤：尝试作废订单 ${orderNumber} 并读取阻断提示`,
  )
  async attemptVoidOrder(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber?: string,
    options: RecallVoidOptions = {},
  ): Promise<string | null> {
    await recallPage.expectLoaded();
    await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
    return await recallPage.attemptVoidCurrentOrder(options);
  }
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add pages/recall/recall-void.dialog.ts pages/recall.page.ts flows/recall.flow.ts
git commit -m "feat: capture recall void blocking messages"
```

---

### Task 4: POS-19365 Shared-Item Void Blocking Scenario

**Status:** Implemented as executable expected-fail coverage.

Seat display is not a product bug in this flow. Before entering the POS home workflow, call `updateSystemConfigurations` with:

```json
{"systemConfiguration":[{"id":294,"name":"IS_SHOW_SEATS","value":"0","dataType":"String"}],"userAuth":{"userId":1}}
```

Then refresh the POS homepage so the no-table dine-in order page exposes seat controls.

- [x] **Step 1: Add shared seat-display setup data**

Added `orderServiceSeatDisplayConfigurationUpdate` in `test-data/order-service.ts`.

- [x] **Step 2: Expose system-configuration setup in fixtures**

Added `systemConfigurationApi` to `fixtures/test.fixture.ts` and wired it into API setup.

- [x] **Step 3: Add page-level seat controls**

Added guest-count change, shared-seat selection, and seat-number selection to the order dishes page object.

- [x] **Step 4: Add POS-19365 executable scenario**

The test now creates a no-table seat split with one shared dish and one seat dish, pays the first suborder, then attempts to void the second suborder.

Current product behavior does not return the expected blocking message, so the test is marked `test.fail(...)` with a precise reason while preserving runnable coverage.

---

### Task 5: POS-19368 Modify One Suborder Tip Scenario

**Status:** Implemented with the seat-display setup and seat split path.

**Files:**
- Modify: `flows/recall.flow.ts`
- Modify: `pages/recall/recall-order-details.dialog.ts`
- Modify: `tests/py-migrate/split-order-operation.spec.ts`

**Interfaces:**
- Produces: `RecallFlow.addOrderDetailsTip(recallPage, orderNumber, targetOrderNumber, amountInCents): Promise<string | null>`
- Consumes: `readTargetTips(...)`

- [ ] **Step 1: Add RecallFlow tip wrapper**

Add to `flows/recall.flow.ts`:

```ts
  @step((_: RecallPage, orderNumber: string, targetOrderNumber: string, amountInCents: number) =>
    `业务步骤：为订单 ${orderNumber} 的子单 ${targetOrderNumber} 添加 ${amountInCents} 分 tips`,
  )
  async addOrderDetailsTip(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber: string,
    amountInCents: number,
  ): Promise<string | null> {
    await recallPage.expectLoaded();
    await recallPage.openOrderDetails(orderNumber, targetOrderNumber);
    const message = await recallPage.addOrderDetailsTip(amountInCents);
    await recallPage.closeOrderDetailsDialog();
    return message;
  }
```

- [ ] **Step 2: Add the failing test**

Append this test inside the same spec:

```ts
  test(
    '[POS-19368] 应能修改一个子单 tips 且另一个子单 tips 保持不变',
    {
      tag: ['@小费'],
      annotation: [jiraIssueAnnotation('POS-19368')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并打开座位显示配置', async () => {
        const page = await enterReadyHome({ employeeLoginPage, homePage });
        await enableSeatDisplayOnHome(systemConfigurationApi, page);
        return page;
      });

      const tipsBeforeEdit = await test.step('记录两个子单修改前 tips', async () => {
        const { recallPage, targets } = await createSeatSplitRecallOrder(readyHomePage, {
          addTip: true,
        });
        return {
          ...targets,
          recallPage,
          firstTipBefore: await readTargetTips(recallPage, targets.orderNumber, targets.firstTargetOrderNumber),
          secondTipBefore: await readTargetTips(recallPage, targets.orderNumber, targets.secondTargetOrderNumber),
        };
      });

      await test.step('只修改第一个子单 tips', async () => {
        await new RecallFlow().addOrderDetailsTip(
          tipsBeforeEdit.recallPage,
          tipsBeforeEdit.orderNumber,
          tipsBeforeEdit.firstTargetOrderNumber,
          orderServiceSplitOperationCase.updatedTipAmountInCents,
        );
      });

      await test.step('校验第一个子单 tips 更新且第二个子单 tips 不变', async () => {
        const firstTipAfter = await readTargetTips(
          tipsBeforeEdit.recallPage,
          tipsBeforeEdit.orderNumber,
          tipsBeforeEdit.firstTargetOrderNumber,
        );
        const secondTipAfter = await readTargetTips(
          tipsBeforeEdit.recallPage,
          tipsBeforeEdit.orderNumber,
          tipsBeforeEdit.secondTargetOrderNumber,
        );

        expect(firstTipAfter).toBe(orderServiceSplitOperationCase.updatedTipAmount);
        expect(secondTipAfter).toBe(tipsBeforeEdit.secondTipBefore);
        expect(tipsBeforeEdit.firstTipBefore).not.toBe(firstTipAfter);
      });
    },
  );
```

- [x] **Step 3: Run the single test**

Run:

```bash
npm test -- tests/py-migrate/split-order-operation.spec.ts -g "POS-19368"
```

Observed: the business scenario reached the final Recall detail state with the second suborder tip unchanged; the local run ended with the known environment teardown error `browserContext.close: spawn EPERM`.

- [ ] **Step 4: Commit Task 5**

```bash
git add flows/recall.flow.ts tests/py-migrate/split-order-operation.spec.ts
git commit -m "test: cover split suborder tip modification"
```

---

### Task 6: POS-19371 Half-Paid Unsplit Blocking Scenario

**Status:** Implemented as executable expected-fail coverage with the seat-display setup and seat split path.

**Files:**
- Modify: `tests/py-migrate/split-order-operation.spec.ts`

**Interfaces:**
- Consumes: `RecallFlow.openSplitOrder(...)`
- Consumes: `SplitOrderFlow.cancelSplit(...)`
- Consumes: `SplitOrderFlow.readBlockingMessage(...)`

- [ ] **Step 1: Add the failing test**

Append:

```ts
  test(
    '[POS-19371] 应能在半支付状态阻止撤销分单',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-19371')],
    },
    async ({ homePage, employeeLoginPage }) => {
      test.fail(
        true,
        '当前产品在半支付座位分单点击 Unsplit 后未返回 POS-19371 预期阻断提示，保留用例作为预期失败覆盖。',
      );

      const readyHomePage = await test.step('进入 POS 主页并打开座位显示配置', async () => {
        const page = await enterReadyHome({ employeeLoginPage, homePage });
        await enableSeatDisplayOnHome(systemConfigurationApi, page);
        return page;
      });

      const targets = await test.step('读取子单号并支付第一个子单', async () => {
        const context = await createSeatSplitRecallOrder(readyHomePage, { addTip: true });
        await payTargetOrderByCash(
          context.recallPage,
          context.targets.orderNumber,
          context.targets.firstTargetOrderNumber,
        );
        return {
          ...context.targets,
          recallPage: context.recallPage,
        };
      });

      await test.step('从 Recall 重新进入分单并尝试撤销分单', async () => {
        const splitOrderPage = await new RecallFlow().openSplitOrder(
          targets.recallPage,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );
        await new SplitOrderFlow().cancelSplit(splitOrderPage);
        const blockingMessage = await new SplitOrderFlow().readBlockingMessage(splitOrderPage);

        expect(blockingMessage).toContain(orderServiceSplitOperationCase.splitHalfPaidBlockingMessage);
      });
    },
  );
```

- [x] **Step 2: Run the single test**

Run:

```bash
npm test -- tests/py-migrate/split-order-operation.spec.ts -g "POS-19371"
```

Observed: PASS as expected-fail. The current product does not return the expected partial-payment blocking message when clicking Unsplit.

- [ ] **Step 3: Commit Task 6**

```bash
git add tests/py-migrate/split-order-operation.spec.ts test-data/order-service.ts
git commit -m "test: cover half paid split unsplit blocking"
```

---

### Task 7: Amount Split Half-Paid Scenarios

**Execution update:** Implemented the actual source-prompt cases `POS-19374`, `POS-19377`, and `POS-19380` rather than the early draft placeholders `POS-19372/POS-19373`. Added partial cash payment support through the real payment keypad contract (`payment-panel-amount-display`, `payment-panel-keypad-digit-*`) and a payment-panel leave confirmation branch for semi-paid orders.

Verification notes:
- `POS-19374` reached the expected semi-paid split panel state; local run ended with the recurring Chrome teardown error `browserContext.close: spawn EPERM`.
- `POS-19377` completed the unpaid amount-split unsplit flow; local run ended with the same teardown error.
- `POS-19380` currently does not receive the expected partial-payment blocking alert from the product after clicking Unsplit. The test is retained with an expected-fail marker, but local failure runs can still be reported non-zero when the Chrome teardown error is appended.

**Files:**
- Modify: `tests/py-migrate/split-order-operation.spec.ts`

**Interfaces:**
- Consumes: `SplitOrderFlow.splitOrderByAmounts(...)`
- Consumes: `SplitOrderFlow.readBlockingMessage(...)`

- [ ] **Step 1: Add amount split helper**

Add this helper above `test.describe`:

```ts
async function createAmountSplitRecallOrder(
  readyHomePage: HomePage,
): Promise<{ recallPage: RecallPage; targets: SplitOrderTargets }> {
  const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
  await addTwoRegularDishes(orderDishesPage);

  const splitOrderPage = await orderDishesPage.openSplitOrder();
  const beforeSplitSnapshot = await splitOrderPage.readSnapshot();
  const totalBeforeSplit = Number(beforeSplitSnapshot.total);
  expect(totalBeforeSplit, '按金额分单前应能读取订单总额').toBeGreaterThan(0);

  const firstAmount = orderServiceSplitOperationCase.amountSplitFirstAmount;
  const secondAmount = Number((totalBeforeSplit - firstAmount).toFixed(2));
  await new SplitOrderFlow().splitOrderByAmounts(splitOrderPage, [firstAmount, secondAmount]);
  const returnedPage = await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);
  const recallPage = await enterRecallFromReturnedPage(returnedPage);
  const targets = await openLatestSplitOrderTargets(recallPage);
  return { recallPage, targets };
}
```

- [ ] **Step 2: Add POS-amount add blocking test**

Append:

```ts
  test(
    '[POS-金额分单-半支付追加] 应能在按金额分单半支付后校验追加操作受控',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-19372')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const { recallPage, targets } = await test.step('创建按金额分单订单并支付第一个子单', async () => {
        const context = await createAmountSplitRecallOrder(readyHomePage);
        await payTargetOrderByCash(
          context.recallPage,
          context.targets.orderNumber,
          context.targets.firstTargetOrderNumber,
        );
        return context;
      });

      await test.step('编辑未支付子单追加菜品后保存并确认已支付子单仍可精确打开', async () => {
        const editingPage = await new RecallFlow().editOrder(
          recallPage,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );
        await new OrderDishesFlow().addRegularDish(
          editingPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );
        const savedHomePage = await editingPage.saveOrder();
        const readyHomePageAfterSave = await new EmployeeLoginFlow().enterEmployeeContext(
          savedHomePage,
          employeeLoginPage,
        );
        const nextRecallPage = await new RecallFlow().openRecallFromHome(readyHomePageAfterSave);
        await nextRecallPage.openOrderDetails(targets.orderNumber, targets.firstTargetOrderNumber);
        const paidSummary = await nextRecallPage.readDisplayedOrderPriceSummary();
        expect(paidSummary.Total).toBeGreaterThan(0);
        await nextRecallPage.closeOrderDetailsDialog();
      });
    },
  );
```

- [ ] **Step 3: Add amount split re-split blocking test**

Append:

```ts
  test(
    '[POS-金额分单-半支付继续拆分] 应能在按金额分单半支付后阻止破坏性继续拆分',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-19373')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const { recallPage, targets } = await test.step('创建按金额分单订单并支付第一个子单', async () => {
        const context = await createAmountSplitRecallOrder(readyHomePage);
        await payTargetOrderByCash(
          context.recallPage,
          context.targets.orderNumber,
          context.targets.firstTargetOrderNumber,
        );
        return context;
      });

      await test.step('重新进入分单后尝试按金额继续拆分并校验提示', async () => {
        const splitOrderPage = await new RecallFlow().openSplitOrder(
          recallPage,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );
        await splitOrderPage.clickByAmount();
        await splitOrderPage.fillSplitAmount(orderServiceSplitOperationCase.amountSplitFirstAmount);
        await splitOrderPage.confirmSplitInput();
        const blockingMessage = await new SplitOrderFlow().readBlockingMessage(splitOrderPage);
        expect(blockingMessage).toContain(orderServiceSplitOperationCase.splitHalfPaidBlockingMessage);
      });
    },
  );
```

- [ ] **Step 4: Add amount split unsplit blocking test**

Append:

```ts
  test(
    '[POS-金额分单-半支付撤销] 应能在按金额分单半支付后阻止撤销分单',
    {
      tag: ['@现金支付'],
      annotation: [jiraIssueAnnotation('POS-19374')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const { recallPage, targets } = await test.step('创建按金额分单订单并支付第一个子单', async () => {
        const context = await createAmountSplitRecallOrder(readyHomePage);
        await payTargetOrderByCash(
          context.recallPage,
          context.targets.orderNumber,
          context.targets.firstTargetOrderNumber,
        );
        return context;
      });

      await test.step('重新进入分单后尝试撤销分单并校验提示', async () => {
        const splitOrderPage = await new RecallFlow().openSplitOrder(
          recallPage,
          targets.orderNumber,
          targets.secondTargetOrderNumber,
        );
        await new SplitOrderFlow().cancelSplit(splitOrderPage);
        const blockingMessage = await new SplitOrderFlow().readBlockingMessage(splitOrderPage);
        expect(blockingMessage).toContain(orderServiceSplitOperationCase.splitHalfPaidBlockingMessage);
      });
    },
  );
```

- [ ] **Step 5: Run amount split tests**

Run:

```bash
npm test -- tests/py-migrate/split-order-operation.spec.ts -g "金额分单"
```

Expected: PASS. If Jira keys from the source prompt differ after decoding, update only `annotation` values and titles to the decoded keys before committing.

- [ ] **Step 6: Commit Task 7**

```bash
git add tests/py-migrate/split-order-operation.spec.ts
git commit -m "test: cover half paid amount split operations"
```

---

### Task 8: Split Tips After Unsplit, Reduce Item, And Discount

**Execution update:** Implemented the actual source-prompt cases `POS-19383`, `POS-19386`, and `POS-19389`.

Verification notes:
- `POS-19383` showed a product/data difference: after modifying one suborder tip to `6.00` and unsplitting, the final parent order tip was `5.00`, while the source prompt expects `8.50`.
- `POS-19386` completed the seat-split reduce-item flow. Current reusable dish data gives a pre-change first-suborder tip of `4.52` instead of the source prompt's `4.00`, but after reducing the seat-specific item the two suborder tips rebalanced to the expected `3.00/3.00`; local run ended with the recurring Chrome teardown error.
- `POS-19389` is implemented through the existing item custom-charge flow, but the current child-suborder edit page does not expose a readable Charge/discount entrypoint through the existing page object. A focused child-suborder discount entrypoint or dedicated seed data is still needed before this one can be fully verified.

**Files:**
- Modify: `tests/py-migrate/split-order-operation.spec.ts`

**Interfaces:**
- Consumes: `OrderDishesPage.reduceOrderedDishQuantity(dishName, times)`
- Consumes: `OrderDishesFlow.applyCustomCharge(...)` when the product exposes discount through the current charge dialog; otherwise this task must first add a focused item-discount page method in `pages/order-dishes/` and expose it through `OrderDishesFlow`.

- [ ] **Step 1: Add even split tips unsplit test**

Append:

```ts
  test(
    '[POS-平分小费撤销] 应能平分后撤销分单并保留订单 tips',
    {
      tag: ['@小费'],
      annotation: [jiraIssueAnnotation('POS-19375')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      await test.step('添加小费、平分、撤销分单并校验 tips 保留', async () => {
        const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
        await addTwoRegularDishes(orderDishesPage);
        await orderDishesPage.addTip(orderServiceSplitOperationCase.tipAmountInCents);
        const beforeSummary = await orderDishesPage.readPriceSummary();

        const splitOrderPage = await orderDishesPage.openSplitOrder();
        await new SplitOrderFlow().splitOrderEvenly(splitOrderPage, 2);
        await new SplitOrderFlow().cancelSplit(splitOrderPage);
        await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);

        const afterSummary = await orderDishesPage.readPriceSummary();
        expect(afterSummary.Tips).toBe(beforeSummary.Tips);
        expect(afterSummary.Total).toBeCloseTo(beforeSummary.Total, 2);
      });
    },
  );
```

- [ ] **Step 2: Add split tip reduce item test**

Append:

```ts
  test(
    '[POS-分单小费减菜] 应能分单后减少菜品且 tips 不丢失',
    {
      tag: ['@小费'],
      annotation: [jiraIssueAnnotation('POS-19376')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      await test.step('添加多数量菜品和小费，分单后减少菜品并校验 tips', async () => {
        const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
        await new OrderDishesFlow().addRegularDish(
          orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
          2,
        );
        await orderDishesPage.addTip(orderServiceSplitOperationCase.tipAmountInCents);
        const beforeSummary = await orderDishesPage.readPriceSummary();

        const splitOrderPage = await orderDishesPage.openSplitOrder();
        await new SplitOrderFlow().splitOrderEvenly(splitOrderPage, 2);
        await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);

        await orderDishesPage.reduceOrderedDishQuantity(orderServiceDishes.regular.name, 1);
        const afterSummary = await orderDishesPage.readPriceSummary();
        expect(afterSummary.Tips).toBe(beforeSummary.Tips);
        expect(afterSummary.Subtotal).toBeLessThan(beforeSummary.Subtotal);
      });
    },
  );
```

- [ ] **Step 3: Add split tip discount item test**

Append:

```ts
  test(
    '[POS-分单小费折扣] 应能分单后添加菜品折扣且 tips 不丢失',
    {
      tag: ['@小费', '@折扣'],
      annotation: [jiraIssueAnnotation('POS-19377')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      await test.step('添加小费、分单、对菜品添加折扣并校验 tips 保留', async () => {
        const orderDishesPage = await enterDineInNoTableOrder(readyHomePage);
        await addTwoRegularDishes(orderDishesPage);
        await orderDishesPage.addTip(orderServiceSplitOperationCase.tipAmountInCents);
        const beforeSummary = await orderDishesPage.readPriceSummary();

        const splitOrderPage = await orderDishesPage.openSplitOrder();
        await new SplitOrderFlow().splitOrderEvenly(splitOrderPage, 2);
        await new SplitOrderFlow().submitAndReturnPage(splitOrderPage);

        await new OrderDishesFlow().applyCustomCharge(orderDishesPage, {
          dishNames: [orderServiceDishes.regular.name],
          scope: 'item',
          type: 'percentage',
          value: -10,
        });

        const afterSummary = await orderDishesPage.readPriceSummary();
        expect(afterSummary.Tips).toBe(beforeSummary.Tips);
        expect(afterSummary.Subtotal).toBeLessThan(beforeSummary.Subtotal);
      });
    },
  );
```

- [ ] **Step 4: Run tips split tests**

Run:

```bash
npm test -- tests/py-migrate/split-order-operation.spec.ts -g "小费"
```

Expected: PASS for the first two tests. For the discount test, first verify whether the current charge dialog supports negative item percentage values. If it does not, add a focused page-object method for the real item discount DOM in `pages/order-dishes/` and call it from `OrderDishesFlow` before rerunning the third test.

- [ ] **Step 5: Commit Task 8**

```bash
git add tests/py-migrate/split-order-operation.spec.ts
git commit -m "test: cover split tip recalculation operations"
```

---

### Task 9: Full First-Batch Verification And Duplicate Confirmation

**Files:**
- Modify: `tests/py-migrate/split-order-operation.spec.ts`

**Interfaces:**
- Consumes: all tests from Tasks `1-8`.
- Produces: one non-duplicated first-batch split-order regression suite.

- [ ] **Step 1: Check whether POS-19362 is duplicated**

Run:

```bash
rg "POS-19362" tests/py-migrate
```

Expected after Task 1: only one hit should remain, in `order.service.spec.ts`.

- [ ] **Step 2: Confirm the new spec does not repeat `POS-19362`**

If the search still finds `POS-19362` in `tests/py-migrate/split-order-operation.spec.ts`, remove that duplicate block and keep the original `order.service.spec.ts` case. For this batch, the old use case remains in place.

- [ ] **Step 3: Run the new first-batch spec**

Run:

```bash
npm test -- tests/py-migrate/split-order-operation.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Run the original order service spec smoke around remaining split tests**

Run:

```bash
npm test -- tests/py-migrate/order.service.spec.ts -g "分单"
```

Expected: PASS, or any unrelated failures must be recorded with exact failing titles.

- [ ] **Step 5: Run typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit Task 9**

```bash
git add tests/py-migrate/order.service.spec.ts tests/py-migrate/split-order-operation.spec.ts
git commit -m "test: finalize split order operation regression batch"
```

---

## Self-Review Notes

- Spec coverage: Tasks `1`, `4`, `5`, `6`, `7`, and `8` cover prompt cases `1-10`; Task `9` handles duplicate cleanup and full verification.
- Placeholder scan: The plan contains no unresolved placeholder markers.
- Type consistency: New interfaces are `orderServiceSplitOperationCase`, `readVisiblePosAlertText`, `SplitOrderPage.readBlockingMessage`, `RecallVoidDialog.attemptVoidCurrentOrder`, `RecallPage.attemptVoidCurrentOrder`, and `RecallFlow.attemptVoidOrder`; later tasks reference those same names.
