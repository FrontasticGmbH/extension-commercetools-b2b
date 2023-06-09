import { ActionContext, Request, Response } from '@frontastic/extension-types';
import { Store } from '@Types/store/Store';
import { ChannelResourceIdentifier } from '@Types/channel/channel';
import { BusinessUnitApi } from '../apis/BusinessUnitApi';
import { StoreDraft } from '@commercetools/platform-sdk';
import { getLocale } from '../utils/Request';
import { CartApi } from '../apis/CartApi';
import { StoreApi } from '../apis/StoreApi';
import { StoreMapper } from '../mappers/StoreMapper';

type ActionHook = (request: Request, actionContext: ActionContext) => Promise<Response>;

type AccountRegisterBody = {
  account: {
    email?: string;
    confirmed?: boolean;
    company?: string;
    rootCategoryId?: string;
  };
  parentBusinessUnit: string;
};

const DEFAULT_CHANNEL_KEY = 'default-channel';

export const create: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const storeApi = new StoreApi(actionContext.frontasticContext, getLocale(request));

  const data = await mapRequestToStore(request, actionContext, storeApi);

  try {
    const store = await storeApi.create(data);

    const response: Response = {
      statusCode: 200,
      body: JSON.stringify(store),
      sessionData: request.sessionData,
    };

    return response;
  } catch (error) {
    const response: Response = {
      statusCode: 400,
      sessionData: request.sessionData,
      // @ts-ignore
      error: error.message,
      errorCode: 400,
    };

    return response;
  }
};

export const query: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const storeApi = new StoreApi(actionContext.frontasticContext, getLocale(request));
  const where = request.query['where'];

  const stores = await storeApi.query(where);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(stores),
    sessionData: request.sessionData,
  };

  return response;
};

export const setMe: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const storeApi = new StoreApi(actionContext.frontasticContext, getLocale(request));
  const cartApi = new CartApi(
    actionContext.frontasticContext,
    getLocale(request),
    request.sessionData?.organization,
    request.sessionData?.account,
  );
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
      rootCategoryId: (store as Store)?.storeRootCategoryId,
    },
  };

  return response;
};

async function getParentDistChannels(parentStores: any): Promise<ChannelResourceIdentifier[]> {
  return parentStores.reduce((prev: ChannelResourceIdentifier[], item: Store) => {
    if (item.distributionChannels.length) {
      return [...prev, ...item.distributionChannels?.map((channel) => ({ id: channel.id, typeId: 'channel' }))];
    }
    return prev;
  }, []);
}

async function getParentSupplyChannels(parentStores: any): Promise<ChannelResourceIdentifier[]> {
  return parentStores.reduce((prev: ChannelResourceIdentifier[], item: Store) => {
    if (item.supplyChannels.length) {
      return [...prev, ...item.supplyChannels?.map((channel) => ({ id: channel.id, typeId: 'channel' }))];
    }
    return prev;
  }, []);
}

async function mapRequestToStore(
  request: Request,
  actionContext: ActionContext,
  storeApi: StoreApi,
): Promise<StoreDraft> {
  const storeBody: AccountRegisterBody = JSON.parse(request.body);
  const key = storeBody.account.company.toLowerCase().replace(/ /g, '_');
  const parentBusinessUnit = storeBody.parentBusinessUnit;
  const rootCategoryId = storeBody.account.rootCategoryId;
  const config = actionContext.frontasticContext?.project?.configuration?.storeContext;

  let supplyChannels: ChannelResourceIdentifier[] = [];
  let distributionChannels: ChannelResourceIdentifier[] = [];

  if (parentBusinessUnit) {
    const businessUnitApi = new BusinessUnitApi(actionContext.frontasticContext, getLocale(request));
    const businessUnit = await businessUnitApi.get(parentBusinessUnit);

    if (businessUnit?.stores) {
      const storeKeys = businessUnit?.stores.map((store) => `"${store.key}"`).join(' ,');
      const results = await storeApi.query(`key in (${storeKeys})`);

      if (results.length) {
        distributionChannels = await getParentDistChannels(results);
        supplyChannels = await getParentSupplyChannels(results);
      }
    }
  } else {
    supplyChannels.push({
      key: DEFAULT_CHANNEL_KEY,
      typeId: 'channel',
    });
    distributionChannels.push({
      key: DEFAULT_CHANNEL_KEY,
      typeId: 'channel',
    });
  }

  const store: StoreDraft = {
    key: `store_${parentBusinessUnit ? `${parentBusinessUnit}_` : ''}${key}`,
    // @ts-ignore
    name: storeBody.account.company,
    distributionChannels,
    supplyChannels,
  };

  if (config?.storeCustomType && config?.rootCategoryCustomField && config?.defaultRootCategoryId) {
    // @ts-ignore
    store.custom = {
      type: {
        key: config.storeCustomType,
        typeId: 'type',
      },
      fields: {
        [config.rootCategoryCustomField]: {
          typeId: 'category',
          id: rootCategoryId ? rootCategoryId : config.defaultRootCategoryId,
        },
      },
    };
  }

  return store;
}
