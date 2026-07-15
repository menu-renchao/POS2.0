import type { ApiRequestData } from '../../api/clients/client-path';
import { createShortTestName } from '../../api/core/test-data-id';

export type RestrictedVoidEmployeeSeed = {
  name: string;
  passcode: string;
  request: ApiRequestData;
};

export function buildRestrictedVoidEmployeeSeed(): RestrictedVoidEmployeeSeed {
  const timestamp = Date.now().toString();
  const name = createShortTestName({
    prefix: 'AT',
    domain: 'VOID',
    maxLength: 16,
    seed: timestamp.slice(-6),
  });
  const passcode = `8${timestamp.slice(-7)}`;

  return {
    name,
    passcode,
    request: {
      staff: {
        name,
        lastName: '',
        active: true,
        requireClockInOut: false,
        requireCashInOut: false,
        requireInputCashTips: false,
        user: {
          passcode,
          roleIds: [3],
          roles: [{ id: 3 }],
          functionIds: [],
          functions: [],
        },
      },
    },
  };
}
