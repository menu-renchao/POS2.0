import { expect } from '@playwright/test';
import { test } from '../../fixtures/test.fixture';
import { buildOrderServicePhysicalGiftCardCase } from '../../test-data/order-service';
import { jiraIssueAnnotation } from '../../utils/jira';

test.describe('礼品卡实体卡管理', () => {
  test(
    '[POS-34106] 应能输入正确手机号并新建实体礼品卡',
    {
      annotation: [jiraIssueAnnotation('POS-34106')],
    },
    async ({
      employeeLoginPage,
      giftCardApi,
      giftCardFlow,
      homeFlow,
      homePage,
    }) => {
      const giftCard = buildOrderServicePhysicalGiftCardCase();
      let saveSucceeded = false;

      try {
        const readyHomePage = await test.step('进入 POS 主页并建立员工上下文', async () => {
          return await homeFlow.openHomeWithEmployeeContext(
            homePage,
            employeeLoginPage,
          );
        });

        const giftCardPage = await test.step('从主页进入礼品卡管理页面', async () => {
          return await readyHomePage.enterGiftCard();
        });

        const result = await test.step('新增实体礼品卡并读取保存请求', async () => {
          return await giftCardFlow.createPhysicalCard(giftCardPage, giftCard);
        });
        saveSucceeded = result.save.status === 200;

        await test.step('校验手机号格式化和礼品卡保存请求', async () => {
          expect(result.form).toEqual({
            cardNumber: giftCard.cardNumber,
            customerName: giftCard.customerName,
            phoneNumber: giftCard.expectedPhoneNumber,
          });
          expect(result.save.requestBody).toContain('SaveGiftCardType');
          expect(result.save.requestBody).toContain(giftCard.cardNumber);
          expect(result.save.requestBody).toContain(giftCard.customerName);
          expect(result.save.requestBody).toContain(giftCard.phoneNumber);
          expect(result.save.requestBody).toContain('PHYISCAL');

          const networkError = await giftCardPage.readNetworkErrorMessage();
          expect(
            result.save.status,
            `礼品卡保存接口应成功，当前页面提示：${networkError ?? '无'}`,
          ).toBe(200);
        });
      } finally {
        if (saveSucceeded) {
          const cleanupResponse = await giftCardApi.deleteCard(giftCard.cardNumber);
          expect(cleanupResponse.ok(), '实体礼品卡测试数据应按卡号清理成功').toBe(true);
        }
      }
    },
  );
});
