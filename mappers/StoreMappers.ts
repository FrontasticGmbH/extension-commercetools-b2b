import { Store as CommercetoolsStore } from '@commercetools/platform-sdk';
import { Store } from '@Types/store/Store';
import { StoreMappers as B2BStoreMappers } from 'cofe-ct-b2b-ecommerce/mappers/StoreMappers';

// @ts-ignore
export class StoreMappers extends B2BStoreMappers {
  static mapCommercetoolsStoreToStore(
    store: CommercetoolsStore,
    locale: string,
    preBuyConfig: Record<string, string>,
    storeConfig: Record<string, string>,
  ): Store {
    return {
      name: store.name?.[locale],
      id: store.id,
      key: store.key,
      distributionChannels: store.distributionChannels,
      supplyChannels: store.supplyChannels,
      isPreBuyStore: !!preBuyConfig ? store.custom?.fields?.[preBuyConfig.storeCustomField] : false,
      storeRootCategoryId: !!preBuyConfig ? store.custom?.fields?.[storeConfig.rootCategoryCustomField]?.id : '',
    };
  }

  static mapStoreToSmallerStore(store: Store): Store {
    return {
      name: store.name,
      id: store.id,
      key: store.key,
      isPreBuyStore: store.isPreBuyStore,
      storeRootCategoryId: store.storeRootCategoryId,
    };
  }
}

// Override the BaseMapper with new Mapper functions
Object.getOwnPropertyNames(StoreMappers).forEach((key) => {
  if (typeof StoreMappers[key] === 'function') {
    B2BStoreMappers[key] = StoreMappers[key];
  }
});
