import { ActionContext, Request } from '@frontastic/extension-types';
import { Cart } from '@Types/cart/Cart';
import { CartApi } from '../apis/CartApi';
import { getCurrency, getLocale } from './Request';
import { BaseCartFetcher } from './BaseCartFetcher';
import { Guid } from './Guid';

export class CartFetcher extends BaseCartFetcher {
  static async fetchCart(request: Request, actionContext: ActionContext): Promise<Cart> {
    const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

    if (request.sessionData?.cartId !== undefined) {
      const cart = await cartApi.getById(request.sessionData.cartId);
      if (cartApi.assertCartOrganization(cart, request.sessionData.organization)) {
        return cart;
      }
    }

    if (request.sessionData?.account !== undefined) {
      return await cartApi.getForUser(request.sessionData?.account, request.sessionData?.organization);
    }
    return await cartApi.getAnonymous(Guid.newGuid());
  }
}

// Override the BaseMapper with new Mapper functions
Object.getOwnPropertyNames(CartFetcher).forEach((key) => {
  if (typeof CartFetcher[key] === 'function') {
    BaseCartFetcher[key] = CartFetcher[key];
  }
});
