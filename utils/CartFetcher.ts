import { ActionContext, Request } from '@frontastic/extension-types';
import { Cart } from '@Types/cart/Cart';
import { CartApi } from '../apis/CartApi';
import { getCurrency, getLocale } from './Request';
import { BaseCartFetcher } from './BaseCartFetcher';

export class CartFetcher extends BaseCartFetcher {
  static async fetchCart(request: Request, actionContext: ActionContext): Promise<Cart> | undefined {
    const businessUnitKey = request?.query?.['businessUnitKey'];
    const storeKey = request?.query?.['storeKey'];

    const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

    if (request.sessionData?.cartId !== undefined) {
      const cart = (await cartApi.getById(request.sessionData.cartId)) as Cart;

      if (
        cartApi.assertCartForBusinessUnitAndStore(cart, request.sessionData.organization, businessUnitKey, storeKey)
      ) {
        return cart;
      }
    }

    if (
      ((businessUnitKey && storeKey) || request.sessionData?.organization) &&
      request.sessionData?.account !== undefined
    ) {
      return await cartApi.getForUser(
        request.sessionData?.account,
        request.sessionData?.organization,
        businessUnitKey,
        storeKey,
      );
    }

    return undefined;
  }
}

// Override the BaseCartFetcher with new CartFetcher functions
Object.getOwnPropertyNames(CartFetcher).forEach((key) => {
  if (typeof CartFetcher[key] === 'function') {
    BaseCartFetcher[key] = CartFetcher[key];
  }
});
