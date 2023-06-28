import { Cart } from '@Types/cart/Cart';
import { LineItemReturnItemDraft } from '@Types/cart/LineItem';
import { LineItem } from '@Types/cart/LineItem';
import { Order } from '@Types/cart/Order';
import { Account } from '@Types/account/Account';
import { CartDraft, Cart as CommercetoolsCart, AddressDraft, CartUpdateAction } from '@commercetools/platform-sdk';
import {
  CartAddLineItemAction,
  CartSetCustomerIdAction,
  CartRemoveLineItemAction,
  CartSetCountryAction,
  CartSetLocaleAction,
  CartUpdate,
} from '@commercetools/platform-sdk/dist/declarations/src/generated/models/cart';
import { OrderFromCartDraft } from '@commercetools/platform-sdk/dist/declarations/src/generated/models/order';
import { isReadyForCheckout } from '../utils/Cart';
import { Locale } from '../interfaces/Locale';
import { Organization } from '../interfaces/Organization';
import { CartMapper } from '../mappers/CartMapper';
import { BaseCartApi } from '@Commerce-commercetools/apis/BaseCartApi';
import { ByProjectKeyAsAssociateByAssociateIdInBusinessUnitKeyByBusinessUnitKeyRequestBuilder } from '@commercetools/platform-sdk/dist/declarations/src/generated/client/in-business-unit/by-project-key-as-associate-by-associate-id-in-business-unit-key-by-business-unit-key-request-builder';
import { ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk/dist/declarations/src/generated/client/by-project-key-request-builder';

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

export class CartApi extends BaseCartApi {
  protected organization?: Organization;
  protected account?: Account;

  protected associateEndpoints: (
    account?: Account,
    organization?: Organization,
  ) =>
    | ByProjectKeyAsAssociateByAssociateIdInBusinessUnitKeyByBusinessUnitKeyRequestBuilder
    | ByProjectKeyRequestBuilder = (account?: Account, organization?: Organization) => {
    return account && organization
      ? this.requestBuilder()
          .asAssociate()
          .withAssociateIdValue({ associateId: account.accountId })
          .inBusinessUnitKeyWithBusinessUnitKeyValue({ businessUnitKey: organization.businessUnit.key })
      : this.requestBuilder();
  };

  getForUser: (account?: Account, organization?: Organization) => Promise<Cart> = async (
    account?: Account,
    organization?: Organization,
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();
      const allCarts = await this.getAllCarts(account, organization);
      if (allCarts.length >= 1) {
        const cart = (await this.buildCartWithAvailableShippingMethods(allCarts[0], locale)) as Cart;
        if (this.assertCartOrganization(cart, organization)) {
          return cart;
        }
      }

      return (await this.createCart(account, organization)) as Cart;
    } catch (error) {
      //TODO: better error, get status code etc...
      throw new Error(`getForUser failed. ${error}`);
    }
  };

  getAllCarts: (account?: Account, organization?: Organization) => Promise<CommercetoolsCart[]> = async (
    account?: Account,
    organization?: Organization,
  ) => {
    try {
      const subscriptionConfig = this.frontasticContext?.project?.configuration?.subscriptions;
      const preBuyConfig = this.frontasticContext?.project?.configuration?.preBuy;

      const where = [
        `store(key="${organization.store?.key}")`,
        `cartState="Active"`,
        `custom(fields(${subscriptionConfig.isSubscriptionCustomFieldNameOnCart} is not defined))`,
      ];

      if (organization.store?.isPreBuyStore) {
        where.push(`custom(fields(${preBuyConfig.orderCustomField} = true))`);
        where.push(`inventoryMode="None"`);
      }

      if (!organization.superUserBusinessUnitKey) {
        where.push(`customerId="${account.accountId}"`);
      }

      const response = await this.associateEndpoints(account, organization)
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
        .execute();

      if (response.body.count >= 1) {
        return response.body.results;
      }
      return [];
    } catch (error) {
      //TODO: better error, get status code etc...
      throw new Error(`getForUser failed. ${error}`);
    }
  };

  getAllForSuperUser: (account?: Account, organization?: Organization) => Promise<Cart[]> = async (
    account?: Account,
    organization?: Organization,
  ) => {
    const locale = await this.getCommercetoolsLocal();
    const allCarts = await this.getAllCarts(account, organization);
    if (allCarts.length >= 1) {
      return allCarts.map((cart) => CartMapper.commercetoolsCartToCart(cart, locale));
    }
    return [];
  };

  createCart: (account?: Account, organization?: Organization) => Promise<Cart> = async (
    account?: Account,
    organization?: Organization,
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();
      const config = this.frontasticContext?.project?.configuration?.preBuy;

      const cartDraft: Writeable<CartDraft> = {
        currency: locale.currency,
        country: locale.country,
        locale: locale.language,
        store: {
          key: organization.store?.key,
          typeId: 'store',
        },
        inventoryMode: 'ReserveOnOrder',
      };
      if (!organization.superUserBusinessUnitKey) {
        cartDraft.customerId = account.accountId;
      } else {
        cartDraft.origin = 'Merchant';
      }

      if (organization.store?.isPreBuyStore) {
        cartDraft.custom = {
          type: {
            typeId: 'type',
            key: config.orderCustomType,
          },
          fields: {
            [config.orderCustomField]: true,
          },
        };
        cartDraft.inventoryMode = 'None';
      }

      const commercetoolsCart = await this.associateEndpoints(account, organization)
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
        .execute();

      return (await this.buildCartWithAvailableShippingMethods(commercetoolsCart.body, locale)) as Cart;
    } catch (error) {
      //TODO: better error, get status code etc...
      throw error;
    }
  };

  // @ts-ignore
  addToCart: (
    cart: Cart,
    lineItem: LineItem,
    distributionChannel?: string,
    account?: Account,
    organization?: Organization,
  ) => Promise<Cart> = async (
    cart: Cart,
    lineItem: LineItem,
    distributionChannel: string,
    account?: Account,
    organization?: Organization,
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
            distributionChannel: { id: distributionChannel, typeId: 'channel' },
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

      const commercetoolsCart = await this.updateCart(cart.cartId, cartUpdate, locale, account, organization);

      return (await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale)) as Cart;
    } catch (error) {
      //TODO: better error, get status code etc...
      throw new Error(`addToCart failed. ${error}`);
    }
  };

  // @ts-ignore
  addItemsToCart: (
    cart: Cart,
    lineItems: LineItem[],
    distributionChannel: string,
    account?: Account,
    organization?: Organization,
  ) => Promise<Cart> = async (
    cart: Cart,
    lineItems: LineItem[],
    distributionChannel: string,
    account?: Account,
    organization?: Organization,
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();

      const actions: CartUpdateAction[] = [];
      lineItems.forEach((lineItem) => {
        actions.push({
          action: 'addLineItem',
          sku: lineItem.variant.sku,
          quantity: +lineItem.count,
          distributionChannel: { id: distributionChannel, typeId: 'channel' },
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

      const commercetoolsCart = await this.updateCart(cart.cartId, cartUpdate, locale, account, organization);

      return this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale);
    } catch (error) {
      //TODO: better error, get status code etc...
      throw new Error(`addToCart failed. ${error}`);
    }
  };

  // @ts-ignore
  updateLineItem: (cart: Cart, lineItem: LineItem, account?: Account, organization?: Organization) => Promise<Cart> =
    async (cart: Cart, lineItem: LineItem, account?: Account, organization?: Organization) => {
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

      const commercetoolsCart = await this.updateCart(cart.cartId, cartUpdate, locale, account, organization);

      return (await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale)) as Cart;
    };

  // @ts-ignore
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
      //TODO: better error, get status code etc...
      throw new Error(`removeLineItem failed. ${error}`);
    }
  };

  // @ts-ignore
  setCustomerId: (cart: Cart, customerId: string, account?: Account, organization?: Organization) => Promise<Cart> =
    async (cart: Cart, customerId: string, account?: Account, organization?: Organization) => {
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

        const commercetoolsCart = await this.updateCart(cart.cartId, cartUpdate, locale, account, organization);

        return this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale);
      } catch (error) {
        //TODO: better error, get status code etc...
        throw new Error(`setCustomerId failed. ${error}`);
      }
    };

  addSubscriptionsToCart: (
    cart: Cart,
    lineItems: LineItem[],
    account?: Account,
    organization?: Organization,
  ) => Promise<Cart> = async (cart: Cart, lineItems: LineItem[], account?: Account, organization?: Organization) => {
    try {
      const locale = await this.getCommercetoolsLocal();

      const cartUpdate = {
        version: +cart.cartVersion,
        actions: lineItems.map((subscription) => {
          return {
            action: 'addLineItem',
            sku: subscription.variant.sku,
            quantity: +subscription.count,
            custom: subscription.custom,
          } as CartAddLineItemAction;
        }),
      };

      // TODO: make it into one api call
      const commercetoolsCart = await this.updateCart(cart.cartId, cartUpdate, locale, account, organization);

      return (await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale)) as Cart;
    } catch (error) {
      //TODO: better error, get status code etc...
      throw new Error(`addToCart failed. ${error}`);
    }
  };

  // @ts-ignore
  removeLineItem: (cart: Cart, lineItem: LineItem, account?: Account, organization?: Organization) => Promise<Cart> =
    async (cart: Cart, lineItem: LineItem, account?: Account, organization?: Organization) => {
      try {
        const locale = await this.getCommercetoolsLocal();

        const subscriptions = cart.lineItems.filter((lineitem: LineItem) => {
          return lineitem.parentId === lineItem.lineItemId;
        });

        const cartUpdate: CartUpdate = {
          version: +cart.cartVersion,
          actions: [
            {
              action: 'removeLineItem',
              lineItemId: lineItem.lineItemId,
            } as CartRemoveLineItemAction,
          ],
        };
        if (subscriptions?.length) {
          // @ts-ignore
          cartUpdate.actions = cartUpdate.actions.concat(
            subscriptions.map(
              (bundledItem) =>
                ({
                  action: 'removeLineItem',
                  lineItemId: bundledItem.lineItemId,
                } as CartRemoveLineItemAction),
            ),
          );
        }

        const commercetoolsCart = await this.updateCart(cart.cartId, cartUpdate, locale, account, organization);

        return (await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale)) as Cart;
      } catch (error) {
        //TODO: better error, get status code etc...
        throw new Error(`removeLineItem failed. ${error}`);
      }
    };

  // @ts-ignore
  order: (
    cart: Cart,
    account?: Account,
    organization?: Organization,
    payload?: { poNumber?: string; orderState?: string },
  ) => Promise<Order> = async (
    cart: Cart,
    account?: Account,
    organization?: Organization,
    payload?: { poNumber?: string; orderState?: string },
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();
      const date = new Date();

      const orderFromCartDraft: OrderFromCartDraft = {
        id: cart.cartId,
        version: +cart.cartVersion,
        orderNumber: `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}-${String(Date.now()).slice(
          -6,
          -1,
        )}`,
        orderState: cart.isPreBuyCart ? 'Open' : 'Confirmed',
      };
      if (typeof payload === 'object' && payload?.poNumber) {
        // @ts-ignore
        orderFromCartDraft.purchaseOrderNumber = payload.poNumber;
      }
      if (typeof payload === 'object' && payload?.orderState) {
        // @ts-ignore
        orderFromCartDraft.state = {
          typeId: 'state',
          id: payload?.orderState,
        };
      }

      if (!isReadyForCheckout(cart)) {
        throw new Error('Cart not complete yet.');
      }
      const config = this.frontasticContext?.project?.configuration?.preBuy;

      const response = await this.associateEndpoints(account, organization)
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
        .execute();

      return CartMapper.commercetoolsOrderToOrder(response.body, locale, config) as Order;
    } catch (error) {
      //TODO: better error, get status code etc...
      throw new Error(`order failed. ${error}`);
    }
  };

  // @ts-ignore
  getOrders: (account: Account, organization?: Organization) => Promise<Order[]> = async (
    account: Account,
    organization?: Organization,
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();
      const config = this.frontasticContext?.project?.configuration?.preBuy;

      const response = await this.associateEndpoints(account, organization)
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
        .execute();

      return response.body.results.map((order) => CartMapper.commercetoolsOrderToOrder(order, locale, config));
    } catch (error) {
      //TODO: better error, get status code etc...
      throw new Error(`get orders failed. ${error}`);
    }
  };

  getOrder: (orderNumber: string, account?: Account, organization?: Organization) => Promise<Order> = async (
    orderNumber: string,
    account?: Account,
    organization?: Organization,
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();
      const config = this.frontasticContext?.project?.configuration?.preBuy;

      const response = await this.associateEndpoints(account, organization)
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
        .execute();

      return CartMapper.commercetoolsOrderToOrder(response.body, locale, config);
    } catch (error) {
      //TODO: better error, get status code etc...
      throw new Error(`get orders failed. ${error}`);
    }
  };

  updateOrderState: (
    orderNumber: string,
    orderState: string,
    account?: Account,
    organization?: Organization,
  ) => Promise<Order> = async (
    orderNumber: string,
    orderState: string,
    account?: Account,
    organization?: Organization,
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();

      const response = await this.getOrder(orderNumber).then((order) => {
        if (order.orderState === 'Complete') {
          throw 'Cannot cancel a Completed order.';
        }
        return this.associateEndpoints(account, organization)
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
          .execute();
      });

      return CartMapper.commercetoolsOrderToOrder(response.body, locale);
    } catch (error) {
      //TODO: better error, get status code etc...
      throw new Error(`get orders failed. ${error}`);
    }
  };

  protected async updateCart(
    cartId: string,
    cartUpdate: CartUpdate,
    locale: Locale,
    account?: Account,
    organization?: Organization,
  ): Promise<CommercetoolsCart> {
    return await this.associateEndpoints(account, organization)
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
        throw new Error(`Update cart failed ${error}`);
      });
  }

  returnItems: (
    orderNumber: string,
    returnLineItems: LineItemReturnItemDraft[],
    account?: Account,
    organization?: Organization,
  ) => Promise<Order> = async (
    orderNumber: string,
    returnLineItems: LineItemReturnItemDraft[],
    account?: Account,
    organization?: Organization,
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();
      const config = this.frontasticContext?.project?.configuration?.preBuy;

      const response = await this.getOrder(orderNumber).then((order) => {
        return this.associateEndpoints(account, organization)
          .orders()
          .withOrderNumber({ orderNumber })
          .post({
            body: {
              version: +order.orderVersion,
              actions: [
                {
                  action: 'addReturnInfo',
                  items: returnLineItems,
                  returnDate: new Date().toISOString(),
                  returnTrackingId: new Date().getTime().toString(),
                },
              ],
            },
          })
          .execute();
      });

      return CartMapper.commercetoolsOrderToOrder(response.body, locale, config);
    } catch (error) {
      //TODO: better error, get status code etc...
      throw error;
    }
  };

  transitionOrderState: (
    orderNumber: string,
    stateKey: string,
    account?: Account,
    organization?: Organization,
  ) => Promise<Order> = async (
    orderNumber: string,
    stateKey: string,
    account?: Account,
    organization?: Organization,
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();
      const config = this.frontasticContext?.project?.configuration?.preBuy;

      const response = await this.getOrder(orderNumber).then((order) => {
        return this.associateEndpoints(account, organization)
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
          .execute();
      });

      return CartMapper.commercetoolsOrderToOrder(response.body, locale, config);
    } catch (error) {
      //TODO: better error, get status code etc...
      throw error;
    }
  };

  getBusinessUnitOrders: (key: string, account?: Account) => Promise<Order[]> = async (
    key: string,
    account?: Account,
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();
      const config = this.frontasticContext?.project?.configuration?.preBuy;

      const endpoint = account
        ? this.requestBuilder()
            .asAssociate()
            .withAssociateIdValue({ associateId: account.accountId })
            .inBusinessUnitKeyWithBusinessUnitKeyValue({ businessUnitKey: key })
        : this.requestBuilder();

      const response = await endpoint
        .orders()
        .get({
          queryArgs: {
            expand: ['state'],
            where: `businessUnit(key="${key}")`,
            sort: 'createdAt desc',
          },
        })
        .execute();

      return response.body.results.map((order) => CartMapper.commercetoolsOrderToOrder(order, locale, config));
    } catch (error) {
      //TODO: better error, get status code etc...
      throw new Error(`get orders failed. ${error}`);
    }
  };

  // @ts-ignore
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

  assertCartOrganization: (cart: Cart, organization: Organization) => boolean = (
    cart: Cart,
    organization: Organization,
  ) => {
    return (
      !!cart.businessUnit &&
      !!cart.store &&
      cart.businessUnit === organization.businessUnit?.key &&
      cart.store === organization.store?.key &&
      cart.isPreBuyCart === organization.store?.isPreBuyStore
    );
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
          } as any,
        ],
      };

      const commercetoolsCart = await this.updateCart(cart.cartId, cartUpdate, locale, account, organization);

      return (await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale)) as Cart;
    } catch (error) {
      //TODO: better error, get status code etc...
      throw new Error(`freeze error failed. ${error}`);
    }
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
          } as any,
        ],
      };
      const commercetoolsCart = await this.updateCart(cart.cartId, cartUpdate, locale, account, organization);

      return (await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale)) as Cart;
    } catch (error) {
      //TODO: better error, get status code etc...
      throw new Error(`freeze error failed. ${error}`);
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
          } as any,
        ],
      };
      const commercetoolsCart = await this.updateCart(cart.cartId, cartUpdate, locale, account, organization);

      return (await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale)) as Cart;
    } catch (error) {
      //TODO: better error, get status code etc...
      throw new Error(`freeze error failed. ${error}`);
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
          } as any,
        ],
      };
      const commercetoolsCart = await this.updateCart(cart.cartId, cartUpdate, locale, account, organization);

      return (await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale)) as Cart;
    } catch (error) {
      //TODO: better error, get status code etc...
      throw new Error(`freeze error failed. ${error}`);
    }
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

  replicateCart: (orderId: string, account?: Account, organization?: Organization) => Promise<Cart> = async (
    orderId: string,
    account?: Account,
    organization?: Organization,
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();
      const response = await this.associateEndpoints(account, organization)
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
        .execute();
      return (await this.buildCartWithAvailableShippingMethods(response.body, locale)) as Cart;
    } catch (e) {
      throw `cannot replicate ${e}`;
    }
  };

  addItemShippingAddress: (
    originalCart: Cart,
    address: AddressDraft,
    account?: Account,
    organization?: Organization,
  ) => Promise<any> = async (
    originalCart: Cart,
    address: AddressDraft,
    account?: Account,
    organization?: Organization,
  ) => {
    const locale = await this.getCommercetoolsLocal();

    const cartUpdate: CartUpdate = {
      version: +originalCart.cartVersion,
      actions: [
        {
          action: 'addItemShippingAddress',
          address: {
            ...address,
            key: address.id,
          },
        },
      ],
    };
    return this.updateCart(originalCart.cartId, cartUpdate, locale, account, organization);
  };

  updateLineItemShippingDetails: (
    cart: Cart,
    lineItemId: string,
    targets?: { addressKey: string; quantity: number }[],
    account?: Account,
    organization?: Organization,
  ) => Promise<Cart> = async (
    cart: Cart,
    lineItemId: string,
    targets?: { addressKey: string; quantity: number }[],
    account?: Account,
    organization?: Organization,
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
    const commercetoolsCart = await this.updateCart(cart.cartId, cartUpdate, locale, account, organization);
    return (await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale)) as Cart;
  };
}
