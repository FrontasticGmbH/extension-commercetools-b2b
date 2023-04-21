import { Store as CommercetoolsStore } from '@commercetools/platform-sdk';
import { Store } from '@Types/store/Store';

export class B2BStoreMapper {
  static mapCommercetoolsStoreToStore(
    store: CommercetoolsStore,
    locale: string,
  ): Store {
    return {
      name: store.name?.[locale],
      id: store.id,
      key: store.key,
      distributionChannels: store.distributionChannels,
      supplyChannels: store.supplyChannels,
    };
  }
  static mapStoreToSmallerStore(
    store: Store,
  ): Store {
    return {
      name: store.name,
      id: store.id,
      key: store.key,
    };
  }
}
