import { Context, Request } from '@frontastic/extension-types';
import { getCurrency, getLocale, getPath } from './Request';
import { Quote } from '@Types/quote/Quote';
import { QuoteApi } from '../apis/QuoteApi';

export default class QuoteRouter {
  static identifyFrom(request: Request) {
    if (getPath(request)?.match(/\/quote\/([^\/]+)/)) {
      return true;
    }

    return false;
  }

  static identifyPreviewFrom(request: Request) {
    if (getPath(request)?.match(/\/preview\/.+\/quote\/([^\/]+)/)) {
      return true;
    }

    return false;
  }

  static loadFor = async (request: Request, frontasticContext: Context): Promise<Quote> => {
    const quoteApi = new QuoteApi(frontasticContext, getLocale(request), getCurrency(request));

    const urlMatches = getPath(request)?.match(/\/quote\/([^\/]+)/);

    if (urlMatches) {
      return quoteApi.getQuote(urlMatches[1]);
    }

    return null;
  };

  static loadPreviewFor = async (request: Request, frontasticContext: Context): Promise<Quote> => {
    const wishlistApi = new QuoteApi(frontasticContext, getLocale(request), getCurrency(request));

    const urlMatches = getPath(request)?.match(/\/preview\/.+\/quote\/([^\/]+)/);

    if (urlMatches) {
      return wishlistApi.getQuote(urlMatches[1]);
    }

    return null;
  };
}
