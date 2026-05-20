import { expect, test } from '@playwright/test';
import { HomePage } from '../../pages/home.page';

const homeFrameFixtureHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button" data-testid="pos-ui-function-card-dine_in">Dine In</button>
    <button type="button" id="home-refresh-button" data-testid="icon-button-refresh">
      <span class="_button__icon_qxjvm_520">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="RefreshIcon"
          role="img"
          class="_icon_3uhhx_210"
        >
          <path
            d="M4.87115 14.5C5.88914 17.6939 8.80464 20 12.2424 20C16.5268 20 20 16.4183 20 12C20 7.58172 16.5268 4 12.2424 4C9.37103 4 6.86399 5.60879 5.52267 8M4.87115 7.21845L5.93971 8.25008M7.87879 9H4V5L7.87879 9Z"
            stroke="currentColor"
            stroke-opacity="0.88"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ></path>
        </svg>
      </span>
    </button>
    <div id="refresh-result">version-1</div>

    <script>
      (() => {
        const refreshButton = document.querySelector('#home-refresh-button');
        const loading = window.parent.document.getElementById('floatmsgbx');
        const result = document.querySelector('#refresh-result');
        let refreshCount = 0;

        refreshButton.addEventListener('click', () => {
          refreshButton.setAttribute('disabled', '');
          if (loading) {
            loading.hidden = false;
          }

          window.setTimeout(() => {
            refreshCount += 1;
            result.textContent = 'version-' + (refreshCount + 1);
            if (loading) {
              loading.hidden = true;
            }
            refreshButton.removeAttribute('disabled');
          }, 200);
        });
      })();
    </script>
  </body>
</html>
`;

const homeFrameWithDelayedToGoReadyHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button" data-testid="pos-ui-function-card-dine_in">Dine In</button>
    <button type="button" data-testid="pos-ui-function-card-togo">To Go</button>
    <button type="button" id="home-refresh-button" data-testid="icon-button-refresh">
      <span class="_button__icon_qxjvm_520">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="RefreshIcon"
          role="img"
          class="_icon_3uhhx_210"
        >
          <path
            d="M4.87115 14.5C5.88914 17.6939 8.80464 20 12.2424 20C16.5268 20 20 16.4183 20 12C20 7.58172 16.5268 4 12.2424 4C9.37103 4 6.86399 5.60879 5.52267 8M4.87115 7.21845L5.93971 8.25008M7.87879 9H4V5L7.87879 9Z"
            stroke="currentColor"
            stroke-opacity="0.88"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ></path>
        </svg>
      </span>
    </button>
    <div id="refresh-result">version-1-ready</div>

    <script>
      (() => {
        const refreshButton = document.querySelector('#home-refresh-button');
        const toGoButton = document.querySelector('[data-testid="pos-ui-function-card-togo"]');
        const loading = window.parent.document.getElementById('floatmsgbx');
        const result = document.querySelector('#refresh-result');
        let refreshCount = 0;
        let toGoReady = true;

        toGoButton?.addEventListener('click', () => {
          if (!toGoReady) {
            return;
          }

          window.top.location.hash = '#orderDishes';
        });

        refreshButton?.addEventListener('click', () => {
          refreshButton.setAttribute('disabled', '');
          toGoReady = false;

          if (loading) {
            loading.hidden = false;
          }

          window.setTimeout(() => {
            refreshCount += 1;
            result.textContent = 'version-' + (refreshCount + 2) + '-refresh-finished';
            if (loading) {
              loading.hidden = true;
            }
            refreshButton.removeAttribute('disabled');
          }, 100);

          window.setTimeout(() => {
            toGoReady = true;
            result.textContent = 'version-' + (refreshCount + 2) + '-ready';
          }, 350);
        });
      })();
    </script>
  </body>
</html>
`;

const homeFrameWithStableHeaderButtonsOnlyHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button" data-testid="pos-ui-theme-toggle">Theme</button>
    <button
      type="button"
      data-testid="icon-button-language"
      data-test-id="shared-language-switcher-dropdown-trigger"
      aria-label="language"
    >
      Language
    </button>
    <button type="button" data-testid="icon-button-support" aria-label="support">Support</button>
    <button type="button" data-testid="icon-button-refresh" aria-label="refresh">Refresh</button>
    <button type="button" data-testid="icon-button-exit" aria-label="exit">Exit</button>
  </body>
</html>
`;

const homeFrameWithTextOnlyPickUpEntryHtml = String.raw`
<!DOCTYPE html>
<html lang="en">
  <body>
    <button type="button" id="pick-up-entry">Pick Up</button>

    <script>
      (() => {
        const pickUpEntry = document.querySelector('#pick-up-entry');

        pickUpEntry?.addEventListener('click', () => {
          document.body.innerHTML = [
            '<input placeholder="Phone number" />',
            '<input placeholder="Name" />',
            '<input placeholder="Note" />',
            '<button type="button" data-testid="button-default">Start Order</button>',
          ].join('');
        });
      })();
    </script>
  </body>
</html>
`;

test.describe('主页刷新契约', () => {
  test(
    '主页核心可用信号应基于固定头部按钮而非可配置菜单项',
    {},
    async ({ page }) => {
      await test.step('准备仅包含固定头部按钮的主页骨架', async () => {
        await page.setContent(`
          <!DOCTYPE html>
          <html lang="en">
            <body>
              <div id="floatmsgbx" hidden>Loading...</div>
              <div id="newLoginContainer">
                <iframe></iframe>
              </div>
            </body>
          </html>
        `);
        await page.locator('#newLoginContainer iframe').evaluate((iframe, content) => {
          iframe.setAttribute('srcdoc', content as string);
        }, homeFrameWithStableHeaderButtonsOnlyHtml);
      });

      const homePage = new HomePage(page);

      await test.step('当前主页就绪判断不应再依赖 Pick Up、Report、Admin、Recall 等灵活菜单', async () => {
        await homePage.expectPrimaryFunctionCardsVisible();
      });
    },
  );

  test(
    '应能通过按钮名称识别没有 data-testid 的 Pick Up 入口',
    {},
    async ({ page }) => {
      await test.step('准备仅通过按钮名称暴露 Pick Up 入口的主页骨架', async () => {
        await page.setContent(`
          <!DOCTYPE html>
          <html lang="en">
            <body>
              <div id="floatmsgbx" hidden>Loading...</div>
              <div id="newLoginContainer">
                <iframe></iframe>
              </div>
            </body>
          </html>
        `);
        await page.locator('#newLoginContainer iframe').evaluate((iframe, content) => {
          iframe.setAttribute('srcdoc', content as string);
        }, homeFrameWithTextOnlyPickUpEntryHtml);
      });

      const homePage = new HomePage(page);

      await test.step('点击 Pick Up 后仍应进入 Pick Up 信息页', async () => {
        const pickUpPage = await homePage.enterPickUp();
        await pickUpPage.expectVisible();
      });
    },
  );

  test(
    '应能点击主页刷新按钮并等待刷新完成',
    {},
    async ({ page }) => {
      await test.step('准备包含 RefreshIcon 按钮的主页骨架', async () => {
        await page.setContent(`
          <!DOCTYPE html>
          <html lang="en">
            <body>
              <div id="floatmsgbx" hidden>Loading...</div>
              <div id="newLoginContainer">
                <iframe></iframe>
              </div>
            </body>
          </html>
        `);
        await page.locator('#newLoginContainer iframe').evaluate((iframe, content) => {
          iframe.setAttribute('srcdoc', content as string);
        }, homeFrameFixtureHtml);
      });

      const homePage = new HomePage(page);

      await test.step('点击刷新按钮并等待主页刷新完成', async () => {
        await homePage.clickRefresh();
      });

      await test.step('确认刷新结果已完成落地', async () => {
        const appFrame = page.frameLocator('#newLoginContainer iframe');
        await expect(page.locator('#floatmsgbx')).toBeHidden();
        await expect(appFrame.locator('#refresh-result')).toHaveText('version-2');
        await expect(appFrame.locator('#home-refresh-button')).toBeEnabled();
      });
    },
  );

  test(
    '刷新后应等待 To Go 入口恢复跳转能力再进入点单页',
    {},
    async ({ page }) => {
      await test.step('准备刷新完成早于 To Go 跳转恢复的主页骨架', async () => {
        await page.setContent(`
          <!DOCTYPE html>
          <html lang="en">
            <body>
              <div id="floatmsgbx" hidden>Loading...</div>
              <div id="newLoginContainer">
                <iframe></iframe>
              </div>
            </body>
          </html>
        `);
        await page.locator('#newLoginContainer iframe').evaluate((iframe, content) => {
          iframe.setAttribute('srcdoc', content as string);
        }, homeFrameWithDelayedToGoReadyHtml);
      });

      const homePage = new HomePage(page);

      await test.step('主页刷新后立即进入 To Go，仍应最终跳转到点单页', async () => {
        await homePage.clickRefresh();
        await homePage.clickToGo();
      });

      await test.step('确认页面最终进入点单页 URL', async () => {
        await expect(page).toHaveURL(/#orderDishes/);
      });
    },
  );
});
