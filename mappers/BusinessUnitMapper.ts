import {
  BusinessUnit as CommercetoolsBusinessUnit,
  StoreKeyReference as CommercetoolsStoreKeyReference,
} from '@commercetools/platform-sdk';
import { BusinessUnit } from '@Types/business-unit/BusinessUnit';
import { Store, StoreKeyReference } from '@Types/store/Store';
import { Associate } from '@Types/associate/Associate';
import { Account } from '@Types/account/Account';

export class BusinessUnitMapper {
  static commercetoolsBusinessUnitToBusinessUnit(
    commercetoolsBusinessUnit: CommercetoolsBusinessUnit,
    allStores?: Store[],
  ): BusinessUnit {
    const businessUnit = {
      businessUnitId: commercetoolsBusinessUnit.id,
      key: commercetoolsBusinessUnit.key,
      name: commercetoolsBusinessUnit.name,
      parentUnit: commercetoolsBusinessUnit.parentUnit,
      storeMode: commercetoolsBusinessUnit.storeMode,
      stores: this.mapCommercetoolsStoreKeyReferencesToStoreKeyReferences(commercetoolsBusinessUnit.stores),
      associates: this.mapReferencedAssociatesToAssociate(commercetoolsBusinessUnit),
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
    businessUnit.associates = this.mapReferencedAssociatesToAssociate(commercetoolsBusinessUnit);

    return businessUnit;
  }

  static trimBusinessUnit(businessUnit: BusinessUnit, accountId: string): BusinessUnit {
    return {
      ...businessUnit,
      addresses: [],
      // @ts-ignore
      stores: businessUnit.stores.map((store) => ({ key: store.key, name: store.name })),
      associates: businessUnit.associates
        ?.filter((associate) => associate.customer.id === accountId)
        ?.map((associate) => ({
          associateRoleAssignments: associate.associateRoleAssignments?.map((role) => ({
            associateRole: { key: role.associateRole.key },
          })),
          customer: { id: associate.customer.id },
        })),
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
      (associate) => associate.customer.id === account.accountId,
    );
    return currentUserAssociate?.associateRoleAssignments.some((role) => role.associateRole.key === associateRoleKey);
  }

  static isUserRootAdminInBusinessUnit(
    businessUnit: CommercetoolsBusinessUnit,
    accountId: string,
    adminRoleKey: string,
  ): boolean {
    if (this.isAssociateRoleKeyInCommercetoolsBusinessUnit(businessUnit, accountId, adminRoleKey)) {
      return !businessUnit.parentUnit;
    }
    return false;
  }

  static mapReferencedAssociatesToAssociate(businessUnit: CommercetoolsBusinessUnit): Associate[] {
    return businessUnit.associates?.map((associate) => {
      if (associate.customer?.obj) {
        return {
          associateRoleAssignments: associate.associateRoleAssignments,
          customer: {
            id: associate.customer.id,
            typeId: 'customer',
            firstName: associate.customer?.obj?.firstName,
            lastName: associate.customer?.obj?.lastName,
            email: associate.customer?.obj?.email,
          },
        };
      }
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
}
