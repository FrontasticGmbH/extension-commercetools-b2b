import { Result } from '@Types/product/Result';
import { ProductQuery } from '@Types/query/ProductQuery';
import { FilterField, FilterFieldTypes } from '@Types/product/FilterField';
import { FilterTypes } from '@Types/query/Filter';
import { TermFilter } from '@Types/query/TermFilter';
import { RangeFilter } from '@Types/query/RangeFilter';
import { FacetDefinition } from '@Types/product/FacetDefinition';
import { ProductApi as B2BProductApi } from 'cofe-ct-b2b-ecommerce/apis/ProductApi';
import { ProductMapper } from '../mappers/ProductMapper';
import { Category } from '@Types/product/Category';
import { CategoryQuery } from '@Types/query/CategoryQuery';
export class ProductApi extends B2BProductApi {
  query: (productQuery: ProductQuery, additionalQueryArgs?: object, additionalFacets?: object[]) => Promise<Result> =
    async (productQuery: ProductQuery, additionalQueryArgs?: object, additionalFacets: object[] = []) => {
      try {
        const locale = await this.getCommercetoolsLocal();

        // TODO: get default from constant
        const limit = +productQuery.limit || 24;

        const filterQuery: string[] = [];
        const filterFacets: string[] = [];
        const sortAttributes: string[] = [];

        const facetDefinitions: FacetDefinition[] = [
          ...ProductMapper.commercetoolsProductTypesToFacetDefinitions(await this.getProductTypes(), locale),
          ...additionalFacets,
          // Include Scoped Price facet
          {
            attributeId: 'variants.scopedPrice.value',
            attributeType: 'money',
          },
          // Include Price facet
          {
            attributeId: 'variants.price',
            attributeType: 'money',
          },
        ];

        const queryArgFacets = ProductMapper.facetDefinitionsToCommercetoolsQueryArgFacets(facetDefinitions, locale);

        if (productQuery.productIds !== undefined && productQuery.productIds.length !== 0) {
          filterQuery.push(`id:"${productQuery.productIds.join('","')}"`);
        }

        if (productQuery.skus !== undefined && productQuery.skus.length !== 0) {
          filterQuery.push(`variants.sku:"${productQuery.skus.join('","')}"`);
        }

        if (productQuery.category !== undefined && productQuery.category !== '') {
          filterQuery.push(`categories.id:subtree("${productQuery.category}")`);
        }

        if (productQuery.rootCategoryId) {
          filterQuery.push(`categories.id:subtree("${productQuery.rootCategoryId}")`);
        }

        if (productQuery.filters !== undefined) {
          productQuery.filters.forEach((filter) => {
            switch (filter.type) {
              case FilterTypes.TERM:
                filterQuery.push(`${filter.identifier}.key:"${(filter as TermFilter).terms.join('","')}"`);
                break;
              case FilterTypes.BOOLEAN:
                filterQuery.push(
                  `${filter.identifier}:${(filter as TermFilter).terms[0]?.toString().toLowerCase() === 'true'}`,
                );
                break;
              case FilterTypes.RANGE:
                if (filter.identifier === 'price') {
                  // The scopedPrice filter is a commercetools price filter of a product variant selected
                  // base on the price scope. The scope used is currency and country.
                  filterQuery.push(
                    `variants.scopedPrice.value.centAmount:range (${(filter as RangeFilter).min ?? '*'} to ${
                      (filter as RangeFilter).max ?? '*'
                    })`,
                  );
                }
                break;
            }
          });
        }

        if (productQuery.facets !== undefined) {
          filterFacets.push(
            ...ProductMapper.facetDefinitionsToFilterFacets(productQuery.facets, facetDefinitions, locale),
          );
        }

        if (productQuery.sortAttributes !== undefined) {
          Object.keys(productQuery.sortAttributes).map((field, directionIndex) => {
            sortAttributes.push(`${field} ${Object.values(productQuery.sortAttributes)[directionIndex]}`);
          });
        } else {
          // default sort
          sortAttributes.push(`variants.attributes.salesRank asc`);
        }

        const methodArgs = {
          queryArgs: {
            sort: sortAttributes,
            limit: limit,
            offset: this.getOffsetFromCursor(productQuery.cursor),
            priceCurrency: locale.currency,
            priceCountry: locale.country,
            facet: queryArgFacets.length > 0 ? queryArgFacets : undefined,
            filter: filterFacets.length > 0 ? filterFacets : undefined,
            expand: 'categories[*]',
            'filter.facets': filterFacets.length > 0 ? filterFacets : undefined,
            'filter.query': filterQuery.length > 0 ? filterQuery : undefined,
            [`text.${locale.language}`]: productQuery.query,
            ...additionalQueryArgs,
          },
        };

        return await this.getApiForProject()
          .productProjections()
          .search()
          .get(methodArgs)
          .execute()
          .then((response) => {
            const items = response.body.results.map((product) =>
              ProductMapper.commercetoolsProductProjectionToProduct(product, locale),
            );

            const result: Result = {
              total: response.body.total,
              items: items,
              count: response.body.count,
              facets: ProductMapper.commercetoolsFacetResultsToFacets(response.body.facets, productQuery, locale),
              previousCursor: ProductMapper.calculatePreviousCursor(response.body.offset, response.body.count),
              nextCursor: ProductMapper.calculateNextCursor(
                response.body.offset,
                response.body.count,
                response.body.total,
              ),
              query: productQuery,
            };

            return result;
          })
          .catch((error) => {
            throw error;
          });
      } catch (error) {
        //TODO: better error, get status code etc...
        throw new Error(`query failed. ${error}`);
      }
    };

  getSearchableAttributes: (rootCategoryId?: string) => Promise<FilterField[]> = async (rootCategoryId?) => {
    try {
      const locale = await this.getCommercetoolsLocal();

      const response = await this.getApiForProject().productTypes().get().execute();

      const filterFields = ProductMapper.commercetoolsProductTypesToFilterFields(response.body.results, locale);

      filterFields.push({
        field: 'categoryId',
        type: FilterFieldTypes.ENUM,
        label: 'Category ID',
        values: await this.queryCategories({ rootCategoryId, limit: 250 }).then((result) => {
          return (result.items as Category[]).map((item) => {
            return {
              value: item.categoryId,
              name: item.name,
            };
          });
        }),
      });

      return filterFields;
    } catch (error) {
      //TODO: better error, get status code etc...
      throw new Error(`getSearchableAttributes failed. ${error}`);
    }
  };

  getNavigationCategories: (rootCategoryId?: string) => Promise<Category[]> = async (rootCategoryId) => {
    const res = await this.queryCategories({ rootCategoryId, limit: 500 });
    const items: any[] = res.items;

    let categories: Category[] = [];
    if (rootCategoryId) {
      categories = items.filter((item: Category) => item.parentId == rootCategoryId);
    } else {
      categories = items.filter((item: Category) => !item.ancestors?.length);
    }
    return categories as Category[];
  };

  queryCategories: (categoryQuery: CategoryQuery) => Promise<Result> = async (categoryQuery: CategoryQuery) => {
    try {
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

      if (categoryQuery.rootCategoryId) {
        where.push(`ancestors(id="${categoryQuery.rootCategoryId}")`);
      }
      const methodArgs = {
        queryArgs: {
          limit: limit,
          offset: this.getOffsetFromCursor(categoryQuery.cursor),
          where: where.length > 0 ? where : undefined,
          sort: 'orderHint',
        },
      };

      return await this.getApiForProject()
        .categories()
        .get(methodArgs)
        .execute()
        .then((response) => {
          const categories = response.body.results;

          const nodes = {};

          for (let i = 0; i < categories.length; i++) {
            (categories[i] as any).subCategories = [];
            nodes[categories[i].id] = categories[i];
          }

          for (let i = 0; i < categories.length; i++) {
            if (categories[i].parent && nodes[categories[i].parent.id]?.subCategories) {
              nodes[categories[i].parent.id].subCategories.push(categories[i]);
            }
          }
          const nodesQueue = [categories];

          while (nodesQueue.length > 0) {
            const currentCategories = nodesQueue.pop();
            currentCategories.sort((a, b) => +a.orderHint - +b.orderHint);
            currentCategories.forEach(
              (category) => !!nodes[category.id]?.subCategories && nodesQueue.push(nodes[category.id].subCategories),
            );
          }

          const items = categories.map((category) =>
            ProductMapper.commercetoolsCategoryToCategory(category, locale),
          );

          const result: Result = {
            total: response.body.total,
            items: items,
            count: response.body.count,
            previousCursor: ProductMapper.calculatePreviousCursor(response.body.offset, response.body.count),
            nextCursor: ProductMapper.calculateNextCursor(
              response.body.offset,
              response.body.count,
              response.body.total,
            ),
            query: categoryQuery,
          };
          return result;
        })
        .catch((error) => {
          throw error;
        });
    } catch (error) {
      //TODO: better error, get status code etc...
      throw new Error(`queryCategories failed. ${error}`);
    }
  };
}
