import { test } from '@playwright/test';
import { SelectTablePage } from '../../pages/select-table.page';

const selectTableFixtureHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <div>
      <header>
        <img alt="ChevronLeftIcon" />
        <div>
          <button type="button">
            <img alt="OrderIcon" />
            <span>New Order</span>
          </button>
          <button type="button">
            <img alt="RecallIcon" />
            <span>Recall</span>
          </button>
        </div>
      </header>

      <main>
        <button type="button" aria-pressed="true">Area</button>
        <button type="button" aria-label="List View">
          <img alt="List1Icon" />
        </button>
        <button type="button">A1</button>
      </main>
    </div>
  </body>
</html>
`;

test.describe('选桌页面契约', () => {
  test('应能在返回控件变为 ChevronLeftIcon 时仍识别选桌页已加载', async ({ page }) => {
    const selectTablePage = new SelectTablePage(page);

    await test.step('准备不再暴露 Back 文案的新选桌页头部结构', async () => {
      await page.setContent(selectTableFixtureHtml);
      await page.evaluate(() => {
        window.location.hash = '#tableV2';
      });
    });

    await test.step('页面对象应仍能判断选桌页加载完成', async () => {
      await selectTablePage.expectLoaded();
    });
  });
});
