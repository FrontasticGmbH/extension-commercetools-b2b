export * from './BaseCartController';
import { AddressDraft } from '@commercetools/platform-sdk';
import { Context, Request, Response } from '@frontastic/extension-types';
import { ActionContext } from '@frontastic/extension-types';
import { LineItem, LineItemReturnItemDraft } from '@Types/cart/LineItem';
import { getLocale } from '../utils/Request';
import { Cart } from '@Types/cart/Cart';
import { Address } from '@Types/account/Address';
import { CartFetcher } from '../utils/CartFetcher';
import { CartApi } from '../apis/CartApi';
import { SubscriptionApi } from '../apis/SubscriptionApi';
import { BusinessUnitApi } from '../apis/BusinessUnitApi';

type ActionHook = (request: Request, actionContext: ActionContext) => Promise<Response>;

async function updateCartFromRequest(request: Request, actionContext: ActionContext): Promise<Cart> {
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request));
  let cart = await CartFetcher.fetchCart(request, actionContext);

  if (request?.body === undefined || request?.body === '') {
    return cart;
  }

  const body: {
    account?: { email?: string };
    shipping?: Address;
    billing?: Address;
  } = JSON.parse(request.body);

  if (body?.account?.email !== undefined) {
    cart = (await cartApi.setEmail(cart, body.account.email)) as Cart;
  }

  if (body?.shipping !== undefined || body?.billing !== undefined) {
    const shippingAddress = body?.shipping !== undefined ? body.shipping : body.billing;
    const billingAddress = body?.billing !== undefined ? body.billing : body.shipping;

    cart = (await cartApi.setShippingAddress(cart, shippingAddress)) as Cart;
    cart = (await cartApi.setBillingAddress(cart, billingAddress)) as Cart;
  }

  return cart;
}

export const getCart: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cart = await CartFetcher.fetchCart(request, actionContext);
  const cartId = cart.cartId;

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(cart),
    sessionData: {
      ...request.sessionData,
      cartId,
    },
  };

  return response;
};

export const addToCart: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request));
  const config = actionContext.frontasticContext?.project?.configuration?.subscriptions;

  const body: {
    variant?: { sku?: string; count: number };
    subscriptions?: { sku?: string; count?: number }[];
  } = JSON.parse(request.body);

  const lineItem: LineItem = {
    variant: {
      sku: body.variant?.sku || undefined,
      price: undefined,
    },
    count: +body.variant?.count || 1,
  };

  const distributionChannel = request.sessionData.organization?.distributionChannel?.id;

  let cart = await CartFetcher.fetchCart(request, actionContext);
  cart = (await cartApi.addToCart(cart, lineItem, distributionChannel)) as Cart;

  // handle subscription products bundled with this lineitem
  cart = await handleSubscriptionsOnAddToCart(cart, body, config, cartApi);

  const cartId = cart.cartId;

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(cart),
    sessionData: {
      ...request.sessionData,
      cartId,
    },
  };

  return response;
};

export const addItemsToCart: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request));
  const config = actionContext.frontasticContext?.project?.configuration?.subscriptions;

  const body: {
    list?: { sku?: string; count: number }[];
    subscriptions?: { sku?: string; count?: number }[];
  } = JSON.parse(request.body);

  const lineItems: LineItem[] = body.list?.map((variant) => ({
    variant: {
      sku: variant.sku || undefined,
      price: undefined,
    },
    count: +variant.count || 1,
  }));

  const distributionChannel = request.sessionData.organization?.distributionChannel?.id;

  let cart = await CartFetcher.fetchCart(request, actionContext);
  cart = (await cartApi.addItemsToCart(cart, lineItems, distributionChannel)) as Cart;

  // find the lineitems that are added
  cart = await handleSubscriptionsOnAddItemsToCart(cart, body, config, cartApi);

  const cartId = cart.cartId;

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(cart),
    sessionData: {
      ...request.sessionData,
      cartId,
    },
  };

  return response;
};

export const checkout: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const businessUnitApi = new BusinessUnitApi(actionContext.frontasticContext, getLocale(request));
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request));
  const subscriptionApi = new SubscriptionApi(actionContext.frontasticContext, getLocale(request));

  const config = actionContext.frontasticContext?.project?.configuration?.workflows;

  const cart = await updateCartFromRequest(request, actionContext);
  const body: { payload: any } = JSON.parse(request.body);

  const orderState = await businessUnitApi.getOrderStateFromWorkflows(cart, request.sessionData.organization, config);

  const order = await cartApi.order(cart, { ...body.payload, orderState });
  const distributionChannel = request.sessionData.organization?.distributionChannel?.id;
  try {
    await subscriptionApi.handleSubscriptionsOnOrder(cart, order, distributionChannel);
  } catch {
    console.error('subscriptions failed');
  }

  // Unset the cartId
  const cartId: string = undefined;

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(order),
    sessionData: {
      ...request.sessionData,
      cartId,
    },
  };

  return response;
};

export const transitionOrderState: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request));

  let response: Response;

  try {
    const { orderNumber, stateKey }: { orderNumber: string; stateKey: string } = JSON.parse(request.body);
    const res = await cartApi.transitionOrderState(orderNumber, stateKey);
    response = {
      statusCode: 200,
      body: JSON.stringify(res),
      sessionData: request.sessionData,
    };
  } catch (e) {
    response = {
      statusCode: 400,
      sessionData: request.sessionData,
      // @ts-ignore
      error: e?.message,
      errorCode: 500,
    };
  }

  return response;
};

const handleSubscriptionsOnAddToCart = async (
  cart: Cart,
  body: { variant?: { sku?: string; count: number }; subscriptions?: { sku?: string; count?: number }[] },
  config: Record<string, string>,
  cartApi: CartApi,
): Promise<Cart> => {
  if (config?.customLineItemKeyOfBundle && config?.customeTypeKeyOnLineItem) {
    const lineItemId = cart.lineItems.find(
      (item) => item.variant.sku === body.variant.sku && item.count === body.variant.count,
    )?.lineItemId;

    if (lineItemId && body.subscriptions?.length) {
      const bundleLineItems = body.subscriptions.map((subscription) => ({
        variant: {
          sku: subscription.sku || undefined,
          price: undefined,
        },
        count: +subscription.count || 1,
        custom: {
          type: {
            key: config.customeTypeKeyOnLineItem,
            typeId: 'type',
          },
          fields: {
            [config.customLineItemKeyOfBundle as string]: lineItemId,
          },
        },
      }));
      // @ts-ignore
      cart = await cartApi.addSubscriptionsToCart(cart, bundleLineItems);
    }
  }
  return cart;
};

const handleSubscriptionsOnAddItemsToCart = async (
  cart: Cart,
  body: { list?: { sku?: string; count: number }[]; subscriptions?: { sku?: string; count?: number }[] },
  config: Record<string, string>,
  cartApi: CartApi,
): Promise<Cart> => {
  if (config?.customLineItemKeyOfBundle && config?.customeTypeKeyOnLineItem) {
    const lineItemIds = cart.lineItems
      .filter((item) =>
        body.list.find((listItem) => item.variant.sku === listItem.sku && item.count === listItem.count),
      )
      ?.map((lineItem) => lineItem.lineItemId);

    if (lineItemIds && body.subscriptions?.length) {
      const bundleLineItems = lineItemIds.reduce((prev, lineItemId) => {
        return prev.concat(
          body.subscriptions.map((subscription) => ({
            variant: {
              sku: subscription.sku || undefined,
              price: undefined,
            },
            count: +subscription.count || 1,
            custom: {
              type: {
                key: config.customeTypeKeyOnLineItem,
                typeId: 'type',
              },
              fields: {
                [config.customLineItemKeyOfBundle as string]: lineItemId,
              },
            },
          })),
        );
      }, []);
      cart = await cartApi.addSubscriptionsToCart(cart, bundleLineItems);
    }
  }

  return cart;
};
