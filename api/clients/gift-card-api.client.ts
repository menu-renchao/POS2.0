import type { APIRequestContext, APIResponse } from '@playwright/test';
import { toApiClientPath } from './client-path';

export class GiftCardApiClient {
  constructor(private readonly request: APIRequestContext) {}

  deleteCard(cardNumber: string): Promise<APIResponse> {
    return this.request.delete(toApiClientPath('/api/ecard/cards/delete'), {
      data: { cardNumber },
    });
  }
}
