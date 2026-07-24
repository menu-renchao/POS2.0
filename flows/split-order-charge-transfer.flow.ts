import type { OrderApiClient } from '../api/clients/order-api.client';
import type { EmployeeLoginPage } from '../pages/employee-login.page';
import type { HomePage } from '../pages/home.page';
import type { OrderDishesPage } from '../pages/order-dishes.page';
import type { RecallPage } from '../pages/recall.page';
import type { ChargeCopyCase } from '../test-data/split-order-charge';
import {
  parseChargeAmountText,
  readWholeChargeAmountText,
} from '../utils/split-order-charge';
import { step } from '../utils/step';
import type { RecallFlow } from './recall.flow';
import type { SplitOrderScenarioFlow } from './split-order-scenario.flow';
import type { SavedChargeOrder } from './split-order.types';

export class SplitOrderChargeTransferFlow {
  constructor(
    private readonly recallFlow: RecallFlow,
    private readonly splitOrderScenarioFlow: SplitOrderScenarioFlow,
  ) {}

  @step('业务流程：按复制加收用例策略创建源订单')
  async createSavedOrderForChargeCopyCase(
    readyHomePage: HomePage,
    employeeLoginPage: EmployeeLoginPage,
    orderApi: OrderApiClient,
    chargeResource: { id: string | number; name: string },
    chargeCase: ChargeCopyCase,
    chargeName: string,
  ): Promise<SavedChargeOrder> {
    if (chargeCase.source === 'manual') {
      return await this.splitOrderScenarioFlow.createSavedOrderWithManualCharge(
        readyHomePage,
        employeeLoginPage,
        chargeName,
      );
    }

    if (chargeCase.source === 'delivery-auto') {
      return await this.splitOrderScenarioFlow.createSavedDeliveryOrder(
        readyHomePage,
        employeeLoginPage,
      );
    }

    if (chargeCase.issue === 'POS-27259') {
      return await this.splitOrderScenarioFlow.createSavedOrderWithAutoCharge(
        readyHomePage,
        employeeLoginPage,
      );
    }

    const savedOrder =
      await this.splitOrderScenarioFlow.createSavedOrderWithApiAutoCharge(
        readyHomePage,
        employeeLoginPage,
        orderApi,
        chargeResource,
        chargeCase.initialCharge,
      );
    const rate = chargeCase.initialCharge.rate ?? 0;
    const amount =
      chargeCase.initialCharge.rateType === 2
        ? Number(
            (
              (savedOrder.beforeSummary.Subtotal * rate) /
              100
            ).toFixed(2),
          )
        : Number(rate.toFixed(2));

    return {
      ...savedOrder,
      beforeChargeSnapshot: {
        ...savedOrder.beforeChargeSnapshot,
        wholeOrderCharges: [
          ...savedOrder.beforeChargeSnapshot.wholeOrderCharges,
          {
            amountText: `$${amount.toFixed(2)}`,
            name:
              chargeCase.initialCharge.name ?? chargeResource.name,
          },
        ],
      },
    };
  }

  @step('业务流程：配置刷新后复制已保存订单')
  async copySavedOrderAfterConfigurationRefresh(
    homePage: HomePage,
    employeeLoginPage: EmployeeLoginPage,
    orderNumber: string,
  ): Promise<OrderDishesPage> {
    const recallPage =
      await this.splitOrderScenarioFlow.openRecallAfterConfigurationRefresh(
        homePage,
        employeeLoginPage,
      );
    return await this.recallFlow.openCopyFromMore(recallPage, orderNumber);
  }

  @step('业务流程：读取复制订单的命名加收金额')
  async readCopiedOrderChargeAmount(
    orderDishesPage: OrderDishesPage,
    chargeName: string,
  ): Promise<{
    amount: number | null;
    summary: Record<string, number> | null;
  }> {
    const summary = await orderDishesPage.reads.readPriceSummary();
    const chargeSnapshot =
      await this.splitOrderScenarioFlow.readOrderDishesChargeSnapshot(
        orderDishesPage,
      );
    const amount = parseChargeAmountText(
      readWholeChargeAmountText(chargeSnapshot, chargeName),
    );

    return { amount, summary };
  }

  @step('业务流程：配置刷新后移动首个菜品')
  async moveItemAfterConfigurationRefresh(
    homePage: HomePage,
    employeeLoginPage: EmployeeLoginPage,
    orderNumber: string,
    targetOrderNumber?: string,
  ): Promise<RecallPage> {
    const recallPage =
      await this.splitOrderScenarioFlow.openRecallAfterConfigurationRefresh(
        homePage,
        employeeLoginPage,
      );

    if (targetOrderNumber) {
      await this.recallFlow.moveFirstDishToExistingOrder(
        recallPage,
        orderNumber,
        targetOrderNumber,
      );
      return recallPage;
    }

    await this.recallFlow.moveFirstDishToNewOrder(recallPage, orderNumber);
    return recallPage;
  }

  @step('业务流程：配置刷新后将整单移动到目标订单')
  async moveWholeOrderAfterConfigurationRefresh(
    homePage: HomePage,
    employeeLoginPage: EmployeeLoginPage,
    orderNumber: string,
    targetOrderNumber: string,
  ): Promise<RecallPage> {
    const recallPage =
      await this.splitOrderScenarioFlow.openRecallAfterConfigurationRefresh(
        homePage,
        employeeLoginPage,
      );
    await this.recallFlow.moveFirstDishToExistingOrder(
      recallPage,
      orderNumber,
      targetOrderNumber,
    );
    return recallPage;
  }
}
