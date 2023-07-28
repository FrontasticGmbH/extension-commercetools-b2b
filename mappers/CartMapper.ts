import {
  Cart as CommercetoolsCart,
  LineItem as CommercetoolsLineItem,
  Order as CommercetoolsOrder,
  ReturnItemDraft,
  StateReference,
} from '@commercetools/platform-sdk';
import { BaseCartMapper } from './BaseCartMapper';
import { Locale } from '@Commerce-commercetools/interfaces/Locale';
import { ProductMapper } from './ProductMapper';
import { ProductRouter } from '../utils/ProductRouter';
import { LineItem, ReturnLineItem } from '@Types/cart/LineItem';
import { Cart } from '@Types/cart/Cart';
import { Order, ReturnInfo } from '@Types/cart/Order';
import { ReturnInfo as CommercetoolsReturnInfo } from '@commercetools/platform-sdk/dist/declarations/src/generated/models/order';

export class CartMapper extends BaseCartMapper {
  static commercetoolsCartToCart(
    commercetoolsCart: CommercetoolsCart,
    locale: Locale,
    config?: Record<string, string>,
  ): Cart {
    return {
      cartId: commercetoolsCart.id,
      customerId: commercetoolsCart.customerId,
      cartVersion: commercetoolsCart.version.toString(),
      lineItems: this.commercetoolsLineItemsToLineItems(commercetoolsCart.lineItems, locale),
      email: commercetoolsCart?.customerEmail,
      sum: ProductMapper.commercetoolsMoneyToMoney(commercetoolsCart.totalPrice),
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
      businessUnit: commercetoolsCart.businessUnit?.key,
      store: commercetoolsCart.store?.key,
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
        productId: commercetoolsLineItem.productId,
        name: commercetoolsLineItem?.name[locale.language] || '',
        type: 'variant',
        count: commercetoolsLineItem.quantity,
        price: ProductMapper.commercetoolsMoneyToMoney(commercetoolsLineItem.price?.value),
        discountedPrice: ProductMapper.commercetoolsMoneyToMoney(commercetoolsLineItem.price?.discounted?.value),
        discountTexts: this.commercetoolsDiscountedPricesPerQuantityToDiscountTexts(
          commercetoolsLineItem.discountedPricePerQuantity,
          locale,
        ),
        discounts: this.commercetoolsDiscountedPricesPerQuantityToDiscounts(
          commercetoolsLineItem.discountedPricePerQuantity,
          locale,
        ),
        totalPrice: ProductMapper.commercetoolsMoneyToMoney(commercetoolsLineItem.totalPrice),
        custom: commercetoolsLineItem.custom,
        parentId: commercetoolsLineItem.custom?.fields?.parentId,
        variant: ProductMapper.commercetoolsProductVariantToVariant(
          commercetoolsLineItem.variant,
          locale,
          commercetoolsLineItem.price,
        ),
        isGift:
          commercetoolsLineItem?.lineItemMode !== undefined && commercetoolsLineItem.lineItemMode === 'GiftLineItem',
        // shippingDetails: commercetoolsLineItem.shippingDetails,
        shippingAddresses: commercetoolsLineItem.shippingDetails,
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
      customerId: commercetoolsOrder.customerId,
      origin: commercetoolsOrder.origin,
      orderState: commercetoolsOrder.orderState,
      orderId: commercetoolsOrder.orderNumber,
      orderVersion: commercetoolsOrder.version.toString(),
      lineItems: this.commercetoolsLineItemsToLineItems(commercetoolsOrder.lineItems, locale),
      email: commercetoolsOrder?.customerEmail,
      shippingAddress: this.commercetoolsAddressToAddress(commercetoolsOrder.shippingAddress),
      billingAddress: this.commercetoolsAddressToAddress(commercetoolsOrder.billingAddress),
      sum: ProductMapper.commercetoolsMoneyToMoney(commercetoolsOrder.totalPrice),
      businessUnit: commercetoolsOrder.businessUnit?.key,
      createdAt: new Date(commercetoolsOrder.createdAt),
      shippingInfo: this.commercetoolsShippingInfoToShippingInfo(commercetoolsOrder.shippingInfo, locale),
      returnInfo: this.commercetoolsReturnInfoToReturnInfo(commercetoolsOrder.returnInfo),
      isPreBuyCart: !!config ? commercetoolsOrder.custom?.fields?.[config.orderCustomField] : false,
      state: this.commercetoolsOrderStateToState(commercetoolsOrder.state, locale),
    };
  }

  static commercetoolsOrderStateToState(commercetoolsStateRef: StateReference, locale: Locale): any {
    if (commercetoolsStateRef) {
      return commercetoolsStateRef.obj
        ? {
            key: commercetoolsStateRef.obj?.key,
            name: commercetoolsStateRef.obj?.name[locale.language],
          }
        : {
            id: commercetoolsStateRef.id,
          };
    }
    return null;
  }

  static commercetoolsReturnInfoToReturnInfo(commercetoolsReturnInfo: CommercetoolsReturnInfo[]): ReturnInfo[] {
    return commercetoolsReturnInfo.map((ctReturnInfo) => ({
      returnDate: ctReturnInfo.returnDate,
      returnTrackingId: ctReturnInfo.returnTrackingId,
      items: ctReturnInfo.items.map((item) => ({
        comment: item.comment,
        createdAt: item.createdAt,
        // @ts-ignore
        lineItemId: item.lineItemId,
        returnInfoId: item.id,
        count: item.quantity,
        shipmentState: item.shipmentState,
      })),
    }));
  }

  static returnLineItemToCommercetoolsReturnItemDraft(returnItem: ReturnLineItem[]): ReturnItemDraft[] {
    return returnItem.map((item) => ({
      quantity: item.count,
      lineItemId: item.lineItemId,
      shipmentState: 'Returned', //Initial state for Return Items that are refundable.
      comment: item?.comment,
    }));
  }
}

// Override the BaseMapper with new Mapper functions
Object.getOwnPropertyNames(CartMapper).forEach((key) => {
  if (typeof CartMapper[key] === 'function') {
    BaseCartMapper[key] = CartMapper[key];
  }
});
