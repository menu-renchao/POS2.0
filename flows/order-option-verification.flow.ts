import { expect } from '@playwright/test';
import type { OrderDishesPage } from '../pages/order-dishes.page';
import type { RecallPage } from '../pages/recall.page';
import { step } from '../utils/step';
import type { OrderRegressionFlow } from './order-regression.flow';
import type { RecallFlow } from './recall.flow';

export class OrderOptionVerificationFlow {
  constructor(
    private readonly orderRegressionFlow: OrderRegressionFlow,
    private readonly recallFlow: RecallFlow,
  ) {}

  @step('业务流程：校验分类选项从点单页到 Recall 的往返结果')
  async assertCategoryOptionOrderRoundTrip(
    orderDishesPage: OrderDishesPage,
    dishName: string,
    option: string,
    suboption?: string,
  ): Promise<void> {
    await orderDishesPage.menu.clickDish(dishName);
    await orderDishesPage.menu.selectCategoryOption(option, suboption);

    const orderedItems = await orderDishesPage.reads.readOrderedItems();
    const orderedItem = orderedItems.find((item) => item.name === dishName);
    const expectedOptions = suboption ? [option, suboption] : [option];

    expect(orderedItem, `点单页应包含菜品 ${dishName}`).toBeTruthy();
    expect(
      orderedItem?.price,
      `点单页应展示菜品 ${dishName} 的价格`,
    ).toBeTruthy();
    expect(
      orderedItem?.additions.map((addition) => addition.name.trim()) ?? [],
      `点单页应回显 ${dishName} 的 option`,
    ).toEqual(expectedOptions);

    const orderDetails =
      await this.orderRegressionFlow.saveOrderAndOpenLatestRecallDetails(
        orderDishesPage,
      );
    const recallItem = orderDetails.items.find(
      (item) => item.name === dishName,
    );

    expect(
      orderDetails.items,
      'Recall 最新订单应只包含本次保存的菜品',
    ).toHaveLength(1);
    expect(recallItem, `Recall 中应包含菜品 ${dishName}`).toBeTruthy();
    expect(recallItem?.price).toBe(orderedItem?.price);
    expect(
      recallItem?.additions.map((addition) => addition.name.trim()) ?? [],
      `Recall 中应回显 ${dishName} 的 option`,
    ).toEqual(expectedOptions);
  }

  @step('业务流程：校验菜品选项从点单页到 Recall 的往返结果')
  async assertDishOptionsRoundTrip(
    orderDishesPage: OrderDishesPage,
    dishName: string,
    expectedOptions: readonly string[],
    expectedPrice?: number,
  ): Promise<void> {
    const orderedItems = await orderDishesPage.reads.readOrderedItems();
    const orderedItem = orderedItems.find((item) => item.name === dishName);

    expect(orderedItem, `点单页应包含菜品 ${dishName}`).toBeTruthy();
    expect(
      orderedItem?.additions.map((addition) => addition.name.trim()) ?? [],
      `点单页菜品 ${dishName} 的 option 应与录制一致`,
    ).toEqual(expectedOptions);

    if (expectedPrice !== undefined) {
      expect(
        await orderDishesPage.reads.readOrderedDishPrice(dishName),
      ).toBeCloseTo(expectedPrice, 2);
    }

    const savedOrder = await orderDishesPage.navigation.saveOrderWithReference();
    const recallPage = await this.recallFlow.openRecallFromHome(
      savedOrder.homePage,
    );
    await recallPage.orderDetails.openOrderDetails(savedOrder.orderNumber);
    const orderDetails = await recallPage.orderDetails.readOrderDetailsSnapshot();
    const recallItem = orderDetails.items.find(
      (item) => item.name === dishName,
    );

    expect(
      orderDetails.items,
      'Recall 精确订单应只包含本次保存的菜品',
    ).toHaveLength(1);
    expect(recallItem, `Recall 中应包含菜品 ${dishName}`).toBeTruthy();
    expect(
      recallItem?.additions.map((addition) => addition.name.trim()) ?? [],
    ).toEqual(expectedOptions);

    if (expectedPrice !== undefined) {
      expect(await recallPage.orderDetails.readOrderItemPrice(dishName)).toBeCloseTo(
        expectedPrice,
        2,
      );
    }
  }

  @step('业务流程：校验点单页菜品明细的显示与隐藏状态')
  async expectOrderedDishDetails(
    orderDishesPage: OrderDishesPage,
    dishName: string,
    visibleDetails: readonly string[],
    hiddenDetails: readonly string[] = [],
  ): Promise<void> {
    for (const detailText of visibleDetails) {
      expect(
        await orderDishesPage.reads.isOrderedDishDetailVisible(
          dishName,
          detailText,
        ),
      ).toBe(true);
    }

    for (const detailText of hiddenDetails) {
      expect(
        await orderDishesPage.reads.isOrderedDishDetailVisible(
          dishName,
          detailText,
        ),
      ).toBe(false);
    }
  }

  @step('业务流程：校验 Recall 菜品明细的显示与隐藏状态')
  async expectRecallDishDetails(
    recallPage: RecallPage,
    dishName: string,
    visibleDetails: readonly string[],
    hiddenDetails: readonly string[] = [],
  ): Promise<void> {
    for (const detailText of visibleDetails) {
      expect(
        await recallPage.orderDetails.isOrderItemDetailVisible(dishName, detailText),
        `Recall 菜品 ${dishName} 应展示 ${detailText}`,
      ).toBe(true);
    }

    for (const detailText of hiddenDetails) {
      expect(
        await recallPage.orderDetails.isOrderItemDetailVisible(dishName, detailText),
        `Recall 菜品 ${dishName} 不应展示 ${detailText}`,
      ).toBe(false);
    }
  }

  @step('业务流程：校验最新 Recall 菜品与点单页一致')
  async expectLatestRecallDishMatches(
    orderDishesPage: OrderDishesPage,
    dishName: string,
  ): Promise<void> {
    const orderedItems = await orderDishesPage.reads.readOrderedItems();
    const orderedDish = orderedItems.find((item) => item.name === dishName);

    expect(orderedDish, `点单页应包含菜品 ${dishName}`).toBeTruthy();

    const orderDetails =
      await this.orderRegressionFlow.saveOrderAndOpenLatestRecallDetails(
        orderDishesPage,
      );
    const recallDish = orderDetails.items.find(
      (item) => item.name === dishName,
    );

    expect(
      orderDetails.items,
      'Recall 最新订单应只包含本次保存的菜品',
    ).toHaveLength(1);
    expect(recallDish?.name).toBe(orderedDish?.name);
    expect(recallDish?.price).toBe(orderedDish?.price);
  }
}
