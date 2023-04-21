export * from './B2BCartController';
import { Context, Request, Response } from '@frontastic/extension-types';
import { ActionContext } from '@frontastic/extension-types';
import { LineItem } from '@Types/cart/LineItem';
import { getLocale } from '../utils/Request';
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
  cart: Cart,
  lineItem: LineItem,
  compatibilityConfig: Record<string, string>,
) {
  const inCompatibilityAttributeKey = compatibilityConfig?.incompatibleProductsAttributeName;
  if (!inCompatibilityAttributeKey) {
    return;
  }
  const productApi = new ProductApi(context, locale);
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
  const cartApi = new CartApi(
    actionContext.frontasticContext,
    getLocale(request),
    request.sessionData?.organization,
    request.sessionData?.account,
  );
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
  const cartApi = new CartApi(
    actionContext.frontasticContext,
    getLocale(request),
    request.sessionData?.organization,
    request.sessionData?.account,
  );
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
      cart,
      lineItem,
      compatibilityConfig,
    );
  } catch (e) {
    return {
      statusCode: 400,
      errorCode: 500,
      // @ts-ignore
      error: e.message,
    };
  }
  cart = (await cartApi.addToCart(cart, lineItem, distributionChannel)) as Cart;

  // handle subscription products bundled with this lineitem
  cart = await handleSubscriptionsOnAddToCart(cart, body, subscriptionsConfig, cartApi);
  cart = await handleConfigurableComponentsOnAddToCart(cart, body, configurableComponentsConfig, cartApi);

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
  const cartApi = new CartApi(
    actionContext.frontasticContext,
    getLocale(request),
    request.sessionData?.organization,
    request.sessionData?.account,
  );
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

export const removeLineItem: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const cartApi = new CartApi(
    actionContext.frontasticContext,
    getLocale(request),
    request.sessionData?.organization,
    request.sessionData?.account,
  );

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
  cart = (await cartApi.removeLineItem(cart, lineItem)) as Cart;

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
  const businessUnitApi = new BusinessUnitApi(actionContext.frontasticContext, getLocale(request));
  const cartApi = new CartApi(
    actionContext.frontasticContext,
    locale,
    request.sessionData?.organization,
    request.sessionData?.account,
  );
  const subscriptionApi = new SubscriptionApi(actionContext.frontasticContext, getLocale(request));

  const config = actionContext.frontasticContext?.project?.configuration?.workflows;
  const clientHost = actionContext.frontasticContext?.project?.configuration?.smtp?.client_host;

  const cart = await updateCartFromRequest(request, actionContext);
  const body: { payload: any } = JSON.parse(request.body);

  let response: Response;

  const orderState = await businessUnitApi.getOrderStateFromWorkflows(cart, request.sessionData.organization, config);

  try {
    const order = await cartApi.order(cart, { ...body.payload, orderState });
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
  const cartApi = new CartApi(
    actionContext.frontasticContext,
    getLocale(request),
    request.sessionData?.organization,
    request.sessionData?.account,
  );

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
  body: { variant?: LineItemVariant; subscriptions?: Partial<LineItemVariant>[] },
  config: Record<string, string>,
  cartApi: CartApi,
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
      cart = await cartApi.addSubscriptionsToCart(cart, bundleLineItems);
    }
  }
  return cart;
};

const handleConfigurableComponentsOnAddToCart = async (
  cart: Cart,
  body: { variant?: LineItemVariant; configurableComponents?: Partial<LineItemVariant>[] },
  config: Record<string, string>,
  cartApi: CartApi,
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
      cart = await cartApi.addSubscriptionsToCart(cart, bundleLineItems);
    }
  }
  return cart;
};

const handleSubscriptionsOnAddItemsToCart = async (
  cart: Cart,
  body: { list?: LineItemVariant[]; subscriptions?: Partial<LineItemVariant>[] },
  config: Record<string, string>,
  cartApi: CartApi,
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
      cart = await cartApi.addSubscriptionsToCart(cart, bundleLineItems);
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
