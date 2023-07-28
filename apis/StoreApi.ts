import { Store } from '@Types/store/Store';
import { StoreMapper } from '../mappers/StoreMapper';
import { StoreDraft } from '@commercetools/platform-sdk';
import { BaseApi } from '@Commerce-commercetools/apis/BaseApi';
import { ExternalError } from '@Commerce-commercetools/utils/Errors';

const convertStoreToBody = (store: StoreDraft, locale: string): StoreDraft => {
  return {
    ...store,
    // @ts-ignore
    name: {
      [locale]: store.name,
    },
  };
};

export const DEFAULT_CHANNEL_KEY = 'default-channel';

export class StoreApi extends BaseApi {
  /**
   * @deprecated use create instead
   */
  createFromCommercetoolsStoreDraft: (store: StoreDraft) => Promise<any> = async (store: StoreDraft) => {
    const locale = await this.getCommercetoolsLocal();
    const body = convertStoreToBody(store, locale.language);

    try {
      return this.requestBuilder()
        .stores()
        .post({
          body,
        })
        .execute()
        .then((response) => {
          return response.body;
        })
        .catch((error) => {
          throw error;
        });
    } catch (error) {
      throw error;
    }
  };

  create: (store: Store) => Promise<Store> = async (store: Store) => {
    const locale = await this.getCommercetoolsLocal();

    const storeDraft: StoreDraft = {
      key: store.key,
      name: {
        [locale.language]: store.name,
      },
      supplyChannels: [
        {
          key: DEFAULT_CHANNEL_KEY,
          typeId: 'channel',
        },
      ],
      distributionChannels: [
        {
          key: DEFAULT_CHANNEL_KEY,
          typeId: 'channel',
        },
      ],
    };

    return this.requestBuilder()
      .stores()
      .post({
        body: storeDraft,
      })
      .execute()
      .then((response) => {
        return StoreMapper.mapCommercetoolsStoreToStore(response.body, locale.language);
      })
      .catch((error) => {
        throw new ExternalError({ status: error.code, message: error.message, body: error.body });
      });
  };

  get: (key: string) => Promise<Store> = async (key: string): Promise<Store> => {
    const locale = await this.getCommercetoolsLocal();

    try {
      return this.requestBuilder()
        .stores()
        .withKey({ key })
        .get()
        .execute()
        .then((response) => {
          return StoreMapper.mapCommercetoolsStoreToStore(response.body, locale.language);
        });
    } catch (e) {
      console.log(e);

      throw '';
    }
  };

  query: (where: string, expand?: string | string[]) => Promise<any> = async (
    where: string,
    expand?: string | string[],
  ): Promise<Store[]> => {
    const locale = await this.getCommercetoolsLocal();

    try {
      return this.requestBuilder()
        .stores()
        .get({
          queryArgs: {
            where,
            expand,
          },
        })
        .execute()
        .then((response) => {
          return response.body.results.map((store) => StoreMapper.mapCommercetoolsStoreToStore(store, locale.language));
        });
    } catch (e) {
      console.log(e);

      throw '';
    }
  };
}
