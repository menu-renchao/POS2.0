import { HomePage } from '../pages/home.page';
import { LicenseSelectionPage } from '../pages/license-selection.page';
import { step } from '../utils/step';

export class LicenseSelectionFlow {
  @step(
    (_licenseSelectionPage: LicenseSelectionPage, _homePage: HomePage, type = 'PC') =>
      `业务步骤：选择一个类型为 ${type} 的可用 License 并进入员工登录页`,
  )
  async enterWithAvailableLicense(
    licenseSelectionPage: LicenseSelectionPage,
    homePage: HomePage,
    type = 'PC',
  ): Promise<HomePage> {
    await licenseSelectionPage.expectVisible();
    await licenseSelectionPage.selectAvailableLicenseByType(type);
    await licenseSelectionPage.clickEnter();

    return homePage;
  }
}

export async function enterWithAvailableLicense(
  licenseSelectionPage: LicenseSelectionPage,
  homePage: HomePage,
  type = 'PC',
): Promise<HomePage> {
  const licenseSelectionFlow = new LicenseSelectionFlow();
  return await licenseSelectionFlow.enterWithAvailableLicense(
    licenseSelectionPage,
    homePage,
    type,
  );
}
