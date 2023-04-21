import { Product } from '@Types/product/Product';
import { Context, Request } from '@frontastic/extension-types';
import { ProductQuery } from '@Types/query/ProductQuery';
import { ProductApi } from '../apis/ProductApi';
import { LineItem } from '@Types/cart/LineItem';
import { getLocale, getPath } from 'cofe-ct-ecommerce/utils/Request';
import { LineItem as WishlistItem } from '@Types/wishlist/LineItem';
import { Variant } from '@Types/product/Variant';

export class ProductRouter {
  private static isProduct(product: Product | LineItem | WishlistItem): product is Product {
    return (product as Product).variants !== undefined;
  }

  static generateUrlFor(item: Product | LineItem | WishlistItem) {
    if (ProductRouter.isProduct(item)) {
      return `/${item.slug}/p/${item.variants?.[0]?.sku}`;
    }
    return `/slug/p/${item.variant?.sku}`;
  }

  static identifyFrom(request: Request) {
    if (getPath(request)?.match(/\/p\/([^\/]+)/)) {
      return true;
    }

    return false;
  }

  static identifyPreviewFrom(request: Request) {
    if (getPath(request)?.match(/\/preview\/.+\/p\/([^\/]+)/)) {
      return true;
    }

    return false;
  }

  static loadFor = async (request: Request, frontasticContext: Context): Promise<Product> => {
    const productApi = new ProductApi(frontasticContext, getLocale(request));

    const urlMatches = getPath(request)?.match(/\/p\/([^\/]+)/);

    if (urlMatches) {
      const productQuery: ProductQuery = {
        skus: [urlMatches[1]],
      };
      const additionalQueryArgs = {};
      const distributionChannelId =
        request.query?.['distributionChannelId'] || request.sessionData?.organization?.distributionChannel?.id;

      if (distributionChannelId) {
        // @ts-ignore
        additionalQueryArgs.priceChannel = distributionChannelId;
      }

      return productApi.getProduct(productQuery, additionalQueryArgs);
    }

    return null;
  };

  static loadPreviewFor = async (request: Request, frontasticContext: Context): Promise<Product> => {
    const productApi = new ProductApi(frontasticContext, getLocale(request));

    const urlMatches = getPath(request)?.match(/\/preview\/.+\/p\/([^\/]+)/);

    if (urlMatches) {
      const productQuery: ProductQuery = {
        skus: [urlMatches[1]],
      };

      const additionalQueryArgs = { staged: true };
      const distributionChannelId =
        request.query?.['distributionChannelId'] || request.sessionData?.organization?.distributionChannel?.id;

      if (distributionChannelId) {
        // @ts-ignore
        additionalQueryArgs.priceChannel = distributionChannelId;
      }
      return productApi.getProduct(productQuery, additionalQueryArgs);
    }

    return null;
  };

  private static getProductIdsFromReferencedAttributes = (attributeNames: string[], variant: Variant) => {
    return attributeNames.reduce((prev, attributeKey) => {
      const attributeValue = variant.attributes?.[attributeKey];
      if (attributeValue && Array.isArray(attributeValue)) {
        prev = prev.concat(attributeValue?.map((item: Record<string, string>) => item.id));
      } else if (attributeValue) {
        prev.push(attributeValue.id);
      }
      return prev;
    }, []);
  };

  static getBundles = async (
    request: Request,
    frontasticContext: Context,
    product: Product,
  ): Promise<Record<string, Product[]>> => {
    const urlMatches = getPath(request)?.match(/\/p\/([^\/]+)/);

    const referencedProductsMapping: { name: string; key: string; productIds: string[] }[] = [
      { name: 'subscriptions', key: 'subscriptionAttributeNameOnBundledProduct', productIds: [] },
      { name: 'configurableComponents', key: 'bundleAttributeNames', productIds: [] },
    ];

    if (urlMatches) {
      const sku = urlMatches[1];
      const variant = product.variants.find((variant) => variant.sku === sku);
      if (variant) {
        // Store product IDs in referencedProductsMapping for each reference
        referencedProductsMapping.forEach((referenceProductMap) => {
          const attributes =
            frontasticContext?.project?.configuration?.[referenceProductMap.name]?.[referenceProductMap.key]?.split(
              ',',
            );
          if (attributes?.length) {
            const attributeKeys = Object.keys(variant.attributes).filter((attributeKey) =>
              attributes.includes(attributeKey),
            );
            referenceProductMap.productIds = this.getProductIdsFromReferencedAttributes(attributeKeys, variant);
          }
        });

        // store all product IDs in one array
        const allProductIds = referencedProductsMapping.reduce((prev, current) => {
          prev = prev.concat(current.productIds);
          return prev;
        }, []);

        // Fetch all products at once
        if (allProductIds.length) {
          const productApi = new ProductApi(frontasticContext, getLocale(request));
          const products = await productApi
            .query({ productIds: allProductIds })
            .then((result) => result.items as Product[]);

          // return each product set in a map
          if (products.length) {
            return referencedProductsMapping.reduce((prev, current) => {
              prev[current.name] = products.filter((product) => current.productIds.includes(product.productId));
              return prev;
            }, {});
          }
        }
      }
    }

    return {};
  };
}
