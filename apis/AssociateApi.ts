import { BaseApi } from './BaseApi';
import { AssociateRole } from '@Types/account/Associate';
import { AssociateMapper } from '../mappers/AssociateMapper';

export class AssociateApi extends BaseApi {
  getAssociateRoles: () => Promise<AssociateRole[]> = async () => {
    try {
      return this.requestBuilder()
        .associateRoles()
        .get()
        .execute()
        .then((response) => {
          return (
            response.body.results
              // Filter out roles that can't be assigned by another associates.
              .filter((associateRole) => associateRole.buyerAssignable)
              .map((associateRole) => AssociateMapper.mapCommercetoolsAssociateRoleToAssociateRole(associateRole))
          );
        })
        .catch((error) => {
          throw error;
        });
    } catch {
      throw '';
    }
  };
}
