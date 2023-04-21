import { ActionContext, Request } from '@frontastic/extension-types';
import { Cart } from '@Types/cart/Cart';
import { B2BCartFetcher } from './B2BCartFetcher';
import { CartApi } from '../apis/CartApi';
import { getLocale } from './Request';

export class CartFetcher extends B2BCartFetcher {
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
      return await cartApi.getForUser();
    }
    // @ts-ignore
    return {};
  }
}

// Override the BaseMapper with new Mapper functions
Object.getOwnPropertyNames(CartFetcher).forEach((key) => {
  if (typeof CartFetcher[key] === 'function') {
    B2BCartFetcher[key] = CartFetcher[key];
  }
});
