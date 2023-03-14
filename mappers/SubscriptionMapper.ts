import { CustomFields } from '@commercetools/platform-sdk';
import { Locale } from 'cofe-ct-ecommerce/interfaces/Locale';
import { CartMapper } from './CartMapper';
import { ProductMapper as B2BProductMapper } from 'cofe-ct-b2b-ecommerce/mappers/ProductMapper';
import { Cart as CommercetoolsCart } from '@commercetools/platform-sdk';
import { Cart } from '@Types/cart/Cart';
import { Subscription } from '@Types/cart/Cart';
export class SubscriptionMapper {
  static commercetoolsCartToCart(
    commercetoolsCart: CommercetoolsCart,
    locale: Locale,
    config?: Record<string, string>,
  ): Cart {
    return {
      cartId: commercetoolsCart.id,
      cartVersion: commercetoolsCart.version.toString(),
      lineItems: CartMapper.commercetoolsLineItemsToLineItems(commercetoolsCart.lineItems, locale),
      email: commercetoolsCart?.customerEmail,
      sum: B2BProductMapper.commercetoolsMoneyToMoney(commercetoolsCart.totalPrice),
      shippingAddress: CartMapper.commercetoolsAddressToAddress(commercetoolsCart.shippingAddress),
      billingAddress: CartMapper.commercetoolsAddressToAddress(commercetoolsCart.billingAddress),
      shippingInfo: CartMapper.commercetoolsShippingInfoToShippingInfo(commercetoolsCart.shippingInfo, locale),
      payments: CartMapper.commercetoolsPaymentInfoToPayments(commercetoolsCart.paymentInfo, locale),
      discountCodes: CartMapper.commercetoolsDiscountCodesInfoToDiscountCodes(commercetoolsCart.discountCodes, locale),
      directDiscounts: commercetoolsCart.directDiscounts?.length,
      taxed: CartMapper.commercetoolsTaxedPriceToTaxed(commercetoolsCart.taxedPrice, locale),
      itemShippingAddresses: commercetoolsCart.itemShippingAddresses,
      origin: commercetoolsCart.origin,
      subscription: SubscriptionMapper.commercetoolsCustomToSubscriptions(commercetoolsCart.custom, locale, config),
    };
  }

  private static commercetoolsCustomToSubscriptions(
    commercetoolsCustom: CustomFields,
    locale: Locale,
    config?: Record<string, string>,
  ): Subscription {
    if (!config) {
      return {};
    }
    return {
      order: commercetoolsCustom?.fields?.[config.orderCustomFieldNameOnCart]?.obj,
      sku: commercetoolsCustom?.fields?.[config.skuCustomFieldNameOnCart],
      product: B2BProductMapper.commercetoolsProductProjectionToProduct(
        commercetoolsCustom?.fields?.[config.productCustomFieldNameOnCart]?.obj?.masterData?.current,
        locale,
      ),
      nextDeliveryDate: commercetoolsCustom?.fields?.[config.nextAccuranceCustomFieldNameOnCart],
      isActive: commercetoolsCustom?.fields?.[config.isActiveCustomFieldNameOnCart],
    };
  }
}
