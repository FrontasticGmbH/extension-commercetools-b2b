import { DataSourceConfiguration, DataSourceContext } from '@frontastic/extension-types';
import { getLocale } from './utils/Request';
import { ProductApi } from './apis/ProductApi';
import { ProductQueryFactory } from './utils/ProductQueryFactory';
import { BusinessUnitApi } from './apis/BusinessUnitApi';

function productQueryFromContext(context: DataSourceContext, config: DataSourceConfiguration) {
  const productApi = new ProductApi(context.frontasticContext, context.request ? getLocale(context.request) : null);
  const additionalQueryArgs = {};
  const distributionChannelId =
    context.request.query?.['distributionChannelId'] ||
    context.request.sessionData?.organization?.distributionChannel?.id;

  if (distributionChannelId) {
    // @ts-ignore
    additionalQueryArgs.priceChannel = distributionChannelId;
  }

  const productQuery = ProductQueryFactory.queryFromParams(context?.request, config);
  return { productApi, productQuery, additionalQueryArgs };
}

export default {
  'frontastic/categories': async (config: DataSourceConfiguration, context: DataSourceContext) => {
    const productApi = new ProductApi(context.frontasticContext, context.request ? getLocale(context.request) : null);
    try {
      const categories = await productApi.getNavigationCategories(context?.request?.sessionData?.rootCategoryId);
      return {
        dataSourcePayload: {
          categories,
        },
      };
    } catch (error) {
      console.log(error);
      return {
        dataSourcePayload: {
          categories: [],
        },
      };
    }
  },
  'frontastic/product-list': async (config: DataSourceConfiguration, context: DataSourceContext) => {
    const { productApi, productQuery, additionalQueryArgs } = productQueryFromContext(context, config);

    return await productApi.query(productQuery, additionalQueryArgs).then((queryResult) => {
      return {
        dataSourcePayload: queryResult,
      };
    });
  },

  'frontastic/similar-products': async (config: DataSourceConfiguration, context: DataSourceContext) => {
    if (!context.hasOwnProperty('request')) {
      throw new Error(`Request is not defined in context ${context}`);
    }

    const productApi = new ProductApi(context.frontasticContext, getLocale(context.request));
    const productQuery = ProductQueryFactory.queryFromParams(context.request, config);
    const queryWithCategoryId = {
      ...productQuery,
      category: (
        context.pageFolder.dataSourceConfigurations.find((stream) => (stream as any).streamId === '__master') as any
      )?.preloadedValue?.product?.categories?.[0]?.categoryId,
    };

    return await productApi.query(queryWithCategoryId).then((queryResult) => {
      return {
        dataSourcePayload: queryResult,
      };
    });
  },

  'frontastic/product': async (config: DataSourceConfiguration, context: DataSourceContext) => {
    const { productApi, productQuery, additionalQueryArgs } = productQueryFromContext(context, config);

    return await productApi.getProduct(productQuery, additionalQueryArgs).then((queryResult) => {
      return {
        dataSourcePayload: {
          product: queryResult,
        },
      };
    });
  },
  'b2b/organization': (config: DataSourceConfiguration, context: DataSourceContext) => {
    return {
      dataSourcePayload: {
        organization: context.request.sessionData?.organization,
      },
    };
  },
  'b2b/associations': async (config: DataSourceConfiguration, context: DataSourceContext) => {
    const superUserBusinessUnitKey = context.request.sessionData?.organization?.superUserBusinessUnitKey;
    const businessUnitApi = new BusinessUnitApi(
      context.frontasticContext,
      context.request ? getLocale(context.request) : null,
    );
    const results = await businessUnitApi.getAssociatedBusinessUnits(context.request.sessionData?.account?.accountId);
    const filteredResults = !superUserBusinessUnitKey
      ? results
      : results.filter((bu) => bu.key === superUserBusinessUnitKey || bu.topLevelUnit.key === superUserBusinessUnitKey);

    return {
      dataSourcePayload: {
        associations: filteredResults,
      },
    };
  },
  'b2b/notifications': async (config: DataSourceConfiguration, context: DataSourceContext) => {
    const notificationToken = context.request.sessionData?.notificationToken;

    return {
      dataSourcePayload: {
        notificationToken,
      },
    };
  },
  'b2b/organization-tree': async (config: DataSourceConfiguration, context: DataSourceContext) => {
    const superUserBusinessUnitKey = context.request.sessionData?.organization?.superUserBusinessUnitKey;
    const businessUnitApi = new BusinessUnitApi(
      context.frontasticContext,
      context.request ? getLocale(context.request) : null,
    );
    const tree = await businessUnitApi.getTree(context.request.sessionData?.account?.accountId);
    const filteredTree = !superUserBusinessUnitKey
      ? tree
      : tree.filter((bu) => bu.key === superUserBusinessUnitKey || bu.topLevelUnit.key === superUserBusinessUnitKey);
    return {
      dataSourcePayload: {
        tree: filteredTree,
      },
    };
  },
};
