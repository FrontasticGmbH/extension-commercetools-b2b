import { Store } from 'cofe-ct-b2b-ecommerce/types/store/store';
import { StoreApi as B2BStoreApi } from 'cofe-ct-b2b-ecommerce/apis/StoreApi';
import { StoreMappers } from '../mappers/StoreMappers';

export class StoreApi extends B2BStoreApi {
  get: (key: string) => Promise<any> = async (key: string): Promise<Store> => {
    const locale = await this.getCommercetoolsLocal();
    const config = this.frontasticContext?.project?.configuration?.preBuy;

    try {
      return this.getApiForProject()
        .stores()
        .withKey({ key })
        .get()
        .execute()
        .then((response) => {
          return StoreMappers.mapCommercetoolsStoreToStore(response.body, locale.language, config);
        });
    } catch (e) {
      console.log(e);

      throw '';
    }
  };
}
