import type { EmployeeLoginPage } from '../pages/employee-login.page';
import type { HomePage } from '../pages/home.page';
import type { OrderDishesPage } from '../pages/order-dishes.page';
import type { OrderPriceSummary } from '../pages/order-dishes/order-dishes.types';
import type { RecallPage } from '../pages/recall.page';
import type { SplitOrderTargets } from './split-order.types';
import { parseChargeAmountText, readWholeChargeAmountText } from '../utils/split-order-charge';
import { escapeRegExp } from '../utils/text';
import { step } from '../utils/step';
import type { OrderRegressionFlow } from './order-regression.flow';
import type { RecallFlow } from './recall.flow';
import type { SplitOrderFlow } from './split-order.flow';
import type { SplitOrderScenarioFlow } from './split-order-scenario.flow';

export type SplitOrderTargetsWithRecallPage = SplitOrderTargets & {
  recallPage: RecallPage;
};

export class SplitOrderChargeEditFlow {
  constructor(
    private readonly orderRegressionFlow: OrderRegressionFlow,
    private readonly recallFlow: RecallFlow,
    private readonly splitOrderFlow: SplitOrderFlow,
    private readonly splitOrderScenarioFlow: SplitOrderScenarioFlow,
  ) {}

  @step('业务流程：重新编辑订单并读取指定加收金额')
  async readEditedOrderChargeAmount(
    homePage: HomePage,
    employeeLoginPage: EmployeeLoginPage,
    orderNumber: string,
    chargeName: string,
  ): Promise<{
    amount: number | null;
    summary: OrderPriceSummary;
  }> {
    const editedOrder =
      await this.splitOrderScenarioFlow.reopenSavedOrderForChargeCheck(
        homePage,
        employeeLoginPage,
        orderNumber,
      );
    const amount = parseChargeAmountText(
      readWholeChargeAmountText(editedOrder.chargeSnapshot, chargeName),
    );

    return { amount, summary: editedOrder.summary };
  }

  @step('业务流程：从 Recall 详情平均分单并读取子单目标')
  async splitSavedOrderFromRecallDetails(
    homePage: HomePage,
    employeeLoginPage: EmployeeLoginPage,
    orderNumber: string,
  ): Promise<SplitOrderTargetsWithRecallPage> {
    const recallPage =
      await this.splitOrderScenarioFlow.openRecallAfterConfigurationRefresh(
        homePage,
        employeeLoginPage,
      );
    const splitOrderPage = await this.recallFlow.openSplitOrder(
      recallPage,
      orderNumber,
      undefined,
      { chargePromptAction: 'keep' },
    );
    await this.splitOrderFlow.splitOrderEvenly(splitOrderPage, 2);
    const returnedPage =
      await this.splitOrderFlow.submitAndReturnPage(splitOrderPage);
    const returnedRecallPage =
      await this.orderRegressionFlow.enterRecallFromReturnedPage(returnedPage);
    const targets =
      await this.splitOrderScenarioFlow.openLatestSplitOrderTargets(
        returnedRecallPage,
        orderNumber,
      );

    return { ...targets, recallPage: returnedRecallPage };
  }

  @step('业务流程：从 Recall 详情按菜分单并读取子单目标')
  async splitSavedOrderByItemFromRecallDetails(
    homePage: HomePage,
    employeeLoginPage: EmployeeLoginPage,
    orderNumber: string,
    dishName: string,
  ): Promise<SplitOrderTargetsWithRecallPage> {
    const recallPage =
      await this.splitOrderScenarioFlow.openRecallAfterConfigurationRefresh(
        homePage,
        employeeLoginPage,
      );
    const splitOrderPage = await this.recallFlow.openSplitOrder(
      recallPage,
      orderNumber,
      undefined,
      { chargePromptAction: 'keep' },
    );
    await this.splitOrderFlow.moveDishToNewSuborder(
      splitOrderPage,
      dishName,
    );
    const returnedPage =
      await this.splitOrderFlow.submitAndReturnPage(splitOrderPage);
    const returnedRecallPage =
      await this.orderRegressionFlow.enterRecallFromReturnedPage(returnedPage);
    const targets =
      await this.splitOrderScenarioFlow.openLatestSplitOrderTargets(
        returnedRecallPage,
        orderNumber,
      );

    return { ...targets, recallPage: returnedRecallPage };
  }

  @step('业务流程：读取指定子单的命名加收详情')
  async readTargetChargeDetails(
    recallPage: RecallPage,
    orderNumber: string,
    targetOrderNumber: string,
    chargeName: string,
  ): Promise<{
    priceSummary: Record<string, number>;
    namedChargeAmount: number;
    text: string;
  }> {
    await recallPage.orderDetails.openOrderDetails(orderNumber, targetOrderNumber);
    const priceSummary = await recallPage.orderDetails.readDisplayedOrderPriceSummary();
    const text = await recallPage.orderDetails.readDisplayedOrderPriceSummaryText();
    await recallPage.orderDetails.closeOrderDetailsDialog();

    const chargeAmountMatch = text.match(
      new RegExp(
        `${escapeRegExp(chargeName)}\\s*:?\\s*\\$?([\\d,]+(?:\\.\\d{1,2})?)`,
      ),
    );
    if (!chargeAmountMatch) {
      throw new Error(
        `未能从价格摘要中读取加收“${chargeName}”的金额：${text}`,
      );
    }

    return {
      priceSummary,
      namedChargeAmount: Number(
        chargeAmountMatch[1].replace(/,/g, ''),
      ),
      text,
    };
  }

  @step('业务流程：从订单编辑页平均分单并读取子单目标')
  async splitSavedOrderFromEditPage(
    homePage: HomePage,
    employeeLoginPage: EmployeeLoginPage,
    orderNumber: string,
  ): Promise<SplitOrderTargetsWithRecallPage> {
    const editingPage =
      await this.splitOrderScenarioFlow.editSavedOrderAfterConfigurationRefresh(
        homePage,
        employeeLoginPage,
        orderNumber,
      );
    const splitOrderPage = await editingPage.navigation.openSplitOrder();
    await this.splitOrderFlow.splitOrderEvenly(splitOrderPage, 2);

    const returnedPage =
      await this.splitOrderFlow.submitAndReturnPage(splitOrderPage);
    const recallPage =
      await this.orderRegressionFlow.enterRecallFromReturnedPage(returnedPage);
    const targets =
      await this.splitOrderScenarioFlow.openLatestSplitOrderTargets(recallPage);

    return { ...targets, recallPage };
  }

  @step('业务流程：读取第一个分单子单的加收金额')
  async readFirstSplitTargetCharge(
    splitOrder: SplitOrderTargetsWithRecallPage,
  ): Promise<number> {
    return await this.splitOrderScenarioFlow.readTargetCharge(
      splitOrder.recallPage,
      splitOrder.orderNumber,
      splitOrder.firstTargetOrderNumber,
    );
  }
}
