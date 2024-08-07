import { Category } from '@Types/product/Category';
import { ProductDiscount, ProductDiscountType, Variant } from '@Types/product/Variant';
import {
  AttributeGroup,
  Category as CommercetoolsCategory,
  CategoryReference,
  ProductVariant as CommercetoolsProductVariant,
  TypedMoney,
  ProductSearchRequest,
  ProductSearchFacetExpression,
  ProductSearchFacetRangesExpression,
  ProductSearchFacetDistinctExpression,
  ProductSearchFacetCountExpression,
  SearchNumberRangeExpression,
  SearchExactExpression,
  ProductSearchFacetResultBucket,
  _SearchQuery,
  SearchAndExpression,
  ProductSearchFacetResultCount,
  ProductSearchFacetResult,
  ProductSearchMatchingVariants as CommercetoolsProductSearchMatchingVariants,
  ProductSearchResult as CommercetoolsProductSearchResult,
} from '@commercetools/platform-sdk';
import { Attribute as CommercetoolsAttribute } from '@commercetools/platform-sdk/dist/declarations/src/generated/models/product';
import { Attributes, FacetDefinition, Money, Product } from '@Types/product';
import { ProductDiscount as CommercetoolsProductDiscount } from '@commercetools/platform-sdk/dist/declarations/src/generated/models/product-discount';
import {
  Money as CommercetoolsMoney,
  Price as CommercetoolsPrice,
} from '@commercetools/platform-sdk/dist/declarations/src/generated/models/common';
import {
  AttributeDefinition as CommercetoolsAttributeDefinition,
  AttributeEnumType,
  AttributeLocalizedEnumType,
  AttributeSetType,
  ProductType as CommercetoolsProductType,
} from '@commercetools/platform-sdk/dist/declarations/src/generated/models/product-type';
import { FilterField, FilterFieldTypes, FilterFieldValue } from '@Types/product/FilterField';
import { RangeFacet, Term, TermFacet } from '@Types/result';
import { Facet, FacetTypes } from '@Types/result/Facet';
import ProductRouter from '@Commerce-commercetools/utils/routers/ProductRouter';
import { Locale } from '@Commerce-commercetools/interfaces/Locale';

const TypeMap = new Map<string, string>([
  ['boolean', FilterFieldTypes.BOOLEAN],
  ['enum', FilterFieldTypes.ENUM],
  ['text', FilterFieldTypes.TEXT],
  ['number', FilterFieldTypes.NUMBER],
  ['lenum', FilterFieldTypes.ENUM],
  ['ltext', FilterFieldTypes.TEXT],
  ['reference', FilterFieldTypes.TEXT],
  ['money', FilterFieldTypes.MONEY],
]);

export default class ProductMapper {
  static commercetoolsProductSearchResultToProduct(
    commercetoolsProduct: CommercetoolsProductSearchResult,
    productIdField: string,
    categoryIdField: string,
    locale: Locale,
    supplyChannelId?: string,
  ): Product {
    const product: Product = {
      productId: commercetoolsProduct?.productProjection?.id,
      productKey: commercetoolsProduct?.productProjection?.key,
      productRef: commercetoolsProduct?.productProjection?.[productIdField],
      version: commercetoolsProduct?.productProjection.version?.toString(),
      name: commercetoolsProduct?.productProjection.name?.[locale.language],
      slug: commercetoolsProduct?.productProjection.slug?.[locale.language],
      description: commercetoolsProduct?.productProjection.description?.[locale.language],
      categories: this.commercetoolsCategoryReferencesToCategories(
        commercetoolsProduct.productProjection.categories,
        categoryIdField,
        locale,
      ),
      variants: this.commercetoolsProductProjectionToVariants(commercetoolsProduct, locale, supplyChannelId),
    };

    product._url = ProductRouter.generateUrlFor(product);

    return product;
  }

  static commercetoolsProductProjectionToVariants(
    commercetoolsProduct: CommercetoolsProductSearchResult,
    locale: Locale,
    supplyChannelId?: string,
  ): Variant[] {
    const variants: Variant[] = [];

    if (commercetoolsProduct?.productProjection.masterVariant) {
      variants.push(
        this.commercetoolsProductVariantToVariant(
          commercetoolsProduct.productProjection.masterVariant,
          locale,
          supplyChannelId,
          commercetoolsProduct.matchingVariants,
        ),
      );
    }

    for (let i = 0; i < commercetoolsProduct.productProjection.variants.length; i++) {
      variants.push(
        this.commercetoolsProductVariantToVariant(
          commercetoolsProduct.productProjection.variants[i],
          locale,
          supplyChannelId,
          commercetoolsProduct.matchingVariants,
        ),
      );
    }

    return variants;
  }

  static commercetoolsProductVariantToVariant(
    commercetoolsVariant: CommercetoolsProductVariant,
    locale: Locale,
    supplyChannelId?: string,
    matchingVariants?: CommercetoolsProductSearchMatchingVariants,
  ): Variant {
    const attributes = this.commercetoolsAttributesToAttributes(commercetoolsVariant.attributes, locale);
    const { price, discountedPrice, discounts } = this.extractPriceAndDiscounts(commercetoolsVariant, locale);

    return {
      id: commercetoolsVariant.id?.toString(),
      sku: commercetoolsVariant.sku?.toString(),
      images: [
        ...commercetoolsVariant.assets.map((asset) => asset.sources?.[0].uri),
        ...commercetoolsVariant.images.map((image) => image.url),
      ],
      groupId: attributes?.baseId || undefined,
      attributes: attributes,
      price: price,
      discountedPrice: discountedPrice,
      discounts: discounts,
      isMatchingVariant: matchingVariants?.matchedVariants.some((variant) => variant.id === commercetoolsVariant.id),
      isOnStock: supplyChannelId
        ? commercetoolsVariant.availability?.channels?.[supplyChannelId]?.isOnStock
        : commercetoolsVariant.availability?.isOnStock || undefined,
      restockableInDays: supplyChannelId
        ? commercetoolsVariant.availability?.channels?.[supplyChannelId]?.restockableInDays
        : commercetoolsVariant.availability?.restockableInDays || undefined,
      availableQuantity: supplyChannelId
        ? commercetoolsVariant.availability?.channels?.[supplyChannelId]?.availableQuantity
        : commercetoolsVariant.availability?.availableQuantity || undefined,
    } as Variant;
  }

  static commercetoolsAttributesToAttributes(
    commercetoolsAttributes: CommercetoolsAttribute[],
    locale: Locale,
  ): Attributes {
    const attributes: Attributes = {};

    commercetoolsAttributes?.forEach((commercetoolsAttribute) => {
      attributes[commercetoolsAttribute.name] = this.extractAttributeValue(commercetoolsAttribute.value, locale);
    });

    return attributes;
  }

  static commercetoolsCategoryReferencesToCategories(
    commercetoolsCategoryReferences: CategoryReference[],
    categoryIdField: string,
    locale: Locale,
  ): Category[] {
    const categories: Category[] = [];

    commercetoolsCategoryReferences.forEach((commercetoolsCategory) => {
      let category: Category = {
        categoryId: commercetoolsCategory.id,
      } as any;

      if (commercetoolsCategory.obj) {
        category = this.commercetoolsCategoryToCategory(commercetoolsCategory.obj, categoryIdField, locale);
      }

      categories.push(category);
    });

    return categories;
  }

  static commercetoolsProductDiscountValueToProductDiscountValue(
    commercetoolsProductDiscount: CommercetoolsProductDiscount,
    locale: Locale,
  ): ProductDiscount[] {
    const productDiscount: ProductDiscount = {
      description: commercetoolsProductDiscount.description?.[locale.language],
    };

    if (commercetoolsProductDiscount.value.type === ProductDiscountType.RELATIVE) {
      productDiscount.value = commercetoolsProductDiscount.value.permyriad;
      productDiscount.type = ProductDiscountType.RELATIVE;
    }

    if (commercetoolsProductDiscount.value.type === ProductDiscountType.ABSOLUTE) {
      productDiscount.value = commercetoolsProductDiscount.value.money
        .map((money) => {
          return this.commercetoolsMoneyToMoney(money);
        })
        .find((money) => money.currencyCode === locale.currency);
      productDiscount.type = ProductDiscountType.ABSOLUTE;
    }

    return [productDiscount];
  }

  static extractPriceAndDiscounts(commercetoolsVariant: CommercetoolsProductVariant, locale: Locale) {
    let price: Money | undefined;
    let discountedPrice: Money | undefined;
    let discounts: ProductDiscount[] | undefined;

    if (commercetoolsVariant?.scopedPrice) {
      price = this.commercetoolsMoneyToMoney(commercetoolsVariant.scopedPrice?.value);
      if (commercetoolsVariant.scopedPrice?.discounted?.value) {
        discountedPrice = this.commercetoolsMoneyToMoney(commercetoolsVariant.scopedPrice?.discounted?.value);
      }

      if (commercetoolsVariant.scopedPrice?.discounted?.discount?.obj) {
        discounts = this.commercetoolsProductDiscountValueToProductDiscountValue(
          commercetoolsVariant.scopedPrice?.discounted?.discount?.obj,
          locale,
        );
      }

      return { price, discountedPrice, discounts };
    }

    if (commercetoolsVariant?.price) {
      price = this.commercetoolsMoneyToMoney(commercetoolsVariant.price?.value);
      if (commercetoolsVariant.price?.discounted?.value) {
        discountedPrice = this.commercetoolsMoneyToMoney(commercetoolsVariant.price?.discounted?.value);
      }

      if (commercetoolsVariant.price?.discounted?.discount?.obj) {
        discounts = this.commercetoolsProductDiscountValueToProductDiscountValue(
          commercetoolsVariant.price?.discounted?.discount?.obj,
          locale,
        );
      }

      return { price, discountedPrice, discounts };
    }

    if (commercetoolsVariant?.prices) {
      //Filter price by country and currency and if we don't find one, then filter only by currency
      let commercetoolsPrice: CommercetoolsPrice = commercetoolsVariant?.prices.find((price: CommercetoolsPrice) => {
        return (
          !price.hasOwnProperty('channel') &&
          !price.hasOwnProperty('customerGroup') &&
          price.country === locale.country &&
          price.value.currencyCode === locale.currency
        );
      });

      if (!commercetoolsPrice) {
        commercetoolsPrice = commercetoolsVariant?.prices.find((price: CommercetoolsPrice) => {
          return (
            !price.hasOwnProperty('channel') &&
            !price.hasOwnProperty('customerGroup') &&
            !price.hasOwnProperty('country') &&
            price.value.currencyCode === locale.currency
          );
        });
      }

      price = this.commercetoolsMoneyToMoney(commercetoolsPrice?.value);

      if (commercetoolsPrice?.discounted?.value) {
        discountedPrice = this.commercetoolsMoneyToMoney(commercetoolsPrice?.discounted?.value);
      }

      if (commercetoolsPrice?.discounted?.discount?.obj) {
        discounts = this.commercetoolsProductDiscountValueToProductDiscountValue(
          commercetoolsPrice?.discounted?.discount?.obj,
          locale,
        );
      }

      return { price, discountedPrice, discounts };
    }

    return { price, discountedPrice, discounts };
  }

  static commercetoolsMoneyToMoney(commercetoolsMoney: CommercetoolsMoney | TypedMoney): Money | undefined {
    if (commercetoolsMoney === undefined) {
      return undefined;
    }

    return {
      fractionDigits:
        commercetoolsMoney.hasOwnProperty('fractionDigits') &&
        (commercetoolsMoney as TypedMoney).fractionDigits !== undefined
          ? (commercetoolsMoney as TypedMoney).fractionDigits
          : 2,
      centAmount: commercetoolsMoney.centAmount,
      currencyCode: commercetoolsMoney.currencyCode,
    };
  }

  static commercetoolsProductTypesToFilterFields(
    commercetoolsProductTypes: CommercetoolsProductType[],
    locale: Locale,
  ): FilterField[] {
    const filterFields: FilterField[] = [];

    commercetoolsProductTypes?.forEach((productType) => {
      productType.attributes?.forEach((attribute) => {
        if (!attribute.isSearchable) {
          return;
        }

        filterFields.push(this.commercetoolsAttributeDefinitionToFilterField(attribute, locale));
      });
    });

    return filterFields;
  }

  static commercetoolsAttributeDefinitionToFilterField(
    commercetoolsAttributeDefinition: CommercetoolsAttributeDefinition,
    locale: Locale,
  ): FilterField {
    let commercetoolsAttributeTypeName = commercetoolsAttributeDefinition.type.name;

    let commercetoolsAttributeValues = commercetoolsAttributeDefinition.type?.hasOwnProperty('values')
      ? (commercetoolsAttributeDefinition.type as AttributeEnumType | AttributeLocalizedEnumType).values
      : [];

    if (commercetoolsAttributeTypeName === 'set') {
      const elementType = (commercetoolsAttributeDefinition.type as AttributeSetType).elementType;

      commercetoolsAttributeTypeName = elementType.name;
      commercetoolsAttributeValues = elementType?.hasOwnProperty('values')
        ? (elementType as AttributeEnumType | AttributeLocalizedEnumType).values
        : [];
    }

    const filterFieldValues: FilterFieldValue[] = [];

    for (const value of commercetoolsAttributeValues) {
      filterFieldValues.push({
        value: value.key,
        name: commercetoolsAttributeTypeName === 'enum' ? value.label : value.label?.[locale.language] ?? undefined,
      });
    }

    return {
      field: `variants.attributes.${commercetoolsAttributeDefinition.name}`,
      type: TypeMap.has(commercetoolsAttributeTypeName)
        ? TypeMap.get(commercetoolsAttributeTypeName)
        : commercetoolsAttributeTypeName,
      label: commercetoolsAttributeDefinition.label?.[locale.language] ?? commercetoolsAttributeDefinition.name,
      values: filterFieldValues.length > 0 ? filterFieldValues : undefined,
      translatable: false,
    };
  }

  static commercetoolsProductTypesToFacetDefinitions(
    commercetoolsProductTypes: CommercetoolsProductType[],
    locale: Locale,
  ): FacetDefinition[] {
    const facetDefinitionsIndex: { [key: string]: FacetDefinition } = {};
    const facetDefinitions: FacetDefinition[] = [];

    commercetoolsProductTypes?.forEach((productType) => {
      productType.attributes?.forEach((attribute) => {
        if (!attribute.isSearchable) {
          return;
        }

        const facetDefinition: FacetDefinition = {
          attributeType: attribute.type.name,
          attributeId: `variants.attributes.${attribute.name}`,
          attributeLabel:
            attribute.label[locale.language] !== undefined && attribute.label[locale.language].length > 0
              ? attribute.label[locale.language]
              : attribute.name,
        };

        // Store facets by attributeId to avoid duplicated attributes
        facetDefinitionsIndex[facetDefinition.attributeId] = facetDefinition;
      });
    });

    for (const [attributeId, facetDefinition] of Object.entries(facetDefinitionsIndex)) {
      facetDefinitions.push(facetDefinition);
    }

    return facetDefinitions;
  }

  static commercetoolsFacetResultsToFacets(
    commercetoolsFacetResults: ProductSearchFacetResult[],
    commercetoolsProductSearchRequest: ProductSearchRequest,
    facetDefinitions: FacetDefinition[],
  ): Facet[] {
    return commercetoolsFacetResults
      .map((commercetoolsFacetResult) => {
        const commercetoolsFacetExpression = this.findCommercetoolsFacetExpression(
          commercetoolsProductSearchRequest.facets,
          commercetoolsFacetResult.name,
        );

        let facetLabel = commercetoolsFacetResult.name;

        facetDefinitions.filter((facet) => {
          if (facet.attributeId === commercetoolsFacetResult.name) {
            facetLabel = facet.attributeLabel;
          }
        });

        if (commercetoolsFacetExpression) {
          if ('ranges' in commercetoolsFacetExpression) {
            return this.commercetoolsFacetResultBucketToRangeFacet(
              commercetoolsFacetExpression as ProductSearchFacetRangesExpression,
              commercetoolsFacetResult as ProductSearchFacetResultBucket,
              facetLabel,
            );
          }
          if ('count' in commercetoolsFacetExpression) {
            return this.commercetoolsFacetResultCountToFacet(
              commercetoolsFacetExpression as ProductSearchFacetCountExpression,
              commercetoolsFacetResult as ProductSearchFacetResultCount,
              facetDefinitions,
              facetLabel,
            );
          }
          if ('distinct' in commercetoolsFacetExpression) {
            return this.commercetoolsFacetResultBucketToTermFacet(
              commercetoolsFacetExpression as ProductSearchFacetDistinctExpression,
              commercetoolsFacetResult as ProductSearchFacetResultBucket,
              facetLabel,
            );
          }
        }
        return null;
      })
      .filter((facet) => facet);
  }

  static commercetoolsFacetResultBucketToRangeFacet = (
    commercetoolsFacetRangesExpression: ProductSearchFacetRangesExpression,
    commercetoolsFacetResultBucket: ProductSearchFacetResultBucket,
    facetLabel: string,
  ): RangeFacet => {
    const min = parseInt(
      commercetoolsFacetResultBucket.buckets[0].key.substring(
        0,
        commercetoolsFacetResultBucket.buckets[0].key.indexOf('-'),
      ),
    );
    const max = parseInt(
      commercetoolsFacetResultBucket.buckets[0].key.substring(
        commercetoolsFacetResultBucket.buckets[0].key.indexOf('-') + 1,
      ),
    );
    const selected = this.getSelectedFilterFromFacetSearchQuery(
      commercetoolsFacetResultBucket.name,
      commercetoolsFacetRangesExpression,
      'ranges',
    ) as SearchNumberRangeExpression[];
    return {
      type: FacetTypes.RANGE,
      identifier: commercetoolsFacetResultBucket.name,
      label: facetLabel,
      key: commercetoolsFacetResultBucket.name,
      min: isNaN(min) ? 0 : min,
      max: isNaN(max) ? Number.MAX_SAFE_INTEGER : max,
      selected: !!selected,
      minSelected: selected ? selected[0]?.range?.gt : undefined,
      maxSelected: selected ? selected[0]?.range?.lt : undefined,
    };
  };

  static commercetoolsFacetResultCountToFacet = (
    commercetoolsFacetCountExpression: ProductSearchFacetCountExpression,
    commercetoolsFacetResultCount: ProductSearchFacetResultCount,
    facetDefinitions: FacetDefinition[],
    facetLabel: string,
  ): Facet => {
    const selected = this.getSelectedFilterFromFacetSearchQuery(
      commercetoolsFacetResultCount.name,
      commercetoolsFacetCountExpression,
      'count',
    );
    const definition = facetDefinitions.find(
      (facetDefinition) => facetDefinition.attributeId === commercetoolsFacetResultCount.name,
    );
    return {
      type: definition.attributeType === FacetTypes.BOOLEAN ? FacetTypes.BOOLEAN : FacetTypes.TERM,
      identifier: commercetoolsFacetResultCount.name,
      label: facetLabel,
      key: commercetoolsFacetResultCount.name,
      count: commercetoolsFacetResultCount.value,
      selected: !!selected,
    };
  };

  static commercetoolsFacetResultBucketToTermFacet = (
    commercetoolsFacetDistinctExpression: ProductSearchFacetDistinctExpression,
    commercetoolsFacetResultBucket: ProductSearchFacetResultBucket,
    facetLabel: string,
  ): TermFacet => {
    const selected = this.getSelectedFilterFromFacetSearchQuery(
      commercetoolsFacetResultBucket.name,
      commercetoolsFacetDistinctExpression,
      'distinct',
    );

    return {
      type:
        commercetoolsFacetDistinctExpression.distinct.fieldType === 'boolean' ? FacetTypes.BOOLEAN : FacetTypes.TERM,
      identifier: commercetoolsFacetResultBucket.name,
      label: facetLabel,
      key: commercetoolsFacetResultBucket.name,
      selected: selected?.length > 0,
      terms: commercetoolsFacetResultBucket.buckets.map((facetResultTerm) => {
        const term: Term = {
          identifier: facetResultTerm.key.toString(),
          label: facetResultTerm.key.toString(),
          count: facetResultTerm.count,
          key: facetResultTerm.key.toString(),
          selected: selected?.some(
            (andQuery) => 'exact' in andQuery && andQuery.exact?.value.toString() === facetResultTerm.key,
          ),
        };
        return term;
      }),
    };
  };

  static findCommercetoolsFacetExpression = (
    commercetoolsFacetExpression: ProductSearchFacetExpression[],
    facetName: string,
  ):
    | ProductSearchFacetRangesExpression
    | ProductSearchFacetCountExpression
    | ProductSearchFacetDistinctExpression
    | undefined => {
    return commercetoolsFacetExpression.find(
      (facet) =>
        (facet as ProductSearchFacetRangesExpression).ranges?.name === facetName ||
        (facet as ProductSearchFacetCountExpression).count?.name === facetName ||
        (facet as ProductSearchFacetDistinctExpression).distinct?.name === facetName,
    ) as
      | ProductSearchFacetRangesExpression
      | ProductSearchFacetCountExpression
      | ProductSearchFacetDistinctExpression
      | undefined;
  };

  static getSelectedFilterFromFacetSearchQuery = (
    facetResultName: string,
    facetQuery:
      | ProductSearchFacetRangesExpression
      | ProductSearchFacetCountExpression
      | ProductSearchFacetDistinctExpression,
    type: 'ranges' | 'count' | 'distinct',
  ): _SearchQuery[] | undefined => {
    if (facetQuery) {
      let filterExpression: _SearchQuery;
      let fieldType: string;
      switch (type) {
        case 'ranges':
          filterExpression = (facetQuery as ProductSearchFacetRangesExpression).ranges.filter;
          fieldType = (facetQuery as ProductSearchFacetRangesExpression).ranges.fieldType;
          break;
        case 'count':
          filterExpression = (facetQuery as ProductSearchFacetCountExpression).count.filter;
          break;
        case 'distinct':
          filterExpression = (facetQuery as ProductSearchFacetDistinctExpression).distinct.filter;
          fieldType = (facetQuery as ProductSearchFacetDistinctExpression).distinct.fieldType;
          break;
      }

      const facetResultIdentifier = this.getfacetIdentifier(facetResultName, fieldType);

      if (filterExpression) {
        if ('and' in filterExpression) {
          return (filterExpression as SearchAndExpression).and.filter((andQuery) => {
            return (
              (andQuery as SearchNumberRangeExpression).range?.field === facetResultIdentifier ||
              (andQuery as SearchExactExpression).exact?.field === facetResultIdentifier
            );
          });
        }
        return (filterExpression as SearchExactExpression).exact?.field === facetResultIdentifier
          ? [filterExpression]
          : (filterExpression as SearchNumberRangeExpression).range?.field === facetResultIdentifier
            ? [filterExpression]
            : undefined;
      }
    }
    return undefined;
  };
  private static getfacetIdentifier(facetResultName: string, fieldType: string) {
    switch (fieldType) {
      case 'enum':
        return `${facetResultName}.label`;
      default:
        return facetResultName;
    }
  }

  static commercetoolsAttributeGroupToString(body: AttributeGroup): string[] {
    return body.attributes.map((attribute) => attribute.key);
  }

  static calculatePreviousCursor(offset: number, count: number) {
    return offset - count >= 0 ? `offset:${offset - count}` : undefined;
  }

  static calculateNextCursor(offset: number, count: number, total: number) {
    return offset + count < total ? `offset:${offset + count}` : undefined;
  }

  static commercetoolsCategoryToCategory: (
    commercetoolsCategory: CommercetoolsCategory,
    categoryIdField: string,
    locale: Locale,
  ) => Category = (commercetoolsCategory: CommercetoolsCategory, categoryIdField: string, locale: Locale) => {
    return {
      categoryId: commercetoolsCategory?.[categoryIdField] ?? commercetoolsCategory.id,
      parentId: commercetoolsCategory.parent?.obj?.[categoryIdField],
      name: commercetoolsCategory.name?.[locale.language] ?? undefined,
      slug: commercetoolsCategory.slug?.[locale.language] ?? undefined,
      depth: commercetoolsCategory.ancestors.length,
      subCategories:
        (
          commercetoolsCategory as CommercetoolsCategory & { subCategories: CommercetoolsCategory[] }
        ).subCategories?.map((subCategory) =>
          this.commercetoolsCategoryToCategory(subCategory, categoryIdField, locale),
        ) ?? [],
      _url:
        commercetoolsCategory.ancestors.length > 0
          ? `/${commercetoolsCategory.ancestors
              .map((ancestor) => {
                return ancestor?.obj?.slug?.[locale.language];
              })
              .join('/')}/${commercetoolsCategory?.slug?.[locale.language]}`
          : `/${commercetoolsCategory?.slug?.[locale.language]}`,
    };
  };

  static commercetoolsCategoriesToTreeCategory(
    commercetoolsCategories: CommercetoolsCategory[],
    categoryIdField: string,
    locale: Locale,
  ) {
    const nodes = {};

    for (const category of commercetoolsCategories) {
      (category as CommercetoolsCategory & { subCategories: CommercetoolsCategory[] }).subCategories = [];
      nodes[category.id] = category;
    }

    for (const category of commercetoolsCategories) {
      if (!category.parent?.id) continue;

      nodes[category.parent.id].subCategories.push(category);
    }

    return commercetoolsCategories
      .filter((category) => category.ancestors.length === 0)
      .map((category) => this.commercetoolsCategoryToCategory(category, categoryIdField, locale));
  }

  static extractAttributeValue(commercetoolsAttributeValue: unknown, locale: Locale): unknown {
    if (commercetoolsAttributeValue['key'] !== undefined && commercetoolsAttributeValue['label'] !== undefined) {
      return {
        key: commercetoolsAttributeValue['key'],
        label: this.extractAttributeValue(commercetoolsAttributeValue['label'], locale),
      };
    }

    if (commercetoolsAttributeValue['typeId'] === 'product' && commercetoolsAttributeValue['id'] !== undefined) {
      return commercetoolsAttributeValue['id'];
    }

    if (commercetoolsAttributeValue instanceof Array) {
      return commercetoolsAttributeValue.map((value) => this.extractAttributeValue(value, locale));
    }

    return commercetoolsAttributeValue[locale.language] || commercetoolsAttributeValue;
  }
}
