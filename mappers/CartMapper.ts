import {
  Cart as CommercetoolsCart,
  Order as CommercetoolsOrder,
  LineItem as CommercetoolsLineItem,
  State,
} from '@commercetools/platform-sdk';
import { CartMapper as BaseCartMapper } from 'cofe-ct-ecommerce/mappers/CartMapper';
import { CartMapper as B2BCartMapper } from 'cofe-ct-b2b-ecommerce/mappers/CartMapper';
import { Locale } from 'cofe-ct-ecommerce/interfaces/Locale';
import { ProductMapper as B2BProductMapper } from 'cofe-ct-b2b-ecommerce/mappers/ProductMapper';
import { ProductRouter } from '../utils/ProductRouter';
import { LineItem } from '@Types/cart/LineItem';
import { Cart } from 'cofe-ct-b2b-ecommerce/types/cart/Cart';
import { Order } from '@Types/cart/Order';

export class CartMapper extends B2BCartMapper {
  static commercetoolsCartToCart(
    commercetoolsCart: CommercetoolsCart,
    locale: Locale,
    config?: Record<string, string>,
  ): Cart {
    return {
      cartId: commercetoolsCart.id,
      cartVersion: commercetoolsCart.version.toString(),
      lineItems: this.commercetoolsLineItemsToLineItems(commercetoolsCart.lineItems, locale),
      email: commercetoolsCart?.customerEmail,
      sum: B2BProductMapper.commercetoolsMoneyToMoney(commercetoolsCart.totalPrice),
      shippingAddress: this.commercetoolsAddressToAddress(commercetoolsCart.shippingAddress),
      billingAddress: this.commercetoolsAddressToAddress(commercetoolsCart.billingAddress),
      shippingInfo: this.commercetoolsShippingInfoToShippingInfo(commercetoolsCart.shippingInfo, locale),
      payments: this.commercetoolsPaymentInfoToPayments(commercetoolsCart.paymentInfo, locale),
      discountCodes: this.commercetoolsDiscountCodesInfoToDiscountCodes(commercetoolsCart.discountCodes, locale),
      directDiscounts: commercetoolsCart.directDiscounts?.length,
      taxed: this.commercetoolsTaxedPriceToTaxed(commercetoolsCart.taxedPrice, locale),
      itemShippingAddresses: commercetoolsCart.itemShippingAddresses,
      origin: commercetoolsCart.origin,
      isPreBuyCart: !!config ? commercetoolsCart.custom?.fields?.[config.orderCustomField] : false,
    };
  }

  static commercetoolsLineItemsToLineItems(
    commercetoolsLineItems: CommercetoolsLineItem[],
    locale: Locale,
  ): LineItem[] {
    const lineItems: LineItem[] = [];

    commercetoolsLineItems?.forEach((commercetoolsLineItem) => {
      const item: LineItem = {
        lineItemId: commercetoolsLineItem.id,
        name: commercetoolsLineItem?.name[locale.language] || '',
        type: 'variant',
        count: commercetoolsLineItem.quantity,
        price: B2BProductMapper.commercetoolsMoneyToMoney(commercetoolsLineItem.price?.value),
        discountedPrice: B2BProductMapper.commercetoolsMoneyToMoney(commercetoolsLineItem.price?.discounted?.value),
        discountTexts: this.commercetoolsDiscountedPricesPerQuantityToDiscountTexts(
          commercetoolsLineItem.discountedPricePerQuantity,
          locale,
        ),
        discounts: this.commercetoolsDiscountedPricesPerQuantityToDiscounts(
          commercetoolsLineItem.discountedPricePerQuantity,
          locale,
        ),
        totalPrice: B2BProductMapper.commercetoolsMoneyToMoney(commercetoolsLineItem.totalPrice),
        custom: commercetoolsLineItem.custom,
        parentId: commercetoolsLineItem.custom?.fields?.parentId,
        variant: B2BProductMapper.commercetoolsProductVariantToVariant(
          commercetoolsLineItem.variant,
          locale,
          commercetoolsLineItem.price,
        ),
        isGift:
          commercetoolsLineItem?.lineItemMode !== undefined && commercetoolsLineItem.lineItemMode === 'GiftLineItem',
        shippingDetails: commercetoolsLineItem.shippingDetails,
      };
      item._url = ProductRouter.generateUrlFor(item);
      lineItems.push(item);
    });

    return lineItems;
  }

  static commercetoolsOrderToOrder(
    commercetoolsOrder: CommercetoolsOrder,
    locale: Locale,
    config?: Record<string, string>,
  ): Order {
    return {
      cartId: commercetoolsOrder.id,
      origin: commercetoolsOrder.origin,
      orderState: commercetoolsOrder.orderState,
      orderId: commercetoolsOrder.orderNumber,
      orderVersion: commercetoolsOrder.version.toString(),
      lineItems: this.commercetoolsLineItemsToLineItems(commercetoolsOrder.lineItems, locale),
      email: commercetoolsOrder?.customerEmail,
      shippingAddress: this.commercetoolsAddressToAddress(commercetoolsOrder.shippingAddress),
      billingAddress: this.commercetoolsAddressToAddress(commercetoolsOrder.billingAddress),
      sum: B2BProductMapper.commercetoolsMoneyToMoney(commercetoolsOrder.totalPrice),
      businessUnit: commercetoolsOrder.businessUnit?.key,
      createdAt: commercetoolsOrder.createdAt,
      shippingInfo: this.commercetoolsShippingInfoToShippingInfo(commercetoolsOrder.shippingInfo, locale),
      returnInfo: this.commercetoolsReturnInfoToReturnInfo(commercetoolsOrder.returnInfo),
      isPreBuyCart: !!config ? commercetoolsOrder.custom?.fields?.[config.orderCustomField] : false,
      state: this.commercetoolsOrderStateToState(commercetoolsOrder.state?.obj, locale),
    };
  }

  static commercetoolsOrderStateToState(commercetoolsState: State, locale: Locale): any {
    return commercetoolsState
      ? {
          key: commercetoolsState.key,
          name: commercetoolsState.name[locale.language],
        }
      : null;
  }
}
// Override the BaseMapper with new Mapper functions
Object.getOwnPropertyNames(CartMapper).forEach((key) => {
  if (typeof CartMapper[key] === 'function') {
    BaseCartMapper[key] = CartMapper[key];
    B2BCartMapper[key] = CartMapper[key];
  }
});
