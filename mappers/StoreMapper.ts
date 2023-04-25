import { Store as CommercetoolsStore } from '@commercetools/platform-sdk';
import { Store } from '@Types/store/Store';

export class StoreMapper {
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
