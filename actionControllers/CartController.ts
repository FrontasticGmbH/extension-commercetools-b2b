import { AddressDraft } from '@commercetools/platform-sdk';
import { ActionContext, Context, Request, Response } from '@frontastic/extension-types';
import { LineItem, LineItemReturnItemDraft } from '@Types/cart/LineItem';
import { getCurrency, getLocale } from '../utils/Request';
import { Cart } from '@Types/cart/Cart';
import { Address } from '@Types/account/Address';
import { CartFetcher } from '../utils/CartFetcher';
import { CartApi, Payload } from '../apis/CartApi';
import { BusinessUnitApi } from '../apis/BusinessUnitApi';
import { EmailApiFactory } from '../utils/EmailApiFactory';
import { ProductApi } from '../apis/ProductApi';
import handleError from '@Commerce-commercetools/utils/handleError';
import { fetchAccountFromSession } from '@Commerce-commercetools/utils/fetchAccountFromSession';
import { AccountAuthenticationError } from '@Commerce-commercetools/errors/AccountAuthenticationError';

export * from './BaseCartController';

type ActionHook = (request: Request, actionContext: ActionContext) => Promise<Response>;

interface LineItemVariant {
  sku?: string;
  count: number;
}

async function checkForCompatibility(
  context: Context,
  locale: string,
  currency: string,
  cart: Cart,
  lineItem: LineItem,
  compatibilityConfig: Record<string, string>,
) {
  const inCompatibilityAttributeKey = compatibilityConfig?.incompatibleProductsAttributeName;
  if (!inCompatibilityAttributeKey) {
    return;
  }
  const productApi = new ProductApi(context, locale, currency);
  const currentProduct = await productApi.getProduct({ skus: [lineItem.variant.sku] });
  const cartIncompatibles = cart?.lineItems
    ?.reduce((prev, lineitem) => {
      prev = prev.concat(lineitem.variant?.attributes?.[inCompatibilityAttributeKey]);
      return prev;
    }, [])
    ?.map((item) => item?.id);
  const cartProductIds = cart?.lineItems.map((lineitem) => lineitem.productId);

  const currentProductIncompatibilities = currentProduct.variants
    ?.reduce((prev, item) => {
      prev = prev.concat(item.attributes?.[inCompatibilityAttributeKey]);
      return prev;
    }, [])
    ?.map((item) => item?.id);
  const currentProductId = currentProduct.productId;

  if (
    cartIncompatibles.includes(currentProductId) ||
    currentProductIncompatibilities.some((incompatibleId) => cartProductIds.includes(incompatibleId))
  ) {
    throw new Error(`Product with SKU: ${lineItem.variant?.sku} is not compatible with the current items in the cart`);
  }
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
  const compatibilityConfig = actionContext.frontasticContext?.project?.configuration?.compatibility;
  const body: {
    variant?: LineItemVariant;
    distributionChannelId?: string;
    businessUnitKey?: string;
    configurableComponents?: Partial<LineItemVariant>[];
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

  const distributionChannelId = body.distributionChannelId ?? request.sessionData.organization?.distributionChannel?.id;

  let cart = await CartFetcher.fetchCart(request, actionContext);

  try {
    await checkForCompatibility(
      actionContext.frontasticContext,
      getLocale(request),
      getCurrency(request),
      cart,
      lineItem,
      compatibilityConfig,
    );
  } catch (error) {
    return handleError(error, request);
  }

  cart = await cartApi.addToCart(
    cart,
    lineItem,
    distributionChannelId,
    account,
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

export const addItemsToCart: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const body: {
    list?: LineItemVariant[];
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
  cart = await cartApi.addItemsToCart(
    cart,
    lineItems,
    distributionChannel,
    request.sessionData?.account,
    request.sessionData?.organization,
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
  } = JSON.parse(request.body);

  const lineItem: LineItem = {
    lineItemId: body.lineItem?.id,
    count: +body.lineItem?.count || 1,
  };

  let cart = await CartFetcher.fetchCart(request, actionContext);
  cart = await cartApi.updateLineItem(cart, lineItem, request.sessionData?.account, request.sessionData?.organization);

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
    const { orderNumber, returnLineItems }: { orderNumber: string; returnLineItems: LineItemReturnItemDraft[] } =
      JSON.parse(request.body);
    const res = await cartApi.returnItems(
      orderNumber,
      returnLineItems,
      request.sessionData?.account,
      request.sessionData?.organization,
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
    const { orderNumber, orderState }: { orderNumber: string; orderState: string } = JSON.parse(request.body);
    const res = await cartApi.updateOrderState(
      orderNumber,
      orderState,
      request.sessionData?.account,
      request.sessionData?.organization,
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

  if (!orderId) {
    return {
      statusCode: 500,
      sessionData: request.sessionData,
      error: 'orderId is required',
    };
  }
  try {
    const cart = await cartApi.replicateCart(orderId, request.sessionData?.account, request.sessionData?.organization);
    const order = await cartApi.order(cart, request.sessionData?.account, request.sessionData?.organization);
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
    data: { address: AddressDraft; quantity: number }[];
  } = JSON.parse(request.body);

  const cartItemsShippingAddresses = cart.itemShippingAddresses || [];
  const remainingAddresses = body.data
    .map((item) => item.address)
    .filter(
      (addressSplit) =>
        cartItemsShippingAddresses.findIndex((address: Address) => address.id === addressSplit.id) === -1,
    );

  if (remainingAddresses.length) {
    for await (const address of remainingAddresses) {
      await cartApi.addItemShippingAddress(
        cart,
        address,
        request.sessionData?.account,
        request.sessionData?.organization,
      );
    }
  }

  const target = body.data.map((item) => ({ addressKey: item.address.id, quantity: item.quantity }));

  const cartData = await cartApi.updateLineItemShippingDetails(
    cart,
    body.lineItemId,
    target,
    request.sessionData?.account,
    request.sessionData?.organization,
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

  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));
  cart = await cartApi.setCustomerId(
    cart,
    request.query?.customerId,
    request.sessionData?.account,
    request.sessionData?.organization,
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
  } = JSON.parse(request.body);

  const lineItem: LineItem = {
    lineItemId: body.lineItem?.id,
    variant: {
      sku: '',
    },
  };

  let cart = await CartFetcher.fetchCart(request, actionContext);
  cart = await cartApi.removeLineItem(cart, lineItem, request.sessionData?.account, request.sessionData?.organization);

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
  const businessUnitApi = new BusinessUnitApi(actionContext.frontasticContext, locale, getCurrency(request));
  const cartApi = new CartApi(actionContext.frontasticContext, locale, getCurrency(request));

  const config = actionContext.frontasticContext?.project?.configuration?.workflows;

  const cart = await updateCartFromRequest(request, actionContext);
  const body: { payload: Payload } = JSON.parse(request.body);

  const orderState = await businessUnitApi.getOrderStateFromWorkflows(cart, request.sessionData.organization, config);

  try {
    const order = await cartApi.order(cart, request.sessionData?.account, request.sessionData?.organization, {
      ...body.payload,
      orderState,
    });
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
    const { orderNumber, stateKey }: { orderNumber: string; stateKey: string } = JSON.parse(request.body);
    const res = await cartApi.transitionOrderState(
      orderNumber,
      stateKey,
      request.sessionData?.account,
      request.sessionData?.organization,
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
