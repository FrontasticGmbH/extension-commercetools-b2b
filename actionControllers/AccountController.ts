import { Address } from '@Types/account/Address';

export * from './BaseAccountController';

export type AccountRegisterBody = {
  email?: string;
  confirmed?: boolean;
  password?: string;
  salutation?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  birthdayYear?: string;
  birthdayMonth?: string;
  birthdayDay?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
};

type AccountLoginBody = {
  email?: string;
  password?: string;
  businessUnitKey?: string;
};
