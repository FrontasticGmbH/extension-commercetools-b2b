import { Category } from '@Types/product/Category';
import { FacetDefinition } from '@Types/product/FacetDefinition';
import { FilterField, FilterFieldTypes } from '@Types/product/FilterField';
import { Product } from '@Types/product/Product';
import { Filter, TermFilter } from '@Types/query';
import { CategoryQuery, CategoryQueryFormat } from '@Types/query/CategoryQuery';
import { ProductQuery } from '@Types/query/ProductQuery';
import { PaginatedResult, ProductPaginatedResult } from '@Types/result';
import { ProductMapper } from '../mappers/ProductMapper';
import { ProductSearchFactory } from '@Commerce-commercetools/utils/ProductSearchQueryFactory';
import { ExternalError } from '@Commerce-commercetools/errors/ExternalError';
import { BaseApi } from '@Commerce-commercetools/apis/BaseApi';

export class ProductApi extends BaseApi {
  protected getOffsetFromCursor = (cursor: string) => {
    if (cursor === undefined) {
      return undefined;
    }

    const offsetMach = cursor.match(/(?<=offset:).+/);
    return offsetMach !== null ? +Object.values(offsetMach)[0] : undefined;
  };

  query: (productQuery: ProductQuery) => Promise<ProductPaginatedResult> = async (productQuery: ProductQuery) => {
    const locale = await this.getCommercetoolsLocal();
    productQuery.categories = await this.hydrateCategories(productQuery);
    productQuery.filters = await this.hydrateFilters(productQuery);
    const facetDefinitions: FacetDefinition[] = [
      ...ProductMapper.commercetoolsProductTypesToFacetDefinitions(await this.getCommercetoolsProductTypes(), locale),
      // Include Price facet
      {
        attributeId: 'variants.prices',
        attributeType: 'money',
      },
    ];
    const commercetoolsProductSearchRequest =
      ProductSearchFactory.createCommercetoolsProductSearchRequestFromProductQuery(
        productQuery,
        facetDefinitions,
        locale,
      );

    return this.requestBuilder()
      .products()
      .search()
      .post({
        body: commercetoolsProductSearchRequest,
      })
      .execute()
      .then((response) => {
        const items = response.body.results.map((product) =>
          ProductMapper.commercetoolsProductProjectionToProduct(
            product.productProjection,
            this.categoryIdField,
            locale,
            productQuery.supplyChannelId,
          ),
        );
        const count = response.body.results.length;
        const result: ProductPaginatedResult = {
          total: response.body.total,
          items,
          count,
          facets: ProductMapper.commercetoolsFacetResultsToFacets(
            response.body.facets,
            commercetoolsProductSearchRequest,
            facetDefinitions,
          ),
          previousCursor: ProductMapper.calculatePreviousCursor(response.body.offset, count),
          nextCursor: ProductMapper.calculateNextCursor(response.body.offset, count, response.body.total),
          query: productQuery,
        };

        return result;
      })
      .catch((error) => {
        throw new ExternalError({ statusCode: error.code, message: error.message, body: error.body });
      });
  };

  getProduct: (productQuery: ProductQuery) => Promise<Product> = async (productQuery: ProductQuery) => {
    try {
      const result = await this.query(productQuery);

      return result.items.shift() as Product;
    } catch (error) {
      throw error;
    }
  };

  getSearchableAttributes: () => Promise<FilterField[]> = async () => {
    const locale = await this.getCommercetoolsLocal();

    const response = await this.requestBuilder()
      .productTypes()
      .get()
      .execute()
      .catch((error) => {
        throw new ExternalError({ statusCode: error.code, message: error.message, body: error.body });
      });

    const filterFields = ProductMapper.commercetoolsProductTypesToFilterFields(response.body.results, locale);

    // Category filter. Not included as commercetools product type.
    filterFields.push({
      field: 'categoryIds',
      type: FilterFieldTypes.ENUM,
      label: 'Category',
      values: await this.queryCategories({ limit: 250 }).then((result) => {
        return (result.items as Category[]).map((item) => {
          return {
            value: item.categoryId,
            name: item.name,
          };
        });
      }),
    });

    // Variants scoped price filter. Not included as commercetools product type.
    filterFields.push({
      field: 'variants.prices',
      type: FilterFieldTypes.MONEY,
      label: 'Variants scoped price', // TODO: localize label
    });

    return filterFields;
  };

  queryCategories: (categoryQuery: CategoryQuery) => Promise<PaginatedResult<Category>> = async (
    categoryQuery: CategoryQuery,
  ) => {
    const locale = await this.getCommercetoolsLocal();

    // TODO: get default from constant
    const limit = +categoryQuery.limit || 24;
    const where: string[] = [];

    if (categoryQuery.slug) {
      where.push(`slug(${locale.language}="${categoryQuery.slug}")`);
    }

    if (categoryQuery.parentId) {
      where.push(`parent(id="${categoryQuery.parentId}")`);
    }

    const methodArgs = {
      queryArgs: {
        limit: limit,
        offset: this.getOffsetFromCursor(categoryQuery.cursor),
        where: where.length > 0 ? where : undefined,
        expand: ['ancestors[*]', 'parent'],
      },
    };

    return await this.getCommercetoolsCategoryPagedQueryResponse(methodArgs)
      .then((response) => {
        const items =
          categoryQuery.format === CategoryQueryFormat.TREE
            ? ProductMapper.commercetoolsCategoriesToTreeCategory(response.body.results, this.categoryIdField, locale)
            : response.body.results.map((category) =>
                ProductMapper.commercetoolsCategoryToCategory(category, this.categoryIdField, locale),
              );

        const result: PaginatedResult<Category> = {
          total: response.body.total,
          items: items,
          count: response.body.count,
          previousCursor: ProductMapper.calculatePreviousCursor(response.body.offset, response.body.count),
          nextCursor: ProductMapper.calculateNextCursor(response.body.offset, response.body.count, response.body.total),
          query: categoryQuery,
        };

        return result;
      })
      .catch((error) => {
        throw new ExternalError({ statusCode: error.code, message: error.message, body: error.body });
      });
  };

  protected async hydrateCategories(productQuery: ProductQuery): Promise<string[]> {
    if (productQuery.categories !== undefined && productQuery.categories.length !== 0) {
      let categoryIds = productQuery.categories.filter(function uniqueCategories(value, index, self) {
        return self.indexOf(value) === index;
      });

      // commercetools only allows filter categories by id. If we are using something different as categoryIdField,
      // we need first to fetch the category to get the correspondent category id.
      if (this.categoryIdField !== 'id') {
        const categoriesMethodArgs = {
          queryArgs: {
            where: [`key in ("${categoryIds.join('","')}")`],
          },
        };

        categoryIds = await this.getCommercetoolsCategoryPagedQueryResponse(categoriesMethodArgs).then((response) => {
          return response.body.results.map((category) => {
            return category.id;
          });
        });
      }

      return categoryIds;
    }
    return [];
  }

  protected async hydrateFilters(productQuery: ProductQuery): Promise<Filter[]> {
    if (productQuery.filters !== undefined && productQuery.filters.length !== 0) {
      const categoryIds = productQuery.filters
        .filter((filter) => filter.identifier === 'categoriesSubTree')
        .map((filter) => (filter as TermFilter).terms?.map((term) => term))
        .filter(function uniqueCategories(value, index, self) {
          return self.indexOf(value) === index;
        });

      // commercetools only allows filter categories by id. If we are using something different as categoryIdField,
      // we need first to fetch the category to get the correspondent category id.
      if (this.categoryIdField !== 'id' && categoryIds.length !== 0) {
        const categoriesMethodArgs = {
          queryArgs: {
            where: [`key in ("${categoryIds.join('","')}")`],
          },
        };

        const categories = await this.getCommercetoolsCategoryPagedQueryResponse(categoriesMethodArgs).then(
          (response) => {
            return response.body.results;
          },
        );

        productQuery.filters = productQuery.filters.map((filter) => {
          if (filter.identifier === 'categoriesSubTree') {
            return {
              ...filter,
              terms: categories
                ?.filter((category) => (filter as TermFilter).terms?.includes(category.key))
                ?.map((category) => category.id),
            };
          }
          return filter;
        });
      }

      return productQuery.filters;
    }
    return [];
  }

  protected async getCommercetoolsCategoryPagedQueryResponse(methodArgs: object) {
    return await this.requestBuilder()
      .categories()
      .get(methodArgs)
      .execute()
      .catch((error) => {
        throw new ExternalError({ statusCode: error.code, message: error.message, body: error.body });
      });
  }
}
