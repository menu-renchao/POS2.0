import { OrderDishesPage } from '../pages/order-dishes.page';
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

export async function selectAnyAvailableTable(
  selectTablePage: SelectTablePage,
): Promise<TableSelectionResult> {
  const selectTableFlow = new SelectTableFlow();
  return await selectTableFlow.selectAnyAvailableTable(selectTablePage);
}

export async function selectTableByAreaAndTableNumber(
  selectTablePage: SelectTablePage,
  areaName: string,
  tableNumber: string,
): Promise<TableSelectionResult> {
  const selectTableFlow = new SelectTableFlow();
  return await selectTableFlow.selectTableByAreaAndTableNumber(
    selectTablePage,
    areaName,
    tableNumber,
  );
}

export async function selectAnyAvailableTableAndEnterOrderDishes(
  selectTablePage: SelectTablePage,
  guestCount: number,
): Promise<TableOrderEntryResult> {
  const selectTableFlow = new SelectTableFlow();
  return await selectTableFlow.selectAnyAvailableTableAndEnterOrderDishes(
    selectTablePage,
    guestCount,
  );
}

export async function skipTableSelectionAndEnterOrderDishes(
  selectTablePage: SelectTablePage,
): Promise<OrderDishesPage> {
  const selectTableFlow = new SelectTableFlow();
  return await selectTableFlow.skipTableSelectionAndEnterOrderDishes(selectTablePage);
}
