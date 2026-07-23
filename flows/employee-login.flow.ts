import { EmployeeLoginPage } from '../pages/employee-login.page';
import { HomePage } from '../pages/home.page';
import { step } from '../utils/step';
import { waitUntil } from '../utils/wait';

type EmployeeEntryState = 'employee-login' | 'home-ready' | 'pending';

export class EmployeeLoginFlow {
  @step('业务步骤：使用员工密码登录并进入主页')
  async enterWithEmployeePassword(
    employeeLoginPage: EmployeeLoginPage,
    homePage: HomePage,
    password: string,
  ): Promise<HomePage> {
    try {
      await employeeLoginPage.expectVisible();
    } catch (error) {
      if (await homePage.isPrimaryFunctionCardsVisible().catch(() => false)) {
        await homePage.expectPrimaryFunctionCardsVisible();
        return homePage;
      }

      throw error;
    }
    await employeeLoginPage.fillPassword(password);
    await employeeLoginPage.clickConfirm();
    await homePage.expectLoaded();

    return homePage;
  }

  @step('业务步骤：输入员工口令11并进入首页')
  async enterEmployeeContext(
    homePage: HomePage,
    employeeLoginPage: EmployeeLoginPage,
    password = '11',
  ): Promise<HomePage> {
    const entryState = await waitUntil(
      async (): Promise<EmployeeEntryState> => {
        if (await employeeLoginPage.isVisible().catch(() => false)) {
          return 'employee-login';
        }

        if (await homePage.isPrimaryFunctionCardsVisible().catch(() => false)) {
          return 'home-ready';
        }

        return 'pending';
      },
      (state) => state !== 'pending',
      {
        timeout: 10_000,
        interval: 500,
        probeTimeout: 2_000,
        message: 'POS employee entry state did not become ready.',
      },
    );

    if (entryState === 'employee-login') {
      return await this.enterWithEmployeePassword(employeeLoginPage, homePage, password);
    }

    await homePage.expectPrimaryFunctionCardsVisible();
    return homePage;
  }
}
