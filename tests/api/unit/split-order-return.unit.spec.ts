import { expect, test } from '@playwright/test';
import {
  classifySplitOrderReturnUrl,
  isSplitOrderReturnStateSettled,
} from '../../../pages/split-order.page';

test.describe('分单返回页面识别契约', () => {
  test('应识别 POS 主页', () => {
    expect(
      classifySplitOrderReturnUrl(
        'http://192.168.247:22080/kpos/front/myhome.html',
      ),
    ).toBe('home');
  });

  test('应识别 Recall 页面', () => {
    expect(
      classifySplitOrderReturnUrl(
        'http://192.168.247:22080/kpos/front/myhome.html#recall',
      ),
    ).toBe('recall');
  });

  test('应识别 Order Dishes 页面', () => {
    expect(
      classifySplitOrderReturnUrl(
        'http://192.168.247:22080/kpos/front/myhome.html#orderDishes',
      ),
    ).toBe('orderDishes');
  });

  test('不得将未知页面默认为主页', () => {
    expect(
      classifySplitOrderReturnUrl(
        'http://192.168.247:22080/kpos/front/myhome.html#inventory',
      ),
    ).toBeNull();
  });

  test('不得把分单关闭后仍停留在原点单 URL 的过渡态判定为返回完成', () => {
    const orderDishesUrl =
      'http://192.168.247:22080/kpos/front/myhome.html#orderDishes';

    expect(
      isSplitOrderReturnStateSettled(
        orderDishesUrl,
        orderDishesUrl,
        true,
      ),
    ).toBe(false);
  });

  test('分单面板关闭且进入主页时应判定返回完成', () => {
    expect(
      isSplitOrderReturnStateSettled(
        'http://192.168.247:22080/kpos/front/myhome.html#orderDishes',
        'http://192.168.247:22080/kpos/front/myhome.html',
        true,
      ),
    ).toBe(true);
  });
});
