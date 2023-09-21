import {
  DynamicPageContext,
  DynamicPageRedirectResult,
  DynamicPageSuccessResult,
  ExtensionRegistry,
  Request,
} from '@frontastic/extension-types';
import { getCurrency, getLocale, getPath } from './utils/Request';
import { BusinessUnitApi } from './apis/BusinessUnitApi';
import { ProductRouter } from './utils/ProductRouter';
import { Product } from '@Types/product/Product';
import { SearchRouter } from './utils/SearchRouter';
import { Result } from '@Types/product/Result';
import { CategoryRouter } from './utils/CategoryRouter';
import dataSources from './dataSources';
import { actions } from './actionControllers';
import WishlistRouter from '@Commerce-commercetools/utils/WishlistRouter';
import QuoteRouter from '@Commerce-commercetools/utils/QuoteRouter';
import CartRouter from '@Commerce-commercetools/utils/CartRouter';

import { Wishlist } from '@Types/wishlist/Wishlist';
import { Cart } from '@Types/cart/Cart';
import { Quote } from '@Types/quote/Quote';

export default {
  'dynamic-page-handler': async (
    request: Request,
    context: DynamicPageContext,
  ): Promise<DynamicPageSuccessResult | DynamicPageRedirectResult | null> => {
    // Identify static page
    const staticPageMatch = getPath(request)?.match(
      /^\/(cart|checkout|wishlist|account|login|register|reset-password|thank-you|quote-thank-you)/,
    );

    if (staticPageMatch) {
      return {
        dynamicPageType: `frontastic${staticPageMatch[0]}`,
        dataSourcePayload: {},
        pageMatchingPayload: {},
      } as DynamicPageSuccessResult;
    }

    /**
     * Identify businessUnit page
     *
     * @deprecated
     */
    const b2bPageMatch = getPath(request)?.match(/^\/(business-unit)/);
    if (b2bPageMatch) {
      let organization = request.sessionData?.organization;
      if (!organization.businessUnit && request.sessionData?.account?.accountId) {
        const businessUnitApi = new BusinessUnitApi(
          context.frontasticContext,
          getLocale(request),
          getCurrency(request),
        );
        organization = await businessUnitApi.getOrganization(request.sessionData.account);
      }
      return {
        dynamicPageType: `b2b${b2bPageMatch[0]}`,
        dataSourcePayload: {
          organization,
        },
        pageMatchingPayload: {
          organization,
        },
      } as DynamicPageSuccessResult;
    }

    // Identify Product Preview
    if (ProductRouter.identifyPreviewFrom(request)) {
      return ProductRouter.loadPreviewFor(request, context.frontasticContext).then((product: Product) => {
        if (product) {
          return {
            dynamicPageType: 'frontastic/product-detail-page',
            dataSourcePayload: {
              product: product,
            },
            pageMatchingPayload: {
              product: product,
            },
          };
        }

        // FIXME: Return proper error result
        return null;
      });
    }

    // Identify Product
    if (ProductRouter.identifyFrom(request)) {
      return ProductRouter.loadFor(request, context.frontasticContext).then((product: Product) => {
        if (product) {
          return {
            dynamicPageType: 'frontastic/product-detail-page',
            dataSourcePayload: {
              product: product,
            },
            pageMatchingPayload: {
              product: product,
            },
          };
        }

        // FIXME: Return proper error result
        return null;
      });
    }

    // Identify Wishlist
    if (WishlistRouter.identifyFrom(request)) {
      return WishlistRouter.loadFor(request, context.frontasticContext).then((wishlist: Wishlist) => {
        if (wishlist) {
          return {
            dynamicPageType: 'frontastic/wishlist-detail-page',
            dataSourcePayload: {
              wishlist: wishlist,
            },
            pageMatchingPayload: {
              wishlist: wishlist,
            },
          };
        }

        // FIXME: Return proper error result
        return null;
      });
    }

    // Identify Preview Wishlist
    if (WishlistRouter.identifyPreviewFrom(request)) {
      return WishlistRouter.loadPreviewFor(request, context.frontasticContext).then((wishlist: Wishlist) => {
        if (wishlist) {
          return {
            dynamicPageType: 'frontastic/wishlist-detail-page',
            dataSourcePayload: {
              wishlist: wishlist,
            },
            pageMatchingPayload: {
              wishlist: wishlist,
            },
          };
        }

        // FIXME: Return proper error result
        return null;
      });
    }

    // Identify Order
    if (CartRouter.identifyFrom(request)) {
      return CartRouter.loadFor(request, context.frontasticContext).then((cart: Cart) => {
        if (cart) {
          return {
            dynamicPageType: 'frontastic/order',
            dataSourcePayload: {
              cart,
            },
            pageMatchingPayload: {
              cart,
            },
          };
        }

        // FIXME: Return proper error result
        return null;
      });
    }
    // Identify Preview Order
    if (CartRouter.identifyPreviewFrom(request)) {
      return CartRouter.loadPreviewFor(request, context.frontasticContext).then((cart: Cart) => {
        if (cart) {
          return {
            dynamicPageType: 'frontastic/order',
            dataSourcePayload: {
              cart,
            },
            pageMatchingPayload: {
              cart,
            },
          };
        }

        // FIXME: Return proper error result
        return null;
      });
    }

    // Identify Quote
    if (QuoteRouter.identifyFrom(request)) {
      return QuoteRouter.loadFor(request, context.frontasticContext).then((quote: Quote) => {
        if (quote) {
          return {
            dynamicPageType: 'frontastic/order',
            dataSourcePayload: {
              quote,
            },
            pageMatchingPayload: {
              quote,
            },
          };
        }

        // FIXME: Return proper error result
        return null;
      });
    }

    // Identify Preview Quote
    if (QuoteRouter.identifyPreviewFrom(request)) {
      return QuoteRouter.loadPreviewFor(request, context.frontasticContext).then((quote: Quote) => {
        if (quote) {
          return {
            dynamicPageType: 'frontastic/order',
            dataSourcePayload: {
              quote,
            },
            pageMatchingPayload: {
              quote,
            },
          };
        }

        // FIXME: Return proper error result
        return null;
      });
    }

    // Identify Search
    if (SearchRouter.identifyFrom(request)) {
      return SearchRouter.loadFor(request, context.frontasticContext).then((result: Result) => {
        if (result) {
          return {
            dynamicPageType: 'frontastic/search',
            dataSourcePayload: {
              totalItems: result.total,
              ...result,
            },
            pageMatchingPayload: {
              query: result.query,
            },
          };
        }

        // FIXME: Return proper error result
        return null;
      });
    }

    // Identify preview list
    if (CategoryRouter.identifyPreviewFrom(request)) {
      return CategoryRouter.loadPreviewFor(request, context.frontasticContext).then((result: Result) => {
        if (result) {
          return {
            dynamicPageType: 'frontastic/category',
            dataSourcePayload: {
              totalItems: result.total,
              items: result.items,
              facets: result.facets,
              previousCursor: result.previousCursor,
              nextCursor: result.nextCursor,
              category: getPath(request),
              isPreview: true,
            },
            pageMatchingPayload: {
              totalItems: result.total,
              items: result.items,
              facets: result.facets,
              previousCursor: result.previousCursor,
              nextCursor: result.nextCursor,
              category: getPath(request),
              isPreview: true,
            },
          };
        }

        // FIXME: Return proper error result
        return null;
      });
    }

    if (CategoryRouter.identifyFrom(request)) {
      return CategoryRouter.loadFor(request, context.frontasticContext).then((result: Result) => {
        if (result) {
          return {
            dynamicPageType: 'frontastic/category',
            dataSourcePayload: {
              totalItems: result.total,
              items: result.items,
              facets: result.facets,
              previousCursor: result.previousCursor,
              nextCursor: result.nextCursor,
              category: getPath(request),
            },
            pageMatchingPayload: {
              totalItems: result.total,
              items: result.items,
              facets: result.facets,
              previousCursor: result.previousCursor,
              nextCursor: result.nextCursor,
              category: getPath(request),
            },
          };
        }

        // FIXME: Return proper error result
        return null;
      });
    }

    /**
     * @deprecated
     */
    const homePageMatch = getPath(request)?.match(/^\//);
    if (homePageMatch) {
      let organization = request.sessionData?.organization;
      if (!organization?.businessUnit && request.sessionData?.account?.accountId) {
        const businessUnitApi = new BusinessUnitApi(
          context.frontasticContext,
          getLocale(request),
          getCurrency(request),
        );
        organization = await businessUnitApi.getOrganization(request.sessionData.account);
      }

      return {
        dynamicPageType: `b2b/home`,
        dataSourcePayload: {
          organization: request.sessionData?.organization,
        },
        pageMatchingPayload: {
          organization: request.sessionData?.organization,
          businessUnit: request?.sessionData?.organization?.businessUnit?.topLevelUnit?.key,
          store: request?.sessionData?.organization?.store?.key,
        },
      } as DynamicPageSuccessResult;
    }

    return null;
  },
  'data-sources': dataSources,
  actions,
} as ExtensionRegistry;
