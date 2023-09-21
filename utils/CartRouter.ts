import { Context, Request } from '@frontastic/extension-types';
import { getCurrency, getLocale, getPath } from './Request';
import { Cart } from '../../../types/cart/Cart';
import { CartApi } from '../apis/CartApi';
import { fetchAccountFromSession } from './fetchAccountFromSession';

export default class WishlistRouter {
  static identifyFrom(request: Request) {
    if (getPath(request)?.match(/\/c\/([^\/]+)/)) {
      return true;
    }

    return false;
  }

  static identifyPreviewFrom(request: Request) {
    if (getPath(request)?.match(/\/preview\/.+\/c\/([^\/]+)/)) {
      return true;
    }

    return false;
  }

  static loadFor = async (request: Request, frontasticContext: Context): Promise<Cart> => {
    const cartApi = new CartApi(frontasticContext, getLocale(request), getCurrency(request));

    const account = fetchAccountFromSession(request);

    const urlMatches = getPath(request)?.match(/\/c\/([^\/]+)/);

    if (urlMatches) {
      return cartApi.getOrder(urlMatches[1], account);
    }

    return null;
  };

  static loadPreviewFor = async (request: Request, frontasticContext: Context): Promise<Cart> => {
    const cartApi = new CartApi(frontasticContext, getLocale(request), getCurrency(request));

    const urlMatches = getPath(request)?.match(/\/preview\/.+\/c\/([^\/]+)/);

    const account = fetchAccountFromSession(request);
    if (urlMatches) {
      return cartApi.getOrder(urlMatches[1], account);
    }

    return null;
  };
}
