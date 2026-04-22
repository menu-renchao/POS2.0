# POS 自动化项目 AI 自动生成代码演示文档

## 1. 演示定位

本文档用于向团队成员演示当前 `pos2.0` 项目如何结合 AI 自动生成、补全和维护 Playwright + TypeScript 自动化代码。

本次演示的重点不是“让 AI 随机写脚本”，而是展示如何通过项目规则、分层架构、需求模板和验证机制，把 AI 输出约束成可维护、可复用、可审查的工程代码。

演示建议时长：30 到 45 分钟。

适合受众：

- 测试工程师：理解如何把业务场景转成稳定自动化用例。
- 开发工程师：理解为什么需要 `data-testid`、页面对象和业务流程分层。
- 自动化维护者：理解如何让 AI 持续补代码而不是制造一次性脚本。
- 团队负责人：理解 AI 参与自动化建设的收益、边界和风险控制方式。

## 2. 演示目标

本次演示结束后，团队成员应能理解以下内容：

1. 当前项目不是零散 Playwright 脚本，而是有明确边界的自动化工程。
2. AI 生成代码前必须先读取仓库规则、现有结构和类似实现。
3. 需求描述越结构化，AI 生成的代码越稳定、越容易合入。
4. AI 生成代码的核心产物通常不是单个测试文件，而是 `pages/`、`flows/`、`tests/` 的协同增量。
5. AI 产出的代码必须经过真实验证，不能只停留在“理论上应该通过”。

一句话总结：

> 这个项目中的 AI 自动生成代码流程，是“规则驱动 + 分层复用 + 最小增量 + 真实验证”的工程化流程。

## 3. 项目背景

当前仓库是 POS 前端的 UI 自动化项目，技术栈为：

- 测试框架：Playwright Test
- 开发语言：TypeScript
- 报告体系：Allure + 中文步骤
- 浏览器：Chrome
- 主要入口：`http://192.168.0.89:22080/kpos/front2/myhome.html`

常用命令：

```bash
npm test
npm run test:smoke
npm run test:e2e
npm run test:headed
npm run codegen
npm run allure:generate
npm run allure:open
```

项目目录职责：

```text
pos2.0
├── docs/          文档与计划
├── fixtures/      Playwright fixture 扩展
├── flows/         业务流程编排
├── pages/         页面对象与页面级动作
├── test-data/     环境配置与测试数据
├── tests/         smoke / e2e 自动化用例
├── utils/         公共工具
├── AGENTS.md      AI 与项目协作规则
└── package.json   脚本与依赖
```

## 4. 演示主线

推荐用以下主线串联整场演示：

```text
业务需求
  -> 结构化需求模板
  -> AI 读取 AGENTS.md 和已有代码
  -> 判断应该复用还是新增能力
  -> 补充 page 层页面动作
  -> 补充 flow 层业务编排
  -> 补充 test 层验证用例
  -> 运行 Playwright 验证
  -> 生成 Allure 中文报告
```

讲解重点：

- AI 不是直接从需求跳到测试脚本。
- AI 必须先理解项目约束。
- AI 应优先复用已有 page、flow、fixture、utils。
- 新增代码必须符合分层边界。
- 验证结果必须来自真实命令执行。

## 5. AI 生成代码的前置规则

项目中的 AI 行为主要由 `AGENTS.md` 约束。

演示时建议重点说明以下规则。

### 5.1 必须使用 Playwright Test

所有自动化用例默认使用 Playwright Test，不引入其他临时 runner。

原因：

- 保持报告、fixture、配置和运行方式统一。
- 降低维护成本。
- 避免 AI 生成无法接入现有体系的孤立脚本。

### 5.2 定位器优先级

推荐顺序：

1. 优先使用 `data-testid`。
2. 没有稳定测试属性时，使用 `getByRole`、`getByLabel`、`getByText`。
3. 避免长 CSS 链、`nth-child`、XPath。

演示话术：

> AI 很容易生成“能跑一次”的选择器，但项目要求的是“页面变化后还能维护”的选择器。

### 5.3 禁止直接打开业务内页

项目要求所有业务页面都从 POS 首页进入，不能直接拼接 hash 或深链接进入内部页面。

原因：

- POS 不是普通 SaaS 系统。
- 授权选择、员工上下文、iframe、入口状态都可能影响后续页面。
- 直接打开内页会绕过真实业务链路，导致用例失真。

### 5.4 所有中文报告步骤必须可执行

`pages/` 和 `flows/` 中的方法需要使用中文 `@step(...)`。

示例：

```ts
@step('页面操作：点击 Dine In 入口并进入选桌页')
async clickDineIn(): Promise<SelectTablePage> {
  await this.clickFunctionButton('Dine In');
  return new SelectTablePage(this.page);
}
```

这样 Allure 报告里看到的不是一堆底层点击，而是业务可读的中文步骤。

### 5.5 不使用 `waitForTimeout`

项目使用 `utils/wait.ts` 中的 `waitUntil()` 处理需要轮询的条件。

价值：

- 避免固定等待导致用例慢。
- 避免 `expect.poll()` 或 `expect(...).toPass()` 在报告中制造中间失败噪声。
- 超时失败时能输出最后一次探测值，便于定位问题。

## 6. 项目分层模型

AI 生成代码时最重要的是遵守三层边界。

### 6.1 Page 层：页面能做什么

目录：`pages/`

职责：

- 定义页面结构。
- 集中管理稳定定位器。
- 封装页面级动作。
- 封装页面级读取。

Page 层可以做：

- 点击按钮。
- 填写输入框。
- 读取表格、卡片、弹窗内容。
- 等待页面加载。
- 返回下一个页面对象。

Page 层不能做：

- 选择“任意可用桌台”。
- 判断“优先选择哪种订单”。
- 处理跨页面业务兜底策略。
- 决定业务流程怎么走。

示例：

```ts
@step('页面操作：点击 Recall 入口并进入 Recall 页面')
async clickRecall(): Promise<RecallPage> {
  await this.clickFunctionButton('Recall');
  return new RecallPage(this.page);
}
```

这个方法只表达页面动作：点击 Recall。

### 6.2 Flow 层：业务想完成什么

目录：`flows/`

职责：

- 组合多个 page 方法。
- 表达业务意图。
- 处理选择策略、分支、兜底和状态恢复。

Flow 层可以做：

- 选择任意空桌。
- 根据菜品参数选择普通菜、称重菜、套餐菜或规格菜流程。
- 搜索订单并读取详情。
- 失败后关闭弹窗恢复页面状态。

示例：

```ts
@step('业务步骤：在选桌页面选择任意空桌')
async selectAnyAvailableTable(
  selectTablePage: SelectTablePage,
): Promise<TableSelectionResult> {
  await selectTablePage.expectLoaded();
  const areaNames = await selectTablePage.readAreaNames();

  for (const areaName of areaNames) {
    await selectTablePage.selectArea(areaName);
    const availableTables = await selectTablePage.getAvailableTables();
    const selectedTable = availableTables[0];

    if (!selectedTable) {
      continue;
    }

    const tableNumber = await selectTablePage.readTableNumber(selectedTable);
    await selectTablePage.clickTable(selectedTable);

    return {
      selectedTable: {
        areaName,
        tableNumber,
      },
    };
  }

  throw new Error('No available table found across all visible areas on the select-table page.');
}
```

这个方法属于 Flow 层，因为它包含“选择任意空桌”的业务策略。

### 6.3 Test 层：验证什么结果

目录：`tests/`

职责：

- 描述测试意图。
- 调用 flow 或 page 能力。
- 保留必要断言。
- 使用 Playwright 原生 metadata。

示例：

```ts
test(
  '应能通过 New order 跳过选桌直接进入点餐页面',
  {
    tag: ['@smoke'],
    annotation: [
      {
        type: 'issue',
        description: 'https://devtickets.atlassian.net/browse/POS-46667',
      },
    ],
  },
  async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
    await openHome(homePage);

    if (await licenseSelectionPage.isVisible(10_000)) {
      await enterWithAvailableLicense(licenseSelectionPage, homePage);
    }

    const loggedInHomePage = await enterWithEmployeePassword(
      employeeLoginPage,
      homePage,
      '11',
    );

    await loggedInHomePage.expectPrimaryFunctionCardsVisible();
    const selectTablePage = await loggedInHomePage.clickDineIn();
    const orderDishesPage = await skipTableSelectionAndEnterOrderDishes(selectTablePage);

    await orderDishesPage.expectLoaded();
  },
);
```

这里测试只表达业务路径和最终验证，没有堆叠底层选择器。

## 7. AI 生成代码的标准流程

演示时可以把 AI 工作流拆成 8 步。

### 第 1 步：读取规则

AI 先读取：

- `AGENTS.md`
- `package.json`
- `playwright.config.ts`
- 相关 `pages/`
- 相关 `flows/`
- 相关 `tests/`
- `utils/step.ts`
- `utils/wait.ts`

目的：

- 识别项目技术栈。
- 识别分层边界。
- 识别已有能力。
- 避免重复造轮子。

### 第 2 步：识别需求类型

AI 需要判断任务属于哪类：

- 只需要补测试。
- 需要补 page 能力。
- 需要补 flow 能力。
- 需要同时补 page、flow、test。
- 只需要补契约测试或工具函数。

示例：

```text
需求：验证 Recall 页面能按订单号打开订单详情并读取菜品明细。

AI 判断：
1. 需要 RecallPage 提供打开订单详情和读取详情的页面能力。
2. 需要 RecallFlow 表达“查看指定订单详情”的业务步骤。
3. 需要 e2e 用例验证读取结果结构。
```

### 第 3 步：检查已有能力

AI 不能直接新建文件，而要先查找类似实现。

推荐检查：

```bash
rg "Recall" pages flows tests
rg "order details" pages flows tests
rg "订单详情" pages flows tests
```

如果已有能力接近，应增量补充，不重复创建。

### 第 4 步：设计最小增量

AI 应回答：

- 需要改哪些文件？
- 哪些能力放 page？
- 哪些能力放 flow？
- 哪些断言放 test？
- 是否需要补测试数据？
- 是否需要补工具方法？

原则：

- 不做无关重构。
- 不扩大任务范围。
- 不为单个用例写一堆一次性代码。

### 第 5 步：生成 Page 代码

Page 代码要求：

- 稳定定位器集中定义。
- 方法名称表达页面动作。
- 公共方法使用中文 `@step(...)`。
- 不写业务选择策略。
- 复杂弹窗如果强耦合在父页面中，可以保留在父 page object 内。

错误示例：

```ts
async selectBestAvailableTable() {
  // 错误：这是业务策略，不该放在 page。
}
```

正确示例：

```ts
async getAvailableTables() {
  // 正确：只读取页面中可用桌台。
}
```

### 第 6 步：生成 Flow 代码

Flow 代码要求：

- 表达业务意图。
- 组合 page 能力。
- 可以包含选择策略和兜底逻辑。
- 异常时尽量恢复页面状态。

示例：

```ts
@step('业务步骤：选择任意空桌并选择 2 位客人进入点单页')
async selectAnyAvailableTableAndEnterOrderDishes(...) {
  // 选择空桌、处理人数弹窗、进入点单页。
}
```

### 第 7 步：生成 Test 代码

Test 代码要求：

- `describe` 和 `test` 标题使用中文。
- 使用 Playwright 原生 `test(title, details, body)` 元数据。
- Jira 链接放在 `details.annotation`。
- 测试正文只保留业务意图和断言。
- 不堆底层 locator。

### 第 8 步：运行验证

AI 必须运行相关命令，例如：

```bash
npm run test:smoke
npx playwright test tests/e2e/xxx.spec.ts
npx tsc --noEmit
```

输出时必须说明真实结果：

- 哪个命令运行了。
- 是否通过。
- 如果失败，失败原因是什么。
- 如果因为环境不可达而无法验证，要明确说明。

## 8. 需求模板如何帮助 AI 生成代码

仓库中已有三个关键模板：

- `task.example.md`
- `page.example.md`
- `test-case.example.md`

它们的作用不是写给人看的形式文档，而是给 AI 的任务输入约束。

### 8.1 一体化任务模板

文件：`task.example.md`

适用场景：

- 需要 AI 一轮完成 page、flow、test、验证。
- 需求边界比较完整。
- 团队希望减少来回沟通。

核心字段：

- 场景名称
- 用例类型
- 业务目标
- 入口与前置条件
- 测试数据
- 业务步骤
- 断言要求
- 实现约束
- 输出要求

演示话术：

> 这类模板的价值是让 AI 先做工程判断，而不是直接写一个能点击的脚本。

### 8.2 Page / Flow 能力补全模板

文件：`page.example.md`

适用场景：

- 页面能力不完整。
- 需要补可复用的 page / flow。
- 还不一定马上写完整测试。

核心价值：

- 强调 page 只做页面动作。
- 强调 flow 只做业务编排。
- 强调选择器集中管理。
- 强调中文 `@step(...)`。

### 8.3 用例需求模板

文件：`test-case.example.md`

适用场景：

- 已有 page 和 flow 能力基本足够。
- 只需要新增或补充测试用例。

核心价值：

- 让 AI 优先复用已有能力。
- 避免在 spec 文件中堆底层操作。
- 让用例保持业务可读。

## 9. 现场演示脚本

下面是一套可直接用于团队演示的脚本。

### 9.1 开场介绍

建议用时：3 分钟。

讲解内容：

```text
这个项目不是一次性录制脚本，而是 POS UI 自动化工程。
我们希望 AI 参与的是可持续维护的自动化建设。
所以 AI 写代码前，必须先遵守 AGENTS.md 中的工程规则。
```

可以展示：

- `AGENTS.md`
- `package.json`
- `docs/项目框架说明.md`
- `task.example.md`

### 9.2 展示项目分层

建议用时：5 分钟。

展示目录：

```text
pages/
flows/
fixtures/
tests/
utils/
test-data/
```

讲解顺序：

1. `pages/`：页面结构与页面动作。
2. `flows/`：业务意图与多步编排。
3. `tests/`：验证目标与断言。
4. `fixtures/`：统一注入页面对象。
5. `utils/`：公共基础能力。

推荐展示文件：

- `pages/home.page.ts`
- `flows/select-table.flow.ts`
- `tests/smoke/dine-in-order-dishes.smoke.spec.ts`
- `utils/step.ts`
- `utils/wait.ts`

### 9.3 展示 AI 需求输入

建议用时：5 分钟。

可以用以下示例需求：

```text
请基于当前仓库补充一个 smoke 用例：
从 POS 首页进入，处理授权选择和员工口令，点击 Dine In，
通过 New order 跳过选桌进入点餐页，并验证点餐页加载完成。

要求：
1. 必须从首页进入。
2. 如果出现 license 页面，要选择可用授权。
3. 员工口令使用 11。
4. 不允许直接打开点餐页 URL。
5. 优先复用已有 page / flow。
6. describe 和 test 使用中文。
7. 运行相关 Playwright 用例并汇报真实结果。
```

然后解释 AI 应如何拆解：

- `HomeFlow.openHome()` 已有，可复用。
- `LicenseSelectionFlow.enterWithAvailableLicense()` 已有，可复用。
- `EmployeeLoginFlow.enterWithEmployeePassword()` 已有，可复用。
- `HomePage.clickDineIn()` 已有，可复用。
- `SelectTableFlow.skipTableSelectionAndEnterOrderDishes()` 已有，可复用。
- 只需要新增或检查 smoke 用例。

### 9.4 展示 AI 生成后的代码形态

建议用时：8 分钟。

展示重点不是逐行讲代码，而是讲“为什么这样分层”。

推荐展示：

```ts
await openHome(homePage);

if (await licenseSelectionPage.isVisible(10_000)) {
  await enterWithAvailableLicense(licenseSelectionPage, homePage);
}

const loggedInHomePage = await enterWithEmployeePassword(
  employeeLoginPage,
  homePage,
  '11',
);

await loggedInHomePage.expectPrimaryFunctionCardsVisible();
const selectTablePage = await loggedInHomePage.clickDineIn();
const orderDishesPage = await skipTableSelectionAndEnterOrderDishes(selectTablePage);

await orderDishesPage.expectLoaded();
```

讲解点：

- 测试代码没有直接写选择器。
- 授权、员工口令、Dine In 进入、New order 进入点餐页都复用了已有能力。
- 用例表达的是业务链路，不是点击脚本。

### 9.5 展示中文报告步骤

建议用时：5 分钟。

展示 `utils/step.ts`：

```ts
export function step(title?: StepTitle) {
  return function (originalMethod: AnyMethod, context: { name: string | symbol }) {
    return async function (this: unknown, ...args: any[]) {
      const stepTitle =
        typeof title === 'function'
          ? title(...args)
          : title ?? `步骤：${String(context.name)}`;

      return await test.step(stepTitle, async () => {
        return await originalMethod.apply(this, args);
      });
    };
  };
}
```

讲解点：

- AI 新增 page / flow 方法时必须写中文 `@step(...)`。
- 报告中能看到“页面操作”和“业务步骤”的差异。
- 失败时更容易判断是页面动作失败还是业务编排失败。

### 9.6 展示验证和报告

建议用时：5 分钟。

演示命令：

```bash
npm run test:smoke
npm run allure:generate
npm run allure:open
```

如果现场环境不可用，可以说明：

```text
该项目依赖内网 POS 地址和真实 Chrome 执行环境。
如果环境不可达，AI 不能伪造通过结果，只能如实说明无法完成运行验证。
```

## 10. 可用于现场演示的完整 AI 提示词

下面是一段可以直接复制给 AI 的演示提示词。

```text
请基于当前仓库完成一个 Playwright smoke 用例，并严格遵守 AGENTS.md。

场景名称：堂食点餐入口冒烟
用例类型：smoke
业务目标：验证员工进入 POS 后，可以从首页点击 Dine In，并通过 New order 进入点餐页面。

入口与前置条件：
1. 必须从 http://192.168.0.89:22080/kpos/front2/myhome.html 进入。
2. 如果出现授权选择页面，请选择可用授权并进入系统。
3. 员工口令使用 11。
4. 不允许直接打开点餐页或拼接 hash。

业务步骤：
1. 打开 POS 首页。
2. 如出现授权选择页，进入可用授权。
3. 输入员工口令进入 POS 首页。
4. 验证首页核心入口可见。
5. 点击 Dine In。
6. 通过 New order 跳过选桌进入点餐页。
7. 验证点餐页加载完成。

实现约束：
1. 优先复用已有 pages、flows、fixtures、utils。
2. 不要在 spec 中写底层 locator。
3. describe 和 test 标题必须使用中文。
4. test 元数据使用 Playwright 原生 test(title, details, body) 风格。
5. 如果需要新增 page 或 flow 方法，必须使用中文 @step(...)。
6. 不允许使用 waitForTimeout。

完成后请输出：
1. 修改了哪些文件。
2. 为什么这些逻辑放在对应层。
3. 运行了什么命令。
4. 真实验证结果。
```

## 11. AI 生成代码质量检查清单

团队评审 AI 产物时，可以按下面清单检查。

### 11.1 需求理解

- 是否先读取了 `AGENTS.md`？
- 是否检查了已有 page / flow / test？
- 是否明确了本次只做什么、不做什么？
- 是否避免了无关重构？

### 11.2 Page 层

- 选择器是否集中定义？
- 是否优先使用 `data-testid`？
- 是否避免长 CSS 链、XPath、`nth-child`？
- 公共方法是否有中文 `@step(...)`？
- 是否只包含页面动作和页面读取？
- 是否混入了业务选择策略？

### 11.3 Flow 层

- 是否表达业务意图？
- 是否复用了 page 方法？
- 是否没有重复定义 locator？
- 是否把选择策略、兜底和状态恢复放在 flow？
- 异常时是否尽量恢复 UI 状态？

### 11.4 Test 层

- `describe` 和 `test` 标题是否为中文？
- 是否使用 Playwright 原生 metadata？
- Jira 链接是否放在 `annotation`？
- 测试正文是否保持业务可读？
- 是否避免在 spec 中堆底层 locator？

### 11.5 验证

- 是否运行了相关 Playwright 用例？
- 是否运行了 TypeScript 检查？
- 是否基于真实结果汇报？
- 如果失败，是否说明失败原因？
- 如果环境不可达，是否明确说明未验证？

## 12. AI 适合处理的任务

适合交给 AI：

- 基于已有模式新增 smoke 用例。
- 补充 page object 的页面动作。
- 把重复脚本抽到 flow。
- 给复杂弹窗补结构化读取。
- 新增中文 `@step(...)` 报告步骤。
- 根据现有模板补测试元数据。
- 根据失败日志定位选择器漂移。
- 给已有用例补断言或改成更稳定的 locator。

不适合直接交给 AI：

- 没有任何页面信号的盲写。
- 没有业务目标的“随便自动化一下”。
- 需要生产数据权限但没有说明边界的操作。
- 需要修改系统业务逻辑但只给了测试现象。
- 没有运行环境却要求 AI 声称通过。

## 13. 常见错误示例

### 13.1 把所有逻辑写进 spec

错误表现：

```ts
await page.locator('.a .b .c:nth-child(2)').click();
await page.locator('.dialog input').fill('11');
await page.locator('.btn-primary').click();
```

问题：

- 选择器脆弱。
- 业务意图不清楚。
- 无法复用。
- 报告不可读。

正确方向：

- 页面动作放到 `pages/`。
- 业务编排放到 `flows/`。
- 测试只保留业务步骤和断言。

### 13.2 Page 层写业务策略

错误表现：

```ts
async selectAnyAvailableTable() {
  // 在 page 中循环区域并选择第一张空桌。
}
```

问题：

- “选择任意空桌”是业务策略。
- Page 层职责被污染。

正确方向：

- Page 层提供 `readAreaNames()`、`selectArea()`、`getAvailableTables()`、`clickTable()`。
- Flow 层实现 `selectAnyAvailableTable()`。

### 13.3 直接打开内部页面

错误表现：

```ts
await page.goto('/kpos/front2/myhome.html#orderDishes');
```

问题：

- 绕过授权选择和员工上下文。
- 和真实业务入口不一致。
- 后续失败难以定位。

正确方向：

- 从首页进入。
- 通过 UI 入口导航到目标页面。

## 14. AI 生成代码的收益

### 14.1 提升开发效率

AI 能快速完成重复性强、模式明确的代码：

- 新增 page 方法。
- 新增 flow 编排。
- 补用例 metadata。
- 补中文步骤。
- 复用已有工具。

### 14.2 降低知识传递成本

模板和规则让新人更容易理解：

- 什么逻辑放 page。
- 什么逻辑放 flow。
- 测试如何表达业务意图。
- 报告为什么要中文步骤。

### 14.3 提高一致性

AI 在明确规则下生成代码，可以减少个人习惯差异：

- 文件放置更一致。
- 命名更一致。
- 元数据更一致。
- 验证输出更一致。

## 15. 风险与控制

### 15.1 风险：AI 生成脆弱选择器

控制方式：

- 强制优先 `data-testid`。
- 需要前端补测试属性时，不要用复杂 CSS 硬绕。
- 评审时重点看 locator。

### 15.2 风险：AI 混淆 page 和 flow

控制方式：

- 明确 page 只表达页面能力。
- 明确 flow 表达业务意图。
- 发现策略逻辑进 page 时必须退回修改。

### 15.3 风险：AI 伪造验证结果

控制方式：

- 要求输出实际运行命令。
- 要求说明真实结果。
- 环境不可达时必须明确说明。

### 15.4 风险：AI 过度实现

控制方式：

- 需求中明确“只做”和“不做”。
- 要求最小必要改动。
- 不允许无关重构。

## 16. 推荐团队协作方式

### 16.1 需求方给 AI 的输入

最少应提供：

- 场景名称。
- 用例类型。
- 入口和前置条件。
- 业务步骤。
- 断言要求。
- 测试数据。
- 是否有 Jira 链接。
- 哪些内容本次不做。

### 16.2 AI 产物交付格式

AI 完成后应输出：

- 修改文件列表。
- 核心实现说明。
- 分层理由。
- 运行命令。
- 验证结果。
- 未验证项和原因。

### 16.3 人工评审重点

人工评审不应只看“能不能跑”，还要看：

- 是否符合 `AGENTS.md`。
- 是否破坏分层边界。
- 是否会污染现有状态。
- 是否有稳定定位器。
- 是否能被后续用例复用。

## 17. 演示收尾总结

可以用以下总结结束演示：

```text
AI 在这个项目里的价值，不是替我们写一次性 Playwright 脚本，
而是在清晰规则和分层架构下，快速补充可复用的自动化能力。

我们让 AI 做重复、规范、可验证的增量代码；
让人来负责业务判断、规则制定、代码评审和风险兜底。

只要持续坚持：
1. 从真实入口进入；
2. page / flow / test 分层；
3. 中文步骤可追踪；
4. 选择器稳定；
5. 真实运行验证；

这个项目就可以长期交给 AI 和团队共同维护，而不会退化成难以维护的大脚本集合。
```

## 18. 附录：推荐演示顺序清单

现场可以按以下顺序打开文件：

1. `AGENTS.md`
2. `package.json`
3. `playwright.config.ts`
4. `utils/step.ts`
5. `utils/wait.ts`
6. `pages/home.page.ts`
7. `flows/select-table.flow.ts`
8. `flows/order-dishes.flow.ts`
9. `tests/smoke/dine-in-order-dishes.smoke.spec.ts`
10. `task.example.md`
11. `page.example.md`
12. `test-case.example.md`

推荐演示命令：

```bash
npm run test:smoke
npm run allure:generate
npm run allure:open
```

如果只想演示单个用例：

```bash
npx playwright test tests/smoke/dine-in-order-dishes.smoke.spec.ts
```

如果只想检查 TypeScript：

```bash
npx tsc --noEmit
```
