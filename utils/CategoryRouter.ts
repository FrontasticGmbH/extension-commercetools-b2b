import { Context, Request } from '@frontastic/extension-types';
import { ProductApi } from '../apis/ProductApi';
import { CategoryQuery } from '@Types/query/CategoryQuery';
import { Category } from '@Types/product/Category';
import { getCurrency, getLocale, getPath } from './Request';
import { Result } from '@Types/product/Result';
import { ProductQueryFactory } from './ProductQueryFactory';

export class CategoryRouter {
  static identifyPreviewFrom(request: Request) {
    if (getPath(request)?.match(/\/preview\/(.+)/)) {
      return true;
    }

    return false;
  }
  static identifyFrom(request: Request) {
    if (getPath(request)?.match(/[^\/]+/)) {
      return true;
    }

    return false;
  }

  static loadFor = async (request: Request, frontasticContext: Context): Promise<Result> => {
    const productApi = new ProductApi(frontasticContext, getLocale(request), getCurrency(request));
    const urlMatches = getPath(request)?.match(/[^\/]+/);

    if (urlMatches) {
      const categoryQuery: CategoryQuery = {
        slug: urlMatches[0],
      };

      const categoryQueryResult = await productApi.queryCategories(categoryQuery);

      if (categoryQueryResult.items.length == 0) return null;
      request.query.category = (categoryQueryResult.items[0] as Category).categoryId;

      const productQuery = ProductQueryFactory.queryFromParams({
        ...request,
      });

      return await productApi.query(productQuery);
    }

    return null;
  };

  static loadPreviewFor = async (request: Request, frontasticContext: Context): Promise<Result> => {
    const productApi = new ProductApi(frontasticContext, getLocale(request), getCurrency(request));
    const urlMatches = getPath(request)?.match(/\/preview\/(.+)/);

    if (urlMatches) {
      const categoryQuery: CategoryQuery = {
        slug: urlMatches[1],
      };

      const categoryQueryResult = await productApi.queryCategories(categoryQuery);

      if (categoryQueryResult.items.length == 0) return null;
      request.query.category = (categoryQueryResult.items[0] as Category).categoryId;

      const productQuery = ProductQueryFactory.queryFromParams({
        ...request,
      });

      return await productApi.query(productQuery);
    }

    return null;
  };
}
