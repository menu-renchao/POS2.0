import { HomePage } from '../pages/home.page';
import { step } from '../utils/step';

export class HomeFlow {
  @step('业务步骤：打开首页并确认首页完成加载')
  async openHome(homePage: HomePage): Promise<void> {
    await homePage.goto();
    await homePage.expectLoaded();
  }
}

export async function openHome(homePage: HomePage): Promise<void> {
  const homeFlow = new HomeFlow();
  await homeFlow.openHome(homePage);
}
