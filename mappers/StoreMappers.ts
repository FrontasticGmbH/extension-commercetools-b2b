import { Store as CommercetoolsStore } from '@commercetools/platform-sdk';
import { Store } from 'cofe-ct-b2b-ecommerce/types/store/store';
import { StoreMappers as B2BStoreMappers } from 'cofe-ct-b2b-ecommerce/mappers/StoreMappers';

// @ts-ignore
export class StoreMappers extends B2BStoreMappers {
  static mapCommercetoolsStoreToStore(
    store: CommercetoolsStore,
    locale: string,
    config: Record<string, string>,
  ): Store {
    return {
      ...store,
      name: store.name?.[locale],
      isPreBuyStore: !!config ? store.custom?.fields?.[config.storeCustomField] : false,
    };
  }
}

// Override the BaseMapper with new Mapper functions
Object.getOwnPropertyNames(StoreMappers).forEach((key) => {
  if (typeof StoreMappers[key] === 'function') {
    B2BStoreMappers[key] = StoreMappers[key];
  }
});
