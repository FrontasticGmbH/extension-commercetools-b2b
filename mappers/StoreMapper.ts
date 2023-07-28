import { Store as CommercetoolsStore } from '@commercetools/platform-sdk';
import { Store } from '@Types/store/Store';
import { Channel } from '@Types/store/Channel';

export class StoreMapper {
  static mapCommercetoolsStoreToStore(store: CommercetoolsStore, locale: string): Store {
    return {
      name: store.name?.[locale],
      id: store.id,
      key: store.key,
      distributionChannels: store.distributionChannels.map((commercetoolsChannel) => {
        const channel: Channel = {
          channelId: commercetoolsChannel.id,
        };
        return channel;
      }),
      supplyChannels: store.supplyChannels.map((commercetoolsChannel) => {
        const channel: Channel = {
          channelId: commercetoolsChannel.id,
        };
        return channel;
      }),
    };
  }

  static mapStoreToSmallerStore(store: Store): Store {
    return {
      name: store.name,
      id: store.id,
      key: store.key,
    };
  }
}
