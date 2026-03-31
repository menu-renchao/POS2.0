import { expect } from '@playwright/test';
import { openHome } from '../../flows/home.flow';
import { test } from '../../fixtures/test.fixture';

test.describe('license selection smoke', () => {
  test('default selection should pick a PC license that is not in use', async ({
    homePage,
    licenseSelectionPage,
  }) => {
    await openHome(homePage);

    const selectedLicense = await licenseSelectionPage.selectAvailableLicenseByType();

    expect(selectedLicense.type).toBe('PC');
    expect(selectedLicense.status).toBe('Not in use');
    await expect(licenseSelectionPage.licenseInput).toHaveValue(selectedLicense.name);
  });

  test('submitting an available Android license should show the known mismatch error', async ({
    homePage,
    licenseSelectionPage,
    page,
  }) => {
    await openHome(homePage);

    const selectedLicense = await licenseSelectionPage.selectAvailableLicenseByType('Android');
    await licenseSelectionPage.clickEnter();

    expect(selectedLicense.type).toBe('Android');
    await expect(page.getByText(/License type mismatch/)).toBeVisible();
  });
});
