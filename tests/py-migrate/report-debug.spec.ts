import { test } from '../../fixtures/test.fixture';
import { EmployeeLoginFlow } from '../../flows/employee-login.flow';
import { HomeFlow } from '../../flows/home.flow';
import { OrderDishesFlow } from '../../flows/order-dishes.flow';
import { SelectTableFlow } from '../../flows/select-table.flow';
import { orderServiceDishes } from '../../test-data/order-service';
import { waitForInputSettled } from '../../utils/input-stability';
import { waitUntil } from '../../utils/wait';

test('调试报表页面真实 DOM 契约', async ({ employeeLoginPage, homePage, page }) => {
  test.setTimeout(60_000);
  await page.route('**/api/cloud-report-service/commonInterface', async (route) => {
    const requestBody = route.request().postData() ?? '';
    if (requestBody.includes('68622c296ada5ea7c3f17411')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          reportData: {
            serviceData: {
              success: true,
              message: [{ lastUpdateTime: '2026-07-23T20:00:00.000Z' }],
            },
          },
        }),
      });
      return;
    }

    await route.continue();
  });

  page.on('request', (request) => {
    if (/commonInterface|lastUpdate|sync/i.test(request.url())) {
      console.log(
        JSON.stringify({
          requestBody: request.postData(),
          requestMethod: request.method(),
          requestUrl: request.url(),
        }),
      );
    }
  });

  page.on('response', async (response) => {
    if (!/menusifucloudqa|report/i.test(response.url())) {
      return;
    }

    const contentType = response.headers()['content-type'] ?? '';
    const body =
      /json|text/.test(contentType) || response.status() >= 400
        ? await response.text().catch(() => '')
        : '';
    console.log(
      JSON.stringify({
        responseBody: body.slice(0, 5_000),
        responseStatus: response.status(),
        responseUrl: response.url(),
      }),
    );
  });

  const readyHomePage = await new HomeFlow().openHomeWithEmployeeContext(
    homePage,
    employeeLoginPage,
  );
  await readyHomePage.enterReport();

  if (await employeeLoginPage.isVisible()) {
    await new EmployeeLoginFlow().enterWithEmployeePassword(
      employeeLoginPage,
      homePage,
      '11',
    );
  }

  const reportPasscodeInput = page.getByTestId('pos-ui-password-input-hidden-input');
  if (await reportPasscodeInput.isVisible().catch(() => false)) {
    await reportPasscodeInput.fill('11');
    await waitForInputSettled(reportPasscodeInput);
    await page.getByRole('button', { name: 'confirm' }).click();
  }

  await waitUntil(
    async () =>
      await Promise.all(
        page.frames().map(async (frame) => ({
          bodyText: await frame.locator('body').innerText().catch(() => ''),
          url: frame.url(),
        })),
      ),
    (frames) =>
      frames.some(
        (frame) => /report|ecard|cloud/i.test(frame.url) && frame.bodyText.trim().length > 100,
      ),
    {
      timeout: 30_000,
      interval: 500,
      message: '报表页面 iframe 未加载。',
    },
  );
  console.log(
    JSON.stringify(
      {
        frames: page.frames().map((frame) => ({
          name: frame.name(),
          url: frame.url(),
        })),
        url: page.url(),
      },
      null,
      2,
    ),
  );

  for (const frame of page.frames()) {
    const bodyText = await frame.locator('body').innerText().catch(() => '');
    console.log(
      JSON.stringify(
        {
          bodyText: bodyText.slice(0, 10_000),
          frameName: frame.name(),
          frameUrl: frame.url(),
        },
        null,
        2,
      ),
    );
  }
});

test('调试分单相关系统配置键', async ({ systemConfigurationApi }) => {
  const response = await systemConfigurationApi.listSystemConfigurations({
    fetchDetails: true,
    adminRequest: true,
  });
  const body = (await response.json()) as {
    data?: { systemConfiguration?: Array<Record<string, unknown>> };
  };
  console.log(
    JSON.stringify(
      (body.data?.systemConfiguration ?? []).filter((entry) =>
        /split|unsplit/i.test(JSON.stringify(entry)),
      ),
      null,
      2,
    ),
  );
});

test('调试分单菜品列表真实 DOM 契约', async ({
  apiSetup,
  employeeLoginPage,
  homePage,
  page,
}) => {
  const restore = await apiSetup.systemConfiguration.updateByName(
    'IS_SEPARATE_ITEMS_WHEN_SPLIT_ORDER',
    true,
    { verify: true },
  );

  try {
    const readyHomePage = await new HomeFlow().openHomeWithEmployeeContext(
      homePage,
      employeeLoginPage,
    );
    await readyHomePage.clickRefresh();
    const orderDishesPage = await new SelectTableFlow().enterDineInNoTableOrder(readyHomePage);
    const orderDishesFlow = new OrderDishesFlow();
    await orderDishesFlow.addRegularDish(
      orderDishesPage,
      orderServiceDishes.regular.name,
      orderServiceDishes.regular.menu,
    );
    await orderDishesFlow.addRegularDish(
      orderDishesPage,
      orderServiceDishes.test.name,
      orderServiceDishes.test.menu,
    );
    await orderDishesFlow.addRegularDish(
      orderDishesPage,
      orderServiceDishes.regular.name,
      orderServiceDishes.regular.menu,
    );

    await orderDishesPage.openSplitOrder();
    const splitFrame = page.frameLocator('#splitPanelContainer iframe');
    const dialog = splitFrame.getByRole('dialog').first();
    console.log(await dialog.innerText());
    console.log(
      JSON.stringify(
        await dialog.locator('[data-testid]').evaluateAll((elements) =>
          elements.map((element) => ({
            className: element.className,
            testId: element.getAttribute('data-testid'),
            text: element.textContent?.replace(/\s+/g, ' ').trim(),
          })),
        ),
        null,
        2,
      ),
    );
  } finally {
    await restore();
  }
});
