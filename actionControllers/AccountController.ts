export * from './BaseAccountController';

import { AccountRegisterBody as BaseAccountRegisterBody } from './BaseAccountController';

export interface AccountRegisterBody extends BaseAccountRegisterBody {
  company?: string;
  confirmed?: boolean;
}
