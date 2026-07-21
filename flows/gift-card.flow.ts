import {
  GiftCardPage,
  type GiftCardSaveExchange,
  type PhysicalGiftCardFormSnapshot,
  type PhysicalGiftCardInput,
} from '../pages/gift-card.page';
import { step } from '../utils/step';

export type PhysicalGiftCardCreateResult = {
  form: PhysicalGiftCardFormSnapshot;
  save: GiftCardSaveExchange;
};

export class GiftCardFlow {
  @step('业务步骤：填写并保存一张新的实体礼品卡')
  async createPhysicalCard(
    giftCardPage: GiftCardPage,
    input: PhysicalGiftCardInput,
  ): Promise<PhysicalGiftCardCreateResult> {
    await giftCardPage.openPhysicalCardForm();
    await giftCardPage.fillPhysicalCard(input);

    return {
      form: await giftCardPage.readPhysicalCardForm(),
      save: await giftCardPage.savePhysicalCard(),
    };
  }
}
