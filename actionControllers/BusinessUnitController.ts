import { AccountApi } from '@Commerce-commercetools/apis/AccountApi';

import { ActionContext, Request, Response } from '@frontastic/extension-types';
import { Store } from '@Types/store/Store';
import { getCurrency, getLocale } from '../utils/Request';
import { StoreApi } from '../apis/StoreApi';
import { BusinessUnitApi } from '../apis/BusinessUnitApi';
import { CartApi } from '../apis/CartApi';
import { BusinessUnitMapper } from '../mappers/BusinessUnitMapper';
import { fetchAccountFromSession } from '@Commerce-commercetools/utils/fetchAccountFromSession';
import { AccountAuthenticationError } from '@Commerce-commercetools/errors/AccountAuthenticationError';
import { Account } from '@Types/account/Account';
import handleError from '@Commerce-commercetools/utils/handleError';
import { EmailApiFactory } from '@Commerce-commercetools/utils/EmailApiFactory';
import { BaseAccountMapper } from '@Commerce-commercetools/mappers/BaseAccountMapper';
import parseRequestBody from '@Commerce-commercetools/utils/parseRequestBody';
import { Address } from '@Types/account/Address';

type ActionHook = (request: Request, actionContext: ActionContext) => Promise<Response>;

export interface BusinessUnitRequestBody {
  account: Account;
  store?: Store;
  parentBusinessUnit?: string;
  /**
   * @deprecated The accountId should be read from the account
   */
  customer: {
    accountId: string;
  };
}

interface BusinessUpdateRequestBody {
  id?: string;
  roleKeys?: string[];
  address?: Address;
  addressKey?: string;
  addressId?: string;
  name?: string;
  email?: string;
}

export const getBusinessUnits: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const account = fetchAccountFromSession(request);

  if (account === undefined) {
    throw new AccountAuthenticationError({ message: 'Not logged in.' });
  }

  const businessUnitApi = new BusinessUnitApi(
    actionContext.frontasticContext,
    getLocale(request),
    getCurrency(request),
  );

  const expandStores = request.query?.['expandStores'] === 'true';

  const businessUnits = await businessUnitApi.getBusinessUnitsForUser(account, expandStores);

  return {
    statusCode: 200,
    body: JSON.stringify(businessUnits),
    sessionData: {
      ...request.sessionData,
    },
  };
};

/**
 * @deprecated Use `getBusinessUnits` instead
 */
export const getMe: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const account = fetchAccountFromSession(request);

  if (account === undefined) {
    throw new AccountAuthenticationError({ message: 'Not logged in.' });
  }

  const organization = request.sessionData?.organization;
  let businessUnit = request.sessionData?.businessUnit ?? organization?.businessUnit;

  if (businessUnit) {
    return {
      statusCode: 200,
      body: JSON.stringify(businessUnit),
    };
  }

  if (request.sessionData?.account) {
    const businessUnitApi = new BusinessUnitApi(
      actionContext.frontasticContext,
      getLocale(request),
      getCurrency(request),
    );

    businessUnit = await businessUnitApi.getFirstRootForAssociate(account);
  }

  return {
    statusCode: 200,
    body: JSON.stringify(businessUnit),
    sessionData: {
      ...request.sessionData,
      businessUnit,
      organization: {
        ...organization,
        businessUnit,
      },
    },
  };
};

/**
 * @deprecated
 */
export const setMe: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const businessUnitApi = new BusinessUnitApi(
    actionContext.frontasticContext,
    getLocale(request),
    getCurrency(request),
  );
  const storeApi = new StoreApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));
  const data = JSON.parse(request.body);

  const businessUnit = await businessUnitApi.get(data.key, request.sessionData?.account);
  const store = businessUnit.stores?.[0]?.key ? await storeApi.get(businessUnit.stores[0].key) : undefined;
  const organization = await businessUnitApi.getOrganizationByBusinessUnit(businessUnit);
  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(businessUnit),
    sessionData: {
      ...request.sessionData,
      organization: {
        ...organization,
        businessUnit: BusinessUnitMapper.trimBusinessUnit(
          organization.businessUnit,
          request.sessionData?.account?.accountId,
        ),
      },
    },
  };

  return response;
};

export const getCompanies: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const account = fetchAccountFromSession(request);

  if (account === undefined) {
    throw new AccountAuthenticationError({ message: 'Not logged in.' });
  }

  const businessUnitApi = new BusinessUnitApi(
    actionContext.frontasticContext,
    getLocale(request),
    getCurrency(request),
  );

  const companies = await businessUnitApi.getCompaniesForUser(account);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(companies),
    sessionData: request.sessionData,
  };

  return response;
};

/**
 * @deprecated
 */
export const getOrganization: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const businessUnitApi = new BusinessUnitApi(
    actionContext.frontasticContext,
    getLocale(request),
    getCurrency(request),
  );

  const account = fetchAccountFromSession(request);

  const organization = await businessUnitApi.getOrganization(account);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify({}),
    sessionData: {
      ...request.sessionData,
      organization: {
        ...organization,
        businessUnit: BusinessUnitMapper.trimBusinessUnit(organization.businessUnit, account.accountId),
      },
    },
  };

  return response;
};

/**
 * @deprecated
 */
export const getSuperUserBusinessUnits: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const accountApi = new AccountApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));
  const customerAccount = await accountApi.getCustomerByEmail(request.query.email);
  if (customerAccount) {
    const businessUnitApi = new BusinessUnitApi(
      actionContext.frontasticContext,
      getLocale(request),
      getCurrency(request),
    );
    const results = await businessUnitApi.getCommercetoolsBusinessUnitsForUser(customerAccount);
    const highestNodes = businessUnitApi.getRootCommercetoolsBusinessUnitsForAssociate(results, customerAccount);

    const businessUnitsWithSuperUser = highestNodes.filter((bu) =>
      BusinessUnitMapper.isAssociateRoleKeyInCommercetoolsBusinessUnit(bu, customerAccount.id, 'super-user'),
    );

    return {
      statusCode: 200,
      body: JSON.stringify(businessUnitsWithSuperUser),
    };
  } else {
    return {
      statusCode: 400,
      errorCode: 400,
      error: 'Customer not found',
    };
  }
};

export const getBusinessUnitOrders: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const account = fetchAccountFromSession(request);

  if (account === undefined) {
    throw new AccountAuthenticationError({ message: 'Not logged in.' });
  }

  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const key = request?.query?.['key'];
  if (!key) {
    throw new Error('No key');
  }

  const orders = await cartApi.getBusinessUnitOrders(key, account);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(orders),
    sessionData: request.sessionData,
  };

  return response;
};

export const create: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const businessUnitApi = new BusinessUnitApi(
    actionContext.frontasticContext,
    getLocale(request),
    getCurrency(request),
  );
  const businessUnitRequestBody: BusinessUnitRequestBody = JSON.parse(request.body);

  const businessUnit = await businessUnitApi.createForAccountAndStore(
    businessUnitRequestBody.account,
    businessUnitRequestBody.store,
  );

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(businessUnit),
    sessionData: request.sessionData,
  };

  return response;
};

export const addAssociate: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const locale = getLocale(request);
  const emailApi = EmailApiFactory.getDefaultApi(actionContext.frontasticContext, locale);

  const businessUnitApi = new BusinessUnitApi(
    actionContext.frontasticContext,
    getLocale(request),
    getCurrency(request),
  );
  const accountApi = new AccountApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));
  const addUserBody: { email: string; roleKeys: string[] } = JSON.parse(request.body);

  let account = await accountApi.getAccountByEmail(addUserBody.email);
  if (!account) {
    const accountData = {
      email: addUserBody.email,
      password: Math.random().toString(36).slice(-8),
    };
    account = await accountApi.create(accountData);

    const passwordResetToken = await accountApi.generatePasswordResetToken(account.email);
    emailApi.sendAccountVerificationAndPasswordResetEmail(account, passwordResetToken);
  }

  const businessUnit = await businessUnitApi.update(request.query['key'], [
    {
      action: 'addAssociate',
      associate: {
        customer: {
          typeId: 'customer',
          id: account.accountId,
        },
        associateRoleAssignments: addUserBody.roleKeys.map((roleKey) => ({
          associateRole: {
            typeId: 'associate-role',
            key: roleKey,
          },
        })),
      },
    },
  ]);

  emailApi.sendWelcomeAssociateEmail(account, businessUnit);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(businessUnit),
    sessionData: request.sessionData,
  };

  return response;
};

export const removeAssociate: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const businessUnitApi = new BusinessUnitApi(
    actionContext.frontasticContext,
    getLocale(request),
    getCurrency(request),
  );

  const { accountId } = JSON.parse(request.body);

  const businessUnit = await businessUnitApi.update(request.query['key'], [
    {
      action: 'removeAssociate',
      customer: {
        typeId: 'customer',
        id: accountId,
      },
    },
  ]);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(businessUnit),
    sessionData: request.sessionData,
  };

  return response;
};

export const updateAssociate: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const businessUnitApi = new BusinessUnitApi(
    actionContext.frontasticContext,
    getLocale(request),
    getCurrency(request),
  );

  const { accountId, roleKeys }: { accountId: string; roleKeys: string[] } = JSON.parse(request.body);

  const businessUnit = await businessUnitApi.update(request.query['key'], [
    {
      action: 'changeAssociate',
      associate: {
        customer: {
          typeId: 'customer',
          id: accountId,
        },
        associateRoleAssignments: roleKeys.map((roleKey) => ({
          associateRole: {
            typeId: 'associate-role',
            key: roleKey,
          },
        })),
      },
    },
  ]);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(businessUnit),
    sessionData: request.sessionData,
  };

  return response;
};

export const updateBusinessUnit: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const businessUnitApi = new BusinessUnitApi(
    actionContext.frontasticContext,
    getLocale(request),
    getCurrency(request),
  );

  const requestData = parseRequestBody<BusinessUpdateRequestBody>(request.body);

  try {
    let businessUnit;

    if (requestData.name) {
      businessUnit = await businessUnitApi.update(request.query['key'], [
        {
          action: 'changeName',
          name: requestData.name,
        },
      ]);
    } else if (requestData.email) {
      businessUnit = await businessUnitApi.update(request.query['key'], [
        {
          action: 'setContactEmail',
          contactEmail: requestData.email,
        },
      ]);
    }

    return {
      statusCode: 200,
      body: JSON.stringify(businessUnit),
      sessionData: request.sessionData,
    };
  } catch (error) {
    return handleError(error, request);
  }
};

export const addBusinessUnitAddress: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const businessUnitApi = new BusinessUnitApi(
    actionContext.frontasticContext,
    getLocale(request),
    getCurrency(request),
  );

  const requestData = parseRequestBody<BusinessUpdateRequestBody>(request.body);

  const addressData = BaseAccountMapper.addressToCommercetoolsAddress(requestData.address);

  try {
    const businessUnit = await businessUnitApi.update(request.query['key'], [
      {
        action: 'addAddress',
        address: addressData,
      },
    ]);

    return {
      statusCode: 200,
      body: JSON.stringify(businessUnit),
      sessionData: request.sessionData,
    };
  } catch (error) {
    return handleError(error, request);
  }
};

export const updateBusinessUnitAddress: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const businessUnitApi = new BusinessUnitApi(
    actionContext.frontasticContext,
    getLocale(request),
    getCurrency(request),
  );

  const requestData = parseRequestBody<BusinessUpdateRequestBody>(request.body);

  const addressData = BaseAccountMapper.addressToCommercetoolsAddress(requestData.address);

  try {
    const businessUnit = await businessUnitApi.update(request.query['key'], [
      {
        action: 'changeAddress',
        addressId: requestData.addressId,
        addressKey: requestData.addressKey,
        address: addressData,
      },
    ]);

    return {
      statusCode: 200,
      body: JSON.stringify(businessUnit),
      sessionData: request.sessionData,
    };
  } catch (error) {
    return handleError(error, request);
  }
};

export const removeBusinessUnitAddress: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const businessUnitApi = new BusinessUnitApi(
    actionContext.frontasticContext,
    getLocale(request),
    getCurrency(request),
  );

  const requestData = parseRequestBody<BusinessUpdateRequestBody>(request.body);

  try {
    const businessUnit = await businessUnitApi.update(request.query['key'], [
      {
        action: 'removeAddress',
        addressId: requestData.addressId,
        addressKey: requestData.addressKey,
      },
    ]);

    return {
      statusCode: 200,
      body: JSON.stringify(businessUnit),
      sessionData: request.sessionData,
    };
  } catch (error) {
    return handleError(error, request);
  }
};

/**
 * @deprecated
 */
export const update: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const businessUnitApi = new BusinessUnitApi(
    actionContext.frontasticContext,
    getLocale(request),
    getCurrency(request),
  );
  const { key, actions } = JSON.parse(request.body);

  const businessUnit = await businessUnitApi.update(key, actions);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(businessUnit),
    sessionData: {
      ...request.sessionData,
      organization: {
        // TODO
        ...request.sessionData?.organization,
        businessUnit,
      },
    },
  };

  return response;
};

export const getByKey: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const businessUnitApi = new BusinessUnitApi(
    actionContext.frontasticContext,
    getLocale(request),
    getCurrency(request),
  );
  const key = request.query?.['key'];

  const account = fetchAccountFromSession(request);

  if (account === undefined) {
    throw new AccountAuthenticationError({ message: 'Not logged in.' });
  }

  try {
    const businessUnit = await businessUnitApi.get(key, account);

    return {
      statusCode: 200,
      body: JSON.stringify(businessUnit),
      sessionData: request.sessionData,
    };
  } catch (error) {
    const errorInfo = error as Error;
    return {
      statusCode: 400,
      body: JSON.stringify(errorInfo.message),
      sessionData: request.sessionData,
    };
  }
};

export const remove: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const businessUnitApi = new BusinessUnitApi(
    actionContext.frontasticContext,
    getLocale(request),
    getCurrency(request),
  );
  const key = request.query?.['key'];

  let response: Response;

  try {
    const businessUnit = await businessUnitApi.delete(key);
    response = {
      statusCode: 200,
      body: JSON.stringify(businessUnit),
      sessionData: request.sessionData,
    };
  } catch (error) {
    return handleError(error, request);
  }

  return response;
};

export const getAssociateRoles: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const businessUnitApi = new BusinessUnitApi(
    actionContext.frontasticContext,
    getLocale(request),
    getCurrency(request),
  );

  const associateRoles = await businessUnitApi.getAssociateRoles();

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(associateRoles),
    sessionData: request.sessionData,
  };

  return response;
};
