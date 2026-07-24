import { DeliveryPage } from '../pages/delivery.page';
import { EmployeeLoginPage } from '../pages/employee-login.page';
import { HomePage } from '../pages/home.page';
import { OrderDishesPage } from '../pages/order-dishes.page';
import type { OrderDishesCustomerInformationSnapshot } from '../pages/order-dishes/order-dishes-customer.section';
import { PickUpPage } from '../pages/pick-up.page';
import { step } from '../utils/step';
import { waitUntil } from '../utils/wait';
import { EmployeeLoginFlow } from './employee-login.flow';

export type PickUpOrderParams = {
  phoneNumber?: string;
  customerName?: string;
  note?: string;
};

export type DeliveryOrderParams = {
  phoneNumber?: string;
  customerName?: string;
  address: string;
  street?: string;
  zipCode?: string;
  note?: string;
};

export type DeliveryOrderWithCustomerInformationResult = {
  customerInformation: OrderDishesCustomerInformationSnapshot;
  orderCustomerSummaryText: string;
  orderDishesPage: OrderDishesPage;
};

export class TakeoutFlow {
  constructor(private readonly employeeLoginFlow: EmployeeLoginFlow) {}

  @step('业务步骤：从主页点击 To Go 并进入点单页')
  async startToGoOrder(
    homePage: HomePage,
    employeeLoginPage?: EmployeeLoginPage,
    employeePasscode = '11',
  ): Promise<OrderDishesPage> {
    if (employeeLoginPage) {
      await homePage.clickEntry('To Go');

      const passcodeRequested = await waitUntil(
        async () => await employeeLoginPage.isVisible().catch(() => false),
        (isVisible) => isVisible,
        {
          timeout: 3_000,
          interval: 100,
          message: 'To Go 入口未出现员工口令输入框。',
        },
      )
        .then(() => true)
        .catch(() => false);

      if (passcodeRequested) {
        await this.employeeLoginFlow.enterWithEmployeePassword(
          employeeLoginPage,
          homePage,
          employeePasscode,
        );
      }
    }

    return await homePage.enterToGo();
  }

  @step('业务步骤：从主页进入 Pick Up 信息页并完成开始下单')
  async startPickUpOrder(
    homePage: HomePage,
    params: PickUpOrderParams = {},
  ): Promise<OrderDishesPage> {
    const pickUpPage = await homePage.enterPickUp();
    await this.fillPickUpInformation(pickUpPage, params);

    const orderDishesPage = await pickUpPage.clickStartOrder();
    await orderDishesPage.expectLoaded();
    return orderDishesPage;
  }

  @step('业务步骤：从主页进入 Delivery 信息页并完成开始下单')
  async startDeliveryOrder(
    homePage: HomePage,
    params: DeliveryOrderParams,
  ): Promise<OrderDishesPage> {
    const deliveryPage = await homePage.enterDelivery();
    await this.fillDeliveryInformation(deliveryPage, params);

    const orderDishesPage = await deliveryPage.clickStartOrder();
    await orderDishesPage.expectLoaded();
    return orderDishesPage;
  }

  @step('业务步骤：从主页通过自定义订单类型 1 进入 Delivery 并完成开始下单')
  async startCustomDeliveryOrderType1(
    homePage: HomePage,
    employeeLoginPage: EmployeeLoginPage,
    params: DeliveryOrderParams,
    employeePasscode = '11',
  ): Promise<OrderDishesPage> {
    await homePage.clickCustomOrderType1();

    const passcodeRequested = await waitUntil(
      async () => await employeeLoginPage.isVisible().catch(() => false),
      (isVisible) => isVisible,
      {
        timeout: 3_000,
        interval: 100,
        message: '自定义订单类型入口未出现员工口令输入框。',
      },
    )
      .then(() => true)
      .catch(() => false);

    if (passcodeRequested) {
      await employeeLoginPage.fillPassword(employeePasscode);
      await employeeLoginPage.clickConfirm();
    }

    const deliveryPage = await homePage.waitForCustomOrderType1Delivery();
    await this.fillDeliveryInformation(deliveryPage, params);

    const orderDishesPage = await deliveryPage.clickStartOrder();
    await orderDishesPage.expectLoaded();
    return orderDishesPage;
  }

  @step('业务步骤：创建 Delivery 订单并读取点单页客户 Info 与保存后的摘要')
  async startDeliveryOrderWithCustomerInformationSnapshot(
    homePage: HomePage,
    params: DeliveryOrderParams,
    customerButtonLabel: string,
  ): Promise<DeliveryOrderWithCustomerInformationResult> {
    const orderDishesPage = await this.startDeliveryOrder(homePage, params);
    await orderDishesPage.customer.openCustomerInformation(customerButtonLabel);
    const customerInformation =
      await orderDishesPage.customer.readCustomerInformationSnapshot(customerButtonLabel);
    await orderDishesPage.customer.saveCustomerInformation();
    const orderCustomerSummaryText =
      await orderDishesPage.customer.readOrderCustomerSummaryText(customerButtonLabel);

    return {
      customerInformation,
      orderCustomerSummaryText,
      orderDishesPage,
    };
  }

  @step('业务步骤：按需填写 Pick Up 信息页中的可选字段')
  private async fillPickUpInformation(
    pickUpPage: PickUpPage,
    params: PickUpOrderParams,
  ): Promise<void> {
    const { phoneNumber, customerName, note } = params;

    if (phoneNumber !== undefined) {
      await pickUpPage.fillPhoneNumber(phoneNumber);
    }

    if (customerName !== undefined) {
      await pickUpPage.fillCustomerName(customerName);
    }

    if (note !== undefined) {
      await pickUpPage.fillNote(note);
    }
  }

  @step('业务步骤：按需填写 Delivery 信息页中的字段并保留地址为必填')
  private async fillDeliveryInformation(
    deliveryPage: DeliveryPage,
    params: DeliveryOrderParams,
  ): Promise<void> {
    const { phoneNumber, customerName, address, street, zipCode, note } = params;

    if (phoneNumber !== undefined) {
      await deliveryPage.fillPhoneNumber(phoneNumber);
    }

    if (customerName !== undefined) {
      await deliveryPage.fillCustomerName(customerName);
    }

    await deliveryPage.fillAddress(address);

    if (street !== undefined) {
      await deliveryPage.fillStreet(street);
    }

    if (zipCode !== undefined) {
      await deliveryPage.fillZipCode(zipCode);
    }

    if (note !== undefined) {
      await deliveryPage.fillNote(note);
    }
  }
}
