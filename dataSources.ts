import { DataSourceConfiguration, DataSourceContext } from '@frontastic/extension-types';
import { getCurrency, getLocale } from './utils/Request';
import { ProductApi } from './apis/ProductApi';
import { ProductQueryFactory } from './utils/ProductQueryFactory';
import { BusinessUnitApi } from './apis/BusinessUnitApi';
import { fetchAccountFromSession } from '@Commerce-commercetools/utils/fetchAccountFromSession';

function productQueryFromContext(context: DataSourceContext, config: DataSourceConfiguration) {
  const productApi = new ProductApi(
    context.frontasticContext,
    context.request ? getLocale(context.request) : null,
    context.request ? getCurrency(context.request) : null,
  );

  const productQuery = ProductQueryFactory.queryFromParams(context?.request, config);
  return { productApi, productQuery };
}

export default {
  'frontastic/categories': async (config: DataSourceConfiguration, context: DataSourceContext) => {
    const productApi = new ProductApi(
      context.frontasticContext,
      context.request ? getLocale(context.request) : null,
      context.request ? getCurrency(context.request) : null,
    );
    const queryResult = await productApi.queryCategories({});
    return {
      dataSourcePayload: queryResult,
    };
  },

  'frontastic/product-list': async (config: DataSourceConfiguration, context: DataSourceContext) => {
    const { productApi, productQuery } = productQueryFromContext(context, config);

    return await productApi.query(productQuery).then((queryResult) => {
      return {
        dataSourcePayload: queryResult,
      };
    });
  },

  'frontastic/similar-products': async (config: DataSourceConfiguration, context: DataSourceContext) => {
    if (!context.hasOwnProperty('request')) {
      throw new Error(`Request is not defined in context ${context}`);
    }

    const productApi = new ProductApi(
      context.frontasticContext,
      getLocale(context.request),
      getCurrency(context.request),
    );
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
    const { productApi, productQuery } = productQueryFromContext(context, config);

    return await productApi.getProduct(productQuery).then((queryResult) => {
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
    const account = fetchAccountFromSession(context.request);

    if (account === undefined) {
      return {
        dataSourcePayload: {
          associations: [],
        },
      };
    }

    const businessUnitApi = new BusinessUnitApi(
      context.frontasticContext,
      context.request ? getLocale(context.request) : null,
      context.request ? getCurrency(context.request) : null,
    );
    const results = await businessUnitApi.getCommercetoolsBusinessUnitsForUser(context.request.sessionData?.account);

    return {
      dataSourcePayload: {
        associations: results,
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
    const account = fetchAccountFromSession(context.request);
    if (account === undefined) {
      return {
        dataSourcePayload: {
          tree: [],
        },
      };
    }

    const businessUnitApi = new BusinessUnitApi(
      context.frontasticContext,
      context.request ? getLocale(context.request) : null,
      context.request ? getCurrency(context.request) : null,
    );
    const tree = await businessUnitApi.getCompaniesForUser(context.request.sessionData?.account);
    return {
      dataSourcePayload: {
        tree: tree,
      },
    };
  },
};
