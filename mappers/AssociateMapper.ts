import { AssociateRole as CommercetoolsAssociateRole } from '@commercetools/platform-sdk';
import { AssociateRole } from '@Types/account/Associate';

export class AssociateMapper {
  static mapCommercetoolsAssociateRoleToAssociateRole(associateRole: CommercetoolsAssociateRole): AssociateRole {
    return {
      associateRoleId: associateRole.id,
      key: associateRole.key,
      name: associateRole.name,
    };
  }
}
