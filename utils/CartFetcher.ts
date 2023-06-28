import { ActionContext, Request } from '@frontastic/extension-types';
import { Cart } from '@Types/cart/Cart';
import { CartApi } from '../apis/CartApi';
import { getCurrency, getLocale } from './Request';
import { BaseCartFetcher } from './BaseCartFetcher';
import { Guid } from './Guid';

export class CartFetcher extends BaseCartFetcher {
  static async fetchCart(request: Request, actionContext: ActionContext): Promise<Cart> {
    const cartApi = new CartApi(
      actionContext.frontasticContext,
      getLocale(request),
      request.sessionData?.organization,
      request.sessionData?.account,
      getCurrency(request),
    );

    if (request.sessionData?.cartId !== undefined) {
      try {
        const cart = await cartApi.getById(request.sessionData.cartId);
        if (cartApi.assertCartOrganization(cart, request.sessionData.organization)) {
          return cart;
        }
      } catch (error) {
        throw new Error(`Error fetching the cart ${request.sessionData.cartId}, creating a new one. ${error}`);
      }
    }

    if (request.sessionData?.account !== undefined) {
      try {
        return await cartApi.getForUser();
      } catch (e) {
        throw new Error(`Error fetching the cart for user ${request.sessionData.account}, creating a new one. ${e}`);
      }
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
