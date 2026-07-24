import { OrderDishesPage } from '../pages/order-dishes.page';
import { HomePage } from '../pages/home.page';
import { EmployeeLoginPage } from '../pages/employee-login.page';
import { type SelectedTableRecord, SelectTablePage } from '../pages/select-table.page';
import { step } from '../utils/step';
import { waitUntil } from '../utils/wait';
import { EmployeeLoginFlow } from './employee-login.flow';

export type TableSelectionResult = {
  selectedTable: SelectedTableRecord;
};

export type TableOrderEntryResult = {
  orderDishesPage: OrderDishesPage;
  selectedTable: SelectedTableRecord;
};

export class SelectTableFlow {
  constructor(private readonly employeeLoginFlow: EmployeeLoginFlow) {}

  @step('业务步骤：返回主页后重新进入指定桌台区域以刷新桌台信息')
  async refreshTableInformationByReentering(
    selectTablePage: SelectTablePage,
    areaName: string,
  ): Promise<SelectTablePage> {
    const homePage = await selectTablePage.returnHome();
    await homePage.clickRefresh();
    const refreshedSelectTablePage = await homePage.enterDineIn();
    await refreshedSelectTablePage.selectArea(areaName);
    return refreshedSelectTablePage;
  }

  @step('业务步骤：从主页进入 Dine In，并按需完成员工口令确认')
  async enterDineInWithEmployeeContext(
    homePage: HomePage,
    employeeLoginPage: EmployeeLoginPage,
    employeePasscode = '11',
  ): Promise<SelectTablePage> {
    await homePage.clickEntry('Dine In');
    const entryState = await waitUntil(
      async () => {
        if (await employeeLoginPage.isVisible().catch(() => false)) {
          return 'employee-login';
        }

        if (await homePage.isDineInEntryRoute()) {
          return 'dine-in';
        }

        return 'pending';
      },
      (state) => state !== 'pending',
      {
        timeout: 10_000,
        interval: 100,
        message: 'Dine In 入口未进入员工口令页或堂食页面。',
      },
    );

    if (entryState === 'employee-login') {
      await this.employeeLoginFlow.enterWithEmployeePassword(
        employeeLoginPage,
        homePage,
        employeePasscode,
      );
      return await homePage.enterDineIn();
    }

    const entryPage = await homePage.waitForDineInEntryPage();

    if (entryPage instanceof OrderDishesPage) {
      throw new Error('Dine In 当前跳过了选桌页，无法执行桌台用例。');
    }

    await entryPage.expectLoaded();
    return entryPage;
  }

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
      const tableId = await selectTablePage.readTableId(selectedTable);
      await selectTablePage.clickTable(selectedTable);

      return {
        selectedTable: {
          areaName,
          tableId,
          tableNumber,
        },
      };
    }

    throw new Error('No available table found across all visible areas on the select-table page.');
  }

  @step('业务步骤：切换到其他区域并选择一张可用空桌')
  async selectAvailableTableInAnotherArea(
    selectTablePage: SelectTablePage,
  ): Promise<TableSelectionResult> {
    await selectTablePage.expectLoaded();
    const currentAreaName = await selectTablePage.getCurrentAreaName();
    const targetAreaNames = (await selectTablePage.readAreaNames()).filter(
      (areaName) => areaName !== currentAreaName,
    );

    for (const areaName of targetAreaNames) {
      await selectTablePage.selectArea(areaName);
      const availableTables = await selectTablePage.getAvailableTables();
      const selectedTable = availableTables[0];

      if (!selectedTable) {
        continue;
      }

      const tableNumber = await selectTablePage.readTableNumber(selectedTable);
      const tableId = await selectTablePage.readTableId(selectedTable);
      await selectTablePage.clickTable(selectedTable);

      return {
        selectedTable: { areaName, tableId, tableNumber },
      };
    }

    throw new Error(`除当前区域 ${currentAreaName} 外没有可用空桌。`);
  }

  @step('业务步骤：检查所有桌台区域是否至少存在一张空桌')
  async hasAnyAvailableTable(selectTablePage: SelectTablePage): Promise<boolean> {
    await selectTablePage.expectLoaded();

    for (const areaName of await selectTablePage.readAreaNames()) {
      await selectTablePage.selectArea(areaName);

      if ((await selectTablePage.getAvailableTables()).length > 0) {
        return true;
      }
    }

    return false;
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
    const tableId = await selectTablePage.readTableId(table);
    await selectTablePage.clickTable(table);

    return {
      selectedTable: {
        areaName,
        tableId,
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
    await orderDishesPage.menu.openChangeTable(currentTableNumber);
    const targetTableNumbers = await orderDishesPage.menu.readAvailableChangeTableNumbers();
    const targetTableNumber = targetTableNumbers.find(
      (tableNumber) => tableNumber !== currentTableNumber,
    );

    if (!targetTableNumber) {
      throw new Error(`当前桌台 ${currentTableNumber} 没有其他可用的换桌目标。`);
    }

    await orderDishesPage.menu.selectChangeTableTarget(targetTableNumber);
    await orderDishesPage.menu.confirmChangeTable(targetTableNumber);
    await orderDishesPage.menu.expectGuestCount(guestCount);
    const selectedTable = {
      areaName: '换桌',
      tableNumber: targetTableNumber,
    };

    return {
      orderDishesPage,
      selectedTable,
    };
  }

  @step(
    (_homePage: HomePage, selectedTable: SelectedTableRecord, guestCount: number) =>
      `业务步骤：在桌台 ${selectedTable.tableNumber} 上追加一笔 ${guestCount} 人订单`,
  )
  async enterAdditionalOrderForTable(
    homePage: HomePage,
    selectedTable: SelectedTableRecord,
    guestCount: number,
  ): Promise<OrderDishesPage> {
    const tableId = this.requireTableId(selectedTable);
    const selectTablePage = await homePage.enterDineIn();
    await selectTablePage.selectArea(selectedTable.areaName);
    await selectTablePage.cards.clickAddOrder(tableId);
    const orderDishesPage = await selectTablePage.enterOrderDishesAfterSelectingTable(guestCount);
    await orderDishesPage.expectLoaded();
    return orderDishesPage;
  }

  @step(
    (_homePage: HomePage, selectedTable: SelectedTableRecord) =>
      `业务步骤：打开桌台 ${selectedTable.tableNumber} 的全部订单`,
  )
  async openOrdersForTable(
    homePage: HomePage,
    selectedTable: SelectedTableRecord,
  ): Promise<SelectTablePage> {
    const selectTablePage = await homePage.enterDineIn();
    await selectTablePage.selectArea(selectedTable.areaName);
    await selectTablePage.cards.openTableOrders(selectedTable.tableNumber);
    return selectTablePage;
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

  private requireTableId(selectedTable: SelectedTableRecord): string {
    if (!selectedTable.tableId) {
      throw new Error(`桌台 ${selectedTable.tableNumber} 缺少内部桌台 ID。`);
    }

    return selectedTable.tableId;
  }
}
