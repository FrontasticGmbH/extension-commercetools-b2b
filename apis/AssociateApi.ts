import { BaseApi } from './BaseApi';
import { AssociateRole } from '@Types/associate/Associate';
import { AssociateMapper } from '../mappers/AssociateMapper';

export class AssociateApi extends BaseApi {
  getAllAssociateRoles: () => Promise<AssociateRole[]> = async () => {
    try {
      return this.getApiForProject()
        .associateRoles()
        .get()
        .execute()
        .then((response) => {
          return response.body.results
            .filter((associateRole) => associateRole.buyerAssignable)
            .map((associateRole) => AssociateMapper.mapCommercetoolsAssociateRoleToAssociateRole(associateRole));
        })
        .catch((error) => {
          throw error;
        });
    } catch {
      throw '';
    }
  };
}
