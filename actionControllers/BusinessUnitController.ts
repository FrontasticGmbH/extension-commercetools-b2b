import { ActionContext, Request, Response } from '@frontastic/extension-types';
import { AccountRegisterBody } from './AccountController';
import { Store } from 'cofe-ct-b2b-ecommerce/types/store/store';
import { getLocale } from 'cofe-ct-ecommerce/utils/Request';
import { StoreApi } from '../apis/StoreApi';
import { BusinessUnitApi } from '../apis/BusinessUnitApi';
import { CartApi } from '../apis/CartApi';

type ActionHook = (request: Request, actionContext: ActionContext) => Promise<Response>;

export interface BusinessUnitRequestBody {
  account: AccountRegisterBody;
  store?: Store;
  parentBusinessUnit?: string;
  customer: {
    accountId: string;
  };
}

export const getMe: ActionHook = async (request: Request, actionContext: ActionContext) => {
  let organization = request.sessionData?.organization;
  let businessUnit = organization?.businessUnit;

  if (request.sessionData?.account?.accountId && !businessUnit) {
    const businessUnitApi = new BusinessUnitApi(actionContext.frontasticContext, getLocale(request));
    businessUnit = await businessUnitApi.getMe(request.sessionData?.account?.accountId);
    if (businessUnit) {
      organization = await businessUnitApi.getOrganizationByBusinessUnit(businessUnit);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(businessUnit),
  };
};

export const setMe: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const businessUnitApi = new BusinessUnitApi(actionContext.frontasticContext, getLocale(request));
  const storeApi = new StoreApi(actionContext.frontasticContext, getLocale(request));
  const data = JSON.parse(request.body);
  const config = actionContext.frontasticContext?.project?.configuration?.storeContext;

  const businessUnit = await businessUnitApi.get(data.key, request.sessionData?.account?.accountId);
  const store = businessUnit.stores?.[0]?.key ? await storeApi.get(businessUnit.stores[0].key) : undefined;
  const organization = await businessUnitApi.getOrganizationByBusinessUnit(businessUnit);
  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(businessUnit),
    sessionData: {
      ...request.sessionData,
      organization,
      rootCategoryId: store?.custom?.fields?.[config?.rootCategoryCustomField]?.id,
    },
  };

  return response;
};

export const getBusinessUnitOrders: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request));

  const keys = request?.query?.['keys'];
  if (!keys) {
    throw new Error('No keys');
  }

  const orders = await cartApi.getBusinessUnitOrders(keys);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(orders),
    sessionData: request.sessionData,
  };

  return response;
};
