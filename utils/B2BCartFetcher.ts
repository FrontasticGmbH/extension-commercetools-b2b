import { ActionContext, Request } from '@frontastic/extension-types';
import { Cart } from '@Types/cart/Cart';
import { BaseCartFetcher } from './BaseCartFetcher';
import { CartApi } from '../apis/CartApi';
import { getLocale } from './Request';

export class B2BCartFetcher extends BaseCartFetcher {
  static async fetchCart(request: Request, actionContext: ActionContext): Promise<Cart> {
    const cartApi = new CartApi(
      actionContext.frontasticContext,
      getLocale(request),
      request.sessionData?.organization,
      request.sessionData?.account,
    );

    if (request.sessionData?.cartId !== undefined) {
      try {
        const cart = (await cartApi.getById(request.sessionData.cartId)) as Cart;
        if (cartApi.assertCartOrganization(cart, request.sessionData.organization)) {
          return cart;
        }
      } catch (error) {
        console.info(`Error fetching the cart ${request.sessionData.cartId}, creating a new one. ${error}`);
      }
    }

    if (request.sessionData?.account !== undefined) {
      return (await cartApi.getForUser()) as Cart;
    }

    // @ts-ignore
    return {};
  }
}

// Override the BaseMapper with new Mapper functions
Object.getOwnPropertyNames(B2BCartFetcher).forEach((key) => {
  if (typeof B2BCartFetcher[key] === 'function') {
    BaseCartFetcher[key] = B2BCartFetcher[key];
  }
});
