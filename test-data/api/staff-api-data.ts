import type { ApiRequestData } from '../../api/clients/client-path';
import { createShortTestName } from '../../api/core/test-data-id';

export type RestrictedVoidEmployeeSeed = {
  name: string;
  passcode: string;
  request: ApiRequestData;
};

export type RestrictedNoteEmployeeSeed = RestrictedVoidEmployeeSeed;

export function buildRestrictedVoidEmployeeSeed(): RestrictedVoidEmployeeSeed {
  return buildRestrictedEmployeeSeed('VOID', 3);
}

export function buildRestrictedNoteEmployeeSeed(
  roleId: string | number,
): RestrictedNoteEmployeeSeed {
  return buildRestrictedEmployeeSeed('NOTE', roleId);
}

function buildRestrictedEmployeeSeed(
  domain: string,
  roleId: string | number,
): RestrictedVoidEmployeeSeed {
  const timestamp = Date.now().toString();
  const name = createShortTestName({
    prefix: 'AT',
    domain,
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
          roleIds: [roleId],
          roles: [{ id: roleId }],
          functionIds: [],
          functions: [],
        },
      },
    },
  };
}
