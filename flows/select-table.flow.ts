import { OrderDishesPage } from '../pages/order-dishes.page';
import { HomePage } from '../pages/home.page';
import { type SelectedTableRecord, SelectTablePage } from '../pages/select-table.page';
import { step } from '../utils/step';

export type TableSelectionResult = {
  selectedTable: SelectedTableRecord;
};

export type TableOrderEntryResult = {
  orderDishesPage: OrderDishesPage;
  selectedTable: SelectedTableRecord;
};

export class SelectTableFlow {
  @step('业务步骤：从 Dine In 以无桌位路径进入点单页')
  async enterDineInNoTableOrder(homePage: HomePage): Promise<OrderDishesPage> {
    const entryPage = await homePage.enterDineInEntry();

    if (entryPage instanceof OrderDishesPage) {
      return entryPage;
    }

    return await this.skipTableSelectionAndEnterOrderDishes(entryPage);
  }

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

  @step(
    (_selectTablePage: SelectTablePage, areaName: string, tableNumber: string) =>
      `业务步骤：在选桌页面选择区域 ${areaName} 下桌号为 ${tableNumber} 的桌台`,
  )
  async selectTableByAreaAndTableNumber(
    selectTablePage: SelectTablePage,
    areaName: string,
    tableNumber: string,
  ): Promise<TableSelectionResult> {
    await selectTablePage.expectLoaded();
    await selectTablePage.selectArea(areaName);

    const table = await selectTablePage.findTableByNumber(tableNumber);
    await selectTablePage.clickTable(table);

    return {
      selectedTable: {
        areaName,
        tableNumber,
      },
    };
  }

  @step(
    (_selectTablePage: SelectTablePage, guestCount: number) =>
      `业务步骤：选择任意空桌并选择 ${guestCount} 位客人进入点单页`,
  )
  async selectAnyAvailableTableAndEnterOrderDishes(
    selectTablePage: SelectTablePage,
    guestCount: number,
  ): Promise<TableOrderEntryResult> {
    const { selectedTable } = await this.selectAnyAvailableTable(selectTablePage);

    let orderDishesPage: OrderDishesPage;

    try {
      orderDishesPage = await selectTablePage.enterOrderDishesAfterSelectingTable(guestCount);
    } catch {
      await selectTablePage.selectArea(selectedTable.areaName);
      const selectedTableCard = await selectTablePage.findTableByNumber(selectedTable.tableNumber);
      await selectTablePage.clickTable(selectedTableCard);
      orderDishesPage = await selectTablePage.enterOrderDishesAfterSelectingTable(guestCount);
    }

    await orderDishesPage.expectLoaded();

    return {
      orderDishesPage,
      selectedTable,
    };
  }

  @step(
    (_orderDishesPage: OrderDishesPage, currentTableNumber: string, guestCount: number) =>
      `业务步骤：将当前桌台 ${currentTableNumber} 换到任意其他空桌并保留 ${guestCount} 位客人`,
  )
  async changeToAnyAvailableTable(
    orderDishesPage: OrderDishesPage,
    currentTableNumber: string,
    guestCount: number,
  ): Promise<TableOrderEntryResult> {
    await orderDishesPage.openChangeTable(currentTableNumber);
    const targetTableNumbers = await orderDishesPage.readAvailableChangeTableNumbers();
    const targetTableNumber = targetTableNumbers.find(
      (tableNumber) => tableNumber !== currentTableNumber,
    );

    if (!targetTableNumber) {
      throw new Error(`当前桌台 ${currentTableNumber} 没有其他可用的换桌目标。`);
    }

    await orderDishesPage.selectChangeTableTarget(targetTableNumber);
    await orderDishesPage.confirmChangeTable(targetTableNumber);
    await orderDishesPage.expectGuestCount(guestCount);
    const selectedTable = {
      areaName: '换桌',
      tableNumber: targetTableNumber,
    };

    return {
      orderDishesPage,
      selectedTable,
    };
  }

  @step('业务步骤：跳过选桌并通过 New order 直接进入点单页')
  async skipTableSelectionAndEnterOrderDishes(
    selectTablePage: SelectTablePage,
  ): Promise<OrderDishesPage> {
    await selectTablePage.expectLoaded();
    const orderDishesPage = await selectTablePage.clickNewOrder();
    await orderDishesPage.expectLoaded();
    return orderDishesPage;
  }
}
