import { Context, Request } from '@frontastic/extension-types';
import { getCurrency, getLocale, getPath } from './Request';
import { Wishlist } from '@Types/wishlist/Wishlist';
import { WishlistApi } from '../apis/WishlistApi';
import { fetchAccountFromSession } from '@Commerce-commercetools/utils/fetchAccountFromSession';

export default class WishlistRouter {
  static identifyFrom(request: Request) {
    if (getPath(request)?.match(/\/w\/([^\/]+)/)) {
      return true;
    }

    return false;
  }

  static identifyPreviewFrom(request: Request) {
    if (getPath(request)?.match(/\/preview\/.+\/w\/([^\/]+)/)) {
      return true;
    }

    return false;
  }

  static loadFor = async (request: Request, frontasticContext: Context): Promise<Wishlist> => {
    const wishlistApi = new WishlistApi(frontasticContext, getLocale(request), getCurrency(request));

    const urlMatches = getPath(request)?.match(/\/w\/([^\/]+)/);
    const account = fetchAccountFromSession(request);

    if (urlMatches) {
      return wishlistApi.getByIdForAccount(urlMatches[1], account);
    }

    return null;
  };

  static loadPreviewFor = async (request: Request, frontasticContext: Context): Promise<Wishlist> => {
    const wishlistApi = new WishlistApi(frontasticContext, getLocale(request), getCurrency(request));

    const urlMatches = getPath(request)?.match(/\/preview\/.+\/p\/([^\/]+)/);

    const account = fetchAccountFromSession(request);

    if (urlMatches) {
      return wishlistApi.getByIdForAccount(urlMatches[1], account);
    }

    return null;
  };
}
