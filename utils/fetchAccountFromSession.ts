import { Request } from '@frontastic/extension-types';
import { Account } from '@Types/account/Account';

export function fetchAccountFromSession(request: Request): Account | undefined {
  if (request.sessionData?.account !== undefined) {
    return request.sessionData.account;
  }

  return undefined;
}
