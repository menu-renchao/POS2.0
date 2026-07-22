import { EmployeeLoginPage } from '../pages/employee-login.page';
import { HomePage } from '../pages/home.page';
import { step } from '../utils/step';
import { EmployeeLoginFlow } from './employee-login.flow';

export class HomeFlow {
  @step('业务步骤：打开首页并确认首页完成加载')
  async openHome(homePage: HomePage): Promise<void> {
    await homePage.goto();
    await homePage.expectLoaded();
  }

  @step('业务步骤：打开首页并建立员工上下文')
  async openHomeWithEmployeeContext(
    homePage: HomePage,
    employeeLoginPage: EmployeeLoginPage,
    password = '11',
  ): Promise<HomePage> {
    await this.openHome(homePage);
    return await new EmployeeLoginFlow().enterEmployeeContext(homePage, employeeLoginPage, password);
  }

  @step('业务步骤：刷新系统配置后建立员工上下文')
  async openHomeAfterConfigurationRefreshWithEmployeeContext(
    homePage: HomePage,
    employeeLoginPage: EmployeeLoginPage,
    password = '11',
  ): Promise<HomePage> {
    await this.openHome(homePage);
    await homePage.clickRefresh();
    await homePage.confirmDelayedConfigurationRefresh();
    return await new EmployeeLoginFlow().enterEmployeeContext(homePage, employeeLoginPage, password);
  }
}
