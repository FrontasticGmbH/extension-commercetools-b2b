import { Cart } from '@Types/cart/Cart';
import { LineItemReturnItemDraft } from '@Types/cart/LineItem';
import { LineItem } from '@Types/cart/LineItem';
import { Order } from '@Types/cart/Order';
import { Account } from '@Types/account/Account';
import { CartDraft, Cart as CommercetoolsCart } from '@commercetools/platform-sdk';
import {
  CartAddLineItemAction,
  CartRemoveLineItemAction,
  CartSetCountryAction,
  CartSetLocaleAction,
  CartUpdate,
} from '@commercetools/platform-sdk/dist/declarations/src/generated/models/cart';
import { OrderFromCartDraft } from '@commercetools/platform-sdk/dist/declarations/src/generated/models/order';
import { B2BCartApi } from './B2BCartApi';
import { isReadyForCheckout } from '../utils/Cart';
import { Locale } from '../interfaces/Locale';
import { Organization } from '@Types/organization/organization';
import { CartMapper } from '../mappers/CartMapper';

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

export class CartApi extends B2BCartApi {
  getAllCarts: (account?: Account, organization?: Organization) => Promise<CommercetoolsCart[]> = async (
    account: Account = this.account,
    organization: Organization = this.organization,
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

      const response = await this.associateEndpoints
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

  createCart: (customerId?: string, organization?: Organization) => Promise<Cart> = async (
    customerId: string = this.account?.accountId,
    organization: Organization = this.organization,
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
        cartDraft.customerId = customerId;
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

      const commercetoolsCart = await this.associateEndpoints
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

  addSubscriptionsToCart: (cart: Cart, lineItems: LineItem[]) => Promise<Cart> = async (
    cart: Cart,
    lineItems: LineItem[],
  ) => {
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
      const commercetoolsCart = await this.updateCart(cart.cartId, cartUpdate, locale);

      return (await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale)) as Cart;
    } catch (error) {
      //TODO: better error, get status code etc...
      throw new Error(`addToCart failed. ${error}`);
    }
  };

  // @ts-ignore
  removeLineItem: (cart: Cart, lineItem: LineItem) => Promise<Cart> = async (cart: Cart, lineItem: LineItem) => {
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

      const commercetoolsCart = await this.updateCart(cart.cartId, cartUpdate, locale);

      return (await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale)) as Cart;
    } catch (error) {
      //TODO: better error, get status code etc...
      throw new Error(`removeLineItem failed. ${error}`);
    }
  };

  // @ts-ignore
  order: (cart: Cart, payload?: { poNumber?: string; orderState?: string }) => Promise<Order> = async (
    cart: Cart,
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

      const response = await this.associateEndpoints
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
  getOrders: (account: Account) => Promise<Order[]> = async (account: Account) => {
    try {
      const locale = await this.getCommercetoolsLocal();
      const config = this.frontasticContext?.project?.configuration?.preBuy;

      const response = await this.associateEndpoints
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

  getOrder: (orderNumber: string) => Promise<Order> = async (orderNumber: string) => {
    try {
      const locale = await this.getCommercetoolsLocal();
      const config = this.frontasticContext?.project?.configuration?.preBuy;

      const response = await this.associateEndpoints
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

  returnItems: (orderNumber: string, returnLineItems: LineItemReturnItemDraft[]) => Promise<Order> = async (
    orderNumber: string,
    returnLineItems: LineItemReturnItemDraft[],
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();
      const config = this.frontasticContext?.project?.configuration?.preBuy;

      const response = await this.getOrder(orderNumber).then((order) => {
        return this.associateEndpoints
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

  transitionOrderState: (orderNumber: string, stateKey: string) => Promise<Order> = async (
    orderNumber: string,
    stateKey: string,
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();
      const config = this.frontasticContext?.project?.configuration?.preBuy;

      const response = await this.getOrder(orderNumber).then((order) => {
        return this.associateEndpoints
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

  getBusinessUnitOrders: (key: string) => Promise<Order[]> = async (key: string) => {
    try {
      const locale = await this.getCommercetoolsLocal();
      const config = this.frontasticContext?.project?.configuration?.preBuy;

      const endpoint = this.account
        ? this.getApiForProject()
            .asAssociate()
            .withAssociateIdValue({ associateId: this.account.accountId })
            .inBusinessUnitKeyWithBusinessUnitKeyValue({ businessUnitKey: key })
        : this.getApiForProject();

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
  protected assertCorrectLocale: (commercetoolsCart: CommercetoolsCart, locale: Locale) => Promise<Cart> = async (
    commercetoolsCart: CommercetoolsCart,
    locale: Locale,
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

      commercetoolsCart = await this.updateCart(commercetoolsCart.id, cartUpdate, locale);

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
}
