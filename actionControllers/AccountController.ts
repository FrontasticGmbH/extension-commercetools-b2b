import { ActionContext, Request, Response } from '@frontastic/extension-types';

export * from './BaseAccountController';

import { AccountRegisterBody as BaseAccountRegisterBody } from './BaseAccountController';
import { getCurrency, getLocale } from '@Commerce-commercetools/utils/Request';
import { AccountApi } from '@Commerce-commercetools/apis/AccountApi';
import { mapRequestToAccount } from '@Commerce-commercetools/utils/mapRequestToAccount';
import { CartFetcher } from '@Commerce-commercetools/utils/CartFetcher';
import { EmailApiFactory } from '@Commerce-commercetools/utils/EmailApiFactory';
import { BusinessUnitApi } from '@Commerce-commercetools/apis/BusinessUnitApi';
import { StoreApi } from '@Commerce-commercetools/apis/StoreApi';
import { ValidationError } from '../utils/Errors';
import { Store } from '@Types/store/Store';
import { businessUnitKeyFormatter, companyNameNormalizer } from '@Commerce-commercetools/utils/BussinessUnitFormatter';

type ActionHook = (request: Request, actionContext: ActionContext) => Promise<Response>;

export interface AccountRegisterBody extends BaseAccountRegisterBody {
  company?: string;
  confirmed?: boolean;
}

export const register: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const locale = getLocale(request);

  const accountApi = new AccountApi(actionContext.frontasticContext, locale, getCurrency(request));
  const accountData = mapRequestToAccount(request);

  if (accountData.company === undefined) {
    throw new ValidationError({ message: `The account passed doesn't contain a company.` });
  }

  const config = actionContext.frontasticContext?.project?.configuration?.associateRoles;
  if (!config?.defaultBuyerRoleKey || !config?.defaultAdminRoleKey) {
    return {
      statusCode: 400,
      error: 'No associateRoles context defined',
      errorCode: 400,
    };
  }

  // Validate if the business unit name exists using accountData.company
  const businessUnitApi = new BusinessUnitApi(
    actionContext.frontasticContext,
    getLocale(request),
    getCurrency(request),
  );

  const businessUnitKey = businessUnitKeyFormatter(accountData.company);
  try {
    const businessUnit = await businessUnitApi.getByKey(businessUnitKey);

    if (!!businessUnit) {
      return {
        statusCode: 400,
        body: `An account for the company ${accountData.company} already exists`,
        sessionData: request.sessionData,
      };
    }
  } catch (error) {
    // The company does not exist, so we can create the account for this company
  }

  const cart = await CartFetcher.fetchCart(request, actionContext);

  const account = await accountApi.create(accountData, cart);

  // Create the store for the account
  const storeApi = new StoreApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));
  const storeRequest = { ...request };
  storeRequest.body = JSON.stringify({
    account: JSON.parse(request.body),
  });

  const storeData: Store = {
    key: `store_${companyNameNormalizer(accountData.company)}`,
    name: accountData.company,
  };

  const store = await storeApi.create(storeData);

  // Create the business unit for the account
  try {
    await businessUnitApi.createForAccountAndStore(account, store, config);
  } catch (error) {
    const errorInfo = error as Error;
    return {
      statusCode: 400,
      body: JSON.stringify(errorInfo.message),
      sessionData: request.sessionData,
    };
  }

  const emailApi = EmailApiFactory.getDefaultApi(actionContext.frontasticContext, locale);

  emailApi.sendWelcomeCustomerEmail(account);

  if (!account.confirmed) {
    emailApi.sendAccountVerificationEmail(account);
  }

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(account),
    sessionData: {
      ...request.sessionData,
    },
  };

  return response;
};
