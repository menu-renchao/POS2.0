import type { OrderDishesPage } from '../pages/order-dishes.page';
import type { PaymentPage } from '../pages/payment.page';
import { step } from '../utils/step';

export type RequiredCustomerInformation = {
  name: string;
  phone: string;
};

export class OrderCustomerFlow {
  @step('业务步骤：校验支付前客户姓名和电话必填并提交完整信息')
  async validateRequiredInformationAndOpenPayment(
    orderDishesPage: OrderDishesPage,
    customer: RequiredCustomerInformation,
  ): Promise<PaymentPage> {
    await orderDishesPage.openCustomerDialogForPayment();
    await orderDishesPage.confirmEmptyCustomerAndExpectNameRequired();
    await orderDishesPage.fillCustomerName(customer.name);
    await orderDishesPage.confirmCustomerNameAndExpectPhoneRequired();
    await orderDishesPage.fillCustomerPhone(customer.phone);
    return await orderDishesPage.confirmCustomerAndOpenPayment();
  }
}
