import type { OrderApiClient } from '../api/clients/order-api.client';
import type { EmployeeLoginPage } from '../pages/employee-login.page';
import type { HomePage } from '../pages/home.page';
import type { ChargeSetupOverrides } from '../test-data/api/admin-config-api-data';
import {
  type CombineChargeRecalculationCase,
  type ApiWholeChargeSeed,
} from '../test-data/split-order-charge';
import { orderServiceDishes } from '../test-data/order-service';
import { step } from '../utils/step';
import type { OrderDishesFlow } from './order-dishes.flow';
import type { RecallFlow } from './recall.flow';
import type { SplitOrderScenarioFlow } from './split-order-scenario.flow';
import type { SavedChargeOrder } from './split-order.types';
import type { TakeoutFlow } from './takeout.flow';

export class SplitOrderChargeCombineFlow {
  constructor(
    private readonly orderDishesFlow: OrderDishesFlow,
    private readonly recallFlow: RecallFlow,
    private readonly splitOrderScenarioFlow: SplitOrderScenarioFlow,
    private readonly takeoutFlow: TakeoutFlow,
  ) {}

  @step('业务流程：创建已保存的 To Go 加收订单')
  async createSavedToGoOrder(
    readyHomePage: HomePage,
    employeeLoginPage: EmployeeLoginPage,
    dish: {
      readonly name: string;
      readonly menu: typeof orderServiceDishes.regular.menu;
    } = orderServiceDishes.regular,
  ): Promise<SavedChargeOrder> {
    const orderDishesPage =
      await this.takeoutFlow.startToGoOrder(readyHomePage);
    await this.orderDishesFlow.addRegularDish(
      orderDishesPage,
      dish.name,
      dish.menu,
    );
    const beforeSummary = await orderDishesPage.reads.readPriceSummary();
    const beforeChargeSnapshot =
      await this.splitOrderScenarioFlow.readOrderDishesChargeSnapshot(
        orderDishesPage,
      );
    const recallPage =
      await this.splitOrderScenarioFlow.saveEditingOrderAndOpenRecall(
        orderDishesPage,
        employeeLoginPage,
      );
    const orderNumber =
      await this.recallFlow.readLatestVisibleOrderNumber(recallPage);
    return { beforeChargeSnapshot, beforeSummary, orderNumber, recallPage };
  }

  @step('业务流程：通过 API 创建包含三类加收的已保存订单')
  async createSavedOrderWithThreeChargeKinds(
    readyHomePage: HomePage,
    employeeLoginPage: EmployeeLoginPage,
    orderApi: OrderApiClient,
    chargeResource: { id: string | number; name: string },
    charge: ChargeSetupOverrides,
  ): Promise<SavedChargeOrder> {
    const chargeSeeds: readonly ApiWholeChargeSeed[] = [
      { charge, resource: chargeResource },
      { charge, resource: chargeResource },
      {
        charge: {
          name: 'Charge($10.00)',
          rate: 10,
          rateType: 1,
          taxed: true,
          triggerMode: 2,
        },
        resource: { id: -1, name: 'Charge($10.00)' },
      },
    ];

    return await this.splitOrderScenarioFlow.createSavedOrderWithApiCharges(
      readyHomePage,
      employeeLoginPage,
      orderApi,
      chargeSeeds,
    );
  }

  @step('业务流程：按合单加收用例策略创建源订单')
  async createSavedOrderForCombineChargeCase(
    readyHomePage: HomePage,
    employeeLoginPage: EmployeeLoginPage,
    orderApi: OrderApiClient,
    chargeResource: { id: string | number; name: string },
    chargeCase: CombineChargeRecalculationCase,
    chargeName: string,
  ): Promise<SavedChargeOrder> {
    if (chargeCase.issue === 'POS-32008') {
      return await this.splitOrderScenarioFlow.createSavedOrderWithAutoCharge(
        readyHomePage,
        employeeLoginPage,
      );
    }

    if (chargeCase.scenario === 'single-manual') {
      return await this.splitOrderScenarioFlow.createSavedOrderWithManualCharge(
        readyHomePage,
        employeeLoginPage,
        chargeName,
      );
    }

    if (chargeCase.scenario === 'three-charges') {
      return await this.createSavedOrderWithThreeChargeKinds(
        readyHomePage,
        employeeLoginPage,
        orderApi,
        chargeResource,
        chargeCase.charge,
      );
    }

    if (chargeCase.scenario === 'no-existing-charge') {
      const plainOrder =
        await this.splitOrderScenarioFlow.createSavedRecallOrder(
          readyHomePage,
          employeeLoginPage,
        );
      const reopened =
        await this.splitOrderScenarioFlow.reopenSavedOrderForChargeCheck(
          readyHomePage,
          employeeLoginPage,
          plainOrder.orderNumber,
        );
      return {
        beforeChargeSnapshot: reopened.chargeSnapshot,
        beforeSummary: reopened.summary,
        orderNumber: plainOrder.orderNumber,
        recallPage: plainOrder.recallPage,
      };
    }

    if (chargeCase.firstOrderType === 'delivery') {
      return await this.splitOrderScenarioFlow.createSavedDeliveryOrder(
        readyHomePage,
        employeeLoginPage,
      );
    }

    return await this.splitOrderScenarioFlow.createSavedOrderWithApiAutoCharge(
      readyHomePage,
      employeeLoginPage,
      orderApi,
      chargeResource,
      chargeCase.charge,
    );
  }
}
