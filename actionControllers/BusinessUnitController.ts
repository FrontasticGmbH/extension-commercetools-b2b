export * from 'cofe-ct-b2b-ecommerce/actionControllers/BusinessUnitController';
import { ActionContext, Request, Response } from '@frontastic/extension-types';
import { AccountRegisterBody } from './AccountController';
import { Store } from '@Types/store/Store';
import { getLocale } from 'cofe-ct-ecommerce/utils/Request';
import { StoreApi } from '../apis/StoreApi';
import { BusinessUnitApi } from '../apis/BusinessUnitApi';
import { CartApi } from '../apis/CartApi';
import { BusinessUnitMapper } from '../mappers/BusinessUnitMapper';

type ActionHook = (request: Request, actionContext: ActionContext) => Promise<Response>;

export interface BusinessUnitRequestBody {
  account: AccountRegisterBody;
  store?: Store;
  parentBusinessUnit?: string;
  customer: {
    accountId: string;
  };
}

export const setMe: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const businessUnitApi = new BusinessUnitApi(actionContext.frontasticContext, getLocale(request));
  const storeApi = new StoreApi(actionContext.frontasticContext, getLocale(request));
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

export const getBusinessUnitOrders: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(
    actionContext.frontasticContext,
    getLocale(request),
    request.sessionData?.organization,
    request.sessionData?.account,
  );

  const key = request?.query?.['key'];
  if (!key) {
    throw new Error('No key');
  }

  const orders = await cartApi.getBusinessUnitOrders(key);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(orders),
    sessionData: request.sessionData,
  };

  return response;
};
