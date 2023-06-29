import { AccountAuthenticationError } from '@Commerce-commercetools/errors/AccountAuthenticationError';
import { ActionContext, Request, Response } from '@frontastic/extension-types';
import { AccountApi } from '../apis/AccountApi';
import { getCurrency, getLocale } from '../utils/Request';
import { CartFetcher } from '../utils/CartFetcher';
import { EmailApiFactory } from '../utils/EmailApiFactory';
import { Address } from '@Types/account/Address';
import { Account } from '@Types/account/Account';
import { ExternalError } from '@Commerce-commercetools/utils/Errors';

export * from './BaseAccountController';

type ActionHook = (request: Request, actionContext: ActionContext) => Promise<Response>;

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

async function loginAccount(request: Request, actionContext: ActionContext, account: Account, businessUnitKey = '') {
  const accountApi = new AccountApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const cart = await CartFetcher.fetchCart(request, actionContext);

  try {
    return await accountApi.login(account, cart);
  } catch (e) {
    throw e;
  }
}

function parseBirthday(accountRegisterBody: AccountRegisterBody): Date | undefined {
  if (accountRegisterBody.birthdayYear) {
    return new Date(
      +accountRegisterBody.birthdayYear,
      +accountRegisterBody?.birthdayMonth ?? 1,
      +accountRegisterBody?.birthdayDay ?? 1,
    );
  }

  return null;
}

function mapRequestToAccount(request: Request): Account {
  const accountRegisterBody: AccountRegisterBody = JSON.parse(request.body);

  const account: Account = {
    email: accountRegisterBody?.email,
    confirmed: accountRegisterBody?.confirmed,
    password: accountRegisterBody?.password,
    salutation: accountRegisterBody?.salutation,
    firstName: accountRegisterBody?.firstName,
    lastName: accountRegisterBody?.lastName,
    company: accountRegisterBody?.company,
    birthday: parseBirthday(accountRegisterBody),
    addresses: [],
  };

  if (accountRegisterBody.billingAddress) {
    accountRegisterBody.billingAddress.isDefaultBillingAddress = true;
    accountRegisterBody.billingAddress.isDefaultShippingAddress = !(accountRegisterBody.shippingAddress !== undefined);

    account.addresses.push(accountRegisterBody.billingAddress);
  }

  if (accountRegisterBody.shippingAddress) {
    accountRegisterBody.shippingAddress.isDefaultShippingAddress = true;
    accountRegisterBody.shippingAddress.isDefaultBillingAddress = !(accountRegisterBody.billingAddress !== undefined);

    account.addresses.push(accountRegisterBody.shippingAddress);
  }

  return account;
}

export const register: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const locale = getLocale(request);

  const accountApi = new AccountApi(actionContext.frontasticContext, locale, getCurrency(request));

  const accountData = mapRequestToAccount(request);

  const cart = await CartFetcher.fetchCart(request, actionContext).catch(() => undefined);

  try {
    const account = await accountApi.create(accountData, cart);

    const emailApi = EmailApiFactory.getDefaultApi(actionContext.frontasticContext, locale);

    emailApi.sendWelcomeCustomerEmail(account);

    emailApi.sendAccountVerificationEmail(account);

    return {
      statusCode: 200,
      body: JSON.stringify({ accountId: account.accountId }),
      sessionData: {
        ...request.sessionData,
      },
    };
  } catch (error) {
    if (error instanceof AccountAuthenticationError || error instanceof ExternalError) {
      return {
        statusCode: 400,
        sessionData: {
          ...request.sessionData,
        },
        error: error.message,
      };
    }

    return {
      statusCode: 400,
      sessionData: {
        ...request.sessionData,
      },
    };
  }
};

export const login: ActionHook = async (request, actionContext) => {
  const accountLoginBody: AccountLoginBody = JSON.parse(request.body);

  const loginInfo: Account = {
    email: accountLoginBody.email,
    password: accountLoginBody.password,
  };

  try {
    const account = await loginAccount(request, actionContext, loginInfo, accountLoginBody.businessUnitKey);
    return {
      statusCode: 200,
      body: JSON.stringify(account),
      sessionData: {
        ...request.sessionData,
        account,
      },
    };
  } catch (error) {
    if (error instanceof AccountAuthenticationError || error instanceof ExternalError) {
      return {
        statusCode: 400,
        sessionData: {
          ...request.sessionData,
        },
        error: error.message,
      };
    }

    return {
      statusCode: 400,
      sessionData: {
        ...request.sessionData,
      },
    };
  }
};

/**
 * Reset password
 */
export const reset: ActionHook = async (request, actionContext) => {
  type AccountResetBody = {
    token?: string;
    newPassword?: string;
  };

  const accountResetBody: AccountResetBody = JSON.parse(request.body);

  const accountApi = new AccountApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const newAccount = await accountApi.resetPassword(accountResetBody.token, accountResetBody.newPassword);
  newAccount.password = accountResetBody.newPassword;

  // TODO: do we need to log in the account after creation?
  // TODO: handle exception when customer can't login if email is not confirmed
  const account = await loginAccount(request, actionContext, newAccount);

  return {
    statusCode: 200,
    body: JSON.stringify(account),
    sessionData: {
      ...request.sessionData,
      account,
    },
  };
};
