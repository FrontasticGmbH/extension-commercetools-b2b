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
import { LineItem, LineItemShippingAddress } from '@Types/cart/LineItem';
import { Cart } from '@Types/cart/Cart';
import { Order, ReturnInfo, ReturnLineItem } from '@Types/cart/Order';
import {
  LineItemReturnItem,
  ReturnInfo as CommercetoolsReturnInfo,
} from '@commercetools/platform-sdk/dist/declarations/src/generated/models/order';

export class CartMapper extends BaseCartMapper {
  static commercetoolsCartToCart(commercetoolsCart: CommercetoolsCart, locale: Locale): Cart {
    return {
      cartId: commercetoolsCart.id,
      accountId: commercetoolsCart.customerId,
      cartVersion: commercetoolsCart.version.toString(),
      lineItems: this.commercetoolsLineItemsToLineItems(commercetoolsCart.lineItems, locale),
      email: commercetoolsCart?.customerEmail,
      sum: ProductMapper.commercetoolsMoneyToMoney(commercetoolsCart.totalPrice),
      shippingAddress: this.commercetoolsAddressToAddress(commercetoolsCart.shippingAddress),
      billingAddress: this.commercetoolsAddressToAddress(commercetoolsCart.billingAddress),
      shippingInfo: this.commercetoolsShippingInfoToShippingInfo(commercetoolsCart.shippingInfo, locale),
      payments: this.commercetoolsPaymentInfoToPayments(commercetoolsCart.paymentInfo, locale),
      discountCodes: this.commercetoolsDiscountCodesInfoToDiscountCodes(commercetoolsCart.discountCodes, locale),
      taxed: this.commercetoolsTaxedPriceToTaxed(commercetoolsCart.taxedPrice, locale),
      itemShippingAddresses: commercetoolsCart.itemShippingAddresses,
      origin: commercetoolsCart.origin,
      businessUnitKey: commercetoolsCart.businessUnit?.key,
      storeKey: commercetoolsCart.store?.key,
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
        variant: ProductMapper.commercetoolsProductVariantToVariant(
          commercetoolsLineItem.variant,
          locale,
          commercetoolsLineItem.price,
        ),
        isGift:
          commercetoolsLineItem?.lineItemMode !== undefined && commercetoolsLineItem.lineItemMode === 'GiftLineItem',
        shippingDetails: {
          shippingAddresses: commercetoolsLineItem.shippingDetails?.targets?.map((commercetoolsItemShippingTarget) => {
            const lineItemShippingAddress: LineItemShippingAddress = {
              count: commercetoolsItemShippingTarget.quantity,
              addressKey: commercetoolsItemShippingTarget.addressKey,
            };
            return lineItemShippingAddress;
          }),
          valid: commercetoolsLineItem.shippingDetails?.valid,
        },
      };
      item._url = ProductRouter.generateUrlFor(item);
      lineItems.push(item);
    });

    return lineItems;
  }

  static commercetoolsOrderToOrder(commercetoolsOrder: CommercetoolsOrder, locale: Locale): Order {
    return {
      cartId: commercetoolsOrder.id,
      accountId: commercetoolsOrder.customerId,
      origin: commercetoolsOrder.origin,
      orderState: commercetoolsOrder.orderState,
      orderId: commercetoolsOrder.orderNumber,
      orderVersion: commercetoolsOrder.version.toString(),
      lineItems: this.commercetoolsLineItemsToLineItems(commercetoolsOrder.lineItems, locale),
      email: commercetoolsOrder?.customerEmail,
      shippingAddress: this.commercetoolsAddressToAddress(commercetoolsOrder.shippingAddress),
      billingAddress: this.commercetoolsAddressToAddress(commercetoolsOrder.billingAddress),
      sum: ProductMapper.commercetoolsMoneyToMoney(commercetoolsOrder.totalPrice),
      businessUnitKey: commercetoolsOrder.businessUnit?.key,
      storeKey: commercetoolsOrder.store?.key,
      createdAt: new Date(commercetoolsOrder.createdAt),
      shippingInfo: this.commercetoolsShippingInfoToShippingInfo(commercetoolsOrder.shippingInfo, locale),
      returnInfo: this.commercetoolsReturnInfoToReturnInfo(commercetoolsOrder.returnInfo),
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
    return commercetoolsReturnInfo.map((returnInfo) => ({
      returnDate: new Date(returnInfo.returnDate),
      returnTrackingId: returnInfo.returnTrackingId,
      lineItems: returnInfo.items.map((returnItem) => ({
        returnLineItemId: returnItem.id,
        count: returnItem.quantity,
        lineItemId: (returnItem as LineItemReturnItem)?.lineItemId,
        comment: returnItem.comment,
        createdAt: new Date(returnItem.createdAt),
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
