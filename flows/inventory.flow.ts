import { OrderDishesPage } from '../pages/order-dishes.page';
import { inventoryMenu } from '../test-data/inventory';
import { step } from '../utils/step';

type InventoryMenuConfig = typeof inventoryMenu;

export class InventoryFlow {
  @step(
    (_orderDishesPage: OrderDishesPage, itemName: string, quantity: number) =>
      `业务步骤：将商品 ${itemName} 配置为有限库存 ${quantity}`,
  )
  async configureLimitedStock(
    orderDishesPage: OrderDishesPage,
    itemName: string,
    quantity: number,
    menu: InventoryMenuConfig = inventoryMenu,
  ): Promise<OrderDishesPage> {
    const inventoryPage = await orderDishesPage.navigation.openInventoryPage();
    await inventoryPage.focusItem({
      itemName,
      menu: {
        category: menu.category,
      },
    });

    const stockSettingPage = await inventoryPage.openStockSetting(itemName);
    await stockSettingPage.setLimitedStockQuantity(quantity);
    const updatedInventoryPage = await stockSettingPage.saveInventoryConfig();
    return await updatedInventoryPage.backToOrderPage();
  }

  @step((itemName: string) => `业务步骤：读取商品 ${itemName} 的 POS 库存状态`)
  async readPosItemStockState(
    orderDishesPage: OrderDishesPage,
    itemName: string,
    menu: InventoryMenuConfig = inventoryMenu,
  ): Promise<string> {
    const inventoryPage = await orderDishesPage.navigation.openInventoryPage();
    await inventoryPage.focusItem({
      itemName,
      menu: {
        category: menu.category,
      },
      limitedStockFilter: true,
    });

    return await inventoryPage.readItemStockState(itemName);
  }

  @step(
    (_orderDishesPage: OrderDishesPage, itemName: string, expectedState: string) =>
      `业务步骤：校验商品 ${itemName} 的库存状态为 ${expectedState} 后返回点单页`,
  )
  async expectPosItemStockStateAndReturn(
    orderDishesPage: OrderDishesPage,
    itemName: string,
    expectedState: string,
    menu: InventoryMenuConfig = inventoryMenu,
  ): Promise<OrderDishesPage> {
    const inventoryPage = await orderDishesPage.navigation.openInventoryPage();
    await inventoryPage.focusItem({
      itemName,
      menu: {
        category: menu.category,
      },
      limitedStockFilter: true,
    });

    const actualState = await inventoryPage.readItemStockState(itemName);

    if (actualState !== expectedState) {
      throw new Error(
        `Inventory state mismatch for ${itemName}. Expected "${expectedState}", received "${actualState}".`,
      );
    }

    return await inventoryPage.backToOrderPage();
  }
}
