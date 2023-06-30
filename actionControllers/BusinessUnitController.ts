import { AccountApi } from '@Commerce-commercetools/apis/AccountApi';

import { ActionContext, Request, Response } from '@frontastic/extension-types';
import { AccountRegisterBody } from './AccountController';
import { Store, StoreKeyReference } from '@Types/store/Store';
import { getCurrency, getLocale } from '../utils/Request';
import { StoreApi } from '../apis/StoreApi';
import { BusinessUnitApi } from '../apis/BusinessUnitApi';
import { CartApi } from '../apis/CartApi';
import { BusinessUnitMapper } from '../mappers/BusinessUnitMapper';
import { BusinessUnit, BusinessUnitStatus, BusinessUnitType, StoreMode } from '@Types/business-unit/BusinessUnit';
import { fetchAccountFromSession } from '@Commerce-commercetools/utils/fetchAccountFromSession';
import { AccountAuthenticationError } from '@Commerce-commercetools/errors/AccountAuthenticationError';

type ActionHook = (request: Request, actionContext: ActionContext) => Promise<Response>;

export interface BusinessUnitRequestBody {
  account: AccountRegisterBody;
  store?: Store;
  parentBusinessUnit?: string;
  customer: {
    accountId: string;
  };
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

  const businessUnit = await businessUnitApi.get(data.key, request.sessionData?.account?.accountId);
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
      rootCategoryId: (store as Store)?.storeRootCategoryId,
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
      rootCategoryId: organization.store?.storeRootCategoryId,
    },
  };

  return response;
};

/**
 * @deprecated
 */
export const getSuperUserBusinessUnits: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const config = actionContext.frontasticContext?.project?.configuration?.associateRoles;
  if (!config?.defaultSuperUserRoleKey) {
    throw new Error('Configuration error. No "defaultSuperUserRoleKey" exists');
  }
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
      BusinessUnitMapper.isAssociateRoleKeyInCommercetoolsBusinessUnit(
        bu,
        customerAccount.id,
        config.defaultSuperUserRoleKey,
      ),
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
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const key = request?.query?.['key'];
  if (!key) {
    throw new Error('No key');
  }

  const orders = await cartApi.getBusinessUnitOrders(key, request.sessionData?.account);

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
  const config = actionContext.frontasticContext?.project?.configuration?.associateRoles;
  if (!config?.defaultBuyerRoleKey || !config?.defaultAdminRoleKey) {
    return {
      statusCode: 400,
      error: 'No associateRoles context defined',
      errorCode: 400,
    };
  }
  const data = mapRequestToBusinessUnit(request, config);

  const store = await businessUnitApi.create(data);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(store),
    sessionData: request.sessionData,
  };

  return response;
};

export const addAssociate: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const businessUnitApi = new BusinessUnitApi(
    actionContext.frontasticContext,
    getLocale(request),
    getCurrency(request),
  );
  const accountApi = new AccountApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));
  const addUserBody: { email: string; roles: string[] } = JSON.parse(request.body);

  const account = await accountApi.getCustomerByEmail(addUserBody.email);
  if (!account) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'User not found' }),
      sessionData: request.sessionData,
    };
  }

  const businessUnit = await businessUnitApi.update(request.query['key'], [
    {
      action: 'addAssociate',
      associate: {
        customer: {
          typeId: 'customer',
          id: account.id,
        },
        associateRoleAssignments: addUserBody.roles.map((role) => ({
          associateRole: {
            typeId: 'associate-role',
            key: role,
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

export const removeAssociate: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const businessUnitApi = new BusinessUnitApi(
    actionContext.frontasticContext,
    getLocale(request),
    getCurrency(request),
  );

  const { id } = JSON.parse(request.body);

  const businessUnit = await businessUnitApi.update(request.query['key'], [
    {
      action: 'removeAssociate',
      customer: {
        typeId: 'customer',
        id,
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

  const { id, roles }: { id: string; roles: string[] } = JSON.parse(request.body);

  const businessUnit = await businessUnitApi.update(request.query['key'], [
    {
      action: 'changeAssociate',
      associate: {
        customer: {
          typeId: 'customer',
          id,
        },
        associateRoleAssignments: roles.map((role) => ({
          associateRole: {
            typeId: 'associate-role',
            key: role,
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
  try {
    const businessUnit = await businessUnitApi.getByKey(request.query?.['key']);

    const response: Response = {
      statusCode: 200,
      body: JSON.stringify(businessUnit),
      sessionData: request.sessionData,
    };

    return response;
  } catch {
    const response: Response = {
      statusCode: 400,
      // @ts-ignore
      error: new Error('Business unit not found'),
      errorCode: 400,
    };

    return response;
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
  } catch (e) {
    response = {
      statusCode: 400,
      sessionData: request.sessionData,
      // @ts-ignore
      error: e?.body?.message,
      errorCode: 500,
    };
  }

  return response;
};

export const query: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const businessUnitApi = new BusinessUnitApi(
    actionContext.frontasticContext,
    getLocale(request),
    getCurrency(request),
  );

  let where = '';
  if ('where' in request.query) {
    where += [request.query['where']];
  }
  const store = await businessUnitApi.query(where);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(store),
    sessionData: request.sessionData,
  };

  return response;
};

function mapRequestToBusinessUnit(request: Request, config: Record<string, string>): BusinessUnit {
  const businessUnitBody: BusinessUnitRequestBody = JSON.parse(request.body);
  const normalizedName = businessUnitBody.account.company.toLowerCase().replace(/ /g, '_');
  const key = businessUnitBody.parentBusinessUnit
    ? `${businessUnitBody.parentBusinessUnit}_div_${normalizedName}`
    : `business_unit_${normalizedName}`;

  let storeMode = StoreMode.Explicit;
  let unitType = BusinessUnitType.Company;
  const stores: StoreKeyReference[] = [];

  if (businessUnitBody.parentBusinessUnit && !businessUnitBody.store) {
    storeMode = StoreMode.FromParent;
  }

  if (businessUnitBody.parentBusinessUnit) {
    unitType = BusinessUnitType.Division;
  }

  if (businessUnitBody.store) {
    stores.push({
      typeId: 'store',
      id: businessUnitBody.store.id,
    });
  }

  const businessUnit: BusinessUnit = {
    key,
    name: businessUnitBody.account.company,
    status: BusinessUnitStatus.Active,
    stores,
    storeMode,
    unitType,
    contactEmail: businessUnitBody.account.email,
    associates: [
      {
        associateRoleAssignments: [
          {
            associateRole: {
              key: config.defaultBuyerRoleKey,
              typeId: 'associate-role',
            },
          },
          {
            associateRole: {
              key: config.defaultAdminRoleKey,
              typeId: 'associate-role',
            },
          },
        ],
        customer: {
          id: businessUnitBody.customer.accountId,
          typeId: 'customer',
        },
      },
    ],
  };

  if (businessUnitBody.parentBusinessUnit) {
    businessUnit.parentUnit = {
      key: businessUnitBody.parentBusinessUnit,
      typeId: 'business-unit',
    };
  }

  return businessUnit;
}
