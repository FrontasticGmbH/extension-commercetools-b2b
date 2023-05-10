import { Cart } from '@Types/cart/Cart';
import { LineItemReturnItemDraft } from 'cofe-ct-b2b-ecommerce/types/cart/LineItem';
import { LineItem } from '@Types/cart/LineItem';
import { Order } from '@Types/cart/Order';
import { Account } from '@Types/account/Account';
import { CartDraft, Cart as CommercetoolsCart, AddressDraft, CartUpdateAction } from '@commercetools/platform-sdk';
import {
  CartAddLineItemAction,
  CartRemoveLineItemAction,
  CartSetCountryAction,
  CartSetLocaleAction,
  CartUpdate,
} from '@commercetools/platform-sdk/dist/declarations/src/generated/models/cart';
import { OrderFromCartDraft } from '@commercetools/platform-sdk/dist/declarations/src/generated/models/order';
import { CartApi as B2BCartApi } from 'cofe-ct-b2b-ecommerce/apis/CartApi';
import { isReadyForCheckout } from 'cofe-ct-ecommerce/utils/Cart';
import { Locale } from 'cofe-ct-ecommerce/interfaces/Locale';
import { Organization } from 'cofe-ct-b2b-ecommerce/types/organization/organization';
import { CartMapper } from '../mappers/CartMapper';
import { BaseCartApi } from '@Commerce-commercetools/apis/BaseCartApi';
import { Context } from '@frontastic/extension-types';

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

export class CartApi extends BaseCartApi {
  protected organization?: Organization;
  protected account?: Account;
  protected associateEndpoints?;

  constructor(frontasticContext: Context, locale: string, organization?: Organization, account?: Account) {
    super(frontasticContext, locale);
    this.account = account;
    this.organization = organization;
    this.associateEndpoints =
      account && organization
        ? this.requestBuilder()
            .asAssociate()
            .withAssociateIdValue({ associateId: account.accountId })
            .inBusinessUnitKeyWithBusinessUnitKeyValue({ businessUnitKey: organization.businessUnit.key })
        : this.requestBuilder();
  }

  getForUser: (account?: Account, organization?: Organization) => Promise<Cart> = async (
    account: Account = this.account,
    organization: Organization = this.organization,
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();
      const subscriptionConfig = this.frontasticContext?.project?.configuration?.subscriptions;
      const where = [
        `customerId="${account.accountId}"`,
        `cartState="Active"`,
        `businessUnit(key="${organization.businessUnit.key}")`,
        `store(key="${organization.store.key}")`,
        `custom(fields(${subscriptionConfig.isSubscriptionCustomFieldNameOnCart} is not defined))`,
      ];

      if (organization.superUserBusinessUnitKey) {
        where.push('origin="Merchant"');
      }

      const response = await this.getApiForProject()
        .carts()
        .get({
          queryArgs: {
            limit: 1,
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
        return (await this.buildCartWithAvailableShippingMethods(response.body.results[0], locale)) as Cart;
      }

      return this.createCart(account.accountId, organization);
    } catch (error) {
      //TODO: better error, get status code etc...
      throw new Error(`getForUser failed. ${error}`);
    }
  };

  createCart: (customerId: string, organization?: Organization) => Promise<Cart> = async (
    customerId: string,
    organization: Organization,
  ) => {
    try {
      const locale = await this.getCommercetoolsLocal();
      const config = this.frontasticContext?.project?.configuration?.preBuy;

      const cartDraft: CartDraft = {
        currency: locale.currency,
        country: locale.country,
        locale: locale.language,
        customerId,
        businessUnit: {
          key: organization.businessUnit.key,
          typeId: 'business-unit',
        },
        store: {
          key: organization.store.key,
          typeId: 'store',
        },
        inventoryMode: 'ReserveOnOrder',
        origin: organization.superUserBusinessUnitKey ? 'Merchant' : 'Customer',
      };

      if (organization.store.isPreBuyStore) {
        // @ts-ignore
        cartDraft.custom = {
          type: {
            typeId: 'type',
            key: config.orderCustomType,
          },
          fields: {
            [config.orderCustomField]: true,
          },
        };
        // @ts-ignore
        cartDraft.inventoryMode = 'None';
      }

      const commercetoolsCart = await this.getApiForProject()
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

      const response = await this.getApiForProject()
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

      const response = await this.getApiForProject()
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

      const response = await this.getApiForProject()
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
        return this.getApiForProject()
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
        return this.getApiForProject()
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

  getBusinessUnitOrders: (keys: string) => Promise<Order[]> = async (keys: string) => {
    try {
      const locale = await this.getCommercetoolsLocal();
      const config = this.frontasticContext?.project?.configuration?.preBuy;

      const endpoint = this.account
        ? this.requestBuilder()
            .asAssociate()
            .withAssociateIdValue({ associateId: this.account.accountId })
            .inBusinessUnitKeyWithBusinessUnitKeyValue({ businessUnitKey: key })
        : this.requestBuilder();

      const response = await endpoint
        .orders()
        .get({
          queryArgs: {
            expand: ['state'],
            where: `businessUnit(key in (${keys}))`,
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

  freezeCart: (cart: Cart) => Promise<Cart> = async (cart: Cart) => {
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

      const commercetoolsCart = await this.updateCart(cart.cartId, cartUpdate, locale);

      return (await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale)) as Cart;
    } catch (error) {
      //TODO: better error, get status code etc...
      throw new Error(`freeze error failed. ${error}`);
    }
  };

  unfreezeCart: (cart: Cart) => Promise<Cart> = async (cart: Cart) => {
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
      const commercetoolsCart = await this.updateCart(cart.cartId, cartUpdate, locale);

      return (await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale)) as Cart;
    } catch (error) {
      //TODO: better error, get status code etc...
      throw new Error(`freeze error failed. ${error}`);
    }
  };

  setCartExpirationDays: (cart: Cart, deleteDaysAfterLastModification: number) => Promise<Cart> = async (
    cart: Cart,
    deleteDaysAfterLastModification: number,
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
      const commercetoolsCart = await this.updateCart(cart.cartId, cartUpdate, locale);

      return (await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale)) as Cart;
    } catch (error) {
      //TODO: better error, get status code etc...
      throw new Error(`freeze error failed. ${error}`);
    }
  };

  setCustomType: (cart: Cart, type: string, fields: any) => Promise<Cart> = async (
    cart: Cart,
    type: string,
    fields: any,
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
      const commercetoolsCart = await this.updateCart(cart.cartId, cartUpdate, locale);

      return (await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale)) as Cart;
    } catch (error) {
      //TODO: better error, get status code etc...
      throw new Error(`freeze error failed. ${error}`);
    }
  };

  protected recreate: (primaryCommercetoolsCart: CommercetoolsCart, locale: Locale) => Promise<Cart> = async (
    primaryCommercetoolsCart: CommercetoolsCart,
    locale: Locale,
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

    let replicatedCommercetoolsCart = await this.associateEndpoints
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

        replicatedCommercetoolsCart = await this.updateCart(replicatedCommercetoolsCart.id, cartUpdate, locale);
      } catch (error) {
        // Ignore that a line item could not be added due to missing price, etc
      }
    }

    // Delete previous cart
    await this.deleteCart(primaryCartId, cartVersion);

    return CartMapper.commercetoolsCartToCart(replicatedCommercetoolsCart, locale);
  };

  deleteCart: (primaryCartId: string, cartVersion: number) => Promise<void> = async (
    primaryCartId: string,
    cartVersion: number,
  ) => {
    await this.associateEndpoints
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

  replicateCart: (orderId: string) => Promise<Cart> = async (orderId: string) => {
    try {
      const locale = await this.getCommercetoolsLocal();
      const response = await this.associateEndpoints
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

  addItemShippingAddress: (originalCart: Cart, address: AddressDraft) => Promise<any> = async (
    originalCart: Cart,
    address: AddressDraft,
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
    return this.updateCart(originalCart.cartId, cartUpdate, locale);
  };

  updateLineItemShippingDetails: (
    cart: Cart,
    lineItemId: string,
    targets?: { addressKey: string; quantity: number }[],
  ) => Promise<Cart> = async (cart: Cart, lineItemId: string, targets?: { addressKey: string; quantity: number }[]) => {
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
    const commercetoolsCart = await this.updateCart(cart.cartId, cartUpdate, locale);
    return (await this.buildCartWithAvailableShippingMethods(commercetoolsCart, locale)) as Cart;
  };
}
