import { Store } from '@Types/store/Store';
import { StoreApi as B2BStoreApi } from 'cofe-ct-b2b-ecommerce/apis/StoreApi';
import { StoreMapper } from '../mappers/StoreMapper';

export class StoreApi extends B2BStoreApi {
  get: (key: string) => Promise<Store> = async (key: string): Promise<Store> => {
    const locale = await this.getCommercetoolsLocal();
    const preBuyConfig = this.frontasticContext?.project?.configuration?.preBuy;
    const sotreConfig = this.frontasticContext?.project?.configuration?.storeContext;

    try {
      return this.getApiForProject()
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
}
