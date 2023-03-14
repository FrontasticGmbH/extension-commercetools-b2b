import { BusinessUnitApi as B2BBusinessUnitApi } from 'cofe-ct-b2b-ecommerce/apis/BusinessUnitApi';
import { BusinessUnit } from 'cofe-ct-b2b-ecommerce/types/business-unit/BusinessUnit';
import { StoreApi } from './StoreApi';
import { Cart } from 'cofe-ct-b2b-ecommerce/types/cart/Cart';
import { Organization } from 'cofe-ct-b2b-ecommerce/types/organization/organization';
import { Workflow } from '@Types/workflow/Workflow';
import jsonata from 'jsonata';

export class BusinessUnitApi extends B2BBusinessUnitApi {
  getOrganizationByBusinessUnit = async (businessUnit: BusinessUnit): Promise<Record<string, object>> => {
    const organization: Record<string, object> = {};
    organization.businessUnit = businessUnit;
    if (businessUnit.stores?.[0]) {
      const storeApi = new StoreApi(this.frontasticContext, this.locale);
      // @ts-ignore
      const store = await storeApi.get(businessUnit.stores?.[0].key);
      // @ts-ignore
      organization.store = {
        id: store.id,
        key: store.key,
        name: store.name,
        custom: store.custom,
        isPreBuyStore: store.isPreBuyStore,
      };
      if (store?.distributionChannels?.length) {
        organization.distributionChannel = store.distributionChannels[0];
      }
    }

    return organization;
  };
  getOrderStateFromWorkflows = async (
    cart: Cart,
    organization: Organization,
    config: Record<string, string>,
  ): Promise<null | string> => {
    const businessUnit = await this.getByKey(organization.businessUnit.key);
    const workflowString = businessUnit.custom?.fields?.[config?.businessUnitCustomField];
    if (workflowString && config?.orderReviewStateID) {
      try {
        const workflows: Workflow[] = JSON.parse(workflowString);
        const promises = workflows.map((workflow) => jsonata(workflow.ast.expression).evaluate({ cart }));
        if ((await Promise.all(promises)).some((res) => res)) {
          return config?.orderReviewStateID;
        }
      } catch {
        return null;
      }
    }
    return null;
  };
}
