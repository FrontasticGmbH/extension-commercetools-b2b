import { Cart } from '@Types/cart/Cart';
import { LineItem, ReturnLineItem } from '@Types/cart/LineItem';
import { Address } from '@Types/account/Address';
import { Order } from '@Types/cart/Order';
import { Account } from '@Types/account/Account';
import { Cart as CommercetoolsCart, CartDraft, CartUpdateAction } from '@commercetools/platform-sdk';
import {
  CartAddLineItemAction,
  CartRemoveLineItemAction,
  CartSetCountryAction,
  CartSetCustomerIdAction,
  CartSetLocaleAction,
  CartUpdate,
} from '@commercetools/platform-sdk/dist/declarations/src/generated/models/cart';
import { OrderFromCartDraft } from '@commercetools/platform-sdk/dist/declarations/src/generated/models/order';
import { isReadyForCheckout } from '../utils/Cart';
import { Locale } from '@Commerce-commercetools/interfaces/Locale';
import { Organization } from '@Commerce-commercetools/interfaces/Organization';
import { CartMapper } from '../mappers/CartMapper';
import { BaseCartApi } from '@Commerce-commercetools/apis/BaseCartApi';
import { ByProjectKeyAsAssociateByAssociateIdInBusinessUnitKeyByBusinessUnitKeyRequestBuilder } from '@commercetools/platform-sdk/dist/declarations/src/generated/client/in-business-unit/by-project-key-as-associate-by-associate-id-in-business-unit-key-by-business-unit-key-request-builder';
import { ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk/dist/declarations/src/generated/client/by-project-key-request-builder';
import { ExternalError } from '@Commerce-commercetools/utils/Errors';
import { AccountMapper } from '@Commerce-commercetools/mappers/AccountMapper';

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

export type Payload = { poNumber?: string; orderState?: string };

export class CartApi extends BaseCartApi {
  protected organization?: Organization;
  protected account?: Account;

  protected associateEndpoints: (
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ) =>
    | ByProjectKeyAsAssociateByAssociateIdInBusinessUnitKeyByBusinessUnitKeyRequestBuilder
    | ByProjectKeyRequestBuilder = (account?: Account, organization?: Organization, businessUnitKey?: string) => {
    return account && (businessUnitKey || organization)
      ? this.requestBuilder()
          .asAssociate()
          .withAssociateIdValue({ associateId: account.accountId })
          .inBusinessUnitKeyWithBusinessUnitKeyValue({
            businessUnitKey: businessUnitKey ?? organization.businessUnit.key,
          })
      : this.requestBuilder();
  };

  getForUser: (
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
    storeKey?: string,
  ) => Promise<Cart> = async (
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
    storeKey?: string,
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();
      if (organization || (businessUnitKey && storeKey)) {
        const allCarts = await this.getAllCarts(account, organization, businessUnitKey, storeKey);
        if (allCarts.length >= 1) {
          const cart = await this.buildCartWithAvailableShippingMethods(allCarts[0], locale);
          if (this.assertCartForBusinessUnitAndStore(cart, organization, businessUnitKey, storeKey)) {
            return cart;
          }
        }
      }

      return await this.createCart(account, organization, businessUnitKey, storeKey);
    } catch (error) {
      throw new ExternalError({
        status: 400,
        message: 'getForUser failed',
        body: `getForUser failed. ${error}`,
      });
    }
  };

  getAllCarts: (
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
    storeKey?: string,
  ) => Promise<CommercetoolsCart[]> = async (
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
    storeKey?: string,
  ) => {
    const where = [`store(key="${storeKey ?? organization.store?.key}")`, `cartState="Active"`];

    where.push(`customerId="${account.accountId}"`);

    return await this.associateEndpoints(account, organization, businessUnitKey)
      .carts()
      .get({
        queryArgs: {
          limit: 15,
          expand: [
            'lineItems[*].discountedPrice.includedDiscounts[*].discount',
            'discountCodes[*].discountCode',
            'paymentInfo.payments[*]',
          ],
          where,
          sort: 'createdAt desc',
        },
      })
      .execute()
      .then((response) => {
        if (response.body.count >= 1) {
          return response.body.results;
        }
        return [];
      })
      .catch((error) => {
        throw new ExternalError({ status: error.code, message: error.message, body: error.body });
      });
  };

  createCart: (
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
    storeKey?: string,
  ) => Promise<Cart> = async (
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
    storeKey?: string,
  ) => {
    const locale = await this.getCommercetoolsLocal();

    const cartDraft: Writeable<CartDraft> = {
      currency: locale.currency,
      country: locale.country,
      locale: locale.language,
      store: {
        key: storeKey ?? organization.store?.key,
        typeId: 'store',
      },
      inventoryMode: 'ReserveOnOrder',
      customerId: account.accountId,
    };

    return await this.associateEndpoints(account, organization, businessUnitKey)
      .carts()
      .post({
        queryArgs: {
          expand: [
            'lineItems[*].discountedPrice.includedDiscounts[*].discount',
            'discountCodes[*].discountCode',
            'paymentInfo.payments[*]',
          ],
        },
        body: cartDraft,
      })
      .execute()
      .then(async (response) => await this.buildCartWithAvailableShippingMethods(response.body, locale))
      .catch((error) => {
        throw new ExternalError({ status: error.code, message: error.message, body: error.body });
      });
  };

  addToCart: (
    cart: Cart,
    lineItem: LineItem,
    distributionChannelId?: string,
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ) => Promise<Cart> = async (
    cart: Cart,
    lineItem: LineItem,
    distributionChannelId: string,
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();

      const cartUpdate: CartUpdate = {
        version: +cart.cartVersion,
        actions: [
          {
            action: 'addLineItem',
            sku: lineItem.variant.sku,
            quantity: +lineItem.count,
            distributionChannel: { id: distributionChannelId, typeId: 'channel' },
          } as CartAddLineItemAction,
        ],
      };

      const oldLineItem = cart.lineItems?.find((li) => li.variant?.sku === lineItem.variant.sku);
      if (oldLineItem) {
        cartUpdate.actions.push({
          action: 'setLineItemShippingDetails',
          lineItemId: oldLineItem.lineItemId,
          shippingDetails: null,
        });
      }

      const commercetoolsCart = await this.updateCart(
        cart.cartId,
        cartUpdate,
        locale,
        account,
        organization,
        businessUnitKey,
      );

      return await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale);
    } catch (error) {
      throw new ExternalError({
        status: 400,
        message: 'addToCart failed',
        body: `addToCart failed. ${error}`,
      });
    }
  };

  addItemsToCart: (
    cart: Cart,
    lineItems: LineItem[],
    distributionChannelId: string,
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ) => Promise<Cart> = async (
    cart: Cart,
    lineItems: LineItem[],
    distributionChannelId: string,
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();

      const actions: CartUpdateAction[] = [];
      lineItems.forEach((lineItem) => {
        actions.push({
          action: 'addLineItem',
          sku: lineItem.variant.sku,
          quantity: +lineItem.count,
          distributionChannel: { id: distributionChannelId, typeId: 'channel' },
        });
        const oldLineItem = cart.lineItems?.find((li) => li.variant?.sku === lineItem.variant.sku);
        if (oldLineItem) {
          actions.push({
            action: 'setLineItemShippingDetails',
            lineItemId: oldLineItem.lineItemId,
            shippingDetails: null,
          });
        }
      });
      const cartUpdate: CartUpdate = {
        version: +cart.cartVersion,
        actions,
      };

      const commercetoolsCart = await this.updateCart(
        cart.cartId,
        cartUpdate,
        locale,
        account,
        organization,
        businessUnitKey,
      );

      return this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale);
    } catch (error) {
      throw new ExternalError({
        status: 400,
        message: 'addToCart failed',
        body: `addToCart failed. ${error}`,
      });
    }
  };

  updateLineItem: (
    cart: Cart,
    lineItem: LineItem,
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ) => Promise<Cart> = async (
    cart: Cart,
    lineItem: LineItem,
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ) => {
    const locale = await this.getCommercetoolsLocal();

    const cartUpdate: CartUpdate = {
      version: +cart.cartVersion,
      actions: [
        {
          action: 'changeLineItemQuantity',
          lineItemId: lineItem.lineItemId,
          quantity: +lineItem.count,
        },
      ],
    };

    const oldLineItem = cart.lineItems?.find((li) => li.lineItemId === lineItem.lineItemId);
    if (oldLineItem) {
      cartUpdate.actions.push({
        action: 'setLineItemShippingDetails',
        lineItemId: oldLineItem.lineItemId,
        shippingDetails: null,
      });
    }

    const commercetoolsCart = await this.updateCart(
      cart.cartId,
      cartUpdate,
      locale,
      account,
      organization,
      businessUnitKey,
    );

    return await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale);
  };

  removeAllLineItems: (cart: Cart, account?: Account, organization?: Organization) => Promise<Cart> = async (
    cart: Cart,
    account?: Account,
    organization?: Organization,
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();

      const cartUpdate: CartUpdate = {
        version: +cart.cartVersion,
        actions: cart.lineItems.map((lineItem) => ({
          action: 'removeLineItem',
          lineItemId: lineItem.lineItemId,
        })),
      };

      const commercetoolsCart = await this.updateCart(cart.cartId, cartUpdate, locale, account, organization);

      return this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale);
    } catch (error) {
      throw new ExternalError({
        status: 400,
        message: 'removeLineItem failed',
        body: `removeLineItem failed. ${error}`,
      });
    }
  };

  setCustomerId: (
    cart: Cart,
    customerId: string,
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ) => Promise<Cart> = async (
    cart: Cart,
    customerId: string,
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();

      const cartUpdate: CartUpdate = {
        version: +cart.cartVersion,
        actions: [
          {
            action: 'setCustomerId',
            customerId,
          } as CartSetCustomerIdAction,
        ],
      };

      const commercetoolsCart = await this.updateCart(
        cart.cartId,
        cartUpdate,
        locale,
        account,
        organization,
        businessUnitKey,
      );

      return this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale);
    } catch (error) {
      throw new ExternalError({
        status: 400,
        message: 'setCustomerId failed',
        body: `setCustomerId failed. ${error}`,
      });
    }
  };

  removeLineItem: (
    cart: Cart,
    lineItem: LineItem,
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ) => Promise<Cart> = async (
    cart: Cart,
    lineItem: LineItem,
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();

      const cartUpdate: CartUpdate = {
        version: +cart.cartVersion,
        actions: [
          {
            action: 'removeLineItem',
            lineItemId: lineItem.lineItemId,
          } as CartRemoveLineItemAction,
        ],
      };

      const commercetoolsCart = await this.updateCart(
        cart.cartId,
        cartUpdate,
        locale,
        account,
        organization,
        businessUnitKey,
      );

      return await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale);
    } catch (error) {
      throw new ExternalError({
        status: 400,
        message: 'setCustomerId failed',
        body: `setCustomerId failed. ${error}`,
      });
    }
  };

  order: (
    cart: Cart,
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
    payload?: Payload,
  ) => Promise<Order> = async (
    cart: Cart,
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
    payload?: { poNumber?: string; orderState?: string },
  ) => {
    const locale = await this.getCommercetoolsLocal();
    const date = new Date();

    const orderFromCartDraft: Writeable<OrderFromCartDraft> = {
      id: cart.cartId,
      version: +cart.cartVersion,
      orderNumber: `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}-${String(Date.now()).slice(-6, -1)}`,
      orderState: cart.isPreBuyCart ? 'Open' : 'Confirmed',
    };
    if (typeof payload === 'object' && payload?.poNumber) {
      orderFromCartDraft.purchaseOrderNumber = payload.poNumber;
    }
    // if (typeof payload === 'object' && payload?.orderState) {
    //   orderFromCartDraft.state = {
    //     typeId: 'state',
    //     id: payload?.orderState,
    //   };
    // }

    if (!isReadyForCheckout(cart)) {
      throw new Error('Cart not complete yet.');
    }
    const config = this.frontasticContext?.project?.configuration?.preBuy;

    return await this.associateEndpoints(account, organization, businessUnitKey)
      .orders()
      .post({
        queryArgs: {
          expand: [
            'lineItems[*].discountedPrice.includedDiscounts[*].discount',
            'discountCodes[*].discountCode',
            'paymentInfo.payments[*]',
          ],
        },
        body: orderFromCartDraft,
      })
      .execute()
      .then((response) => CartMapper.commercetoolsOrderToOrder(response.body, locale, config))
      .catch((error) => {
        throw new ExternalError({ status: error.code, message: error.message, body: error.body });
      });
  };

  getOrders: (account: Account, organization?: Organization) => Promise<Order[]> = async (
    account: Account,
    organization?: Organization,
  ) => {
    const locale = await this.getCommercetoolsLocal();
    const config = this.frontasticContext?.project?.configuration?.preBuy;

    return await this.associateEndpoints(account, organization)
      .orders()
      .get({
        queryArgs: {
          expand: [
            'lineItems[*].discountedPrice.includedDiscounts[*].discount',
            'discountCodes[*].discountCode',
            'paymentInfo.payments[*]',
            'state',
          ],
          where: `customerId="${account.accountId}"`,
          sort: 'createdAt desc',
        },
      })
      .execute()
      .then((response) =>
        response.body.results.map((order) => CartMapper.commercetoolsOrderToOrder(order, locale, config)),
      )
      .catch((error) => {
        throw new ExternalError({ status: error.code, message: error.message, body: error.body });
      });
  };

  getOrder: (orderNumber: string, account?: Account, organization?: Organization) => Promise<Order> = async (
    orderNumber: string,
    account?: Account,
    organization?: Organization,
  ) => {
    const locale = await this.getCommercetoolsLocal();
    const config = this.frontasticContext?.project?.configuration?.preBuy;

    return await this.associateEndpoints(account, organization)
      .orders()
      .withOrderNumber({ orderNumber })
      .get({
        queryArgs: {
          expand: [
            'lineItems[*].discountedPrice.includedDiscounts[*].discount',
            'discountCodes[*].discountCode',
            'paymentInfo.payments[*]',
            'state',
          ],
        },
      })
      .execute()
      .then((response) => CartMapper.commercetoolsOrderToOrder(response.body, locale, config))
      .catch((error) => {
        throw new ExternalError({ status: error.code, message: error.message, body: error.body });
      });
  };

  updateOrderState: (
    orderNumber: string,
    orderState: string,
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ) => Promise<Order> = async (
    orderNumber: string,
    orderState: string,
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ) => {
    const locale = await this.getCommercetoolsLocal();

    return await this.getOrder(orderNumber).then((order) => {
      if (order.orderState === 'Complete') {
        throw 'Cannot cancel a Completed order.';
      }
      return this.associateEndpoints(account, organization, businessUnitKey)
        .orders()
        .withOrderNumber({ orderNumber })
        .post({
          body: {
            version: +order.orderVersion,
            actions: [
              {
                action: 'changeOrderState',
                orderState,
              },
            ],
          },
          queryArgs: {
            expand: [
              'lineItems[*].discountedPrice.includedDiscounts[*].discount',
              'discountCodes[*].discountCode',
              'paymentInfo.payments[*]',
            ],
          },
        })
        .execute()
        .then((response) => CartMapper.commercetoolsOrderToOrder(response.body, locale))
        .catch((error) => {
          throw new ExternalError({ status: error.code, message: error.message, body: error.body });
        });
    });
  };

  returnItems: (
    orderNumber: string,
    returnLineItems: ReturnLineItem[],
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ) => Promise<Order> = async (
    orderNumber: string,
    returnLineItems: ReturnLineItem[],
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ) => {
    const locale = await this.getCommercetoolsLocal();
    const config = this.frontasticContext?.project?.configuration?.preBuy;
    const returnItems = CartMapper.returnLineItemToCommercetoolsReturnItemDraft(returnLineItems);

    return await this.getOrder(orderNumber).then((order) => {
      return this.associateEndpoints(account, organization, businessUnitKey)
        .orders()
        .withOrderNumber({ orderNumber })
        .post({
          body: {
            version: +order.orderVersion,
            actions: [
              {
                action: 'addReturnInfo',
                items: returnItems,
                returnDate: new Date().toISOString(),
                returnTrackingId: new Date().getTime().toString(),
              },
            ],
          },
        })
        .execute()
        .then((response) => CartMapper.commercetoolsOrderToOrder(response.body, locale, config))
        .catch((error) => {
          throw new ExternalError({ status: error.code, message: error.message, body: error.body });
        });
    });
  };

  transitionOrderState: (
    orderNumber: string,
    stateKey: string,
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ) => Promise<Order> = async (
    orderNumber: string,
    stateKey: string,
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ) => {
    const locale = await this.getCommercetoolsLocal();
    const config = this.frontasticContext?.project?.configuration?.preBuy;

    return await this.getOrder(orderNumber).then((order) => {
      return this.associateEndpoints(account, organization, businessUnitKey)
        .orders()
        .withOrderNumber({ orderNumber })
        .post({
          body: {
            version: +order.orderVersion,
            actions: [
              {
                action: 'transitionState',
                state: {
                  typeId: 'state',
                  key: stateKey,
                },
              },
            ],
          },
        })
        .execute()
        .then((response) => CartMapper.commercetoolsOrderToOrder(response.body, locale, config))
        .catch((error) => {
          throw new ExternalError({ status: error.code, message: error.message, body: error.body });
        });
    });
  };

  getBusinessUnitOrders: (businessUnitKey: string, account?: Account) => Promise<Order[]> = async (
    businessUnitKey: string,
    account?: Account,
  ) => {
    const locale = await this.getCommercetoolsLocal();
    const config = this.frontasticContext?.project?.configuration?.preBuy;

    const endpoint = account
      ? this.requestBuilder()
          .asAssociate()
          .withAssociateIdValue({ associateId: account.accountId })
          .inBusinessUnitKeyWithBusinessUnitKeyValue({ businessUnitKey: businessUnitKey })
      : this.requestBuilder();

    return await endpoint
      .orders()
      .get({
        queryArgs: {
          expand: ['state'],
          where: `businessUnit(key="${businessUnitKey}")`,
          sort: 'createdAt desc',
        },
      })
      .execute()
      .then((response) =>
        response.body.results.map((order) => CartMapper.commercetoolsOrderToOrder(order, locale, config)),
      )
      .catch((error) => {
        throw new ExternalError({ status: error.code, message: error.message, body: error.body });
      });
  };

  freezeCart: (cart: Cart, account?: Account, organization?: Organization) => Promise<Cart> = async (
    cart: Cart,
    account?: Account,
    organization?: Organization,
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();

      const cartUpdate: CartUpdate = {
        version: +cart.cartVersion,
        actions: [
          {
            action: 'freezeCart',
          },
        ],
      };

      const commercetoolsCart = await this.updateCart(cart.cartId, cartUpdate, locale, account, organization);

      return await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale);
    } catch (error) {
      throw new ExternalError({ status: 400, message: `freeze error failed`, body: `freeze error failed. ${error}` });
    }
  };

  protected assertCorrectLocale: (
    commercetoolsCart: CommercetoolsCart,
    locale: Locale,
    account?: Account,
    organization?: Organization,
  ) => Promise<Cart> = async (
    commercetoolsCart: CommercetoolsCart,
    locale: Locale,
    account?: Account,
    organization?: Organization,
  ) => {
    if (commercetoolsCart.totalPrice.currencyCode !== locale.currency.toLocaleUpperCase()) {
      return this.recreate(commercetoolsCart, locale);
    }

    const config = this.frontasticContext?.project?.configuration?.preBuy;

    if (this.doesCartNeedLocaleUpdate(commercetoolsCart, locale)) {
      const cartUpdate: CartUpdate = {
        version: commercetoolsCart.version,
        actions: [
          {
            action: 'setCountry',
            country: locale.country,
          } as CartSetCountryAction,
          {
            action: 'setLocale',
            country: locale.language,
          } as CartSetLocaleAction,
        ],
      };

      commercetoolsCart = await this.updateCart(commercetoolsCart.id, cartUpdate, locale, account, organization);

      return CartMapper.commercetoolsCartToCart(commercetoolsCart, locale, config) as Cart;
    }

    return CartMapper.commercetoolsCartToCart(commercetoolsCart, locale, config) as Cart;
  };

  assertCartForBusinessUnitAndStore: (
    cart: Cart,
    organization: Organization,
    businessUnitKey?: string,
    storeKey?: string,
  ) => boolean = (cart: Cart, organization: Organization, businessUnitKey?: string, storeKey?: string) => {
    return (
      !!cart.businessUnit &&
      !!cart.store &&
      (cart.businessUnit === businessUnitKey || cart.businessUnit === organization?.businessUnit?.key) &&
      (cart.store === storeKey || cart.store === organization?.store?.key)
    );
  };

  unfreezeCart: (cart: Cart, account?: Account, organization?: Organization) => Promise<Cart> = async (
    cart: Cart,
    account?: Account,
    organization?: Organization,
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();

      const cartUpdate: CartUpdate = {
        version: +cart.cartVersion,
        actions: [
          {
            action: 'unfreezeCart',
          },
        ],
      };
      const commercetoolsCart = await this.updateCart(cart.cartId, cartUpdate, locale, account, organization);

      return await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale);
    } catch (error) {
      throw new ExternalError({ status: 400, message: `freeze error failed`, body: `freeze error failed. ${error}` });
    }
  };

  setCartExpirationDays: (
    cart: Cart,
    deleteDaysAfterLastModification: number,
    account?: Account,
    organization?: Organization,
  ) => Promise<Cart> = async (
    cart: Cart,
    deleteDaysAfterLastModification: number,
    account?: Account,
    organization?: Organization,
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();

      const cartUpdate: CartUpdate = {
        version: +cart.cartVersion,
        actions: [
          {
            action: 'setDeleteDaysAfterLastModification',
            deleteDaysAfterLastModification,
          },
        ],
      };
      const commercetoolsCart = await this.updateCart(cart.cartId, cartUpdate, locale, account, organization);

      return await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale);
    } catch (error) {
      throw new ExternalError({ status: 400, message: `freeze error failed`, body: `freeze error failed. ${error}` });
    }
  };

  setCustomType: (
    cart: Cart,
    type: string,
    fields: any,
    account?: Account,
    organization?: Organization,
  ) => Promise<Cart> = async (
    cart: Cart,
    type: string,
    fields: any,
    account?: Account,
    organization?: Organization,
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();

      const cartUpdate: CartUpdate = {
        version: +cart.cartVersion,
        actions: [
          {
            action: 'setCustomType',
            type: {
              typeId: 'type',
              key: type,
            },
            fields,
          },
        ],
      };
      const commercetoolsCart = await this.updateCart(cart.cartId, cartUpdate, locale, account, organization);

      return await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale);
    } catch (error) {
      throw new ExternalError({ status: 400, message: `freeze error failed`, body: `freeze error failed. ${error}` });
    }
  };

  replicateCart: (
    orderId: string,
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ) => Promise<Cart> = async (
    orderId: string,
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ) => {
    const locale = await this.getCommercetoolsLocal();
    return await this.associateEndpoints(account, organization, businessUnitKey)
      .carts()
      .replicate()
      .post({
        body: {
          reference: {
            id: orderId,
            typeId: 'order',
          },
        },
      })
      .execute()
      .then(async (response) => await this.buildCartWithAvailableShippingMethods(response.body, locale))
      .catch((error) => {
        throw new ExternalError({ status: 400, message: error.message, body: error.body });
      });
  };

  protected recreate: (
    primaryCommercetoolsCart: CommercetoolsCart,
    locale: Locale,
    account?: Account,
    organization?: Organization,
  ) => Promise<Cart> = async (
    primaryCommercetoolsCart: CommercetoolsCart,
    locale: Locale,
    account?: Account,
    organization?: Organization,
  ) => {
    const primaryCartId = primaryCommercetoolsCart.id;
    const cartVersion = primaryCommercetoolsCart.version;
    const lineItems = primaryCommercetoolsCart.lineItems;

    const cartDraft: CartDraft = {
      currency: locale.currency,
      country: locale.country,
      locale: locale.language,
    };

    // TODO: implement a logic that hydrate cartDraft with commercetoolsCart
    // for (const key of Object.keys(commercetoolsCart)) {
    //   if (cartDraft.hasOwnProperty(key) && cartDraft[key] !== undefined) {
    //     cartDraft[key] = commercetoolsCart[key];
    //   }
    // }

    const propertyList = [
      'customerId',
      'customerEmail',
      'customerGroup',
      'anonymousId',
      'store',
      'inventoryMode',
      'taxMode',
      'taxRoundingMode',
      'taxCalculationMode',
      'shippingAddress',
      'billingAddress',
      'shippingMethod',
      'externalTaxRateForShippingMethod',
      'deleteDaysAfterLastModification',
      'origin',
      'shippingRateInput',
      'itemShippingAddresses',
    ];

    for (const key of propertyList) {
      if (primaryCommercetoolsCart.hasOwnProperty(key)) {
        cartDraft[key] = primaryCommercetoolsCart[key];
      }
    }

    let replicatedCommercetoolsCart = await this.associateEndpoints(account, organization)
      .carts()
      .post({
        queryArgs: {
          expand: [
            'lineItems[*].discountedPrice.includedDiscounts[*].discount',
            'discountCodes[*].discountCode',
            'paymentInfo.payments[*]',
          ],
        },
        body: cartDraft,
      })
      .execute()
      .then((response) => {
        return response.body;
      });

    // Add line items to the replicated cart one by one to handle the exception
    // if an item is not available on the new currency.
    for (const lineItem of lineItems) {
      try {
        const cartUpdate: CartUpdate = {
          version: +replicatedCommercetoolsCart.version,
          actions: [
            {
              action: 'addLineItem',
              sku: lineItem.variant.sku,
              quantity: +lineItem.quantity,
            },
          ],
        };

        replicatedCommercetoolsCart = await this.updateCart(
          replicatedCommercetoolsCart.id,
          cartUpdate,
          locale,
          account,
          organization,
        );
      } catch (error) {
        // Ignore that a line item could not be added due to missing price, etc
      }
    }

    // Delete previous cart
    await this.deleteCart(primaryCartId, cartVersion);

    return CartMapper.commercetoolsCartToCart(replicatedCommercetoolsCart, locale);
  };

  deleteCart: (
    primaryCartId: string,
    cartVersion: number,
    account?: Account,
    organization?: Organization,
  ) => Promise<void> = async (
    primaryCartId: string,
    cartVersion: number,
    account?: Account,
    organization?: Organization,
  ) => {
    await this.associateEndpoints(account, organization)
      .carts()
      .withId({
        ID: primaryCartId,
      })
      .delete({
        queryArgs: {
          version: cartVersion,
        },
      })
      .execute();
  };

  protected async updateCart(
    cartId: string,
    cartUpdate: CartUpdate,
    locale: Locale,
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ): Promise<CommercetoolsCart> {
    return await this.associateEndpoints(account, organization, businessUnitKey)
      .carts()
      .withId({
        ID: cartId,
      })
      .post({
        queryArgs: {
          expand: [
            'lineItems[*].discountedPrice.includedDiscounts[*].discount',
            'discountCodes[*].discountCode',
            'paymentInfo.payments[*]',
          ],
        },
        body: cartUpdate,
      })
      .execute()
      .then((response) => {
        return response.body;
      })
      .catch((error) => {
        throw new ExternalError({ status: error.code, message: error.message, body: error.body });
      });
  }

  addItemShippingAddress: (
    originalCart: Cart,
    address: Address,
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ) => Promise<CommercetoolsCart> = async (
    originalCart: Cart,
    address: Address,
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ) => {
    const locale = await this.getCommercetoolsLocal();

    const commercetoolsAddress = AccountMapper.addressToCommercetoolsAddress(address);

    const cartUpdate: CartUpdate = {
      version: +originalCart.cartVersion,
      actions: [
        {
          action: 'addItemShippingAddress',
          address: commercetoolsAddress,
        },
      ],
    };

    return this.updateCart(originalCart.cartId, cartUpdate, locale, account, organization, businessUnitKey);
  };

  updateLineItemShippingDetails: (
    cart: Cart,
    lineItemId: string,
    targets?: { addressKey: string; quantity: number }[],
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ) => Promise<Cart> = async (
    cart: Cart,
    lineItemId: string,
    targets?: { addressKey: string; quantity: number }[],
    account?: Account,
    organization?: Organization,
    businessUnitKey?: string,
  ) => {
    const locale = await this.getCommercetoolsLocal();

    const cartUpdate: CartUpdate = {
      version: +cart.cartVersion,
      actions: [
        {
          action: 'setLineItemShippingDetails',
          lineItemId,
          shippingDetails: targets?.length ? { targets } : null,
        },
      ],
    };

    const commercetoolsCart = await this.updateCart(
      cart.cartId,
      cartUpdate,
      locale,
      account,
      organization,
      businessUnitKey,
    );
    return (await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale)) as Cart;
  };
}
