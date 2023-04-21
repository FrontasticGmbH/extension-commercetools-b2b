export * from 'cofe-ct-b2b-ecommerce/actionControllers/AccountController';
import { Request, Response } from '@frontastic/extension-types';
import { ActionContext } from '@frontastic/extension-types';
import { AccountApi as B2BAccountApi } from 'cofe-ct-b2b-ecommerce/apis/AccountApi';
import { getLocale } from 'cofe-ct-ecommerce/utils/Request';
import { Account } from '@Types/account/Account';
import { Address } from '@commercetools/frontend-domain-types/account/Address';
import { CartFetcher } from '../utils/CartFetcher';
import { NotificationApi } from '../apis/NotificationApi';
import { BusinessUnitApi } from '../apis/BusinessUnitApi';
import { Organization } from '@Types/organization/organization';
import { BusinessUnitMapper } from '../mappers/BusinessUnitMapper';

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

async function loginAccount(
  request: Request,
  actionContext: ActionContext,
  account: Account,
  reverify = false,
  businessUnitKey = '',
) {
  const accountApi = new B2BAccountApi(actionContext.frontasticContext, getLocale(request));
  const businessUnitApi = new BusinessUnitApi(actionContext.frontasticContext, getLocale(request));
  const notificationApi = new NotificationApi(actionContext.frontasticContext, getLocale(request));

  const cart = await CartFetcher.fetchCart(request, actionContext);

  try {
    const accountRes = await accountApi.login(account, cart, reverify);
    const organization: Organization = await businessUnitApi.getOrganization(accountRes.accountId, businessUnitKey);
    const token = await notificationApi.getToken(account.email, account.password);

    return { account: accountRes, organization, token };
  } catch (e) {
    throw e;
  }
}

export const login: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const accountLoginBody: AccountLoginBody = JSON.parse(request.body);

  const loginInfo = {
    email: accountLoginBody.email,
    password: accountLoginBody.password,
  } as Account;

  let response: Response;

  try {
    const { account, organization, token } = await loginAccount(
      request,
      actionContext,
      loginInfo,
      false,
      accountLoginBody.businessUnitKey,
    );
    response = {
      statusCode: 200,
      body: JSON.stringify(account),
      sessionData: {
        ...request.sessionData,
        account,
        organization: {
          ...organization,
          businessUnit: BusinessUnitMapper.trimBusinessUnit(organization.businessUnit, account.accountId),
          superUserBusinessUnitKey: accountLoginBody.businessUnitKey,
        },
        rootCategoryId: organization.store?.storeRootCategoryId,
        notificationToken: token,
      },
    };
  } catch (e) {
    response = {
      statusCode: 400,
      // @ts-ignore
      error: e?.message,
      errorCode: 500,
    };
  }

  return response;
};
