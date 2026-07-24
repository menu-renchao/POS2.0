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

export type PresetItemDiscountParams = {
  authorizationPasscode: string;
  discountName: string;
  dishName: string;
  price?: number;
};

export type ModifyGlobalOptionOperation =
  | { type: 'add' }
  | { type: 'count'; quantity: number }
  | { type: 'reduce' };

export type ModifyGlobalOptionQuantityParams = {
  closeAfter?: boolean;
  dishName: string;
  operations: readonly ModifyGlobalOptionOperation[];
  optionName: string;
};

export type ModifyGlobalOptionQuantityResult = {
  modifyPanelVisible: boolean[];
  quantities: number[];
};

export type ComboDishOptionSelection = {
  option: string;
  suboption?: string;
};

export type ComboDishWithOptionsParams = {
  comboName: string;
  itemIndex?: number;
  menuSelection: MenuSelection;
  saleItemId: number;
  sectionId: number;
  selections: readonly ComboDishOptionSelection[];
};

export class OrderDishesFlow {
  @step(
    (_orderDishesPage: OrderDishesPage, dishName: string, optionName: string) =>
      `业务步骤：为菜品 ${dishName} 添加全局调味 ${optionName} 后点击返回按钮退出 Modify`,
  )
  async addGlobalOptionAndCloseModify(
    orderDishesPage: OrderDishesPage,
    dishName: string,
    optionName: string,
  ): Promise<void> {
    await orderDishesPage.modifier.openModifyForOrderedDish(dishName);
    await orderDishesPage.modifier.selectModifyOption(optionName);
    await orderDishesPage.modifier.closeModifyPanel();
  }

  @step(
    (_orderDishesPage: OrderDishesPage, params: ComboDishWithOptionsParams) =>
      `业务步骤：添加套餐 ${params.comboName}，为套餐子菜选择多个 option`,
  )
  async addComboDishWithItemOptions(
    orderDishesPage: OrderDishesPage,
    params: ComboDishWithOptionsParams,
  ): Promise<void> {
    await orderDishesPage.expectLoaded();
    await this.switchMenu(orderDishesPage, params.menuSelection);
    await orderDishesPage.menu.clickDish(params.comboName);
    await orderDishesPage.menu.selectComboItem(
      params.sectionId,
      params.saleItemId,
      params.itemIndex ?? 0,
    );

    for (const selection of params.selections) {
      await orderDishesPage.menu.selectCategoryOption(selection.option, selection.suboption);
    }

    await orderDishesPage.menu.confirmComboDialog();
  }

  @step('业务步骤：添加普通菜品到购物车')
  async addRegularDish(
    orderDishesPage: OrderDishesPage,
    dishName: string,
    menuSelection: MenuSelection,
    quantity: number = 1,
  ): Promise<void> {
    await orderDishesPage.expectLoaded();
    await this.switchMenu(orderDishesPage, menuSelection);
    await orderDishesPage.menu.clickDish(dishName);
    await this.adjustQuantityIfNeeded(orderDishesPage, quantity);
  }

  @step((_: OrderDishesPage, dishName: string) =>
    `业务步骤：通过 Search menu 搜索并添加菜品 ${dishName}`,
  )
  async searchAndAddDish(
    orderDishesPage: OrderDishesPage,
    dishName: string,
  ): Promise<void> {
    await orderDishesPage.expectLoaded();
    await orderDishesPage.menu.searchAndClickDish(dishName);
  }

  @step(
    (_orderDishesPage: OrderDishesPage, dishName: string, _menuSelection: MenuSelection, quantity: number) =>
      `业务步骤：通过连续点击菜品卡片添加 ${quantity} 份 ${dishName}`,
  )
  async addRegularDishByRepeatedCardClicks(
    orderDishesPage: OrderDishesPage,
    dishName: string,
    menuSelection: MenuSelection,
    quantity: number,
  ): Promise<void> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`连续点击点菜数量必须为正整数：${quantity}`);
    }

    await orderDishesPage.expectLoaded();
    await this.switchMenu(orderDishesPage, menuSelection);

    if (quantity >= 2) {
      await orderDishesPage.menu.doubleClickCurrentCategoryDish(dishName);
    }

    for (let index = quantity >= 2 ? 2 : 0; index < quantity; index += 1) {
      await orderDishesPage.menu.clickCurrentCategoryDish(dishName);
    }
  }

  @step('业务步骤：添加第一道可用菜品到购物车')
  async addFirstAvailableDish(
    orderDishesPage: OrderDishesPage,
    menuSelection: MenuSelection,
  ): Promise<void> {
    await orderDishesPage.expectLoaded();
    await this.switchMenu(orderDishesPage, menuSelection);
    const [dishName] = await orderDishesPage.menu.readCurrentCategoryDishNames();

    if (!dishName) {
      throw new Error('当前菜单类别中没有可点选的菜品。');
    }

    await orderDishesPage.menu.clickCurrentCategoryDish(dishName);
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
    await orderDishesPage.menu.clickDish(dishName);
    await this.adjustQuantityIfNeeded(orderDishesPage, quantity);
    await orderDishesPage.menu.enterWeight(weight);
    await orderDishesPage.menu.confirmWeightDialog();
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
    await orderDishesPage.menu.clickDish(dishName);

    for (const [sectionName, sectionSelection] of Object.entries(selections)) {
      if (typeof sectionSelection === 'string') {
        await orderDishesPage.menu.selectComboSectionItem(sectionName, sectionSelection);
        continue;
      }

      for (const [sectionDishName, sectionDishQuantity] of Object.entries(sectionSelection)) {
        if (sectionDishQuantity < 1) {
          continue;
        }

        await orderDishesPage.menu.selectComboSectionItem(
          sectionName,
          sectionDishName,
          sectionDishQuantity,
        );
      }
    }

    await orderDishesPage.menu.confirmComboDialog();
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
    await orderDishesPage.menu.clickDish(dishName);
    await this.adjustQuantityIfNeeded(orderDishesPage, quantity);

    if (await orderDishesPage.menu.isCategoryOptionPanelVisible()) {
      await orderDishesPage.menu.selectCategoryOption(specifications[0], specifications[1]);
      return;
    }

    if (await orderDishesPage.menu.isSpecificationDialogVisible()) {
      for (const spec of specifications) {
        await orderDishesPage.menu.selectSpecification(spec);
      }

      await orderDishesPage.menu.confirmSpecificationDialog();
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
    await orderDishesPage.menu.clickDish(dishName);
    await this.adjustQuantityIfNeeded(orderDishesPage, quantity);
    await orderDishesPage.menu.enterPrice(price);
    await orderDishesPage.menu.confirmPriceDialog();
  }

  @step((_: OrderDishesPage, name: string, price: number) => `业务步骤：添加 Open Food 菜品 ${name}，价格 ${price}`)
  async addOpenFoodItem(
    orderDishesPage: OrderDishesPage,
    name: string,
    price: number,
  ): Promise<void> {
    await orderDishesPage.expectLoaded();
    await orderDishesPage.menu.addOpenFood(name, price);
  }

  @step((_: OrderDishesPage, name: string, price: number) => `业务步骤：添加无税 Open Food 菜品 ${name}，价格 ${price}`)
  async addOpenFoodItemWithoutTax(
    orderDishesPage: OrderDishesPage,
    name: string,
    price: number,
  ): Promise<void> {
    await orderDishesPage.expectLoaded();
    await orderDishesPage.menu.addOpenFoodWithoutTax(name, price);
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
    return await orderDishesPage.navigation.sendOrder();
  }

  @step('业务步骤：打印当前订单收据并保存订单号')
  async printReceiptWithReference(
    orderDishesPage: OrderDishesPage,
  ): ReturnType<OrderDishesPage['navigation']['printReceiptWithReference']> {
    await orderDishesPage.expectLoaded();
    return await orderDishesPage.navigation.printReceiptWithReference();
  }

  @step((_: OrderDishesPage, dishName: string, note: string) =>
    `业务步骤：为菜品 ${dishName} 添加 Note：${note}`,
  )
  async addDishNote(
    orderDishesPage: OrderDishesPage,
    dishName: string,
    note: string,
    authorizationPasscode = '11',
  ): Promise<void> {
    await orderDishesPage.menu.selectOrderedDish(dishName);
    const state = await orderDishesPage.note.openSelectedItemNote();

    if (state === 'authorization') {
      await orderDishesPage.note.authorizeSelectedItemNote(authorizationPasscode);
    }

    await orderDishesPage.note.fillSelectedItemNote(note);
  }

  @step((_: OrderDishesPage, dishName: string) => `业务步骤：编辑已下单菜品 ${dishName} 并加 1`)
  async increaseOrderedDishQuantityByOne(
    orderDishesPage: OrderDishesPage,
    dishName: string,
  ): Promise<void> {
    await orderDishesPage.expectLoaded();
    await orderDishesPage.menu.increaseOrderedDishQuantityByOne(dishName);
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
        await orderDishesPage.modifier.selectModifyAction(option.action);
        await orderDishesPage.modifier.selectModifyCategory(option.category);
        await orderDishesPage.modifier.selectModifyOption(option.option);

        if (option.price) {
          await orderDishesPage.modifier.selectModifyPrice(option.price);
        }
      }
    });
  }

  @step(
    (_orderDishesPage: OrderDishesPage, params: ModifyGlobalOptionQuantityParams) =>
      `业务步骤：在 Modify 中调整全局选项 ${params.optionName} 的数量`,
  )
  async changeGlobalOptionQuantity(
    orderDishesPage: OrderDishesPage,
    params: ModifyGlobalOptionQuantityParams,
  ): Promise<ModifyGlobalOptionQuantityResult> {
    const modifyPanelVisible: boolean[] = [];
    const quantities: number[] = [];

    await this.runModifyPanelFlow(
      orderDishesPage,
      params.dishName,
      params.closeAfter ?? false,
      async () => {
        await orderDishesPage.modifier.selectModifyOption(params.optionName);
        quantities.push(
          await orderDishesPage.reads.readOrderedDishAdditionQuantity(
            params.dishName,
            params.optionName,
          ),
        );
        modifyPanelVisible.push(await orderDishesPage.modifier.isModifyPanelVisible());

        for (const operation of params.operations) {
          if (operation.type === 'add') {
            await orderDishesPage.modifier.addSelectedModifyOption();
          } else if (operation.type === 'count') {
            await orderDishesPage.modifier.changeSelectedModifyOptionCount(operation.quantity);
          } else {
            await orderDishesPage.modifier.reduceSelectedModifyOption();
          }

          quantities.push(
            await orderDishesPage.reads.readOrderedDishAdditionQuantity(
              params.dishName,
              params.optionName,
            ),
          );
          modifyPanelVisible.push(await orderDishesPage.modifier.isModifyPanelVisible());
        }
      },
    );

    return { modifyPanelVisible, quantities };
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
      await orderDishesPage.modifier.addCustomModifier(params.name, params.price ?? 0);
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
      await orderDishesPage.charge.switchChargeScope(params.scope);

      if (params.scope === 'item') {
        await this.selectChargeDishes(orderDishesPage, params.dishNames);
      }

      await orderDishesPage.charge.toggleChargeOption(params.optionName);
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
      await orderDishesPage.charge.switchChargeScope(params.scope);

      if (params.scope === 'item') {
        await this.selectChargeDishes(orderDishesPage, params.dishNames);
      }

      await orderDishesPage.charge.clickCustomCharge();
      await orderDishesPage.charge.selectCustomChargeType(params.type);
      await orderDishesPage.charge.fillCustomChargeValue(params.value);

      if (params.taxed !== undefined) {
        await orderDishesPage.charge.setCustomChargeTaxed(params.taxed);
      }

      await orderDishesPage.charge.confirmCustomChargeDialog();
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
      await orderDishesPage.charge.switchChargeScope('item');
      await this.selectChargeDishes(orderDishesPage, dishNames);
      await orderDishesPage.charge.applyCustomPercentageDiscount(value);
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
      await orderDishesPage.charge.switchChargeScope('item');
      await this.selectChargeDishes(orderDishesPage, dishNames);
      await orderDishesPage.charge.applyCustomFixedDiscount(value);
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
      await orderDishesPage.charge.switchChargeScope('whole');
      await orderDishesPage.charge.applyCustomPercentageDiscount(value);
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
    const currentSummary = await orderDishesPage.reads.readPriceSummary();
    if (Math.abs(currentSummary.Charge ?? 0) < 0.005) {
      return;
    }

    await this.runChargeDialogFlow(orderDishesPage, async () => {
      await orderDishesPage.charge.switchChargeScope(params.scope);

      if (params.scope === 'item') {
        await this.selectChargeDishes(orderDishesPage, params.dishNames);
      }

      await orderDishesPage.charge.clearAllCharges();
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
    const beforeConfirmationSummary = await orderDishesPage.reads.readPriceSummary();
    await orderDishesPage.charge.clickCharge();

    try {
      const chargeDialogSnapshot = await orderDishesPage.charge.readChargeSnapshot();
      await orderDishesPage.charge.confirmChargeDialog();
      const afterConfirmationSummary = await orderDishesPage.reads.readPriceSummary();

      return {
        afterConfirmationSummary,
        beforeConfirmationSummary,
        chargeDialogSnapshot,
      };
    } catch (error) {
      await orderDishesPage.charge.closeChargeDialog();
      throw error;
    }
  }

  @step(
    (_orderDishesPage: OrderDishesPage, params: PresetItemDiscountParams) =>
      params.price === undefined
        ? `业务步骤：为菜品 ${params.dishName} 选择预置单菜折扣 ${params.discountName}`
        : `业务步骤：将菜品 ${params.dishName} 改价为 ${params.price.toFixed(2)} 并选择预置单菜折扣 ${params.discountName}`,
  )
  async applyPresetItemDiscount(
    orderDishesPage: OrderDishesPage,
    params: PresetItemDiscountParams,
  ): Promise<void> {
    await orderDishesPage.menu.selectOrderedDish(params.dishName);
    await orderDishesPage.discount.openSelectedItemPriceDiscountDialog();

    if (params.price !== undefined) {
      await orderDishesPage.discount.fillSelectedItemPrice(params.price);
    }

    await orderDishesPage.discount.selectItemDiscount(params.discountName);
    await orderDishesPage.discount.confirmItemPriceAndDiscountForAuthorization();
    await orderDishesPage.discount.authorizeItemPriceAndDiscount(params.authorizationPasscode);
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

    await orderDishesPage.menu.changeDishCount(quantity);
  }

  @step(
    (_orderDishesPage: OrderDishesPage, menuSelection: MenuSelection) =>
      `业务步骤：切换菜单组 ${menuSelection.group} 和类别 ${menuSelection.category}`,
  )
  private async switchMenu(
    orderDishesPage: OrderDishesPage,
    menuSelection: MenuSelection,
  ): Promise<void> {
    await orderDishesPage.menu.switchMenu(menuSelection.group, menuSelection.category);
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
      await orderDishesPage.charge.toggleChargeDish(dishName);
    }
  }

  @step((_: OrderDishesPage, dishName: string) =>
    `业务步骤：在 Modify 面板处理菜品 ${dishName}`,
  )
  private async runModifyPanelFlow(
    orderDishesPage: OrderDishesPage,
    dishName: string,
    closeAfter: boolean | undefined,
    work: () => Promise<void>,
  ): Promise<void> {
    await orderDishesPage.modifier.openModifyForOrderedDish(dishName);

    try {
      await work();

      if (closeAfter ?? true) {
        await orderDishesPage.modifier.closeModifyPanel();
      }
    } catch (error) {
      await orderDishesPage.modifier.closeModifyPanel();
      throw error;
    }
  }

  @step('业务步骤：在加收弹窗执行订单加收操作')
  private async runChargeDialogFlow(
    orderDishesPage: OrderDishesPage,
    work: () => Promise<void>,
  ): Promise<void> {
    await orderDishesPage.charge.clickCharge();

    try {
      await work();
      await orderDishesPage.charge.confirmChargeDialog();
    } catch (error) {
      await orderDishesPage.charge.closeCustomChargeDialog();
      await orderDishesPage.charge.closeChargeDialog();
      throw error;
    }
  }
}
