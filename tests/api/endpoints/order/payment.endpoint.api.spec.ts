import { expect, test } from '../../support/endpoint-fixture';
import { buildPaymentRecordRequest } from '../../../../test-data/api/payment-api-data';
import { expectApiOk, expectApiRejected, expectResourceId } from '../../support/endpoint-assertions';
import { toEndpointTitle } from '../../support/endpoint-case';

const ORDER_SAVE_IDENTITY = { method: 'POST', path: '/api/order/save' } as const;
const LEGACY_PAYMENT_DELETE_IDENTITY = { method: 'DELETE', path: '/api/payment/deletePaymentRecord' } as const;
const LEGACY_PAYMENT_SAVE_IDENTITY = { method: 'POST', path: '/api/payment/savePaymentRecord' } as const;
const PAYMENT_SAVE_IDENTITY = { method: 'POST', path: '/api/payment/record/save' } as const;
const PAYMENT_DELETE_IDENTITY = { method: 'POST', path: '/api/payment/record/delete' } as const;

test.describe('订单支付 endpoint', () => {
  test(
    toEndpointTitle(PAYMENT_SAVE_IDENTITY.method, PAYMENT_SAVE_IDENTITY.path, '应能保存支付记录'),
    async ({ endpointResources }) => {
      const order = await test.step(
        toEndpointTitle(ORDER_SAVE_IDENTITY.method, ORDER_SAVE_IDENTITY.path, '先创建订单用于支付'),
        async () => await endpointResources.createOrderResource(),
      );
      const payment = await test.step(
        toEndpointTitle(PAYMENT_SAVE_IDENTITY.method, PAYMENT_SAVE_IDENTITY.path, '保存支付记录并登记清理'),
        async () => await endpointResources.createPaymentRecordResource(order.id),
      );

      expect(payment.id).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(PAYMENT_SAVE_IDENTITY.method, PAYMENT_SAVE_IDENTITY.path, '缺少订单 ID 应返回异常'),
    async ({ paymentApi }) => {
      await test.step(
        toEndpointTitle(PAYMENT_SAVE_IDENTITY.method, PAYMENT_SAVE_IDENTITY.path, '提交空支付记录并校验拒绝响应'),
        async () => {
          await expectApiRejected(await paymentApi.saveRecord({}), PAYMENT_SAVE_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(PAYMENT_DELETE_IDENTITY.method, PAYMENT_DELETE_IDENTITY.path, '应能删除本次创建的支付记录'),
    async ({ endpointResources, paymentApi, resourceRegistry }) => {
      const order = await test.step(
        toEndpointTitle(ORDER_SAVE_IDENTITY.method, ORDER_SAVE_IDENTITY.path, '先创建订单用于支付删除'),
        async () => await endpointResources.createOrderResource(),
      );
      const payment = await test.step(
        toEndpointTitle(PAYMENT_SAVE_IDENTITY.method, PAYMENT_SAVE_IDENTITY.path, '先保存支付记录用于删除'),
        async () => await endpointResources.createPaymentRecordResource(order.id),
      );

      await test.step(
        toEndpointTitle(PAYMENT_DELETE_IDENTITY.method, PAYMENT_DELETE_IDENTITY.path, '删除支付记录并校验响应'),
        async () => {
          await expectApiOk(
            await paymentApi.deleteRecord({
              id: payment.id,
              paymentRecordId: payment.id,
              orderId: order.id,
              reason: 'API_AUTOMATION_ENDPOINT',
            }),
            PAYMENT_DELETE_IDENTITY,
          );
        },
      );

      expect(resourceRegistry.markCleaned('payment', payment.id)).toBe(true);
    },
  );

  test(
    toEndpointTitle(PAYMENT_DELETE_IDENTITY.method, PAYMENT_DELETE_IDENTITY.path, '缺少支付记录 ID 应返回异常'),
    async ({ paymentApi }) => {
      await test.step(
        toEndpointTitle(PAYMENT_DELETE_IDENTITY.method, PAYMENT_DELETE_IDENTITY.path, '提交空删除支付记录请求并校验拒绝响应'),
        async () => {
          await expectApiRejected(await paymentApi.deleteRecord({}), PAYMENT_DELETE_IDENTITY);
        },
      );
    },
  );

  test(
    toEndpointTitle(PAYMENT_DELETE_IDENTITY.method, PAYMENT_DELETE_IDENTITY.path, '删除不存在支付记录应返回异常'),
    async ({ paymentApi }) => {
      await test.step(
        toEndpointTitle(PAYMENT_DELETE_IDENTITY.method, PAYMENT_DELETE_IDENTITY.path, '提交不存在支付记录 ID 并校验拒绝响应'),
        async () => {
          await expectApiRejected(
            await paymentApi.deleteRecord({
              id: 2147483647,
              paymentRecordId: 2147483647,
              orderId: 2147483647,
              reason: 'API_AUTOMATION_INVALID_PAYMENT',
            }),
            PAYMENT_DELETE_IDENTITY,
          );
        },
      );
    },
  );

  test(
    toEndpointTitle(LEGACY_PAYMENT_SAVE_IDENTITY.method, LEGACY_PAYMENT_SAVE_IDENTITY.path, '应能通过旧版接口保存支付记录'),
    async ({ endpointResources, paymentApi, resourceRegistry }) => {
      const order = await test.step(
        toEndpointTitle(ORDER_SAVE_IDENTITY.method, ORDER_SAVE_IDENTITY.path, '先创建订单用于旧版支付保存'),
        async () => await endpointResources.createOrderResource(),
      );
      const request = buildPaymentRecordRequest(order.id);
      const body = await test.step(
        toEndpointTitle(LEGACY_PAYMENT_SAVE_IDENTITY.method, LEGACY_PAYMENT_SAVE_IDENTITY.path, '保存支付记录并登记清理'),
        async () => await expectApiOk(await paymentApi.savePaymentRecord(request), LEGACY_PAYMENT_SAVE_IDENTITY),
      );
      const paymentId = expectResourceId(body, LEGACY_PAYMENT_SAVE_IDENTITY);

      resourceRegistry.register({
        type: 'payment',
        id: paymentId,
        cleanupPriority: 90,
        cleanup: () =>
          paymentApi.deleteRecord({
            id: paymentId,
            paymentRecordId: paymentId,
            orderId: order.id,
            reason: 'API_AUTOMATION_CLEANUP',
          }),
      });

      expect(paymentId).not.toBeUndefined();
    },
  );

  test(
    toEndpointTitle(LEGACY_PAYMENT_DELETE_IDENTITY.method, LEGACY_PAYMENT_DELETE_IDENTITY.path, '应能通过旧版接口删除支付记录'),
    async ({ endpointResources, paymentApi, resourceRegistry }) => {
      const order = await test.step(
        toEndpointTitle(ORDER_SAVE_IDENTITY.method, ORDER_SAVE_IDENTITY.path, '先创建订单用于旧版支付删除'),
        async () => await endpointResources.createOrderResource(),
      );
      const payment = await test.step(
        toEndpointTitle(PAYMENT_SAVE_IDENTITY.method, PAYMENT_SAVE_IDENTITY.path, '先保存支付记录用于旧版删除'),
        async () => await endpointResources.createPaymentRecordResource(order.id),
      );

      await test.step(
        toEndpointTitle(LEGACY_PAYMENT_DELETE_IDENTITY.method, LEGACY_PAYMENT_DELETE_IDENTITY.path, '删除支付记录并校验响应'),
        async () => {
          await expectApiOk(
            await paymentApi.deletePaymentRecord(undefined, {
              id: payment.id,
              paymentRecordId: payment.id,
              orderId: order.id,
              reason: 'API_AUTOMATION_ENDPOINT',
            }),
            LEGACY_PAYMENT_DELETE_IDENTITY,
          );
        },
      );

      expect(resourceRegistry.markCleaned('payment', payment.id)).toBe(true);
    },
  );
});
