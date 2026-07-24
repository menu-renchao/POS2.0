import { expect } from '@playwright/test';
import { test } from '../../fixtures/test.fixture';
import { pagingConfiguration, pagingOrder } from '../../test-data/paging';
import { jiraIssueAnnotation } from '../../utils/jira';

test.describe(
  'Paging 叫号核心回归',
  { tag: ['@点单', '@叫号', '@订单查询', '@送厨打印', '@ui-exclusive-config'] },
  () => {
    test.describe.configure({ timeout: 180_000 });

    test(
      '[POS-42087] 应能在 Paging 页面按订单类型和订单号组合搜索订单',
      {
        annotation: [jiraIssueAnnotation('POS-42087')],
      },
      async ({ apiSetup, employeeLoginPage, homeFlow, homePage, pagingFlow }) => {
        const restoreConfiguration = await apiSetup.systemConfiguration.updateByName(
          pagingConfiguration.automaticCompletionMinutes,
          pagingConfiguration.searchScenarioMinutes,
          { verify: true },
        );

        try {
          const readyHomePage = await homeFlow.openHomeAfterConfigurationRefreshWithEmployeeContext(
            homePage,
            employeeLoginPage,
          );
          const sentOrder = await pagingFlow.createSentDineInOrder(readyHomePage);
          const pagingPage = await pagingFlow.openPagingForOrder(
            sentOrder.homePage,
            sentOrder.orderNumber,
          );

          await pagingFlow.searchDineInOrder(pagingPage, sentOrder.orderNumber);

          await test.step('校验组合搜索结果中的订单号和订单类型', async () => {
            expect(await pagingPage.readVisibleOrderNumbers()).toContain(sentOrder.orderNumber);
            expect(await pagingPage.readOrderType(sentOrder.orderNumber)).toBe(pagingOrder.type);
          });

          await pagingFlow.returnHome(pagingPage, homePage);
        } finally {
          await restoreConfiguration();
        }
      },
    );

    test(
      '[POS-42090] 应能在 Paging 页面叫号并销号后显示为已完成',
      {
        annotation: [jiraIssueAnnotation('POS-42090')],
      },
      async ({ employeeLoginPage, homeFlow, homePage, pagingFlow }) => {
        const readyHomePage = await homeFlow.openHomeWithEmployeeContext(
          homePage,
          employeeLoginPage,
        );
        const sentOrder = await pagingFlow.createSentDineInOrder(readyHomePage);
        const pagingPage = await pagingFlow.openPagingForOrder(
          sentOrder.homePage,
          sentOrder.orderNumber,
        );

        await pagingFlow.readyAndCallOffOrder(pagingPage, sentOrder.orderNumber);

        await test.step('校验销号订单出现在已完成列表', async () => {
          expect(await pagingPage.readVisibleOrderNumbers()).toContain(sentOrder.orderNumber);
        });

        await pagingFlow.returnHome(pagingPage, homePage);
      },
    );

    test(
      '[POS-42091] 应能按配置时长自动完成 Paging 订单',
      {
        annotation: [jiraIssueAnnotation('POS-42091')],
        tag: ['@slow'],
      },
      async ({ apiSetup, employeeLoginPage, homeFlow, homePage, pagingFlow }) => {
        const restoreConfiguration = await apiSetup.systemConfiguration.updateByName(
          pagingConfiguration.automaticCompletionMinutes,
          pagingConfiguration.timeoutScenarioMinutes,
          { verify: true },
        );

        try {
          const readyHomePage = await homeFlow.openHomeAfterConfigurationRefreshWithEmployeeContext(
            homePage,
            employeeLoginPage,
          );
          const sentOrder = await pagingFlow.createSentDineInOrder(readyHomePage);
          const pagingPage = await pagingFlow.openPagingForOrder(
            sentOrder.homePage,
            sentOrder.orderNumber,
          );

          await pagingPage.selectStatus('completed');
          await pagingPage.waitForOrderVisible(sentOrder.orderNumber, 90_000);

          await test.step('校验超时订单出现在已完成列表', async () => {
            expect(await pagingPage.readVisibleOrderNumbers()).toContain(sentOrder.orderNumber);
          });

          await pagingFlow.returnHome(pagingPage, homePage);
        } finally {
          await restoreConfiguration();
        }
      },
    );

    test(
      '[POS-42092] 应能一键完成 Paging 页面全部待取餐订单',
      {
        annotation: [jiraIssueAnnotation('POS-42092')],
      },
      async ({ employeeLoginPage, homeFlow, homePage, pagingFlow }) => {
        const readyHomePage = await homeFlow.openHomeWithEmployeeContext(
          homePage,
          employeeLoginPage,
        );
        const sentOrder = await pagingFlow.createSentDineInOrder(readyHomePage);
        const pagingPage = await pagingFlow.openPagingForOrder(
          sentOrder.homePage,
          sentOrder.orderNumber,
        );

        await pagingFlow.readyAndCompleteAllOrders(pagingPage, sentOrder.orderNumber);

        await test.step('校验目标订单出现在已完成列表', async () => {
          expect(await pagingPage.readVisibleOrderNumbers()).toContain(sentOrder.orderNumber);
        });

        await pagingFlow.returnHome(pagingPage, homePage);
      },
    );

    test(
      '[POS-43829] 应能刷新叫号屏并展示指定 Paging 订单',
      {
        annotation: [jiraIssueAnnotation('POS-43829')],
      },
      async ({ employeeLoginPage, homeFlow, homePage, pagingFlow }) => {
        const readyHomePage = await homeFlow.openHomeWithEmployeeContext(
          homePage,
          employeeLoginPage,
        );
        const sentOrder = await pagingFlow.createSentDineInOrder(readyHomePage);
        const pagingPage = await pagingFlow.openPagingForOrder(
          sentOrder.homePage,
          sentOrder.orderNumber,
        );

        await pagingPage.selectStatus('preparing');
        await pagingPage.waitForOrderVisible(sentOrder.orderNumber);
        await pagingPage.refreshPickupScreen();

        const pickupScreenPage = await pagingPage.openPickupScreen();
        try {
          await pickupScreenPage.expectOrderVisible(sentOrder.orderNumber);
          await test.step('校验叫号屏展示指定订单', async () => {
            expect(await pickupScreenPage.readScreenText()).toContain(sentOrder.orderNumber);
          });
        } finally {
          await pickupScreenPage.close();
        }

        await pagingFlow.returnHome(pagingPage, homePage);
      },
    );
  },
);
