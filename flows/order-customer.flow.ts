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
    await orderDishesPage.customer.openEmptyCustomerInformation();
    await orderDishesPage.customer.fillCustomerInformation(customer);
    await orderDishesPage.customer.saveCustomerInformationPage();
    return await orderDishesPage.customer.readCustomerButtonText(customer.customerButtonLabel);
  }

  @step('业务步骤：校验支付前客户姓名和电话必填并提交完整信息')
  async validateRequiredInformationAndOpenPayment(
    orderDishesPage: OrderDishesPage,
    customer: RequiredCustomerInformation,
  ): Promise<PaymentPage> {
    await orderDishesPage.customer.openCustomerDialogForPayment();
    await orderDishesPage.customer.confirmEmptyCustomerAndExpectNameRequired();
    await orderDishesPage.customer.fillCustomerName(customer.name);
    await orderDishesPage.customer.confirmCustomerNameAndExpectPhoneRequired();
    await orderDishesPage.customer.fillCustomerPhone(customer.phone);
    return await orderDishesPage.customer.confirmCustomerAndOpenPayment();
  }
}
