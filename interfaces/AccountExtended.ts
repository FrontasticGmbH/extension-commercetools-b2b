import { Account } from '@Types/account/Account';

export type AccountExtended = Account & {
  isSubscribed?: boolean;
  email?: string;
  company?: string;
};
