import { expect, test } from '@playwright/test';
import { EmployeeLoginFlow } from '../../flows/employee-login.flow';
import { HomeFlow } from '../../flows/home.flow';
import { LicenseSelectionFlow } from '../../flows/license-selection.flow';
import { OrderDishesFlow } from '../../flows/order-dishes.flow';
import { SelectTableFlow } from '../../flows/select-table.flow';
import { test as appTest } from '../../fixtures/test.fixture';

appTest.describe('点单加收真实验证', () => {
  appTest(
    '应能在真实环境中执行整单自定义固定金额加收',
    {},
    async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
      const orderDishesFlow = new OrderDishesFlow();

      await test.step('从首页正常进入点单页', async () => {
        await new HomeFlow().openHome(homePage);

        if (await licenseSelectionPage.isVisible(10_000)) {
          await new LicenseSelectionFlow().enterWithAvailableLicense(licenseSelectionPage, homePage);
        }

        const readyHomePage = await new EmployeeLoginFlow().enterWithEmployeePassword(
          employeeLoginPage,
          homePage,
          '11',
        );

        const selectTablePage = await readyHomePage.clickDineIn();
        const orderDishesPage = await new SelectTableFlow().skipTableSelectionAndEnterOrderDishes(selectTablePage);

        await orderDishesPage.expectLoaded();
        await orderDishesPage.clickDish('common item2');

        await test.step('执行整单自定义固定金额加收', async () => {
          await orderDishesFlow.applyCustomCharge(orderDishesPage, {
            scope: 'whole',
            type: 'fixed',
            value: 1,
          });
        });

        await test.step('重新打开加收弹窗并确认加收已保留', async () => {
          await orderDishesPage.clickCharge();
          const snapshot = await orderDishesPage.readChargeSnapshot();

          expect(snapshot.scope).toBe('whole');
          expect(snapshot.wholeOrderCharges).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                amountText: '$1.00',
                name: expect.stringContaining('Add'),
              }),
            ]),
          );

          await orderDishesPage.closeChargeDialog();
        });
      });
    },
  );
});
