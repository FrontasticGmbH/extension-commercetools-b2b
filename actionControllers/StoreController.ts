import { ActionContext, Request, Response } from '@frontastic/extension-types';
import { getCurrency, getLocale } from '../utils/Request';
import { CartApi } from '../apis/CartApi';
import { StoreApi } from '../apis/StoreApi';
import { StoreMapper } from '../mappers/StoreMapper';

type ActionHook = (request: Request, actionContext: ActionContext) => Promise<Response>;

/**
 * @deprecated
 */
export const query: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const storeApi = new StoreApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));
  const where = request.query['where'];

  const stores = await storeApi.query(where);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(stores),
    sessionData: request.sessionData,
  };

  return response;
};

/**
 * @deprecated
 */
export const setMe: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const storeApi = new StoreApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));
  let cartId = request.sessionData?.cartId;

  const data = JSON.parse(request.body);

  const store = await storeApi.get(data.key);

  let distributionChannel = request.sessionData?.organization?.distributionChannel;

  if (store?.distributionChannels?.length) {
    distributionChannel = store.distributionChannels[0];
  }

  const organization = {
    ...request.sessionData?.organization,
    distributionChannel,
  };
  organization.store = StoreMapper.mapStoreToSmallerStore(store);

  try {
    const cart = await cartApi.getForUser(request.sessionData?.account, organization);
    cartId = cart.cartId;
  } catch {
    console.error('Cannot get cart');
  }

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(distributionChannel),
    sessionData: {
      ...request.sessionData,
      cartId,
      organization,
    },
  };

  return response;
};
