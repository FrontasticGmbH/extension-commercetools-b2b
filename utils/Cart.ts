import { Cart } from 'cofe-ct-b2b-ecommerce/types/cart/Cart';
import { LineItem } from 'cofe-ct-b2b-ecommerce/types/cart/LineItem';
import { Variant } from '@commercetools/frontend-domain-types/product/Variant';

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
