# Recorded Split And Delivery Regressions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将录制脚本中的 POS-16324 分单后支付部分子单、POS-30575 Delivery 客户信息预填两个场景落为可维护的 Playwright + TypeScript 自动化，并从待录制清单移除。

**Architecture:** POS-16324 由 `SplitOrderPage` 暴露真实 `payBtn-<index>` 页面动作，`SplitOrderFlow` 复用 `PaymentFlow` 编排平分、现金支付、回到 Split 和提交，测试再用现有 Recall 子单详情读取最终状态。POS-30575 继续由 `DeliveryPage` 和 `TakeoutFlow` 完成首次录入，在现有 `OrderDishesCustomerSection` 内集中管理客户按钮、`客人信息` 区域、Save 和点单页摘要读取，并升级现有 Recall 回归。

**Tech Stack:** TypeScript 5.9、Playwright Test 1.60、现有 Page Object / Flow / Fixture / `@step` 体系、Node.js test scripts。

## Global Constraints

- 所有 `describe`、`test`、测试级 `test.step`、`pages/` 与 `flows/` 的 `@step(...)` 描述均使用中文。
- 页面结构、定位器、单页动作和读取只放在 `pages/`；业务选择和跨步骤编排只放在 `flows/`。
- 优先使用录制确认的真实 `data-testid`；不得引入候选选择器遍历、多语言 `.or()` 链、动态数据库 ID、卡片位置或深链接。
- 不使用 `waitForTimeout`、`expect.poll()` 或 `expect(...).toPass()`；条件等待使用 `waitUntil()`，最终稳定状态才断言。
- 编辑输入框后立即提交并触发保存/API 的动作，提交前至少等待 200ms；继续复用 `waitForInputSettled()`。
- Jira 使用 `test(title, details, body)` 的 `details.annotation`，支付场景使用 `@现金支付`，分单场景使用 `@分单`。
- 从 `http://192.168.247:22080/kpos/front/myhome.html` 经 UI 进入目标页，不打开内部 URL/hash。
- 不覆盖录制中出现的动态订单数据库 ID；运行时从 Split 快照取得母子单业务单号。
- POS-16324 的核心断言是 Split 中首个子单 `Paid`、另一个子单未支付，以及 Recall 中对应子单分别为 `Success`、`Unpaid`；不实现录制未证明必要的拖拽或背景样式检查。
- POS-30575 的核心断言是 Delivery 输入的姓名、格式化电话、地址、Apt 与点单页 Info/摘要一致，并继续保留保存后 Recall 回显校验。

---

## File Structure

- Modify: `pages/split-order.page.ts` — 集中定义 `payBtn-<index>` 工厂，并返回已加载的 `PaymentPage`。
- Modify: `flows/split-order.flow.ts` — 编排“平分两份 → 支付指定子单 → 读取支付后快照 → 提交”，返回运行时母子单标识和落点页面。
- Modify: `tests/py-migrate/order-page-regression.spec.ts` — 新增 POS-16324 业务回归及 Split/Recall 两阶段断言。
- Modify: `pages/order-dishes/order-dishes-locators.ts` — 集中定义录制确认的客户摘要按钮、`客人信息` 区域、Save、键盘关闭按钮和点单页根区域。
- Modify: `pages/order-dishes/order-dishes-customer.section.ts` — 打开客户 Info、读取窄快照、保存并读取点单页客户摘要。
- Modify: `flows/takeout.flow.ts` — 编排 Delivery 录入、打开 Info、读取、保存和摘要读取，并把结果返回测试。
- Modify: `test-data/order-service.ts` — 保存 POS-30575 的录制输入和预期回显，不在 spec 内散落业务样本。
- Modify: `tests/py-migrate/order.service.spec.ts` — 升级现有 POS-30575，在保存前断言点单页 Info/摘要，保存后继续断言 Recall。
- Modify: `docs/playwright-recordings-needed.md` — 删除 `ORDER-PAGE-014`、`ORDER-PAGE-016`，剩余数量由 45 更新为 43。
- Modify: `docs/plans/2026-07-14-order-page-prompt-coverage.md` — 两行改为“已等价覆盖”，汇总由 `21/0/0/45/0/0` 更新为 `23/0/0/43/0/0`。

---

### Task 1: POS-16324 分单后支付部分子单

**Files:**
- Modify: `tests/py-migrate/order-page-regression.spec.ts`
- Modify: `pages/split-order.page.ts`
- Modify: `flows/split-order.flow.ts`

**Interfaces:**
- Consumes: `SelectTableFlow.enterDineInNoTableOrder(homePage): Promise<OrderDishesPage>`、`OrderDishesPage.openSplitOrder(): Promise<SplitOrderPage>`、`PaymentFlow.payByCash(paymentPage, { printReceipt: false }): Promise<void>`、`RecallPage.openOrderDetails(orderNumber, targetOrderNumber?)`、`RecallPage.readOrderPaymentStatus()`。
- Produces: `SplitOrderPage.openSuborderPayment(suborderIndex: number): Promise<PaymentPage>`。
- Produces: `SplitOrderFlow.splitEvenlyPaySuborderByCashAndSubmit(splitOrderPage, options): Promise<PartialSplitPaymentResult>`。

- [ ] **Step 1: 先写 POS-16324 失败用例**

在 `tests/py-migrate/order-page-regression.spec.ts` 顶部把 `HomePage` 从 type-only import 改为值 import：

```ts
import { HomePage } from '../../pages/home.page';
```

在“持久化分单回归” describe 内、POS-16303 后插入：

```ts
    test(
      '[POS-16324] 应能平分订单并仅现金支付一个子单后在 Recall 展示不同状态',
      {
        tag: ['@现金支付'],
        annotation: [jiraIssueAnnotation('POS-16324')],
      },
      async ({ homePage, employeeLoginPage }) => {
        const ready = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await enterReadyHome(homePage, employeeLoginPage);
        });

        const splitOrderPage = await test.step('创建无桌堂食订单、添加普通菜并打开分单页', async () => {
          const orderPage = await new SelectTableFlow().enterDineInNoTableOrder(ready);
          await new OrderDishesFlow().addRegularDish(
            orderPage,
            orderServiceDishes.regular.name,
            orderServiceDishes.regular.menu,
          );
          return await orderPage.openSplitOrder();
        });

        const original = await test.step('读取平分前的订单金额与菜品', async () => {
          return await splitOrderPage.readSnapshot();
        });

        const result = await test.step('平分为两份、现金支付首个子单并提交分单', async () => {
          return await new SplitOrderFlow().splitEvenlyPaySuborderByCashAndSubmit(
            splitOrderPage,
            {
              paidSuborderIndex: 1,
              printReceipt: false,
              splitCount: 2,
            },
          );
        });

        await test.step('校验 Split 中一个子单已支付、另一个未支付且金额与菜品比例守恒', async () => {
          expect(result.afterPayment.suborders).toHaveLength(2);
          expect(result.paidSuborder.paidStatus).toBe('Paid');
          expect(result.unpaidSuborders).toHaveLength(1);
          expect(result.unpaidSuborders[0]?.paidStatus).toBeNull();
          expect(toCents(suborderTotal(result.afterPayment))).toBe(toCents(original.total));
          expect(toCents(result.afterPayment.total)).toBe(toCents(original.total));

          for (const suborder of result.afterPayment.suborders) {
            expect(suborder.dishes).toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  name: orderServiceDishes.regular.name,
                  proportion: '1/2',
                }),
              ]),
            );
          }
        });

        await test.step('从 Recall 分别打开两个子单并校验最终支付状态', async () => {
          if (!(result.returnPage instanceof HomePage)) {
            throw new Error('POS-16324 提交分单后应返回 POS 首页。');
          }

          const recallPage = await new RecallFlow().openRecallFromHome(result.returnPage);
          await recallPage.openOrderDetails(result.parentOrderNumber, result.paidSuborder.orderNumber);
          expect(await recallPage.readOrderPaymentStatus()).toBe('Success');

          await recallPage.openOrderDetails(
            result.parentOrderNumber,
            result.unpaidSuborders[0]!.orderNumber,
          );
          expect(await recallPage.readOrderPaymentStatus()).toBe('Unpaid');
        });
      },
    );
```

- [ ] **Step 2: 运行类型检查，确认新接口尚不存在**

Run: `npx tsc --noEmit`

Expected: FAIL，错误包含 `Property 'splitEvenlyPaySuborderByCashAndSubmit' does not exist on type 'SplitOrderFlow'`。

- [ ] **Step 3: 在 SplitOrderPage 补真实子单支付入口**

在 `pages/split-order.page.ts` 增加 import：

```ts
import { PaymentPage } from './payment.page';
```

在 locator 字段和构造函数中增加真实录制契约：

```ts
  private readonly suborderPayButton: (suborderIndex: number) => Locator;

  // constructor 中
  this.suborderPayButton = (suborderIndex: number) =>
    this.splitFrame.getByTestId(`payBtn-${suborderIndex}`);
```

在页面动作区增加：

```ts
  @step((suborderIndex: number) => `页面操作：从分单页打开第 ${suborderIndex} 个子单的支付页`)
  async openSuborderPayment(suborderIndex: number): Promise<PaymentPage> {
    if (!Number.isInteger(suborderIndex) || suborderIndex < 1) {
      throw new Error(`子单序号必须是从 1 开始的整数，收到：${suborderIndex}`);
    }

    await this.expectLoaded();
    await this.suborderPayButton(suborderIndex).click();

    const paymentPage = new PaymentPage(this.page);
    await paymentPage.expectLoaded();
    return paymentPage;
  }
```

- [ ] **Step 4: 在 SplitOrderFlow 编排平分、现金支付与提交**

在 `flows/split-order.flow.ts` 增加 import：

```ts
import { PaymentFlow } from './payment.flow';
```

把现有 `SplitOrderPage` import 合并为：

```ts
import {
  type SplitOrderReturnPage,
  type SplitOrderSnapshot,
  type SplitOrderSuborderSnapshot,
  SplitOrderPage,
} from '../pages/split-order.page';
```

新增类型：

```ts
export type PartialSplitPaymentOptions = {
  paidSuborderIndex: number;
  printReceipt: boolean;
  splitCount: number;
};

export type PartialSplitPaymentResult = {
  afterPayment: SplitOrderSnapshot;
  paidSuborder: SplitOrderSuborderSnapshot;
  parentOrderNumber: string;
  returnPage: SplitOrderReturnPage;
  unpaidSuborders: SplitOrderSuborderSnapshot[];
};
```

在 `SplitOrderFlow` 中增加：

```ts
  @step(
    (_splitOrderPage: SplitOrderPage, options: PartialSplitPaymentOptions) =>
      `业务步骤：将订单平分为 ${options.splitCount} 份，现金支付第 ${options.paidSuborderIndex} 个子单并提交`,
  )
  async splitEvenlyPaySuborderByCashAndSubmit(
    splitOrderPage: SplitOrderPage,
    options: PartialSplitPaymentOptions,
  ): Promise<PartialSplitPaymentResult> {
    await this.splitOrderEvenly(splitOrderPage, options.splitCount);
    const beforePayment = await splitOrderPage.readSnapshot();
    const paidSuborder = beforePayment.suborders[options.paidSuborderIndex - 1];

    if (!paidSuborder) {
      throw new Error(
        `分单后不存在第 ${options.paidSuborderIndex} 个子单；实际子单数：${beforePayment.suborders.length}`,
      );
    }

    const paymentPage = await splitOrderPage.openSuborderPayment(options.paidSuborderIndex);
    await new PaymentFlow().payByCash(paymentPage, {
      printReceipt: options.printReceipt,
    });

    const afterPayment = await splitOrderPage.readSnapshot();
    const settledPaidSuborder = afterPayment.suborders.find(
      (suborder) => suborder.orderNumber === paidSuborder.orderNumber,
    );

    if (!settledPaidSuborder) {
      throw new Error(`支付后未找到子单 ${paidSuborder.orderNumber}。`);
    }

    const parentOrderNumber = settledPaidSuborder.orderNumber.split('-')[0];
    if (!parentOrderNumber) {
      throw new Error(`无法从子单号 ${settledPaidSuborder.orderNumber} 解析母单号。`);
    }

    const unpaidSuborders = afterPayment.suborders.filter(
      (suborder) => suborder.orderNumber !== settledPaidSuborder.orderNumber,
    );
    const returnPage = await this.submitAndReturnPage(splitOrderPage);

    return {
      afterPayment,
      paidSuborder: settledPaidSuborder,
      parentOrderNumber,
      returnPage,
      unpaidSuborders,
    };
  }
```

- [ ] **Step 5: 运行类型检查和 POS-16324 真 UI 用例**

Run: `npx tsc --noEmit`

Expected: PASS，exit code 0。

Run: `npx playwright test tests/py-migrate/order-page-regression.spec.ts --project=py-migrate --grep "POS-16324"`

Expected: PASS，1 passed；报告中可见中文业务步骤，Split 快照为一个 `Paid`、一个未支付，Recall 为 `Success`/`Unpaid`。

- [ ] **Step 6: 提交 POS-16324 独立交付**

```bash
git add pages/split-order.page.ts flows/split-order.flow.ts tests/py-migrate/order-page-regression.spec.ts
git commit -m "test: automate partial split payment regression"
```

---

### Task 2: POS-30575 Delivery 客户信息预填

**Files:**
- Modify: `pages/order-dishes/order-dishes-locators.ts`
- Modify: `pages/order-dishes/order-dishes-customer.section.ts`
- Modify: `flows/takeout.flow.ts`
- Modify: `test-data/order-service.ts`
- Modify: `tests/py-migrate/order.service.spec.ts`

**Interfaces:**
- Consumes: `TakeoutFlow.startDeliveryOrder(homePage, params): Promise<OrderDishesPage>`、`saveOrderAndOpenLatestRecallDetails(orderDishesPage)`。
- Produces: `OrderDishesCustomerInformationSnapshot`，包含从真实客户按钮解析的 `customerName`、`normalizedPhone`，以及真实 Info DOM 的 `informationText`。
- Produces: `OrderDishesCustomerSection.openCustomerInformation(customerButtonLabel)`、`readCustomerInformationSnapshot(customerButtonLabel)`、`saveCustomerInformation()`、`readOrderCustomerSummaryText()`。
- Produces: `TakeoutFlow.startDeliveryOrderWithCustomerInformationSnapshot(homePage, params, customerButtonLabel): Promise<DeliveryOrderWithCustomerInformationResult>`。

- [ ] **Step 1: 固化录制输入并先升级 POS-30575 失败用例**

在 `test-data/order-service.ts` 的客户数据后增加：

```ts
export const orderServiceDeliveryInformationCase = {
  input: {
    address: 'huashengdun',
    customerName: 'baga',
    phoneNumber: '9322222222',
    street: '123',
  } satisfies DeliveryOrderParams,
  expected: {
    customerButtonLabel: 'baga (932)222-2222',
    informationText: '(932)222-2222huashengdun, Flushing, NY 11355',
    orderSummaryText: 'huashengdun, 123, Flushing, NY, 11355',
  },
} as const;
```

在 `tests/py-migrate/order.service.spec.ts` 的 test-data import 中加入 `orderServiceDeliveryInformationCase`，并将现有 POS-30575 用例替换为：

```ts
  test(
    '[POS-30575] 应能在 Delivery 点单页 Info 和 Recall 中展示一致的客户信息',
    {
      annotation: [jiraIssueAnnotation('POS-30575')],
    },
    async ({ homePage, employeeLoginPage }) => {
      const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
        return await enterReadyHome({ employeeLoginPage, homePage });
      });

      const deliveryResult = await test.step('填写 Delivery 信息并读取点单页客户 Info 与摘要', async () => {
        return await new TakeoutFlow().startDeliveryOrderWithCustomerInformationSnapshot(
          readyHomePage,
          orderServiceDeliveryInformationCase.input,
          orderServiceDeliveryInformationCase.expected.customerButtonLabel,
        );
      });

      await test.step('校验姓名、规范化电话、地址和 Apt 与首次输入一致', async () => {
        expect(deliveryResult.customerInformation.customerName).toBe(
          orderServiceDeliveryInformationCase.input.customerName,
        );
        expect(deliveryResult.customerInformation.normalizedPhone).toBe(
          orderServiceDeliveryInformationCase.input.phoneNumber,
        );
        expect(deliveryResult.customerInformation.informationText.replace(/\s+/g, '')).toContain(
          orderServiceDeliveryInformationCase.expected.informationText.replace(/\s+/g, ''),
        );
        expect(deliveryResult.orderCustomerSummaryText.replace(/\s+/g, '')).toContain(
          orderServiceDeliveryInformationCase.expected.orderSummaryText.replace(/\s+/g, ''),
        );
      });

      await test.step('添加菜品、保存订单并在 Recall 校验客户信息', async () => {
        await new OrderDishesFlow().addRegularDish(
          deliveryResult.orderDishesPage,
          orderServiceDishes.regular.name,
          orderServiceDishes.regular.menu,
        );

        const orderDetails = await saveOrderAndOpenLatestRecallDetails(
          deliveryResult.orderDishesPage,
        );
        expect(orderDetails.customerInfo?.name).toContain(
          orderServiceDeliveryInformationCase.input.customerName,
        );
        expect(orderDetails.customerInfo?.address).toContain(
          orderServiceDeliveryInformationCase.input.address,
        );
        expect(orderDetails.customerInfo?.address).toContain(
          orderServiceDeliveryInformationCase.input.street,
        );
        expect(orderDetails.customerInfo?.phone.replace(/\D/g, '')).toContain(
          orderServiceDeliveryInformationCase.input.phoneNumber,
        );
      });
    },
  );
```

- [ ] **Step 2: 运行类型检查，确认客户 Info API 尚不存在**

Run: `npx tsc --noEmit`

Expected: FAIL，错误包含 `Property 'startDeliveryOrderWithCustomerInformationSnapshot' does not exist on type 'TakeoutFlow'`。

- [ ] **Step 3: 在 OrderDishesLocators 集中定义录制确认的 DOM**

在 `pages/order-dishes/order-dishes-locators.ts` 字段区增加：

```ts
  readonly customerInformationButton: (accessibleName: string) => Locator;
  readonly customerInformationRegion: Locator;
  readonly customerInformationSaveButton: Locator;
  readonly customerInformationKeyboardCloseButton: Locator;
  readonly orderDishesRoot: Locator;
```

在现有 customer locator 初始化后增加：

```ts
    this.customerInformationButton = (accessibleName: string) =>
      this.page.getByRole('button', { name: accessibleName, exact: true });
    this.customerInformationRegion = this.page.getByLabel('客人信息', { exact: true });
    this.customerInformationSaveButton = this.customerInformationRegion
      .getByTestId('button-default')
      .filter({ hasText: 'Save' })
      .first();
    this.customerInformationKeyboardCloseButton = this.page.getByTestId(
      'pos-keyboard-button-{close}',
    );
    this.orderDishesRoot = this.page.locator('#orderDishesRoot');
```

- [ ] **Step 4: 在客户 section 实现打开、读取、保存和摘要读取**

在 `pages/order-dishes/order-dishes-customer.section.ts` 顶部增加：

```ts
export type OrderDishesCustomerInformationSnapshot = {
  customerName: string;
  informationText: string;
  normalizedPhone: string;
};

function normalizeCustomerText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
```

在类中增加：

```ts
  @step((customerButtonLabel: string) => `页面操作：打开客户信息 ${customerButtonLabel}`)
  async openCustomerInformation(customerButtonLabel: string): Promise<void> {
    await this.host.expectLoaded();
    await this.locators.customerInformationButton(customerButtonLabel).click();

    if (await this.locators.customerInformationKeyboardCloseButton.isVisible().catch(() => false)) {
      await this.locators.customerInformationKeyboardCloseButton.click();
    }

    await expect(this.locators.customerInformationRegion).toBeVisible();
  }

  @step('页面读取：读取点单页客户按钮和客户信息区域文本')
  async readCustomerInformationSnapshot(
    customerButtonLabel: string,
  ): Promise<OrderDishesCustomerInformationSnapshot> {
    await expect(this.locators.customerInformationRegion).toBeVisible();
    const customerButtonText = normalizeCustomerText(
      await this.locators.customerInformationButton(customerButtonLabel).innerText(),
    );
    const formattedPhone = customerButtonText.match(/\(\d{3}\)\d{3}-\d{4}/)?.[0];

    if (!formattedPhone) {
      throw new Error(`客户按钮未显示可解析的格式化电话：${customerButtonText}`);
    }

    return {
      customerName: customerButtonText.replace(formattedPhone, '').trim(),
      informationText: normalizeCustomerText(
        await this.locators.customerInformationRegion.innerText(),
      ),
      normalizedPhone: formattedPhone.replace(/\D/g, ''),
    };
  }

  @step('页面操作：保存点单页客户信息并关闭 Info 区域')
  async saveCustomerInformation(): Promise<void> {
    await expect(this.locators.customerInformationSaveButton).toBeVisible();
    await this.locators.customerInformationSaveButton.click();
    await expect(this.locators.customerInformationRegion).toBeHidden();
  }

  @step('页面读取：读取点单页客户摘要文本')
  async readOrderCustomerSummaryText(): Promise<string> {
    await this.host.expectLoaded();
    return normalizeCustomerText(await this.locators.orderDishesRoot.innerText());
  }
```

- [ ] **Step 5: 在 TakeoutFlow 增加客户 Info 业务编排**

在 `flows/takeout.flow.ts` 增加 type import：

```ts
import type { OrderDishesCustomerInformationSnapshot } from '../pages/order-dishes/order-dishes-customer.section';
```

新增返回类型：

```ts
export type DeliveryOrderWithCustomerInformationResult = {
  customerInformation: OrderDishesCustomerInformationSnapshot;
  orderCustomerSummaryText: string;
  orderDishesPage: OrderDishesPage;
};
```

在 `TakeoutFlow` 中增加：

```ts
  @step('业务步骤：创建 Delivery 订单并读取点单页客户 Info 与保存后的摘要')
  async startDeliveryOrderWithCustomerInformationSnapshot(
    homePage: HomePage,
    params: DeliveryOrderParams,
    customerButtonLabel: string,
  ): Promise<DeliveryOrderWithCustomerInformationResult> {
    const orderDishesPage = await this.startDeliveryOrder(homePage, params);
    await orderDishesPage.customer.openCustomerInformation(customerButtonLabel);
    const customerInformation =
      await orderDishesPage.customer.readCustomerInformationSnapshot(customerButtonLabel);
    await orderDishesPage.customer.saveCustomerInformation();
    const orderCustomerSummaryText =
      await orderDishesPage.customer.readOrderCustomerSummaryText();

    return {
      customerInformation,
      orderCustomerSummaryText,
      orderDishesPage,
    };
  }
```

- [ ] **Step 6: 运行类型检查和 POS-30575 真 UI 用例**

Run: `npx tsc --noEmit`

Expected: PASS，exit code 0。

Run: `npx playwright test tests/py-migrate/order.service.spec.ts --project=py-migrate --grep "POS-30575"`

Expected: PASS，1 passed；保存前 Info 包含 `baga`、`(932)222-2222`、`huashengdun`，保存后摘要含 `123`，Recall 仍回显姓名、电话和地址。

- [ ] **Step 7: 提交 POS-30575 独立交付**

```bash
git add pages/order-dishes/order-dishes-locators.ts pages/order-dishes/order-dishes-customer.section.ts flows/takeout.flow.ts test-data/order-service.ts tests/py-migrate/order.service.spec.ts
git commit -m "test: automate delivery customer info prefill"
```

---

### Task 3: 清单收口与联合验证

**Files:**
- Modify: `docs/playwright-recordings-needed.md`
- Modify: `docs/plans/2026-07-14-order-page-prompt-coverage.md`

**Interfaces:**
- Consumes: Task 1 的 POS-16324 通过证据、Task 2 的 POS-30575 通过证据。
- Produces: 43 条剩余一对一录制请求，以及矩阵汇总 `23/0/0/43/0/0`。

- [ ] **Step 1: 更新待录制清单**

在 `docs/playwright-recordings-needed.md`：

1. 将正文中的“点单页面提示词当前剩余 **45 条**”改为“点单页面提示词当前剩余 **43 条**”。
2. 将“以下 45 条需求”改为“以下 43 条需求”。
3. 完整删除从 `### ORDER-PAGE-014` 开始、到 `### ORDER-PAGE-015` 前结束的区块。
4. 完整删除从 `### ORDER-PAGE-016` 开始、到 `### ORDER-PAGE-017` 前结束的区块。
5. 保留后续录制编号原值，不重编号。

- [ ] **Step 2: 更新覆盖矩阵两行和汇总**

在 `docs/plans/2026-07-14-order-page-prompt-coverage.md`：

1. 将汇总 `21/0/0/45/0/0` 改为 `23/0/0/43/0/0`。
2. 将 POS-16324 行的状态和证据改为：

```markdown
| 26 | POS-16324 | POS-16324 点单页点击分单后支付部分子单，查看订单信息 | 分单与小费 | 已等价覆盖 | `tests/py-migrate/order-page-regression.spec.ts` 从 POS 首页经无桌堂食进入点单页，添加普通菜后按录制契约 `evenOrderBtn` 平分两份，并通过真实 `payBtn-1` 复用现金支付流程；测试在 Split 中断言首个子单为 `Paid`、另一个未支付、两份菜品比例均为 `1/2` 且金额守恒，提交后用运行时母子单号在 Recall 分别断言 `Success` 与 `Unpaid`。录制已经证明原清单要求的拖拽和订单背景不是本用例核心校验点，因此不再实现。 | `pages/split-order.page.ts`、`flows/split-order.flow.ts`、`flows/payment.flow.ts`、`tests/py-migrate/order-page-regression.spec.ts` | `ORDER-PAGE-014` | 2026-07-15：根据录制补齐 `payBtn-1` 子单支付入口和 Split/Recall 双阶段状态断言，真 UI 通过后移出待录制清单 |
```

3. 将 POS-30575 行的状态和证据改为：

```markdown
| 29 | POS-30575 | POS-30575：delivery点单，输入用户信息，进入点单页面点击info,info信息预输入的一致 | 客户信息 | 已等价覆盖 | `tests/py-migrate/order.service.spec.ts` 使用录制数据 `baga`、`9322222222`、`huashengdun`、Apt `123` 创建 Delivery 订单；进入点单页后通过客户按钮和真实 `aria-label="客人信息"` 区域读取预填信息，断言姓名、格式化电话和地址一致，Save 后断言点单页摘要包含 Apt，保存后继续在 Recall 断言姓名、电话和地址。 | `pages/order-dishes/order-dishes-locators.ts`、`pages/order-dishes/order-dishes-customer.section.ts`、`test-data/order-service.ts`、`tests/py-migrate/order.service.spec.ts` | `ORDER-PAGE-016` | 2026-07-15：根据录制补齐点单页客户 Info/摘要契约并保留 Recall 回显，真 UI 通过后移出待录制清单 |
```

- [ ] **Step 3: 运行联合真 UI、静态检查和脚本测试**

Run: `npx playwright test tests/py-migrate/order-page-regression.spec.ts tests/py-migrate/order.service.spec.ts --project=py-migrate --grep "POS-16324|POS-30575"`

Expected: PASS，2 passed。

Run: `npx tsc --noEmit`

Expected: PASS，exit code 0。

Run: `npm run test:scripts`

Expected: PASS，所有 Node test suites 通过。

- [ ] **Step 4: 校验文档数量与映射**

Run: `(rg -c '^### ORDER-PAGE-' docs/playwright-recordings-needed.md)`

Expected: `43`。

Run: `rg -n "ORDER-PAGE-014|ORDER-PAGE-016" docs/playwright-recordings-needed.md`

Expected: 无输出，exit code 1。

Run: `rg -n "23/0/0/43/0/0|POS-16324|POS-30575" docs/plans/2026-07-14-order-page-prompt-coverage.md`

Expected: 汇总命中 1 次，POS-16324 与 POS-30575 各命中 1 行且状态均为“已等价覆盖”。

- [ ] **Step 5: 查看差异，确认没有录制噪声和越界修改**

Run: `git diff --check`

Expected: 无输出，exit code 0。

Run: `git status --short`

Expected: 只列出本计划明确涉及的代码与文档文件；不包含附件、trace、截图、`test-results/` 或动态订单数据。

- [ ] **Step 6: 提交文档收口**

```bash
git add docs/playwright-recordings-needed.md docs/plans/2026-07-14-order-page-prompt-coverage.md
git commit -m "docs: close recorded split and delivery cases"
```

---

## Final Acceptance

- POS-16324 从首页经 UI 创建订单，按真实 `payBtn-1` 支付首个子单；Split 与 Recall 两阶段状态、金额守恒和 `1/2` 菜品比例均有断言。
- POS-30575 使用录制输入，在点单页保存前校验客户 Info，在保存后校验点单页摘要与 Recall，不把地址字符串硬编码在页面对象内。
- 页面对象只包含稳定 DOM 和低层动作，业务编排留在 flow，测试只持有场景断言。
- 两条目标真 UI 用例联合通过，TypeScript 与脚本测试通过。
- 待录制标题恰好 43 条，`ORDER-PAGE-014` 与 `ORDER-PAGE-016` 已移除，矩阵汇总为 `23/0/0/43/0/0`。
