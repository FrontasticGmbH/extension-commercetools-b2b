import { ActionContext, Request, Response } from '@frontastic/extension-types';
import { LineItem, ReturnLineItem } from '@Types/cart/LineItem';
import { getCurrency, getLocale } from '../utils/Request';
import { Cart } from '@Types/cart/Cart';
import { Address } from '@Types/account/Address';
import { CartFetcher } from '../utils/CartFetcher';
import { CartApi, Payload } from '../apis/CartApi';
import { EmailApiFactory } from '../utils/EmailApiFactory';
import handleError from '@Commerce-commercetools/utils/handleError';
import { fetchAccountFromSession } from '@Commerce-commercetools/utils/fetchAccountFromSession';
import { AccountAuthenticationError } from '@Commerce-commercetools/errors/AccountAuthenticationError';

export * from './BaseCartController';

type ActionHook = (request: Request, actionContext: ActionContext) => Promise<Response>;

interface LineItemVariant {
  sku?: string;
  count: number;
}

async function updateCartFromRequest(request: Request, actionContext: ActionContext): Promise<Cart> {
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));
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

export const addToCart: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));
  const body: {
    variant?: LineItemVariant;
    businessUnitKey?: string;
  } = JSON.parse(request.body);

  const lineItem: LineItem = {
    variant: {
      sku: body.variant?.sku || undefined,
      price: undefined,
    },
    count: +body.variant?.count || 1,
  };

  const account = fetchAccountFromSession(request);

  if (account === undefined) {
    throw new AccountAuthenticationError({ message: 'Not logged in.' });
  }

  let cart = await CartFetcher.fetchCart(request, actionContext);

  cart = await cartApi.addToCart(cart, lineItem, account, request.sessionData?.organization, body.businessUnitKey);

  const cartId = cart.cartId;

  return {
    statusCode: 200,
    body: JSON.stringify(cart),
    sessionData: {
      ...request.sessionData,
      cartId,
    },
  };
};

export const addItemsToCart: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const body: {
    list?: LineItemVariant[];
    distributionChannelId?: string;
    businessUnitKey?: string;
  } = JSON.parse(request.body);

  const lineItems: LineItem[] = body.list?.map((variant) => ({
    variant: {
      sku: variant.sku || undefined,
      price: undefined,
    },
    count: +variant.count || 1,
  }));

  const distributionChannelId = body.distributionChannelId ?? request.sessionData.organization?.distributionChannel?.id;

  let cart = await CartFetcher.fetchCart(request, actionContext);
  cart = await cartApi.addItemsToCart(
    cart,
    lineItems,
    distributionChannelId,
    request.sessionData?.account,
    request.sessionData?.organization,
    body.businessUnitKey,
  );

  const cartId = cart.cartId;

  return {
    statusCode: 200,
    body: JSON.stringify(cart),
    sessionData: {
      ...request.sessionData,
      cartId,
    },
  };
};

export const updateLineItem: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const body: {
    lineItem?: { id?: string; count: number };
    businessUnitKey?: string;
  } = JSON.parse(request.body);

  const lineItem: LineItem = {
    lineItemId: body.lineItem?.id,
    count: +body.lineItem?.count || 1,
  };

  let cart = await CartFetcher.fetchCart(request, actionContext);
  cart = await cartApi.updateLineItem(
    cart,
    lineItem,
    request.sessionData?.account,
    request.sessionData?.organization,
    body.businessUnitKey,
  );

  const cartId = cart.cartId;

  return {
    statusCode: 200,
    body: JSON.stringify(cart),
    sessionData: {
      ...request.sessionData,
      cartId,
    },
  };
};

export const returnItems: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  try {
    const body: {
      orderId: string;
      returnLineItems: ReturnLineItem[];
      businessUnitKey?: string;
    } = JSON.parse(request.body);

    const res = await cartApi.returnItems(
      body.orderId,
      body.returnLineItems,
      request.sessionData?.account,
      request.sessionData?.organization,
      body.businessUnitKey,
    );
    return {
      statusCode: 200,
      body: JSON.stringify(res),
      sessionData: request.sessionData,
    };
  } catch (error) {
    return handleError(error, request);
  }
};

export const updateOrderState: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  try {
    const body: {
      orderNumber: string;
      orderState: string;
      businessUnitKey?: string;
    } = JSON.parse(request.body);

    const res = await cartApi.updateOrderState(
      body.orderNumber,
      body.orderState,
      request.sessionData?.account,
      request.sessionData?.organization,
      body.businessUnitKey,
    );
    return {
      statusCode: 200,
      body: JSON.stringify(res),
      sessionData: request.sessionData,
    };
  } catch (error) {
    return handleError(error, request);
  }
};

export const replicateCart: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));
  const orderId = request.query?.['orderId'];
  const body: {
    businessUnitKey?: string;
  } = JSON.parse(request.body);

  if (!orderId) {
    return {
      statusCode: 500,
      sessionData: request.sessionData,
      error: 'orderId is required',
    };
  }
  try {
    const cart = await cartApi.replicateCart(
      orderId,
      request.sessionData?.account,
      request.sessionData?.organization,
      body.businessUnitKey,
    );
    const order = await cartApi.order(
      cart,
      request.sessionData?.account,
      request.sessionData?.organization,
      body?.businessUnitKey,
    );
    return {
      statusCode: 200,
      body: JSON.stringify(order),
      sessionData: {
        ...request.sessionData,
      },
    };
  } catch (error) {
    return handleError(error, request);
  }
};

export const splitLineItem: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));
  const cart = await CartFetcher.fetchCart(request, actionContext);

  const body: {
    lineItemId?: string;
    businessUnitKey?: string;
    shippingAddresses: { address: Address; count: number }[];
  } = JSON.parse(request.body);

  const cartItemsShippingAddresses = cart.itemShippingAddresses || [];
  const remainingAddresses = body.shippingAddresses
    .map((item) => item.address)
    .filter(
      (addressSplit) =>
        cartItemsShippingAddresses.findIndex((address: Address) => address.addressId === addressSplit.addressId) === -1,
    );

  if (remainingAddresses.length) {
    for await (const address of remainingAddresses) {
      await cartApi.addItemShippingAddress(
        cart,
        address,
        request.sessionData?.account,
        request.sessionData?.organization,
        body?.businessUnitKey,
      );
    }
  }

  // TODO: move this logic to the API
  const target = body.shippingAddresses.map((item) => ({ addressKey: item.address.addressId, quantity: item.count }));

  const cartData = await cartApi.updateLineItemShippingDetails(
    cart,
    body.lineItemId,
    target,
    request.sessionData?.account,
    request.sessionData?.organization,
    body.businessUnitKey,
  );

  return {
    statusCode: 200,
    body: JSON.stringify(cartData),
    sessionData: {
      ...request.sessionData,
      cartId: cart.cartId,
    },
  };
};

export const reassignCart: ActionHook = async (request: Request, actionContext: ActionContext) => {
  let cart = await CartFetcher.fetchCart(request, actionContext);
  const cartId = cart.cartId;
  const body: {
    businessUnitKey?: string;
  } = JSON.parse(request.body);

  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));
  cart = await cartApi.setCustomerId(
    cart,
    request.query?.customerId,
    request.sessionData?.account,
    request.sessionData?.organization,
    body?.businessUnitKey,
  );
  cart = await cartApi.setEmail(cart, request.query?.email);

  return {
    statusCode: 200,
    body: JSON.stringify(cart),
    sessionData: {
      ...request.sessionData,
      cartId,
    },
  };
};

export const removeLineItem: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const body: {
    lineItem?: { id?: string };
    businessUnitKey?: string;
  } = JSON.parse(request.body);

  const lineItem: LineItem = {
    lineItemId: body.lineItem?.id,
    variant: {
      sku: '',
    },
  };

  let cart = await CartFetcher.fetchCart(request, actionContext);
  cart = await cartApi.removeLineItem(
    cart,
    lineItem,
    request.sessionData?.account,
    request.sessionData?.organization,
    body?.businessUnitKey,
  );

  const cartId = cart.cartId;

  return {
    statusCode: 200,
    body: JSON.stringify(cart),
    sessionData: {
      ...request.sessionData,
      cartId,
    },
  };
};

export const checkout: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const locale = getLocale(request);
  const cartApi = new CartApi(actionContext.frontasticContext, locale, getCurrency(request));

  const cart = await updateCartFromRequest(request, actionContext);
  const body: {
    payload: Payload;
    businessUnitKey?: string;
  } = JSON.parse(request.body);

  try {
    const order = await cartApi.order(
      cart,
      request.sessionData?.account,
      request.sessionData?.organization,
      body.businessUnitKey,
      {
        ...body.payload,
      },
    );
    const emailApi = EmailApiFactory.getDefaultApi(actionContext.frontasticContext, locale);

    emailApi.sendOrderConfirmationEmail({ ...order, email: order.email || cart.email });

    // Unset the cartId
    const cartId: string = undefined;

    return {
      statusCode: 200,
      body: JSON.stringify(order),
      sessionData: {
        ...request.sessionData,
        cartId,
      },
    };
  } catch (error) {
    return handleError(error, request);
  }
};

export const transitionOrderState: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  try {
    const {
      orderNumber,
      stateKey,
      businessUnitKey,
    }: {
      orderNumber: string;
      stateKey: string;
      businessUnitKey?: string;
    } = JSON.parse(request.body);

    const res = await cartApi.transitionOrderState(
      orderNumber,
      stateKey,
      request.sessionData?.account,
      request.sessionData?.organization,
      businessUnitKey,
    );
    return {
      statusCode: 200,
      body: JSON.stringify(res),
      sessionData: request.sessionData,
    };
  } catch (error) {
    return handleError(error, request);
  }
};
