import { Context, Request } from '@frontastic/extension-types';
import { ProductQueryFactory } from './ProductQueryFactory';
import { Result } from '@Types/product/Result';
import { ProductApi } from '../apis/ProductApi';
import { getLocale, getPath } from './Request';

export class SearchRouter {
  static identifyFrom(request: Request) {
    const urlMatches = getPath(request)?.match(/^\/search/);

    if (urlMatches) {
      return true;
    }

    return false;
  }

  static loadFor = async (request: Request, frontasticContext: Context): Promise<Result> | null => {
    const productApi = new ProductApi(frontasticContext, getLocale(request));

    const urlMatches = getPath(request)?.match(/\/search/);

    const additionalQueryArgs = {};
    const additionalFacets = [
      {
        attributeId: 'categories.id',
      },
    ];
    const distributionChannelId =
      request.query?.['distributionChannelId'] || request.sessionData?.organization?.distributionChannel?.id;

    if (distributionChannelId) {
      // @ts-ignore
      additionalQueryArgs.priceChannel = distributionChannelId;
      additionalFacets.push({
        attributeId: `variants.availability.availableQuantity`,
      });
    }

    if (urlMatches) {
      const productQuery = ProductQueryFactory.queryFromParams({
        ...request,
        query: { ...request.query, query: request.query.query || request.query.q },
      });
      return productApi.query(productQuery, additionalQueryArgs, additionalFacets);
    }

    return null;
  };
}
