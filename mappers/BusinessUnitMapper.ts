import {
  BusinessUnit as CommercetoolsBusinessUnit,
  StoreKeyReference as CommercetoolsStoreKeyReference,
  Associate as CommercetoolsAssociate,
} from '@commercetools/platform-sdk';
import { BusinessUnit } from '@Types/business-unit/BusinessUnit';
import { Store, StoreKeyReference } from '@Types/store/Store';
import { Associate, AssociateRole } from '@Types/business-unit/Associate';
import { AccountMapper } from '@Commerce-commercetools/mappers/AccountMapper';
import { Locale } from '@Commerce-commercetools/interfaces/Locale';
import { AssociateRoleAssignment as CommercetoolsAssociateRoleAssignment } from '@commercetools/platform-sdk/dist/declarations/src/generated/models/business-unit';
import { Account } from '@Types/account/Account';
import { AssociateRole as CommercetoolsAssociateRole } from '@commercetools/platform-sdk/dist/declarations/src/generated/models/associate-role';

export class BusinessUnitMapper {
  static commercetoolsBusinessUnitToBusinessUnit(
    commercetoolsBusinessUnit: CommercetoolsBusinessUnit,
    locale: Locale,
    allStores?: Store[],
  ): BusinessUnit {
    const businessUnit = {
      businessUnitId: commercetoolsBusinessUnit.id,
      key: commercetoolsBusinessUnit.key,
      name: commercetoolsBusinessUnit.name,
      parentUnit: commercetoolsBusinessUnit.parentUnit,
      storeMode: commercetoolsBusinessUnit.storeMode,
      stores: this.mapCommercetoolsStoreKeyReferencesToStoreKeyReferences(commercetoolsBusinessUnit.stores),
      associates: this.mapReferencedAssociatesToAssociate(commercetoolsBusinessUnit.associates, locale),
      topLevelUnit: commercetoolsBusinessUnit.topLevelUnit,
      addresses: commercetoolsBusinessUnit.addresses,
    };

    if (allStores) {
      businessUnit.stores = this.expandStores(businessUnit.stores, allStores);
    }

    return businessUnit;
  }

  static mapBusinessUnitToBusinessUnitTreeItem(
    commercetoolsBusinessUnit: CommercetoolsBusinessUnit,
    locale: Locale,
    allStores: Store[],
  ): BusinessUnit {
    const businessUnit: BusinessUnit = {
      topLevelUnit: commercetoolsBusinessUnit.topLevelUnit,
      key: commercetoolsBusinessUnit.key,
      name: commercetoolsBusinessUnit.name,
      parentUnit: commercetoolsBusinessUnit.parentUnit,
      storeMode: commercetoolsBusinessUnit.storeMode,
      stores: this.mapCommercetoolsStoreKeyReferencesToStoreKeyReferences(commercetoolsBusinessUnit.stores),
      contactEmail: commercetoolsBusinessUnit.contactEmail,
      unitType: commercetoolsBusinessUnit.unitType,
      custom: commercetoolsBusinessUnit.custom,
      status: commercetoolsBusinessUnit.status,
      addresses: commercetoolsBusinessUnit.addresses,
      defaultShippingAddressId: commercetoolsBusinessUnit.defaultShippingAddressId,
      defaultBillingAddressId: commercetoolsBusinessUnit.defaultBillingAddressId,
    };

    businessUnit.stores = this.expandStores(businessUnit.stores, allStores);
    businessUnit.associates = this.mapReferencedAssociatesToAssociate(commercetoolsBusinessUnit.associates, locale);

    return businessUnit;
  }

  static trimBusinessUnit(businessUnit: BusinessUnit, accountId: string): BusinessUnit {
    return {
      ...businessUnit,
      addresses: [],
      // @ts-ignore
      stores: businessUnit.stores.map((store) => ({ key: store.key, name: store.name })),
      associates: businessUnit.associates
        ?.filter((associate) => associate.accountId === accountId)
        ?.map((associate) => {
          const trimmedAssociate: Associate = {
            accountId: associate.accountId,
            email: associate.email,
            roles: associate.roles?.map((role) => {
              const trimmedAssociateRole: AssociateRole = { key: role.key };
              return trimmedAssociateRole;
            }),
          };

          return trimmedAssociate;
        }),
    };
  }

  /**
   * @deprecated Use `isAssociateRoleKeyInBusinessUnit` instead
   */
  static isAssociateRoleKeyInCommercetoolsBusinessUnit(
    businessUnit: CommercetoolsBusinessUnit,
    accountId: string,
    associateRoleKey: string,
  ): boolean {
    const currentUserAssociate = businessUnit.associates?.find((associate) => associate.customer.id === accountId);
    return currentUserAssociate?.associateRoleAssignments.some((role) => role.associateRole.key === associateRoleKey);
  }

  static isAssociateRoleKeyInBusinessUnit(
    businessUnit: BusinessUnit,
    account: Account,
    associateRoleKey: string,
  ): boolean {
    const currentUserAssociate = businessUnit.associates?.find(
      (associate) => associate.accountId === account.accountId,
    );
    return currentUserAssociate?.roles.some((role) => role.key === associateRoleKey);
  }

  static mapReferencedAssociatesToAssociate(
    commercetoolsAssociates: CommercetoolsAssociate[],
    locale: Locale,
  ): Associate[] {
    return commercetoolsAssociates?.map((commercetoolsAssociate) => {
      if (!commercetoolsAssociate.customer?.obj) {
        return undefined;
      }

      const associate: Associate = AccountMapper.commercetoolsCustomerToAccount(
        commercetoolsAssociate.customer?.obj,
        locale,
      );

      associate.roles = commercetoolsAssociate.associateRoleAssignments?.map((associateRoleAssigment) => {
        return this.mapCommercetoolsAssociateRoleAssignmentToAssociateRole(associateRoleAssigment);
      });

      return associate;
    });
  }

  static expandStores(stores: StoreKeyReference[], allStores: Store[]): StoreKeyReference[] {
    return stores?.map((store) => {
      const storeObj = allStores.find((s) => s.key === store.key);
      return storeObj
        ? {
            name: storeObj.name,
            key: storeObj.key,
            typeId: 'store',
            id: storeObj.id,
          }
        : (store as StoreKeyReference);
    });
  }

  static mapCommercetoolsStoreKeyReferencesToStoreKeyReferences(
    commercetoolsStoreKeyReferences: CommercetoolsStoreKeyReference[],
  ): StoreKeyReference[] {
    return commercetoolsStoreKeyReferences.map((commercetoolsStoreKeyReference) => {
      const storeKeyReference: StoreKeyReference = {
        key: commercetoolsStoreKeyReference.key,
        typeId: 'store',
      };
      return storeKeyReference;
    });
  }

  static mapCommercetoolsAssociateRoleAssignmentToAssociateRole(
    associateRoleAssigment: CommercetoolsAssociateRoleAssignment,
  ): AssociateRole {
    return {
      associateRoleId: associateRoleAssigment.associateRole.id,
      key: associateRoleAssigment.associateRole.key,
    };
  }

  static mapCommercetoolsAssociateRoleToAssociateRole(associateRole: CommercetoolsAssociateRole): AssociateRole {
    return {
      associateRoleId: associateRole.id,
      key: associateRole.key,
      name: associateRole.name,
    };
  }
}
