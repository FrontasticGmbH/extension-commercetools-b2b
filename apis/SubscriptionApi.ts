import { BaseApi } from './BaseApi';
import { calculateNextDeliveryDate, getSubscriptionGroups } from '../utils/Cart';
import { Product } from '@Types/product/Product';
import { ProductApi } from './ProductApi';
import { ProductQuery } from '@Types/query/ProductQuery';
import { Order } from '@Types/cart/Order';
import { Cart } from '@Types/cart/Cart';
import { CartApi } from './CartApi';
import { SubscriptionMapper } from '../mappers/SubscriptionMapper';

export class SubscriptionApi extends BaseApi {
  getSubscriptionsForAccount = async (accountId: string): Promise<Cart[]> => {
    try {
      const locale = await this.getCommercetoolsLocal();
      const config = this.frontasticContext?.project?.configuration?.subscriptions;
      if (config.orderCustomFieldNameOnCart && accountId) {
        const response = await this.requestBuilder()
          .carts()
          .get({
            queryArgs: {
              where: [`customerId="${accountId}"`, `custom(fields(${config.orderCustomFieldNameOnCart} is defined))`],
              expand: [
                'lineItems[*].variant',
                'store',
                `custom.fields.${config.orderCustomFieldNameOnCart}`,
                `custom.fields.${config.productCustomFieldNameOnCart}`,
              ],
            },
          })
          .execute();

        return response.body.results.map((commercetoolsCart) =>
          SubscriptionMapper.commercetoolsCartToCart(commercetoolsCart, locale, config),
        );
      }
      console.error('config for subscriptions is not in place');
      return [];
    } catch (error) {
      throw new Error(`Get subscriptions for account failed: ${error}`);
    }
  };

  handleSubscriptionsOnOrder = async (cart: Cart, order: Order, distributionChannelId: string): Promise<void> => {
    const config = this.frontasticContext?.project?.configuration?.subscriptions;
    if (
      config?.customLineItemKeyOfBundle &&
      config?.customLineItemKeyOfSubscription &&
      config.subscriptionProductAttributeName &&
      config.customTypeKeyOnCart &&
      config.orderCustomFieldNameOnCart &&
      config.productCustomFieldNameOnCart &&
      config.skuCustomFieldNameOnCart &&
      config.isActiveCustomFieldNameOnCart &&
      config.isSubscriptionCustomFieldNameOnCart &&
      config.nextAccuranceCustomFieldNameOnCart
    ) {
      const subscriptionGroups = getSubscriptionGroups(cart, config);

      if (subscriptionGroups) {
        const productApi = new ProductApi(this.frontasticContext, this.locale, this.currency);
        const cartApi = new CartApi(this.frontasticContext, this.locale);

        for await (const sku of Object.keys(subscriptionGroups)) {
          const interval = config?.subscriptionProductAttributeName
            ? parseInt(subscriptionGroups[sku].variant?.attributes?.[config.subscriptionProductAttributeName]?.key)
            : 0;
          const nextDeliveryDate = calculateNextDeliveryDate(subscriptionGroups[sku].variant, interval);
          const productQuery: ProductQuery = {
            skus: [sku],
          };
          const subscriptionProduct: Product = await productApi.getProduct(productQuery);

          //create cart
          let nextCart: Cart = (await cartApi.replicateCart(order.cartId)) as Cart;
          nextCart = (await cartApi.setCartExpirationDays(nextCart, interval + 1)) as Cart;
          nextCart = (await cartApi.removeAllLineItems(nextCart)) as Cart;
          nextCart = (await cartApi.addItemsToCart(
            nextCart,
            subscriptionGroups[sku].lineItems,
            distributionChannelId,
          )) as Cart;
          nextCart = (await cartApi.setCustomType(nextCart, config.customTypeKeyOnCart, {
            [config.orderCustomFieldNameOnCart]: {
              typeId: 'order',
              id: order.cartId,
            },
            [config.productCustomFieldNameOnCart]: {
              typeId: 'product',
              id: subscriptionProduct.productId,
            },
            [config.skuCustomFieldNameOnCart]: sku,
            [config.nextAccuranceCustomFieldNameOnCart]: nextDeliveryDate,
            [config.isSubscriptionCustomFieldNameOnCart]: true,
            [config.isActiveCustomFieldNameOnCart]: true,
          })) as Cart;
        }
      }
    }
  };
}
