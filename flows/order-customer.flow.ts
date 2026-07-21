import type { OrderDishesPage } from '../pages/order-dishes.page';
import type { OrderDishesCustomerInformationInput } from '../pages/order-dishes/order-dishes-customer.section';
import type { PaymentPage } from '../pages/payment.page';
import { step } from '../utils/step';

export type RequiredCustomerInformation = {
  name: string;
  phone: string;
};

export type AddOrderCustomerInformationParams = OrderDishesCustomerInformationInput & {
  customerButtonLabel: string;
};

export class OrderCustomerFlow {
  @step(
    (_orderDishesPage: OrderDishesPage, customer: AddOrderCustomerInformationParams) =>
      `业务步骤：在点单页添加客户信息 ${customer.customerName} 并读取保存结果`,
  )
  async addCustomerInformationToOrder(
    orderDishesPage: OrderDishesPage,
    customer: AddOrderCustomerInformationParams,
  ): Promise<string> {
    await orderDishesPage.openEmptyCustomerInformation();
    await orderDishesPage.fillCustomerInformation(customer);
    await orderDishesPage.saveCustomerInformationPage();
    return await orderDishesPage.readCustomerButtonText(customer.customerButtonLabel);
  }

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
