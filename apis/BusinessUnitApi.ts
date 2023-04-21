import { B2BBusinessUnitApi } from './B2BBusinessUnitApi';
import { BusinessUnit } from '@Types/business-unit/BusinessUnit';
import { StoreApi } from './StoreApi';
import { Cart } from '@Types/cart/Cart';
import { Organization } from '@Types/organization/organization';
import { Workflow } from '@Types/workflow/Workflow';
import jsonata from 'jsonata';
import { StoreMapper } from '../mappers/StoreMapper';

export class BusinessUnitApi extends B2BBusinessUnitApi {
  getOrganizationByBusinessUnit = async (businessUnit: BusinessUnit): Promise<Organization> => {
    const organization: Organization = {} as Organization;
    organization.businessUnit = businessUnit;
    if (businessUnit.stores?.[0]) {
      const storeApi = new StoreApi(this.frontasticContext, this.locale);
      const store = await storeApi.get(businessUnit.stores?.[0].key);
      organization.store = StoreMapper.mapStoreToSmallerStore(store);
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
