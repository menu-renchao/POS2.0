import { EmployeeLoginFlow } from '../../flows/employee-login.flow';
import { HomeFlow } from '../../flows/home.flow';
import { LicenseSelectionFlow } from '../../flows/license-selection.flow';
import {
  TakeoutFlow,
} from '../../flows/takeout.flow';
import { test } from '../../fixtures/test.fixture';

test.describe('外带入口跳转冒烟', () => {
  test(
    '应能从主页点击 To Go 直接进入点单页',
    {
      tag: ['@smoke'],
      annotation: [
        {
          type: 'issue',
          description: 'https://devtickets.atlassian.net/browse/POS-46667',
        },
      ],
    },
    async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
      await new HomeFlow().openHome(homePage);

      if (await licenseSelectionPage.isVisible(10_000)) {
        await new LicenseSelectionFlow().enterWithAvailableLicense(licenseSelectionPage, homePage);
      }

      const loggedInHomePage = await new EmployeeLoginFlow().enterWithEmployeePassword(
        employeeLoginPage,
        homePage,
        '11',
      );

      await new TakeoutFlow().startToGoOrder(loggedInHomePage);
    },
  );

  test(
    '应能从主页填写 Pick Up 信息后进入点单页',
    {
      tag: ['@smoke'],
      annotation: [
        {
          type: 'issue',
          description: 'https://devtickets.atlassian.net/browse/POS-46667',
        },
      ],
    },
    async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
      await new HomeFlow().openHome(homePage);

      if (await licenseSelectionPage.isVisible(10_000)) {
        await new LicenseSelectionFlow().enterWithAvailableLicense(licenseSelectionPage, homePage);
      }

      const loggedInHomePage = await new EmployeeLoginFlow().enterWithEmployeePassword(
        employeeLoginPage,
        homePage,
        '11',
      );

      await new TakeoutFlow().startPickUpOrder(loggedInHomePage, {
        phoneNumber: '9342219929',
        customerName: '小林林',
        note: '自动化取餐备注',
      });
    },
  );

  test(
    '应能从主页填写 Delivery 信息后进入点单页',
    {
      tag: ['@smoke'],
      annotation: [
        {
          type: 'issue',
          description: 'https://devtickets.atlassian.net/browse/POS-46667',
        },
      ],
    },
    async ({ homePage, licenseSelectionPage, employeeLoginPage }) => {
      await new HomeFlow().openHome(homePage);

      if (await licenseSelectionPage.isVisible(10_000)) {
        await new LicenseSelectionFlow().enterWithAvailableLicense(licenseSelectionPage, homePage);
      }

      const loggedInHomePage = await new EmployeeLoginFlow().enterWithEmployeePassword(
        employeeLoginPage,
        homePage,
        '11',
      );

      await new TakeoutFlow().startDeliveryOrder(loggedInHomePage, {
        phoneNumber: '1934221992',
        customerName: '解决急急急',
        address: '5611 Jersey Ave',
        street: 'Room 101',
        zipCode: '94061',
        note: '自动化外送备注',
      });
    },
  );
});
