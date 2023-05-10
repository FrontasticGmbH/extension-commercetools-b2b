import { Store } from '@Types/store/Store';
import { StoreMapper } from '../mappers/StoreMapper';
import { StoreDraft } from '@commercetools/platform-sdk';
import { BaseApi } from '@Commerce-commercetools/apis/BaseApi';

const convertStoreToBody = (store: StoreDraft, locale: string): StoreDraft => {
  return {
    ...store,
    // @ts-ignore
    name: {
      [locale]: store.name,
    },
  };
};

export class StoreApi extends BaseApi {
  create: (store: StoreDraft) => Promise<any> = async (store: StoreDraft) => {
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

  get: (key: string) => Promise<Store> = async (key: string): Promise<Store> => {
    const locale = await this.getCommercetoolsLocal();
    const preBuyConfig = this.frontasticContext?.project?.configuration?.preBuy;
    const sotreConfig = this.frontasticContext?.project?.configuration?.storeContext;

    try {
      return this.requestBuilder()
        .stores()
        .withKey({ key })
        .get()
        .execute()
        .then((response) => {
          return StoreMapper.mapCommercetoolsStoreToStore(response.body, locale.language, preBuyConfig, sotreConfig);
        });
    } catch (e) {
      console.log(e);

      throw '';
    }
  };

  query: (where?: string) => Promise<any> = async (where: string): Promise<Store[]> => {
    const locale = await this.getCommercetoolsLocal();
    const preBuyConfig = this.frontasticContext?.project?.configuration?.preBuy;
    const storeConfig = this.frontasticContext?.project?.configuration?.storeContext;

    const queryArgs = where
      ? {
          where,
        }
      : {};

    try {
      return this.requestBuilder()
        .stores()
        .get({
          queryArgs,
        })
        .execute()
        .then((response) => {
          return response.body.results.map((store) =>
            StoreMapper.mapCommercetoolsStoreToStore(store, locale.language, preBuyConfig, storeConfig),
          );
        });
    } catch (e) {
      console.log(e);

      throw '';
    }
  };
}
