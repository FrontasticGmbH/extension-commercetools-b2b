import { AssociateRole as CommercetoolsAssociateRole } from '@commercetools/platform-sdk';
import { AssociateRole } from '@Types/associate/Associate';

export class AssociateMapper {
  static mapCommercetoolsAssociateRoleToAssociateRole(associateRole: CommercetoolsAssociateRole): AssociateRole {
    return {
      name: associateRole.name,
      id: associateRole.id,
      key: associateRole.key,
      buyerAssignable: associateRole.buyerAssignable,
    };
  }
}
