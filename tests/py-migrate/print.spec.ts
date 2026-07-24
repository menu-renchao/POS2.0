import { expect } from '@playwright/test';
import type { ApiSetup } from '../../api/setup/api-setup';
import { test } from '../../fixtures/test.fixture';
import { HomePage } from '../../pages/home.page';
import { OrderDishesPage } from '../../pages/order-dishes.page';
import { RecallPage } from '../../pages/recall.page';
import {
  orderServiceDishes,
} from '../../test-data/order-service';
import { printConfigurationNames, printTestData } from '../../test-data/print';
import { RecallPaymentStatuses } from '../../test-data/recall-search-options';
import { runCleanupTasks } from '../../utils/cleanup';
import { jiraIssueAnnotation } from '../../utils/jira';
import { PrintOutputReader, type PrintTicket } from '../../utils/print-output';

const printOutput = new PrintOutputReader();

test.describe('POS 本地票据打印核心回归', { tag: ['@打印'] }, () => {
  test.describe.configure({ timeout: 180_000 });

  test(
    '[POS-34187] 仅打印新菜应在重打时恢复整单菜品',
    {
      annotation: [jiraIssueAnnotation('POS-34187')],
      tag: ['@点单', '@订单编辑'],
    },
    async ({ flows, apiSetup, employeeLoginPage, homePage }) => {
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        {
          AUTO_SEND_TO_KITCHEN_AFTER_PRINTED: true,
          [printConfigurationNames.receiptOnlyPrintNewItems]: true,
        },
        { verify: true },
      );

      try {
        const readyHomePage =
          await flows.homeFlow.openHomeAfterConfigurationRefreshWithEmployeeContext(
            homePage,
            employeeLoginPage,
          );
        const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);
        const orderFlow = flows.orderDishesFlow;

        await orderFlow.addRegularDish(
          orderDishesPage,
          printTestData.dishes.first.name,
          printTestData.dishes.first.menu,
        );
        const beforeFirstPrint = await printOutput.snapshot();
        const firstPrint = await orderFlow.printReceiptWithReference(orderDishesPage);
        const firstReceipt = onlyTicket(
          await printOutput.waitForTickets({ after: beforeFirstPrint, kinds: ['RECEIPT'] }),
        );

        expect(firstPrint.printStatus).toBe(200);
        expect(firstReceipt.text).toContain(printTestData.dishes.first.name);

        const recallPage = await flows.recallFlow.openRecallFromHome(firstPrint.homePage);
        const editingPage = await flows.recallFlow.editOrder(
          recallPage,
          firstPrint.orderNumber,
        );
        await orderFlow.addRegularDish(
          editingPage,
          printTestData.dishes.second.name,
          printTestData.dishes.second.menu,
        );
        const beforeSecondPrint = await printOutput.snapshot();
        const secondPrint = await orderFlow.printReceiptWithReference(editingPage);
        const secondReceipt = onlyTicket(
          await printOutput.waitForTickets({ after: beforeSecondPrint, kinds: ['RECEIPT'] }),
        );

        expect(secondReceipt.text).toContain(printTestData.dishes.second.name);
        expect(secondReceipt.text).not.toContain(printTestData.dishes.first.name);

        const recallAfterSecondPrint = await flows.recallFlow.openRecallFromHome(
          secondPrint.homePage,
        );
        const beforeReprint = await printOutput.snapshot();
        expect(
          await flows.recallFlow.reprintReceiptAndReadStatus(
            recallAfterSecondPrint,
            firstPrint.orderNumber,
          ),
        ).toBe(200);
        const reprintedReceipt = onlyTicket(
          await printOutput.waitForTickets({ after: beforeReprint, kinds: ['RECEIPT'] }),
        );

        expect(reprintedReceipt.text).toContain(printTestData.dishes.first.name);
        expect(reprintedReceipt.text).toContain(printTestData.dishes.second.name);
      } finally {
        await restoreConfiguration();
      }
    },
  );

  test(
    '[POS-32337] To Go带加收子单收据应打印提示语且只包含目标子单菜品',
    {
      annotation: [
        jiraIssueAnnotation('POS-32337'),
        jiraIssueAnnotation('POS-50320'),
        {
          type: 'known-issue',
          description:
            'POS NG / 环境 0.247：普通订单收据可正常打印加收提示语；分单后打印指定子单时缺少提示语，详见 POS-50320。',
        },
      ],
      tag: ['@点单', '@分单', '@加收', '@小费'],
    },
    async ({ flows, apiSetup, employeeLoginPage, homePage }) => {
      test.fixme(
        true,
        'POS-50320：POS NG / 环境 0.247 分单子单收据缺少加收提醒语，等待产品修复。',
      );

      const restoreTemplate = await apiSetup.printConfiguration.selectTemplate(
        'RECEIPT',
        '2_5',
      );
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        {
          [printConfigurationNames.chargeReminder]: printTestData.chargeReminder.defaultText,
          [printConfigurationNames.printChargeReminder]: true,
        },
        { verify: true },
      );
      const charge = await createManualSharedTipCharge(apiSetup, 'DEFAULT');

      try {
        const readyHomePage =
          await flows.homeFlow.openHomeAfterConfigurationRefreshWithEmployeeContext(
            homePage,
            employeeLoginPage,
          );
        const orderDishesPage = await flows.takeoutFlow.startToGoOrder(readyHomePage);
        const orderFlow = flows.orderDishesFlow;

        await orderFlow.addRegularDish(
          orderDishesPage,
          printTestData.dishes.first.name,
          printTestData.dishes.first.menu,
        );
        await orderFlow.addRegularDish(
          orderDishesPage,
          printTestData.dishes.second.name,
          printTestData.dishes.second.menu,
        );
        await orderFlow.applyChargeByScope(orderDishesPage, {
          optionName: charge.name,
          scope: 'whole',
        });
        const savedOrder = await orderDishesPage.navigation.saveOrderWithReference();
        const recallPage = await flows.recallFlow.openRecallFromHome(savedOrder.homePage);
        const splitOrderPage = await flows.recallFlow.openSplitOrder(
          recallPage,
          savedOrder.orderNumber,
          undefined,
          { chargePromptAction: 'keep' },
        );
        await flows.splitOrderFlow.moveDishToNewSuborder(
          splitOrderPage,
          printTestData.dishes.second.name,
        );
        const returnedPage = await flows.splitOrderFlow.submitAndReturnPage(splitOrderPage);
        const recallAfterSplit = await enterRecall(returnedPage);
        await recallAfterSplit.orderDetails.openOrderDetails(savedOrder.orderNumber);
        const childOrderNumbers = await recallAfterSplit.orderDetails.readTargetOrderNumbers();
        expect(childOrderNumbers.length).toBeGreaterThanOrEqual(2);

        const beforePrint = await printOutput.snapshot();
        expect(
          await flows.recallFlow.printReceiptAndReadStatus(
            recallAfterSplit,
            savedOrder.orderNumber,
            childOrderNumbers[0],
          ),
        ).toBe(200);
        const receipt = onlyTicket(
          await printOutput.waitForTickets({ after: beforePrint, kinds: ['RECEIPT'] }),
        );

        const printedDishes = [
          printTestData.dishes.first.name,
          printTestData.dishes.second.name,
        ].filter((dishName) => receipt.text.includes(dishName));
        expect(printedDishes).toHaveLength(1);
        expect(receipt.text).toContain(charge.name);
        expect(receipt.text).toContain(printTestData.chargeReminder.defaultText);
      } finally {
        await runCleanupTasks(
          [
            ['删除测试加收', async () => await apiSetup.charge.delete(charge.id)],
            ['恢复打印配置', restoreConfiguration],
            ['恢复票据模板', restoreTemplate],
          ],
          'POS-32337 用例清理',
        );
      }
    },
  );

  test(
    '[POS-34222] To Go收据应以黑底白字加重显示订单类型',
    {
      annotation: [jiraIssueAnnotation('POS-34222')],
      tag: ['@点单'],
    },
    async ({ flows, apiSetup, employeeLoginPage, homePage }) => {
      const restoreTemplate = await apiSetup.printConfiguration.selectTemplate(
        'RECEIPT',
        '1_5',
      );

      try {
        const readyHomePage = await flows.homeFlow.openHomeWithEmployeeContext(
          homePage,
          employeeLoginPage,
        );
        const orderDishesPage = await flows.takeoutFlow.startToGoOrder(readyHomePage);
        await flows.orderDishesFlow.addRegularDish(
          orderDishesPage,
          printTestData.dishes.first.name,
          printTestData.dishes.first.menu,
        );
        const beforePrint = await printOutput.snapshot();
        await flows.orderDishesFlow.printReceiptWithReference(orderDishesPage);
        const receipt = onlyTicket(
          await printOutput.waitForTickets({ after: beforePrint, kinds: ['RECEIPT'] }),
        );

        expect(receipt.text).toContain('TO GO');
        expectBlackBackgroundWhiteText(receipt, 'TO GO');
      } finally {
        await restoreTemplate();
      }
    },
  );

  test(
    '[POS-33876] Delivery送厨单应打印客户电话',
    {
      annotation: [jiraIssueAnnotation('POS-33876')],
      tag: ['@点单'],
    },
    async ({ flows, apiSetup, employeeLoginPage, homePage }) => {
      const restoreTemplate = await apiSetup.printConfiguration.selectTemplate(
        'KITCHEN',
        '1_5',
      );
      const restoreConfiguration = await apiSetup.systemConfiguration.updateByName(
        printConfigurationNames.kitchenPrintTelephone,
        true,
        { verify: true },
      );

      try {
        const readyHomePage =
          await flows.homeFlow.openHomeAfterConfigurationRefreshWithEmployeeContext(
            homePage,
            employeeLoginPage,
          );
        const orderDishesPage = await flows.takeoutFlow.startDeliveryOrder(readyHomePage, {
          address: printTestData.customer.address,
          customerName: printTestData.customer.customerName,
          phoneNumber: printTestData.customer.phoneNumber,
        });
        await flows.orderDishesFlow.addRegularDish(
          orderDishesPage,
          printTestData.dishes.first.name,
          printTestData.dishes.first.menu,
        );
        const beforeSend = await printOutput.snapshot();
        await orderDishesPage.navigation.sendOrderWithReference();
        const kitchenTicket = onlyTicket(
          await printOutput.waitForTickets({ after: beforeSend, kinds: ['KITCHEN'] }),
        );

        expect(kitchenTicket.text).toContain(printTestData.customer.phoneNumber);
      } finally {
        await runCleanupTasks(
          [
            ['恢复打印配置', restoreConfiguration],
            ['恢复票据模板', restoreTemplate],
          ],
          'POS-33876 用例清理',
        );
      }
    },
  );

  test(
    '[POS-33599] 厨房单应在菜品数量后打印X',
    {
      annotation: [jiraIssueAnnotation('POS-33599')],
      tag: ['@点单'],
    },
    async ({ flows, apiSetup, employeeLoginPage, homePage }) => {
      const restoreTemplate = await apiSetup.printConfiguration.selectTemplate('KITCHEN', '7');
      const restoreConfiguration = await apiSetup.systemConfiguration.updateByName(
        printConfigurationNames.printXAfterItemCount,
        true,
        { verify: true },
      );

      try {
        const readyHomePage =
          await flows.homeFlow.openHomeAfterConfigurationRefreshWithEmployeeContext(
            homePage,
            employeeLoginPage,
          );
        const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);
        await flows.orderDishesFlow.addRegularDish(
          orderDishesPage,
          printTestData.dishes.first.name,
          printTestData.dishes.first.menu,
        );
        const beforeSend = await printOutput.snapshot();
        await orderDishesPage.navigation.sendOrderWithReference();
        const kitchenTicket = onlyTicket(
          await printOutput.waitForTickets({ after: beforeSend, kinds: ['KITCHEN'] }),
        );

        expect(kitchenTicket.text).toContain('1X');
        expect(kitchenTicket.text).toContain(printTestData.dishes.first.name);
      } finally {
        await runCleanupTasks(
          [
            ['恢复打印配置', restoreConfiguration],
            ['恢复票据模板', restoreTemplate],
          ],
          'POS-33599 用例清理',
        );
      }
    },
  );

  test(
    '[POS-26979] 未支付堂食收据应打印服务费提示语',
    {
      annotation: [jiraIssueAnnotation('POS-26979')],
      tag: ['@点单', '@加收', '@小费'],
    },
    async ({ flows, apiSetup, employeeLoginPage, homePage }) => {
      const restoreTemplate = await apiSetup.printConfiguration.selectTemplate(
        'RECEIPT',
        '1_2',
      );
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        {
          [printConfigurationNames.chargeReminder]: printTestData.chargeReminder.defaultText,
          [printConfigurationNames.printChargeReminder]: true,
        },
        { verify: true },
      );
      const charge = await createManualSharedTipCharge(apiSetup, 'SERVICE');

      try {
        const readyHomePage =
          await flows.homeFlow.openHomeAfterConfigurationRefreshWithEmployeeContext(
            homePage,
            employeeLoginPage,
          );
        const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);
        const orderFlow = flows.orderDishesFlow;
        await orderFlow.addRegularDish(
          orderDishesPage,
          printTestData.dishes.first.name,
          printTestData.dishes.first.menu,
        );
        await orderFlow.applyChargeByScope(orderDishesPage, {
          optionName: charge.name,
          scope: 'whole',
        });
        const beforePrint = await printOutput.snapshot();
        await orderFlow.printReceiptWithReference(orderDishesPage);
        const receipt = onlyTicket(
          await printOutput.waitForTickets({ after: beforePrint, kinds: ['RECEIPT'] }),
        );

        expect(receipt.text).toContain(charge.name);
        expect(receipt.text).toContain(printTestData.chargeReminder.defaultText);
      } finally {
        await runCleanupTasks(
          [
            ['删除测试加收', async () => await apiSetup.charge.delete(charge.id)],
            ['恢复打印配置', restoreConfiguration],
            ['恢复票据模板', restoreTemplate],
          ],
          'POS-26979 用例清理',
        );
      }
    },
  );

  test(
    '[POS-32335] 未支付Delivery收据应打印送餐费提示语',
    {
      annotation: [jiraIssueAnnotation('POS-32335')],
      tag: ['@点单', '@加收', '@小费'],
    },
    async ({ flows, apiSetup, employeeLoginPage, homePage }) => {
      const restoreTemplate = await apiSetup.printConfiguration.selectTemplate(
        'RECEIPT',
        '1_3',
      );
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        {
          [printConfigurationNames.chargeReminder]: printTestData.chargeReminder.defaultText,
          [printConfigurationNames.printChargeReminder]: true,
        },
        { verify: true },
      );
      const charge = await createManualSharedTipCharge(apiSetup, 'DELIVERY');

      try {
        const readyHomePage =
          await flows.homeFlow.openHomeAfterConfigurationRefreshWithEmployeeContext(
            homePage,
            employeeLoginPage,
          );
        const orderDishesPage = await flows.takeoutFlow.startDeliveryOrder(readyHomePage, {
          address: printTestData.customer.address,
          customerName: printTestData.customer.customerName,
          phoneNumber: printTestData.customer.phoneNumber,
        });
        const orderFlow = flows.orderDishesFlow;
        await orderFlow.addRegularDish(
          orderDishesPage,
          printTestData.dishes.first.name,
          printTestData.dishes.first.menu,
        );
        await orderFlow.applyChargeByScope(orderDishesPage, {
          optionName: charge.name,
          scope: 'whole',
        });
        const beforePrint = await printOutput.snapshot();
        await orderFlow.printReceiptWithReference(orderDishesPage);
        const receipt = onlyTicket(
          await printOutput.waitForTickets({ after: beforePrint, kinds: ['RECEIPT'] }),
        );

        expect(receipt.text).toContain(charge.name);
        expect(receipt.text).toContain(printTestData.chargeReminder.defaultText);
      } finally {
        await runCleanupTasks(
          [
            ['删除测试加收', async () => await apiSetup.charge.delete(charge.id)],
            ['恢复打印配置', restoreConfiguration],
            ['恢复票据模板', restoreTemplate],
          ],
          'POS-32335 用例清理',
        );
      }
    },
  );

  test(
    '[POS-31979] 3_5模板收据应友好展示最大长度加收提示语',
    {
      annotation: [jiraIssueAnnotation('POS-31979')],
      tag: ['@点单', '@加收', '@小费', '@现金支付'],
    },
    async ({ flows, apiSetup, employeeLoginPage, homePage }) => {
      const restoreTemplate = await apiSetup.printConfiguration.selectTemplate(
        'RECEIPT',
        '3_5',
      );
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        {
          [printConfigurationNames.chargeReminder]:
            printTestData.chargeReminder.maximumEnglishText,
          [printConfigurationNames.printChargeReminder]: true,
        },
        { verify: true },
      );
      const charge = await createManualSharedTipCharge(apiSetup, 'DEFAULT');

      try {
        const readyHomePage =
          await flows.homeFlow.openHomeAfterConfigurationRefreshWithEmployeeContext(
            homePage,
            employeeLoginPage,
          );
        const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);
        const orderFlow = flows.orderDishesFlow;
        await orderFlow.addRegularDish(
          orderDishesPage,
          printTestData.dishes.first.name,
          printTestData.dishes.first.menu,
        );
        await orderFlow.applyChargeByScope(orderDishesPage, {
          optionName: charge.name,
          scope: 'whole',
        });
        const paymentPage = await orderDishesPage.navigation.openPayment();
        await flows.paymentFlow.payByCash(paymentPage, { printReceipt: false });
        const recallFlow = flows.recallFlow;
        const recallPage = await recallFlow.openRecallFromHome(readyHomePage);
        await recallFlow.searchOrders(recallPage, {
          paymentStatus: RecallPaymentStatuses.paid,
        });
        const orderNumber = await recallFlow.readLatestVisibleOrderNumber(recallPage);
        const beforePrint = await printOutput.snapshot();
        await recallFlow.printReceiptAndReadStatus(recallPage, orderNumber);
        const receipt = onlyTicket(
          await printOutput.waitForTickets({ after: beforePrint, kinds: ['RECEIPT'] }),
        );

        expect(receipt.text).toContain(charge.name);
        expect(receipt.text).toContain(printTestData.chargeReminder.maximumEnglishText);
      } finally {
        await runCleanupTasks(
          [
            ['删除测试加收', async () => await apiSetup.charge.delete(charge.id)],
            ['恢复打印配置', restoreConfiguration],
            ['恢复票据模板', restoreTemplate],
          ],
          'POS-31979 用例清理',
        );
      }
    },
  );

  test(
    '[POS-31934] 加收记作小费并现金支付时订单收据不应打印小费建议',
    {
      annotation: [jiraIssueAnnotation('POS-31934')],
      tag: ['@点单', '@加收', '@小费', '@现金支付'],
    },
    async ({ flows, apiSetup, employeeLoginPage, homePage }) => {
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        {
          [printConfigurationNames.paymentTipSuggestion]:
            printTestData.tipSuggestionMode.onlyWithoutTips,
          [printConfigurationNames.receiptTipSuggestion]:
            printTestData.tipSuggestionMode.onlyWithoutTips,
        },
        { verify: true },
      );
      const charge = await createManualSharedTipCharge(apiSetup, 'DEFAULT');

      try {
        const readyHomePage =
          await flows.homeFlow.openHomeAfterConfigurationRefreshWithEmployeeContext(
            homePage,
            employeeLoginPage,
          );
        const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);
        const orderFlow = flows.orderDishesFlow;
        await orderFlow.addRegularDish(
          orderDishesPage,
          printTestData.dishes.first.name,
          printTestData.dishes.first.menu,
        );
        await orderFlow.applyChargeByScope(orderDishesPage, {
          optionName: charge.name,
          scope: 'whole',
        });
        const paymentPage = await orderDishesPage.navigation.openPayment();
        await flows.paymentFlow.payByCash(paymentPage, { printReceipt: false });
        const recallFlow = flows.recallFlow;
        const recallPage = await recallFlow.openRecallFromHome(readyHomePage);
        await recallFlow.searchOrders(recallPage, {
          paymentStatus: RecallPaymentStatuses.paid,
        });
        const orderNumber = await recallFlow.readLatestVisibleOrderNumber(recallPage);
        const beforePrint = await printOutput.snapshot();
        await recallFlow.printReceiptAndReadStatus(recallPage, orderNumber);
        const receipt = onlyTicket(
          await printOutput.waitForTickets({ after: beforePrint, kinds: ['RECEIPT'] }),
        );

        expect(receipt.text).toContain(charge.name);
        expect(receipt.text).not.toContain(printTestData.ticketText.tipSuggestion);
      } finally {
        await runCleanupTasks(
          [
            ['删除测试加收', async () => await apiSetup.charge.delete(charge.id)],
            ['恢复打印配置', restoreConfiguration],
          ],
          'POS-31934 用例清理',
        );
      }
    },
  );

  test(
    '[POS-32336] 现金支付后的堂食收据应打印加收提示语',
    {
      annotation: [jiraIssueAnnotation('POS-32336')],
      tag: ['@点单', '@加收', '@小费', '@现金支付'],
    },
    async ({ flows, apiSetup, employeeLoginPage, homePage }) => {
      const restoreTemplate = await apiSetup.printConfiguration.selectTemplate('RECEIPT', '2');
      const restoreConfiguration = await apiSetup.systemConfiguration.updateManyByName(
        {
          [printConfigurationNames.chargeReminder]: printTestData.chargeReminder.defaultText,
          [printConfigurationNames.printChargeReminder]: true,
        },
        { verify: true },
      );
      const charge = await createManualSharedTipCharge(apiSetup, 'DEFAULT');

      try {
        const readyHomePage =
          await flows.homeFlow.openHomeAfterConfigurationRefreshWithEmployeeContext(
            homePage,
            employeeLoginPage,
          );
        const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);
        const orderFlow = flows.orderDishesFlow;
        await orderFlow.addRegularDish(
          orderDishesPage,
          printTestData.dishes.first.name,
          printTestData.dishes.first.menu,
        );
        await orderFlow.applyChargeByScope(orderDishesPage, {
          optionName: charge.name,
          scope: 'whole',
        });
        const paymentPage = await orderDishesPage.navigation.openPayment();
        await flows.paymentFlow.payByCash(paymentPage, { printReceipt: false });
        const recallFlow = flows.recallFlow;
        const recallPage = await recallFlow.openRecallFromHome(readyHomePage);
        await recallFlow.searchOrders(recallPage, {
          paymentStatus: RecallPaymentStatuses.paid,
        });
        const orderNumber = await recallFlow.readLatestVisibleOrderNumber(recallPage);
        const beforePrint = await printOutput.snapshot();
        await recallFlow.printReceiptAndReadStatus(recallPage, orderNumber);
        const receipt = onlyTicket(
          await printOutput.waitForTickets({ after: beforePrint, kinds: ['RECEIPT'] }),
        );

        expect(receipt.text).toContain(charge.name);
        expect(receipt.text).toContain(printTestData.chargeReminder.defaultText);
      } finally {
        await runCleanupTasks(
          [
            ['删除测试加收', async () => await apiSetup.charge.delete(charge.id)],
            ['恢复打印配置', restoreConfiguration],
            ['恢复票据模板', restoreTemplate],
          ],
          'POS-32336 用例清理',
        );
      }
    },
  );

  test(
    '[POS-33004] 四段收据脚注使用同一模板时应正常打印',
    {
      annotation: [jiraIssueAnnotation('POS-33004')],
      tag: ['@点单'],
    },
    async ({ flows, apiSetup, employeeLoginPage, homePage }) => {
      const restoreFooters =
        await apiSetup.printConfiguration.selectReceiptFooterForAllParts(3);

      try {
        const readyHomePage = await flows.homeFlow.openHomeWithEmployeeContext(
          homePage,
          employeeLoginPage,
        );
        const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);
        await flows.orderDishesFlow.addRegularDish(
          orderDishesPage,
          printTestData.dishes.first.name,
          printTestData.dishes.first.menu,
        );
        const beforePrint = await printOutput.snapshot();
        await flows.orderDishesFlow.printReceiptWithReference(orderDishesPage);
        const receipt = onlyTicket(
          await printOutput.waitForTickets({ after: beforePrint, kinds: ['RECEIPT'] }),
        );

        expect(receipt.text).toContain(printTestData.dishes.first.name);
        expect(receipt.text).toContain('Total');
        expect(receipt.text).toContain('POWERED BY MENUSIFU');
      } finally {
        await restoreFooters();
      }
    },
  );

  test(
    '[POS-33010] 有小费的订单收据默认不应展示Total Before Tips',
    {
      annotation: [jiraIssueAnnotation('POS-33010')],
      tag: ['@点单', '@小费', '@现金支付'],
    },
    async ({ flows, employeeLoginPage, homePage }) => {
      const readyHomePage = await flows.homeFlow.openHomeWithEmployeeContext(
        homePage,
        employeeLoginPage,
      );
      const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);
      await flows.orderDishesFlow.addRegularDish(
        orderDishesPage,
        printTestData.dishes.first.name,
        printTestData.dishes.first.menu,
      );
      const paymentPage = await orderDishesPage.navigation.openPayment();
      const paymentFlow = flows.paymentFlow;
      await paymentFlow.addTip(paymentPage, 100);
      await paymentFlow.payByCash(paymentPage, { printReceipt: false });
      const recallFlow = flows.recallFlow;
      const recallPage = await recallFlow.openRecallFromHome(readyHomePage);
      await recallFlow.searchOrders(recallPage, {
        paymentStatus: RecallPaymentStatuses.paid,
      });
      const orderNumber = await recallFlow.readLatestVisibleOrderNumber(recallPage);
      const beforePrint = await printOutput.snapshot();
      await recallFlow.printReceiptAndReadStatus(recallPage, orderNumber);
      const receipt = onlyTicket(
        await printOutput.waitForTickets({ after: beforePrint, kinds: ['RECEIPT'] }),
      );

      expect(receipt.text).toContain(printTestData.dishes.first.name);
      expect(receipt.text).not.toContain(printTestData.ticketText.totalBeforeTips);
    },
  );

  test(
    '[POS-33036] 现金支付收据重打时间应晚于首次打印时间',
    {
      annotation: [jiraIssueAnnotation('POS-33036')],
      tag: ['@点单', '@现金支付'],
    },
    async ({ flows, apiSetup, employeeLoginPage, homePage }) => {
      const restoreTemplate = await apiSetup.printConfiguration.selectTemplate(
        'RECEIPT',
        '1_5',
      );

      try {
        const readyHomePage = await flows.homeFlow.openHomeWithEmployeeContext(
          homePage,
          employeeLoginPage,
        );
        const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);
        await flows.orderDishesFlow.addRegularDish(
          orderDishesPage,
          printTestData.dishes.first.name,
          printTestData.dishes.first.menu,
        );
        const paymentPage = await orderDishesPage.navigation.openPayment();
        await flows.paymentFlow.payByCash(paymentPage, { printReceipt: false });
        const recallFlow = flows.recallFlow;
        const recallPage = await recallFlow.openRecallFromHome(readyHomePage);
        await recallFlow.searchOrders(recallPage, {
          paymentStatus: RecallPaymentStatuses.paid,
        });
        const orderNumber = await recallFlow.readLatestVisibleOrderNumber(recallPage);
        const beforeFirstPrint = await printOutput.snapshot();
        await recallFlow.printReceiptAndReadStatus(recallPage, orderNumber);
        const firstReceipt = onlyTicket(
          await printOutput.waitForTickets({ after: beforeFirstPrint, kinds: ['RECEIPT'] }),
        );
        const beforeReprint = await printOutput.snapshot();
        await recallPage.orderDetails.clickReprintInOrderDetailsAndReadReceiptStatus();
        const reprintedReceipt = onlyTicket(
          await printOutput.waitForTickets({ after: beforeReprint, kinds: ['RECEIPT'] }),
        );

        expect(firstReceipt.text).toContain(printTestData.dishes.first.name);
        expect(reprintedReceipt.text).toContain(printTestData.dishes.first.name);
        expect(firstReceipt.text).not.toContain('REPRINT:');
        expect(reprintedReceipt.text).toContain('REPRINT:');
        expect(reprintedReceipt.modifiedAt).toBeGreaterThan(firstReceipt.modifiedAt);
      } finally {
        await restoreTemplate();
      }
    },
  );

  test(
    '[POS-34259] To Go厨房单应加重订单类型、订单Note和菜品Note',
    {
      annotation: [jiraIssueAnnotation('POS-34259')],
      tag: ['@点单'],
    },
    async ({ flows, employeeLoginPage, homePage }) => {
      const readyHomePage = await flows.homeFlow.openHomeWithEmployeeContext(
        homePage,
        employeeLoginPage,
      );
      const orderDishesPage = await flows.takeoutFlow.startToGoOrder(readyHomePage);
      const orderFlow = flows.orderDishesFlow;

      await orderFlow.addRegularDish(
        orderDishesPage,
        printTestData.dishes.first.name,
        printTestData.dishes.first.menu,
      );
      await orderDishesPage.note.addOrderNote(printTestData.notes.order);
      await orderFlow.addDishNote(
        orderDishesPage,
        printTestData.dishes.first.name,
        printTestData.notes.item,
      );
      const beforeSend = await printOutput.snapshot();
      await orderDishesPage.navigation.sendOrderWithReference();
      const kitchenTicket = onlyTicket(
        await printOutput.waitForTickets({ after: beforeSend, kinds: ['KITCHEN'] }),
      );

      expect(kitchenTicket.text).toContain('TO GO');
      expect(kitchenTicket.text).toContain(printTestData.notes.order);
      expect(kitchenTicket.text).toContain(printTestData.notes.item);
      expectBoldText(kitchenTicket, 'TO GO');
      expectBoldText(kitchenTicket, printTestData.notes.order);
      expectBoldText(kitchenTicket, printTestData.notes.item);
    },
  );

  test(
    '[POS-34258][POS-34225] 堂食部分外带菜应在厨房单和收据中加重显示',
    {
      annotation: [jiraIssueAnnotation('POS-34258'), jiraIssueAnnotation('POS-34225')],
      tag: ['@点单'],
    },
    async ({ flows, employeeLoginPage, homePage }) => {
      const readyHomePage = await flows.homeFlow.openHomeWithEmployeeContext(
        homePage,
        employeeLoginPage,
      );
      const orderDishesPage = await flows.selectTableFlow.enterDineInNoTableOrder(readyHomePage);
      const orderFlow = flows.orderDishesFlow;

      await orderFlow.addRegularDish(
        orderDishesPage,
        printTestData.dishes.first.name,
        printTestData.dishes.first.menu,
      );
      await orderFlow.addRegularDish(
        orderDishesPage,
        printTestData.dishes.second.name,
        printTestData.dishes.second.menu,
      );
      await orderDishesPage.menu.markOrderedDishToGo(printTestData.dishes.first.name);
      const beforeSend = await printOutput.snapshot();
      const sentOrder = await orderDishesPage.navigation.sendOrderWithReference();
      const kitchenTicket = onlyTicket(
        await printOutput.waitForTickets({ after: beforeSend, kinds: ['KITCHEN'] }),
      );

      expect(kitchenTicket.text).toContain('DINE IN');
      expect(kitchenTicket.text).toContain('TO GO');
      expectBoldText(kitchenTicket, 'TO GO');

      const recallPage = await flows.recallFlow.openRecallFromHome(sentOrder.homePage);
      const beforeReceipt = await printOutput.snapshot();
      expect(
        await flows.recallFlow.printReceiptAndReadStatus(recallPage, sentOrder.orderNumber),
      ).toBe(200);
      const receipt = onlyTicket(
        await printOutput.waitForTickets({ after: beforeReceipt, kinds: ['RECEIPT'] }),
      );

      expect(receipt.text).toContain('DINE IN');
      expect(receipt.text).toContain('TO GO');
      expectBoldText(receipt, 'TO GO');
    },
  );

  test(
    '[POS-33892] To Go送厨单应打印客户地址',
    {
      annotation: [jiraIssueAnnotation('POS-33892')],
      tag: ['@点单'],
    },
    async ({ flows, apiSetup, employeeLoginPage, homePage }) => {
      const restoreTemplate = await apiSetup.printConfiguration.selectTemplate(
        'KITCHEN',
        '1_6',
      );
      const restoreConfiguration = await apiSetup.systemConfiguration.updateByName(
        printConfigurationNames.kitchenPrintAddress,
        true,
        { verify: true },
      );

      try {
        const readyHomePage =
          await flows.homeFlow.openHomeAfterConfigurationRefreshWithEmployeeContext(
            homePage,
            employeeLoginPage,
          );
        const orderDishesPage = await flows.takeoutFlow.startToGoOrder(readyHomePage);
        await orderDishesPage.customer.openEmptyCustomerInformation();
        await orderDishesPage.customer.fillCustomerInformation(printTestData.customer);
        await orderDishesPage.customer.saveCustomerInformationPage();
        await flows.orderDishesFlow.addRegularDish(
          orderDishesPage,
          printTestData.dishes.first.name,
          printTestData.dishes.first.menu,
        );
        const beforeSend = await printOutput.snapshot();
        await orderDishesPage.navigation.sendOrderWithReference();
        const kitchenTicket = onlyTicket(
          await printOutput.waitForTickets({ after: beforeSend, kinds: ['KITCHEN'] }),
        );

        expect(kitchenTicket.text).toContain(printTestData.customer.address);
      } finally {
        await runCleanupTasks(
          [
            ['恢复打印配置', restoreConfiguration],
            ['恢复票据模板', restoreTemplate],
          ],
          'POS-33892 用例清理',
        );
      }
    },
  );

  test(
    '[POS-35260] 删除已送厨菜品后厨房单应保留被删菜品的调味',
    {
      annotation: [jiraIssueAnnotation('POS-35260')],
      tag: ['@点单'],
    },
    async ({ flows, employeeLoginPage, homePage }) => {
      const readyHomePage = await flows.homeFlow.openHomeWithEmployeeContext(
        homePage,
        employeeLoginPage,
      );
      const orderDishesPage = await flows.takeoutFlow.startToGoOrder(readyHomePage);
      const orderFlow = flows.orderDishesFlow;

      await orderFlow.addSpecDish(
        orderDishesPage,
        printTestData.dishes.first.name,
        printTestData.dishes.first.menu,
        [printTestData.dishes.option.name, printTestData.dishes.option.suboptionName],
      );
      await orderFlow.addRegularDish(
        orderDishesPage,
        printTestData.dishes.second.name,
        printTestData.dishes.second.menu,
      );
      const beforeInitialSend = await printOutput.snapshot();
      const sentOrder = await orderDishesPage.navigation.sendOrderWithReference();
      await printOutput.waitForTickets({ after: beforeInitialSend, kinds: ['KITCHEN'] });
      const beforeDelete = await printOutput.snapshot();
      const recallPage = await flows.recallFlow.openRecallFromHome(sentOrder.homePage);
      const editingPage = await flows.recallFlow.editOrder(recallPage, sentOrder.orderNumber);
      await editingPage.menu.removeSentDish(printTestData.dishes.first.name);
      await editingPage.navigation.sendOrderWithReference();
      const voidKitchenTicket = onlyTicket(
        await printOutput.waitForTickets({ after: beforeDelete, kinds: ['KITCHEN'] }),
      );

      expect(voidKitchenTicket.text).toContain(printTestData.dishes.first.name);
      expect(voidKitchenTicket.text).toContain(printTestData.dishes.option.name);
      expect(voidKitchenTicket.text).toContain(printTestData.dishes.option.suboptionName);
    },
  );

  test(
    '[POS-35227] 删除已送厨菜品后打包单不应打印被删菜品',
    {
      annotation: [jiraIssueAnnotation('POS-35227')],
      tag: ['@点单', '@订单编辑'],
    },
    async ({ flows, apiSetup, employeeLoginPage, homePage }) => {
      const restoreConfiguration = await apiSetup.systemConfiguration.updateByName(
        printConfigurationNames.packerVoidItemsStyle,
        0,
        { verify: true },
      );

      try {
        const readyHomePage =
          await flows.homeFlow.openHomeAfterConfigurationRefreshWithEmployeeContext(
            homePage,
            employeeLoginPage,
          );
        const orderDishesPage = await flows.takeoutFlow.startToGoOrder(readyHomePage);
        const orderFlow = flows.orderDishesFlow;
        await orderFlow.addRegularDish(
          orderDishesPage,
          printTestData.dishes.first.name,
          printTestData.dishes.first.menu,
        );
        await orderFlow.addRegularDish(
          orderDishesPage,
          printTestData.dishes.second.name,
          printTestData.dishes.second.menu,
        );
        const beforeInitialSend = await printOutput.snapshot();
        const sentOrder = await orderDishesPage.navigation.sendOrderWithReference();
        await printOutput.waitForTickets({ after: beforeInitialSend, kinds: ['PACKAGE'] });
        const beforeDelete = await printOutput.snapshot();
        const recallPage = await flows.recallFlow.openRecallFromHome(sentOrder.homePage);
        const editingPage = await flows.recallFlow.editOrder(recallPage, sentOrder.orderNumber);
        await editingPage.menu.removeSentDish(printTestData.dishes.first.name);
        await editingPage.navigation.sendOrderWithReference();
        const packageTicket = onlyTicket(
          await printOutput.waitForTickets({ after: beforeDelete, kinds: ['PACKAGE'] }),
        );

        expect(packageTicket.text).not.toContain(printTestData.dishes.first.name);
      } finally {
        await restoreConfiguration();
      }
    },
  );

  test(
    '[POS-42890] 支付后应能只选择部分菜品重新送厨',
    {
      annotation: [jiraIssueAnnotation('POS-42890')],
      tag: ['@点单', '@现金支付'],
    },
    async ({ flows, apiSetup, employeeLoginPage, homePage }) => {
      const restoreConfiguration = await apiSetup.systemConfiguration.updateByName(
        'AUTO_SEND_TO_KITCHEN_AFTER_SETTLED',
        true,
        { verify: true },
      );

      try {
        const readyHomePage =
          await flows.homeFlow.openHomeAfterConfigurationRefreshWithEmployeeContext(
            homePage,
            employeeLoginPage,
          );
        const orderDishesPage = await flows.takeoutFlow.startToGoOrder(readyHomePage);
        const orderFlow = flows.orderDishesFlow;

        await orderFlow.addRegularDish(
          orderDishesPage,
          printTestData.dishes.first.name,
          printTestData.dishes.first.menu,
        );
        await orderFlow.addRegularDish(
          orderDishesPage,
          printTestData.dishes.second.name,
          printTestData.dishes.second.menu,
        );
        const beforePayment = await printOutput.snapshot();
        const paymentPage = await orderDishesPage.navigation.openPayment();
        await flows.paymentFlow.payByCash(paymentPage, { printReceipt: false });
        await printOutput.waitForTickets({ after: beforePayment, kinds: ['KITCHEN'] });
        const beforeResend = await printOutput.snapshot();
        const recallFlow = flows.recallFlow;
        const recallPage = await recallFlow.openRecallFromHome(readyHomePage);
        await recallFlow.searchOrders(recallPage, {
          paymentStatus: RecallPaymentStatuses.paid,
        });
        const orderNumber = await recallFlow.readLatestVisibleOrderNumber(recallPage);
        const resendResult = await recallFlow.resendDishes(recallPage, orderNumber, [
          printTestData.dishes.first.name,
        ]);
        const resentKitchenTicket = onlyTicket(
          await printOutput.waitForTickets({ after: beforeResend, kinds: ['KITCHEN'] }),
        );

        expect(resendResult.httpStatus).toBe(200);
        expect(resentKitchenTicket.text).toContain(printTestData.dishes.first.name);
        expect(resentKitchenTicket.text).not.toContain(printTestData.dishes.second.name);
      } finally {
        await restoreConfiguration();
      }
    },
  );
});

async function enterRecall(
  returnedPage: HomePage | OrderDishesPage | RecallPage,
): Promise<RecallPage> {
  if (returnedPage instanceof RecallPage) {
    return returnedPage;
  }

  return returnedPage instanceof OrderDishesPage
    ? await returnedPage.navigation.clickRecall()
    : await returnedPage.clickRecall();
}

function onlyTicket(tickets: PrintTicket[]): PrintTicket {
  const ticket = tickets.at(-1);
  if (!ticket) {
    throw new Error('没有读取到打印票据。');
  }
  return ticket;
}

function expectBoldText(ticket: PrintTicket, text: string): void {
  const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  expect(ticket.html).toMatch(
    new RegExp(`font-weight:\\s*bold[^>]*>[^<]*${escapedText}`, 'i'),
  );
}

function expectBlackBackgroundWhiteText(ticket: PrintTicket, text: string): void {
  const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matchingElement = ticket.html.match(
    new RegExp(`<[^>]+style="([^"]*)"[^>]*>\\s*${escapedText}\\s*</[^>]+>`, 'i'),
  );

  expect(matchingElement, `票据中未找到独立展示的 ${text} 元素`).not.toBeNull();
  const style = matchingElement?.[1] ?? '';
  expect(style).toMatch(/background-color:\s*(?:#000000|#000|black)/i);
  expect(style).toMatch(/color:\s*(?:#ffffff|#fff|white)/i);
  expect(style).toMatch(/font-weight:\s*bold/i);
}

async function createManualSharedTipCharge(
  apiSetup: ApiSetup,
  type: 'DEFAULT' | 'DELIVERY' | 'SERVICE',
): Promise<{ id: string | number; name: string }> {
  const configuration = {
    rate: 1,
    rateType: 1,
    sharedTip: true,
    taxed: false,
    triggerMode: 2,
    type,
  } as const;
  const created = await apiSetup.charge.create(configuration);
  const updated = await apiSetup.charge.update(created.id, {
    ...configuration,
    name: created.name,
  });
  const savedCharge = JSON.stringify(await apiSetup.charge.read(updated.id));
  if (!savedCharge.includes('"sharedTip":true')) {
    throw new Error(`加收 ${updated.name} 保存后未保持 sharedTip=true：${savedCharge}`);
  }

  return { id: updated.id, name: updated.name };
}
