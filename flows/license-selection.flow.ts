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
    const licenses = await licenseSelectionPage.readLicenseRecords();
    const availableLicense = licenses.find(
      (license) => license.type === type && license.status === 'Not in use',
    );

    if (!availableLicense) {
      throw new Error(`未找到类型为 ${type} 且未占用的 License。`);
    }

    await licenseSelectionPage.selectLicenseByName(availableLicense.name);
    await licenseSelectionPage.clickEnter();

    return homePage;
  }
}
