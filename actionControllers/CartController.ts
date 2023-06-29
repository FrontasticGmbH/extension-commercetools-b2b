export * from './BaseCartController';
import { AddressDraft } from '@commercetools/platform-sdk';
import { Context, Request, Response } from '@frontastic/extension-types';
import { ActionContext } from '@frontastic/extension-types';
import { LineItem, LineItemReturnItemDraft } from '@Types/cart/LineItem';
import { getCurrency, getLocale } from '../utils/Request';
import { Cart } from '@Types/cart/Cart';
import { Address } from '@Types/account/Address';
import { CartFetcher } from '../utils/CartFetcher';
import { CartApi } from '../apis/CartApi';
import { SubscriptionApi } from '../apis/SubscriptionApi';
import { BusinessUnitApi } from '../apis/BusinessUnitApi';
import { EmailApiFactory } from '../utils/EmailApiFactory';
import { ProductApi } from '../apis/ProductApi';

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
  const subscriptionsConfig = actionContext.frontasticContext?.project?.configuration?.subscriptions;
  const compatibilityConfig = actionContext.frontasticContext?.project?.configuration?.compatibility;
  const configurableComponentsConfig = actionContext.frontasticContext?.project?.configuration?.configurableComponents;

  const body: {
    variant?: LineItemVariant;
    subscriptions?: Partial<LineItemVariant>[];
    configurableComponents?: Partial<LineItemVariant>[];
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
    const errorInfo = error as Error;
    return {
      statusCode: 400,
      errorCode: 500,
      error: errorInfo.message,
    };
  }
  cart = (await cartApi.addToCart(
    cart,
    lineItem,
    distributionChannel,
    request.sessionData?.account,
    request.sessionData?.organization,
  )) as Cart;

  // handle subscription products bundled with this lineitem
  cart = await handleSubscriptionsOnAddToCart(cart, body, subscriptionsConfig, cartApi, request);
  cart = await handleConfigurableComponentsOnAddToCart(cart, body, configurableComponentsConfig, cartApi, request);

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
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));
  const config = actionContext.frontasticContext?.project?.configuration?.subscriptions;

  const body: {
    list?: LineItemVariant[];
    subscriptions?: Partial<LineItemVariant>[];
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
  cart = (await cartApi.addItemsToCart(
    cart,
    lineItems,
    distributionChannel,
    request.sessionData?.account,
    request.sessionData?.organization,
  )) as Cart;

  // find the lineitems that are added
  cart = await handleSubscriptionsOnAddItemsToCart(cart, body, config, cartApi, request);

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
  cart = (await cartApi.updateLineItem(
    cart,
    lineItem,
    request.sessionData?.account,
    request.sessionData?.organization,
  )) as Cart;

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

export const returnItems: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  let response: Response;

  try {
    const { orderNumber, returnLineItems }: { orderNumber: string; returnLineItems: LineItemReturnItemDraft[] } =
      JSON.parse(request.body);
    const res = await cartApi.returnItems(
      orderNumber,
      returnLineItems,
      request.sessionData?.account,
      request.sessionData?.organization,
    );
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

export const updateOrderState: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  let response: Response;

  try {
    const { orderNumber, orderState }: { orderNumber: string; orderState: string } = JSON.parse(request.body);
    const res = await cartApi.updateOrderState(
      orderNumber,
      orderState,
      request.sessionData?.account,
      request.sessionData?.organization,
    );
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
      error: e?.message ? e.message : e,
      errorCode: 500,
    };
  }

  return response;
};

export const replicateCart: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));
  const orderId = request.query?.['orderId'];
  try {
    if (orderId) {
      const cart = await cartApi.replicateCart(
        orderId,
        request.sessionData?.account,
        request.sessionData?.organization,
      );
      const order = await cartApi.order(cart, request.sessionData?.account, request.sessionData?.organization);
      const response: Response = {
        statusCode: 200,
        body: JSON.stringify(order),
        sessionData: {
          ...request.sessionData,
        },
      };
      return response;
    }
    throw new Error('Order not found');
  } catch (e) {
    const response: Response = {
      statusCode: 400,
      sessionData: request.sessionData,
      // @ts-ignore
      error: e?.message,
      errorCode: 500,
    };

    return response;
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
        // @ts-ignore
        cartItemsShippingAddresses.findIndex((address: Address) => address.key === addressSplit.id) === -1,
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

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(cartData),
    sessionData: {
      ...request.sessionData,
      cartId: cart.cartId,
    },
  };

  return response;
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
  cart = (await cartApi.setEmail(cart, request.query?.email)) as Cart;

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
  cart = (await cartApi.removeLineItem(
    cart,
    lineItem,
    request.sessionData?.account,
    request.sessionData?.organization,
  )) as Cart;

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
  const locale = getLocale(request);
  const businessUnitApi = new BusinessUnitApi(actionContext.frontasticContext, locale, getCurrency(request));
  const cartApi = new CartApi(actionContext.frontasticContext, locale, getCurrency(request));
  const subscriptionApi = new SubscriptionApi(
    actionContext.frontasticContext,
    getLocale(request),
    getCurrency(request),
  );

  const config = actionContext.frontasticContext?.project?.configuration?.workflows;
  const clientHost = actionContext.frontasticContext?.project?.configuration?.smtp?.client_host;

  const cart = await updateCartFromRequest(request, actionContext);
  const body: { payload: any } = JSON.parse(request.body);

  let response: Response;

  const orderState = await businessUnitApi.getOrderStateFromWorkflows(cart, request.sessionData.organization, config);

  try {
    const order = await cartApi.order(cart, request.sessionData?.account, request.sessionData?.organization, {
      ...body.payload,
      orderState,
    });
    const emailApi = EmailApiFactory.getDefaultApi(actionContext.frontasticContext, locale);

    emailApi.sendOrderConfirmationEmail({ ...order, email: order.email || cart.email });

    const distributionChannel = request.sessionData.organization?.distributionChannel?.id;
    try {
      await subscriptionApi.handleSubscriptionsOnOrder(cart, order, distributionChannel);
    } catch {
      console.error('subscriptions failed');
    }

    // Unset the cartId
    const cartId: string = undefined;

    response = {
      statusCode: 200,
      body: JSON.stringify(order),
      sessionData: {
        ...request.sessionData,
        cartId,
      },
    };
  } catch (e) {
    console.debug(e);
    response = {
      statusCode: 500,
      // @ts-ignore
      error: e.message ? e.message : e,
      errorCode: 500,
    };
  }

  return response;
};

export const transitionOrderState: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  let response: Response;

  try {
    const { orderNumber, stateKey }: { orderNumber: string; stateKey: string } = JSON.parse(request.body);
    const res = await cartApi.transitionOrderState(
      orderNumber,
      stateKey,
      request.sessionData?.account,
      request.sessionData?.organization,
    );
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
  body: { variant?: LineItemVariant; subscriptions?: Partial<LineItemVariant>[] },
  config: Record<string, string>,
  cartApi: CartApi,
  request: Request,
): Promise<Cart> => {
  if (config?.customLineItemKeyOfBundle && config?.customLineItemKeyOfSubscription && config?.customTypeKeyOnLineItem) {
    const lineItemId = findNewLineItem(cart, body);

    if (lineItemId && body.subscriptions?.length) {
      const bundleLineItems = getBundleLineItemsDraft(
        body,

        config.customTypeKeyOnLineItem,
        {
          [config.customLineItemKeyOfBundle]: lineItemId,
          [config.customLineItemKeyOfSubscription]: true,
        },

        'subscriptions',
      );
      // @ts-ignore
      cart = await cartApi.addSubscriptionsToCart(
        cart,
        bundleLineItems,
        request.sessionData?.account,
        request.sessionData?.organization,
      );
    }
  }
  return cart;
};

const handleConfigurableComponentsOnAddToCart = async (
  cart: Cart,
  body: { variant?: LineItemVariant; configurableComponents?: Partial<LineItemVariant>[] },
  config: Record<string, string>,
  cartApi: CartApi,
  request: Request,
): Promise<Cart> => {
  if (config?.customLineItemKeyOfBundle && config?.customLineItemTypeKey) {
    const lineItemId = findNewLineItem(cart, body);
    if (lineItemId && body.configurableComponents?.length) {
      const bundleLineItems = getBundleLineItemsDraft(
        body,
        config.customLineItemTypeKey,
        { [config.customLineItemKeyOfBundle]: lineItemId },
        'configurableComponents',
      );
      // @ts-ignore
      cart = await cartApi.addSubscriptionsToCart(
        cart,
        bundleLineItems,
        request.sessionData?.account,
        request.sessionData?.organization,
      );
    }
  }
  return cart;
};

const handleSubscriptionsOnAddItemsToCart = async (
  cart: Cart,
  body: { list?: LineItemVariant[]; subscriptions?: Partial<LineItemVariant>[] },
  config: Record<string, string>,
  cartApi: CartApi,
  request: Request,
): Promise<Cart> => {
  if (config?.customLineItemKeyOfBundle && config?.customTypeKeyOnLineItem) {
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
                key: config.customTypeKeyOnLineItem,
                typeId: 'type',
              },
              fields: {
                [config.customLineItemKeyOfBundle as string]: lineItemId,
              },
            },
          })),
        );
      }, []);
      cart = await cartApi.addSubscriptionsToCart(
        cart,
        bundleLineItems,
        request.sessionData?.account,
        request.sessionData?.organization,
      );
    }
  }

  return cart;
};
function getBundleLineItemsDraft(
  body: {
    variant?: LineItemVariant;
    subscriptions?: Partial<LineItemVariant>[];
    configurableComponents?: Partial<LineItemVariant>[];
  },
  customType: string,
  fields: Record<string, string | boolean>,
  bundleFieldName: 'subscriptions' | 'configurableComponents',
) {
  return body[bundleFieldName].map((field: Partial<LineItemVariant>) => ({
    variant: {
      sku: field.sku || undefined,
      // @ts-ignore
      price: undefined,
    },
    count: +field.count || 1,
    custom: {
      type: {
        key: customType,
        typeId: 'type',
      },
      fields,
    },
  }));
}

function findNewLineItem(cart: Cart, body: { variant?: LineItemVariant }) {
  return cart.lineItems.find((item) => item.variant.sku === body.variant.sku && item.count === body.variant.count)
    ?.lineItemId;
}
