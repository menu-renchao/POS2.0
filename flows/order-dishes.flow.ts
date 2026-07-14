import {
  type ChargeCustomType,
  type ChargeScope,
  type ModifierPriceSelection,
  type OrderChargeSnapshot,
  OrderDishesPage,
  type OrderPriceSummary,
} from '../pages/order-dishes.page';
import { type HomePage } from '../pages/home.page';
import { step } from '../utils/step';

export type ComboSectionSelection = string | Record<string, number>;

export type ComboSelections = Record<string, ComboSectionSelection>;

export type MenuSelection = {
  category: string;
  group: string;
};

export interface DishOrderParams extends MenuSelection {
  comboSelections?: ComboSelections;
  dishName: string;
  price?: number;
  quantity?: number;
  specifications?: string[];
  weight?: number;
}

export type ChargeByScopeParams = {
  dishNames?: string[];
  optionName: string;
  scope: ChargeScope;
};

export type CustomChargeParams = {
  dishNames?: string[];
  scope: ChargeScope;
  taxed?: boolean;
  type: ChargeCustomType;
  value: number;
};

export type ClearChargesParams = {
  dishNames?: string[];
  scope: ChargeScope;
};

export type PresetModifierOption = {
  action: string;
  category: string;
  option: string;
  price?: ModifierPriceSelection;
};

export type PresetModifierOptionsParams = {
  closeAfter?: boolean;
  dishName: string;
  options: PresetModifierOption[];
};

export type CustomModifierParams = {
  closeAfter?: boolean;
  dishName: string;
  name: string;
  price?: number | string;
};

export class OrderDishesFlow {
  @step('业务步骤：添加普通菜品到购物车')
  async addRegularDish(
    orderDishesPage: OrderDishesPage,
    dishName: string,
    menuSelection: MenuSelection,
    quantity: number = 1,
  ): Promise<void> {
    await orderDishesPage.expectLoaded();
    await this.switchMenu(orderDishesPage, menuSelection);
    await orderDishesPage.clickDish(dishName);
    await this.adjustQuantityIfNeeded(orderDishesPage, quantity);
  }

  @step('业务步骤：添加第一道可用菜品到购物车')
  async addFirstAvailableDish(
    orderDishesPage: OrderDishesPage,
    menuSelection: MenuSelection,
  ): Promise<void> {
    await orderDishesPage.expectLoaded();
    await this.switchMenu(orderDishesPage, menuSelection);
    await orderDishesPage.clickFirstAvailableDish();
  }

  @step('业务步骤：添加称重菜到购物车')
  async addWeightedDish(
    orderDishesPage: OrderDishesPage,
    dishName: string,
    menuSelection: MenuSelection,
    weight: number,
    quantity: number = 1,
  ): Promise<void> {
    await orderDishesPage.expectLoaded();
    await this.switchMenu(orderDishesPage, menuSelection);
    await orderDishesPage.clickDish(dishName);
    await this.adjustQuantityIfNeeded(orderDishesPage, quantity);
    await orderDishesPage.enterWeight(weight);
    await orderDishesPage.confirmWeightDialog();
  }

  @step('业务步骤：添加套餐菜品到购物车')
  async addComboDish(
    orderDishesPage: OrderDishesPage,
    dishName: string,
    menuSelection: MenuSelection,
    selections: ComboSelections,
    quantity: number = 1,
  ): Promise<void> {
    await orderDishesPage.expectLoaded();
    await this.switchMenu(orderDishesPage, menuSelection);
    await orderDishesPage.clickDish(dishName);

    for (const [sectionName, sectionSelection] of Object.entries(selections)) {
      if (typeof sectionSelection === 'string') {
        await orderDishesPage.selectComboSectionItem(sectionName, sectionSelection);
        continue;
      }

      for (const [sectionDishName, sectionDishQuantity] of Object.entries(sectionSelection)) {
        if (sectionDishQuantity < 1) {
          continue;
        }

        await orderDishesPage.selectComboSectionItem(
          sectionName,
          sectionDishName,
          sectionDishQuantity,
        );
      }
    }

    await orderDishesPage.confirmComboDialog();
    await this.adjustQuantityIfNeeded(orderDishesPage, quantity);
  }

  @step('业务步骤：添加规格菜品到购物车')
  async addSpecDish(
    orderDishesPage: OrderDishesPage,
    dishName: string,
    menuSelection: MenuSelection,
    specifications: string[],
    quantity: number = 1,
  ): Promise<void> {
    await orderDishesPage.expectLoaded();
    await this.switchMenu(orderDishesPage, menuSelection);
    await orderDishesPage.clickDish(dishName);
    await this.adjustQuantityIfNeeded(orderDishesPage, quantity);

    if (await orderDishesPage.isCategoryOptionPanelVisible()) {
      await orderDishesPage.selectCategoryOption(specifications[0], specifications[1]);
      return;
    }

    if (await orderDishesPage.isSpecificationDialogVisible()) {
      for (const spec of specifications) {
        await orderDishesPage.selectSpecification(spec);
      }

      await orderDishesPage.confirmSpecificationDialog();
    }
  }

  @step('业务步骤：添加开价菜品到购物车')
  async addOpenPriceDish(
    orderDishesPage: OrderDishesPage,
    dishName: string,
    menuSelection: MenuSelection,
    price: number,
    quantity: number = 1,
  ): Promise<void> {
    await orderDishesPage.expectLoaded();
    await this.switchMenu(orderDishesPage, menuSelection);
    await orderDishesPage.clickDish(dishName);
    await this.adjustQuantityIfNeeded(orderDishesPage, quantity);
    await orderDishesPage.enterPrice(price);
    await orderDishesPage.confirmPriceDialog();
  }

  @step((_: OrderDishesPage, name: string, price: number) => `业务步骤：添加 Open Food 菜品 ${name}，价格 ${price}`)
  async addOpenFoodItem(
    orderDishesPage: OrderDishesPage,
    name: string,
    price: number,
  ): Promise<void> {
    await orderDishesPage.expectLoaded();
    await orderDishesPage.addOpenFood(name, price);
  }

  @step('业务步骤：通用添加菜品到购物车')
  async addDishToCart(
    orderDishesPage: OrderDishesPage,
    params: DishOrderParams,
  ): Promise<void> {
    const { category, dishName, group, quantity = 1, weight, price, specifications, comboSelections } = params;
    const menuSelection = { category, group };

    if (weight !== undefined) {
      await this.addWeightedDish(orderDishesPage, dishName, menuSelection, weight, quantity);
      return;
    }

    if (price !== undefined) {
      await this.addOpenPriceDish(orderDishesPage, dishName, menuSelection, price, quantity);
      return;
    }

    if (specifications && specifications.length > 0) {
      await this.addSpecDish(orderDishesPage, dishName, menuSelection, specifications, quantity);
      return;
    }

    if (comboSelections && Object.keys(comboSelections).length > 0) {
      await this.addComboDish(orderDishesPage, dishName, menuSelection, comboSelections, quantity);
      return;
    }

    await this.addRegularDish(orderDishesPage, dishName, menuSelection, quantity);
  }

  @step('业务步骤：将当前堂食订单送厨')
  async sendOrderToKitchen(orderDishesPage: OrderDishesPage): Promise<HomePage> {
    await orderDishesPage.expectLoaded();
    return await orderDishesPage.sendOrder();
  }

  @step((_: OrderDishesPage, dishName: string) => `业务步骤：编辑已下单菜品 ${dishName} 并加 1`)
  async increaseOrderedDishQuantityByOne(
    orderDishesPage: OrderDishesPage,
    dishName: string,
  ): Promise<void> {
    await orderDishesPage.expectLoaded();
    await orderDishesPage.increaseOrderedDishQuantityByOne(dishName);
  }

  @step(
    (_orderDishesPage: OrderDishesPage, params: PresetModifierOptionsParams) =>
      `业务步骤：为已点菜品 ${params.dishName} 连续选择系统预置调味`,
  )
  async selectPresetModifierOptions(
    orderDishesPage: OrderDishesPage,
    params: PresetModifierOptionsParams,
  ): Promise<void> {
    if (params.options.length === 0) {
      throw new Error('Preset modifier flow requires at least one option.');
    }

    await this.runModifyPanelFlow(orderDishesPage, params.dishName, params.closeAfter, async () => {
      for (const option of params.options) {
        await orderDishesPage.selectModifyAction(option.action);
        await orderDishesPage.selectModifyCategory(option.category);
        await orderDishesPage.selectModifyOption(option.option);

        if (option.price) {
          await orderDishesPage.selectModifyPrice(option.price);
        }
      }
    });
  }

  @step(
    (_orderDishesPage: OrderDishesPage, params: CustomModifierParams) =>
      `业务步骤：为已点菜品 ${params.dishName} 添加自定义调味 ${params.name}`,
  )
  async addCustomModifier(
    orderDishesPage: OrderDishesPage,
    params: CustomModifierParams,
  ): Promise<void> {
    await this.runModifyPanelFlow(orderDishesPage, params.dishName, params.closeAfter, async () => {
      await orderDishesPage.addCustomModifier(params.name, params.price ?? 0);
    });
  }

  @step((optionName: string) => `业务步骤：按预置加收项 ${optionName} 快捷整单加收`)
  async quickChargeByName(
    orderDishesPage: OrderDishesPage,
    optionName: string,
  ): Promise<void> {
    await this.applyChargeByScope(orderDishesPage, {
      optionName,
      scope: 'whole',
    });
  }

  @step(
    (_orderDishesPage: OrderDishesPage, params: ChargeByScopeParams) =>
      params.scope === 'whole'
        ? `业务步骤：执行整单加收 ${params.optionName}`
        : `业务步骤：对菜品 ${params.dishNames?.join('、') ?? ''} 执行加收 ${params.optionName}`,
  )
  async applyChargeByScope(
    orderDishesPage: OrderDishesPage,
    params: ChargeByScopeParams,
  ): Promise<void> {
    await this.runChargeDialogFlow(orderDishesPage, async () => {
      await orderDishesPage.switchChargeScope(params.scope);

      if (params.scope === 'item') {
        await this.selectChargeDishes(orderDishesPage, params.dishNames);
      }

      await orderDishesPage.toggleChargeOption(params.optionName);
    });
  }

  @step(
    (_orderDishesPage: OrderDishesPage, params: CustomChargeParams) =>
      params.scope === 'whole'
        ? `业务步骤：执行整单自定义加收 ${params.type === 'percentage' ? `${params.value}%` : `$${params.value}`}`
        : `业务步骤：对菜品 ${params.dishNames?.join('、') ?? ''} 执行自定义加收 ${
            params.type === 'percentage' ? `${params.value}%` : `$${params.value}`
          }`,
  )
  async applyCustomCharge(
    orderDishesPage: OrderDishesPage,
    params: CustomChargeParams,
  ): Promise<void> {
    await this.runChargeDialogFlow(orderDishesPage, async () => {
      await orderDishesPage.switchChargeScope(params.scope);

      if (params.scope === 'item') {
        await this.selectChargeDishes(orderDishesPage, params.dishNames);
      }

      await orderDishesPage.clickCustomCharge();
      await orderDishesPage.selectCustomChargeType(params.type);
      await orderDishesPage.fillCustomChargeValue(params.value);

      if (params.taxed !== undefined) {
        await orderDishesPage.setCustomChargeTaxed(params.taxed);
      }

      await orderDishesPage.confirmCustomChargeDialog();
    });
  }

  @step(
    (_orderDishesPage: OrderDishesPage, dishNames: string[], value: number) =>
      `业务步骤：对菜品 ${dishNames.join('、')} 添加自定义百分比折扣 ${value}%`,
  )
  async applyCustomItemPercentageDiscount(
    orderDishesPage: OrderDishesPage,
    dishNames: string[],
    value: number,
  ): Promise<void> {
    await this.runChargeDialogFlow(orderDishesPage, async () => {
      await orderDishesPage.switchChargeScope('item');
      await this.selectChargeDishes(orderDishesPage, dishNames);
      await orderDishesPage.applyCustomPercentageDiscount(value);
    });
  }

  @step(
    (_orderDishesPage: OrderDishesPage, dishNames: string[], value: number) =>
      `业务步骤：对菜品 ${dishNames.join('、')} 添加固定金额折扣 $${value.toFixed(2)}`,
  )
  async applyCustomItemFixedDiscount(
    orderDishesPage: OrderDishesPage,
    dishNames: string[],
    value: number,
  ): Promise<void> {
    await this.runChargeDialogFlow(orderDishesPage, async () => {
      await orderDishesPage.switchChargeScope('item');
      await this.selectChargeDishes(orderDishesPage, dishNames);
      await orderDishesPage.applyCustomFixedDiscount(value);
    });
  }

  @step(
    (_orderDishesPage: OrderDishesPage, value: number) =>
      `业务步骤：添加整单自定义百分比折扣 ${value}%`,
  )
  async applyCustomWholePercentageDiscount(
    orderDishesPage: OrderDishesPage,
    value: number,
  ): Promise<void> {
    await this.runChargeDialogFlow(orderDishesPage, async () => {
      await orderDishesPage.switchChargeScope('whole');
      await orderDishesPage.applyCustomPercentageDiscount(value);
    });
  }

  @step(
    (_orderDishesPage: OrderDishesPage, params: ClearChargesParams) =>
      params.scope === 'whole'
        ? '业务步骤：清空整单加收或折扣'
        : '业务步骤：清空菜品加收或折扣',
  )
  async clearAllCharges(
    orderDishesPage: OrderDishesPage,
    params: ClearChargesParams,
  ): Promise<void> {
    await this.runChargeDialogFlow(orderDishesPage, async () => {
      await orderDishesPage.switchChargeScope(params.scope);

      if (params.scope === 'item') {
        await this.selectChargeDishes(orderDishesPage, params.dishNames);
      }

      await orderDishesPage.clearAllCharges();
    });
  }

  @step('业务步骤：确认后台变更后的加收并读取确认前后状态')
  async confirmRefreshedChargeAndReadState(
    orderDishesPage: OrderDishesPage,
  ): Promise<{
    afterConfirmationSummary: OrderPriceSummary;
    beforeConfirmationSummary: OrderPriceSummary;
    chargeDialogSnapshot: OrderChargeSnapshot;
  }> {
    const beforeConfirmationSummary = await orderDishesPage.readPriceSummary();
    await orderDishesPage.clickCharge();

    try {
      const chargeDialogSnapshot = await orderDishesPage.readChargeSnapshot();
      await orderDishesPage.confirmChargeDialog();
      const afterConfirmationSummary = await orderDishesPage.readPriceSummary();

      return {
        afterConfirmationSummary,
        beforeConfirmationSummary,
        chargeDialogSnapshot,
      };
    } catch (error) {
      await orderDishesPage.closeChargeDialog();
      throw error;
    }
  }

  @step(
    (_orderDishesPage: OrderDishesPage, quantity: number) =>
      quantity === 1 ? '业务步骤：保持默认点菜数量 1' : `业务步骤：将点菜数量调整为 ${quantity}`,
  )
  private async adjustQuantityIfNeeded(
    orderDishesPage: OrderDishesPage,
    quantity: number,
  ): Promise<void> {
    if (quantity === 1) {
      return;
    }

    await orderDishesPage.changeDishCount(quantity);
  }

  @step(
    (_orderDishesPage: OrderDishesPage, menuSelection: MenuSelection) =>
      `业务步骤：切换菜单组 ${menuSelection.group} 和类别 ${menuSelection.category}`,
  )
  private async switchMenu(
    orderDishesPage: OrderDishesPage,
    menuSelection: MenuSelection,
  ): Promise<void> {
    await orderDishesPage.switchMenu(menuSelection.group, menuSelection.category);
  }

  @step(
    (_orderDishesPage: OrderDishesPage, dishNames?: string[]) =>
      `业务步骤：选择加收目标菜品 ${dishNames?.join('、') ?? ''}`,
  )
  private async selectChargeDishes(
    orderDishesPage: OrderDishesPage,
    dishNames: string[] | undefined,
  ): Promise<void> {
    if (!dishNames || dishNames.length === 0) {
      throw new Error('Item Charge requires at least one dish name.');
    }

    for (const dishName of dishNames) {
      await orderDishesPage.toggleChargeDish(dishName);
    }
  }

  private async runModifyPanelFlow(
    orderDishesPage: OrderDishesPage,
    dishName: string,
    closeAfter: boolean | undefined,
    work: () => Promise<void>,
  ): Promise<void> {
    await orderDishesPage.openModifyForOrderedDish(dishName);

    try {
      await work();

      if (closeAfter ?? true) {
        await orderDishesPage.closeModifyPanel();
      }
    } catch (error) {
      await orderDishesPage.closeModifyPanel();
      throw error;
    }
  }

  private async runChargeDialogFlow(
    orderDishesPage: OrderDishesPage,
    work: () => Promise<void>,
  ): Promise<void> {
    await orderDishesPage.clickCharge();

    try {
      await work();
      await orderDishesPage.confirmChargeDialog();
    } catch (error) {
      await orderDishesPage.closeCustomChargeDialog();
      await orderDishesPage.closeChargeDialog();
      throw error;
    }
  }
}
