import { Cart } from '@Types/cart/Cart';
import { LineItem } from '@Types/cart/LineItem';
import { Variant } from '@Types/product/Variant';

export const hasUser = (cart: Cart): boolean => {
  return cart.email !== undefined;
};

export const hasShippingAddress = (cart: Cart): boolean => {
  return (
    cart.shippingAddress !== undefined &&
    cart.shippingAddress.firstName !== undefined &&
    cart.shippingAddress.lastName !== undefined &&
    cart.shippingAddress.postalCode !== undefined &&
    cart.shippingAddress.city !== undefined &&
    cart.shippingAddress.country !== undefined
  );
};

export const hasBillingAddress = (cart: Cart): boolean => {
  return (
    cart.billingAddress !== undefined &&
    cart.billingAddress.firstName !== undefined &&
    cart.billingAddress.lastName !== undefined &&
    cart.billingAddress.postalCode !== undefined &&
    cart.billingAddress.city !== undefined &&
    cart.billingAddress.country !== undefined
  );
};

export const hasAddresses = (cart: Cart): boolean => {
  return hasShippingAddress(cart) && hasBillingAddress(cart);
};

export const isReadyForCheckout = (cart: Cart): boolean => {
  return hasUser(cart) && hasAddresses(cart);
};

export const calculateNextDeliveryDate = (variant: Variant, interval: number): string => {
  if (interval) {
    const date = new Date();
    date.setDate(date.getDate() + interval);
    return date.toJSON();
  }
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toJSON();
};

export const getSubscriptionGroups = (
  cart: Cart,
  config: Record<string, string>,
): Record<string, { lineItems: LineItem[]; variant: Variant }> => {
  if (cart && config?.customLineItemKeyOfBundle) {
    const subscriptionItems: LineItem[] = cart.lineItems?.filter(
      (lineItem) => !!lineItem.custom?.fields?.[config.customLineItemKeyOfBundle],
    );
    const uniqueSubscriptionSkusMap = subscriptionItems
      ?.map((lineItem) => lineItem.variant)
      .reduce((prev, variant) => {
        prev[variant.sku] = { lineItems: [], variant };
        return prev;
      }, {});
    const uniqueSubscriptionSkus = Object.keys(uniqueSubscriptionSkusMap);
    if (uniqueSubscriptionSkus.length) {
      uniqueSubscriptionSkus.forEach((sku) => {
        const parentItemIds = subscriptionItems
          .filter((lineItem) => lineItem.variant.sku === sku)
          .map((lineItem) => lineItem.custom.fields[config.customLineItemKeyOfBundle]);
        const parentLineItems = cart.lineItems?.filter((lineItem) => parentItemIds?.includes(lineItem.lineItemId));
        uniqueSubscriptionSkusMap[sku].lineItems = parentLineItems;
      });
      return uniqueSubscriptionSkusMap;
    }
  }
  return undefined;
};
