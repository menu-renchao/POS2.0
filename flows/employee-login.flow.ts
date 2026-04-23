import { EmployeeLoginPage } from '../pages/employee-login.page';
import { HomePage } from '../pages/home.page';
import { step } from '../utils/step';
import { waitUntil } from '../utils/wait';

export class EmployeeLoginFlow {
  @step('业务步骤：使用员工密码登录并进入主页')
  async enterWithEmployeePassword(
    employeeLoginPage: EmployeeLoginPage,
    homePage: HomePage,
    password: string,
  ): Promise<HomePage> {
    await employeeLoginPage.expectVisible();
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
    const employeeLoginVisible = await waitUntil(
      async () => await employeeLoginPage.isVisible().catch(() => false),
      (visible) => visible,
      {
        timeout: 5_000,
        probeTimeout: 1_000,
        message: 'Employee passcode page did not become visible.',
      },
    ).catch(() => false);

    if (employeeLoginVisible) {
      return await this.enterWithEmployeePassword(employeeLoginPage, homePage, password);
    }

    await homePage.expectLoaded();
    return homePage;
  }
}

export async function enterWithEmployeePassword(
  employeeLoginPage: EmployeeLoginPage,
  homePage: HomePage,
  password: string,
): Promise<HomePage> {
  const employeeLoginFlow = new EmployeeLoginFlow();
  return await employeeLoginFlow.enterWithEmployeePassword(
    employeeLoginPage,
    homePage,
    password,
  );
}

export async function enterEmployeeContext(
  homePage: HomePage,
  employeeLoginPage: EmployeeLoginPage,
  password = '11',
): Promise<HomePage> {
  const employeeLoginFlow = new EmployeeLoginFlow();
  return await employeeLoginFlow.enterEmployeeContext(homePage, employeeLoginPage, password);
}
