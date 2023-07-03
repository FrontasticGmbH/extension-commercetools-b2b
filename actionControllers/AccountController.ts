export * from './BaseAccountController';

import {
  AccountRegisterBody as BaseAccountRegisterBody,
  AccountLoginBody as BaseAccountLoginBody,
} from './BaseAccountController';

export interface AccountRegisterBody extends BaseAccountRegisterBody {
  company?: string;
}

export interface AccountLoginBody extends BaseAccountLoginBody {
  businessUnitKey?: string;
}
