import { BusinessUnit, BusinessUnitStatus, BusinessUnitType, StoreMode } from '@Types/business-unit/BusinessUnit';
import { StoreApi } from './StoreApi';
import { Organization } from '@Commerce-commercetools/interfaces/Organization';
import { StoreMapper } from '../mappers/StoreMapper';
import {
  BusinessUnit as CommercetoolsBusinessUnit,
  BusinessUnitDraft,
  BusinessUnitPagedQueryResponse,
} from '@commercetools/platform-sdk';
import {
  BusinessUnit as CommercetoolsBusinessUnit,
  BusinessUnitPagedQueryResponse,
  BusinessUnitUpdateAction,
} from '@commercetools/platform-sdk';
import { BusinessUnitMapper } from '../mappers/BusinessUnitMapper';
import { BaseApi } from '@Commerce-commercetools/apis/BaseApi';
import { Store } from '@Types/store/Store';
import { Account } from '@Types/account/Account';
import { ExternalError } from '@Commerce-commercetools/utils/Errors';
import { businessUnitKeyFormatter } from '@Commerce-commercetools/utils/BussinessUnitFormatter';
import { AssociateRole } from '@Types/business-unit/Associate';

const MAX_LIMIT = 50;

export class BusinessUnitApi extends BaseApi {
  /**
   * @deprecated
   */
  getOrganizationByBusinessUnit = async (businessUnit: BusinessUnit): Promise<Organization> => {
    const organization: Organization = {} as Organization;
    organization.businessUnit = businessUnit;
    if (businessUnit.stores?.[0]) {
      const storeApi = new StoreApi(this.frontasticContext, this.locale, this.currency);
      const store = await storeApi.get(businessUnit.stores?.[0].key);
      organization.store = StoreMapper.mapStoreToSmallerStore(store);
      if (store?.distributionChannels?.length) {
        organization.distributionChannel = store.distributionChannels[0];
      }
    }

    return organization;
  };

  /**
   * @deprecated
   */
  getOrganization: (account: Account, businessUnitKey?: string) => Promise<Organization> = async (
    account: Account,
    businessUnitKey?: string,
  ): Promise<Organization> => {
    const organization: Organization = {} as Organization;
    if (account) {
      let businessUnit: BusinessUnit;

      if (businessUnitKey) {
        businessUnit = await this.get(businessUnitKey, account);
      } else {
        businessUnit = await this.getFirstRootForAssociate(account);
      }
      if (businessUnit?.key) {
        return this.getOrganizationByBusinessUnit(businessUnit);
      }
    }

    return organization;
  };

  createForAccountAndStore: (account: Account, store: Store) => Promise<BusinessUnit> = async (
    account: Account,
    store: Store,
  ) => {
    const locale = await this.getCommercetoolsLocal();

    const businessUnitKey = businessUnitKeyFormatter(account.companyName);

    const businessUnitDraft: BusinessUnitDraft = {
      key: businessUnitKey,
      name: account.companyName,
      status: BusinessUnitStatus.Active,
      stores: [
        {
          typeId: 'store',
          id: store.storeId,
        },
      ],
      storeMode: StoreMode.Explicit,
      unitType: BusinessUnitType.Company,
      contactEmail: account.email,
      associates: [
        {
          associateRoleAssignments: [
            {
              associateRole: {
                key: this.associateRoleAdminKey,
                typeId: 'associate-role',
              },
            },
            {
              associateRole: {
                key: this.associateRoleBuyerKey,
                typeId: 'associate-role',
              },
            },
          ],
          customer: {
            id: account.accountId,
            typeId: 'customer',
          },
        },
      ],
    };

    return this.requestBuilder()
      .businessUnits()
      .post({
        body: businessUnitDraft,
      })
      .execute()
      .then((response) => {
        return BusinessUnitMapper.commercetoolsBusinessUnitToBusinessUnit(response.body, locale, [store]);
      })
      .catch((error) => {
        throw new ExternalError({ status: error.code, message: error.message, body: error.body });
      });
  };

  delete: (businessUnitKey: string) => Promise<BusinessUnit> = async (businessUnitKey: string) => {
    const locale = await this.getCommercetoolsLocal();

    return this.getByKey(businessUnitKey).then((businessUnit) => {
      return this.requestBuilder()
        .businessUnits()
        .withKey({ key: businessUnitKey })
        .delete({
          queryArgs: {
            version: businessUnit.version,
          },
        })
        .execute()
        .then((response) => {
          return BusinessUnitMapper.commercetoolsBusinessUnitToBusinessUnit(response.body, locale);
        })
        .catch((error) => {
          throw new ExternalError({ status: error.code, message: error.message, body: error.body });
        });
    });
  };

  update: (businessUnitKey: string, actions: BusinessUnitUpdateAction[]) => Promise<BusinessUnit> = async (
    businessUnitKey: string,
    actions: BusinessUnitUpdateAction[],
  ) => {
    const locale = await this.getCommercetoolsLocal();

    return this.getByKey(businessUnitKey).then((businessUnit) =>
      this.requestBuilder()
        .businessUnits()
        .withKey({ key: businessUnitKey })
        .post({
          body: {
            version: businessUnit.version,
            actions,
          },
        })
        .execute()
        .then((response) => {
          return BusinessUnitMapper.commercetoolsBusinessUnitToBusinessUnit(response.body, locale);
        })
        .catch((error) => {
          throw new ExternalError({ status: error.code, message: error.message, body: error.body });
        }),
    );
  };

  query: (where: string | string[], expand?: string | string[]) => Promise<BusinessUnitPagedQueryResponse> = async (
    where: string | string[],
    expand?: string | string[],
  ) => {
    try {
      return this.requestBuilder()
        .businessUnits()
        .get({
          queryArgs: {
            where,
            expand,
            limit: MAX_LIMIT,
          },
        })
        .execute()
        .then((res) => res.body as BusinessUnitPagedQueryResponse);
    } catch (e) {
      throw e;
    }
  };

  /**
   * @deprecated Use getRootBusinessUnitsForAssociate instead
   */
  getRootCommercetoolsBusinessUnitsForAssociate: (
    commercetoolsBusinessUnits: CommercetoolsBusinessUnit[],
    account: Account,
    filterAdmin?: boolean,
  ) => CommercetoolsBusinessUnit[] = (
    commercetoolsBusinessUnits: CommercetoolsBusinessUnit[],
    account: Account,
    filterAdmin?: boolean,
  ) => {
    if (!commercetoolsBusinessUnits.length) {
      return [];
    }

    const rootNodes = commercetoolsBusinessUnits.filter((bu) => !bu.parentUnit);

    if (rootNodes.length) {
      return rootNodes;
    }

    const justParents = commercetoolsBusinessUnits
      // filter out the ones that their parent is also in the list
      .filter((bu) => {
        return commercetoolsBusinessUnits.findIndex((sbu) => sbu.key === bu.parentUnit?.key) === -1;
      });

    return filterAdmin
      ? justParents.filter((bu) =>
          BusinessUnitMapper.isAssociateRoleKeyInCommercetoolsBusinessUnit(
            bu,
            account.accountId,
            this.associateRoleAdminKey,
          ),
        )
      : justParents
          // sort by Admin first
          .sort((a, b) =>
            BusinessUnitMapper.isAssociateRoleKeyInCommercetoolsBusinessUnit(
              a,
              account.accountId,
              this.associateRoleAdminKey,
            )
              ? -1
              : BusinessUnitMapper.isAssociateRoleKeyInCommercetoolsBusinessUnit(
                  b,
                  account.accountId,
                  this.associateRoleAdminKey,
                )
              ? 1
              : 0,
          );
  };

  protected getRootBusinessUnitsForAssociate: (businessUnits: BusinessUnit[], account: Account) => BusinessUnit[] = (
    businessUnits: BusinessUnit[],
    account: Account,
  ) => {
    if (!businessUnits.length) {
      return [];
    }

    // Filter out the businessUnits that their ancestor is also in the list
    const businessUnitsWithNoAncestors = businessUnits.filter((businessUnit) => {
      return (
        businessUnits.findIndex((currentBusinessUnit) => currentBusinessUnit.key === businessUnit.parentUnit?.key) ===
        -1
      );
    });

    return (
      businessUnitsWithNoAncestors
        // Sort by Admin first
        .sort((a, b) =>
          BusinessUnitMapper.isAssociateRoleKeyInBusinessUnit(a, account, this.associateRoleAdminKey)
            ? -1
            : BusinessUnitMapper.isAssociateRoleKeyInBusinessUnit(b, account, this.associateRoleAdminKey)
            ? 1
            : 0,
        )
    );
  };

  /**
   * @deprecated Use `getForAssociate` instead
   */
  getFirstRootForAssociate: (account: Account) => Promise<BusinessUnit> = async (account: Account) => {
    try {
      const locale = await this.getCommercetoolsLocal();

      const commercetoolsBusinessUnits = await this.getCommercetoolsBusinessUnitsForUser(account);
      const rootCommercetoolsBusinessUnits = this.getRootCommercetoolsBusinessUnitsForAssociate(
        commercetoolsBusinessUnits,
        account,
      );

      if (rootCommercetoolsBusinessUnits.length) {
        const commercetoolsBusinessUnit = await this.getBusinessUnitWithExplicitStores(
          rootCommercetoolsBusinessUnits[0],
        );

        const storeKeys = commercetoolsBusinessUnit?.stores?.map((store) => `"${store.key}"`).join(' ,');

        const storeApi = new StoreApi(this.frontasticContext, this.locale, this.currency);
        const allStores = await storeApi.query(`key in (${storeKeys})`);

        return BusinessUnitMapper.commercetoolsBusinessUnitToBusinessUnit(commercetoolsBusinessUnit, locale, allStores);
      }

      const commercetoolsBusinessUnit = commercetoolsBusinessUnits?.[0];
      const storeKeys = commercetoolsBusinessUnit?.stores?.map((store) => `"${store.key}"`).join(' ,');

      const storeApi = new StoreApi(this.frontasticContext, this.locale, this.currency);
      const allStores = await storeApi.query(`key in (${storeKeys})`);

      return BusinessUnitMapper.commercetoolsBusinessUnitToBusinessUnit(commercetoolsBusinessUnit, locale, allStores);
    } catch (error) {
      throw error;
    }
  };

  get: (key: string, account: Account) => Promise<BusinessUnit> = async (key: string, account: Account) => {
    const locale = await this.getCommercetoolsLocal();

    const storeApi = new StoreApi(this.frontasticContext, this.locale, this.currency);

    try {
      const businessUnit = await this.query(
        [`associates(customer(id="${account.accountId}"))`, `key in ("${key}")`],
        'associates[*].customer',
      ).then((response) => {
        if (response.count >= 1) {
          return BusinessUnitMapper.commercetoolsBusinessUnitToBusinessUnit(response.results[0], locale);
        }

        throw new Error(`Business unit "${key}" not found for this account`);
      });

      const storeKeys = businessUnit?.stores?.map((store) => `"${store.key}"`).join(' ,');
      const allStores = await storeApi.query(`key in (${storeKeys})`);

      businessUnit.stores = BusinessUnitMapper.expandStores(businessUnit.stores, allStores);

      return businessUnit;
    } catch (e) {
      throw e;
    }
  };

  /**
   * @deprecated use getByKey instead
   */
  getCommercetoolsBusinessUnitByKey: (key: string) => Promise<CommercetoolsBusinessUnit> = async (key: string) => {
    try {
      return this.requestBuilder()
        .businessUnits()
        .withKey({ key })
        .get()
        .execute()
        .then((res) => res.body as CommercetoolsBusinessUnit);
    } catch (e) {
      throw e;
    }
  };

  getByKey: (key: string) => Promise<BusinessUnit> = async (key: string) => {
    const locale = await this.getCommercetoolsLocal();

    try {
      return this.requestBuilder()
        .businessUnits()
        .withKey({ key })
        .get()
        .execute()
        .then((response) => {
          return BusinessUnitMapper.commercetoolsBusinessUnitToBusinessUnit(response.body, locale);
        });
    } catch (e) {
      throw e;
    }
  };

  getBusinessUnitWithExplicitStores: (
    commercetoolsBusinessUnit: CommercetoolsBusinessUnit,
  ) => Promise<CommercetoolsBusinessUnit> = async (commercetoolsBusinessUnit: CommercetoolsBusinessUnit) => {
    if (commercetoolsBusinessUnit.storeMode === StoreMode.Explicit) {
      return commercetoolsBusinessUnit;
    }
    let currentCommercetoolsBusinessUnit: CommercetoolsBusinessUnit = { ...commercetoolsBusinessUnit };
    while (
      currentCommercetoolsBusinessUnit.storeMode === StoreMode.FromParent &&
      !!currentCommercetoolsBusinessUnit.parentUnit
    ) {
      currentCommercetoolsBusinessUnit = await this.requestBuilder()
        .businessUnits()
        .withKey({ key: currentCommercetoolsBusinessUnit.parentUnit.key })
        .get()
        .execute()
        .then((response) => {
          return response.body;
        });
    }
    if (currentCommercetoolsBusinessUnit.storeMode === StoreMode.Explicit) {
      return {
        ...commercetoolsBusinessUnit,
        stores: currentCommercetoolsBusinessUnit.stores,
      };
    }
    return commercetoolsBusinessUnit;
  };

  /**
   * @deprecated Use `getBusinessUnitsForUser` instead
   */
  getCommercetoolsBusinessUnitsForUser: (account: Account) => Promise<CommercetoolsBusinessUnit[]> = async (
    account: Account,
  ) => {
    const response = await this.query(`associates(customer(id="${account.accountId}"))`, 'associates[*].customer');
    return response.results;
  };

  getBusinessUnitsForUser: (account: Account, expandStores?: boolean) => Promise<BusinessUnit[]> = async (
    account: Account,
    expandStores?: boolean,
  ) => {
    const locale = await this.getCommercetoolsLocal();

    const storeApi = new StoreApi(this.frontasticContext, this.locale, this.currency);

    const businessUnits = await this.query(
      `associates(customer(id="${account.accountId}"))`,
      'associates[*].customer',
    ).then((response) => {
      return response.results.map((commercetoolsBusinessUnit) => {
        return BusinessUnitMapper.commercetoolsBusinessUnitToBusinessUnit(commercetoolsBusinessUnit, locale);
      });
    });

    if (expandStores) {
      const storeKeys = businessUnits
        .reduce((prev: Store[], curr) => {
          prev = prev.concat(curr.stores || []);
          return prev;
        }, [])
        ?.map((store) => `"${store.key}"`)
        .join(' ,');

      const allStores = storeKeys ? await storeApi.query(`key in (${storeKeys})`) : [];

      businessUnits.map((businessUnit) => {
        businessUnit.stores = BusinessUnitMapper.expandStores(businessUnit.stores, allStores);
      });
    }

    return businessUnits;
  };

  getCompaniesForUser: (account: Account) => Promise<BusinessUnit[]> = async (account: Account) => {
    const locale = await this.getCommercetoolsLocal();

    const storeApi = new StoreApi(this.frontasticContext, this.locale, this.currency);

    const treeBusinessUnits = await this.getBusinessUnitsForUser(account).then((businessUnits) => {
      return this.getRootBusinessUnitsForAssociate(businessUnits, account);
    });

    if (treeBusinessUnits.length) {
      const treeBusinessUnitsKeys = treeBusinessUnits
        ?.map((businessUnit) => `"${businessUnit.topLevelUnit.key}"`)
        .join(' ,');

      // Get the whole company and division nodes
      const commercetoolsBusinessUnits = await this.query(
        `topLevelUnit(key in (${treeBusinessUnitsKeys}))`,
        'associates[*].customer',
      ).then((response) => {
        return response.results;
      });

      const tempParents = [...treeBusinessUnits];

      // Filter commercetoolsBusinessUnits and add nodes to tree if they are descendents of tree nodes
      while (tempParents.length) {
        const [item] = tempParents.splice(0, 1);

        const children = commercetoolsBusinessUnits.filter(
          (commercetoolsBusinessUnit) => commercetoolsBusinessUnit.parentUnit?.key === item.key,
        );

        if (children.length) {
          children.forEach((child) => {
            const businessUnitChild = BusinessUnitMapper.commercetoolsBusinessUnitToBusinessUnit(child, locale);
            tempParents.push(businessUnitChild);
            treeBusinessUnits.push(businessUnitChild);
          });
        }
      }
    }

    const storeKeys = treeBusinessUnits
      .reduce((prev: Store[], curr) => {
        prev = prev.concat(curr.stores || []);
        return prev;
      }, [])
      ?.map((store) => `"${store.key}"`)
      .join(' ,');

    const allStores = storeKeys ? await storeApi.query(`key in (${storeKeys})`) : [];

    return treeBusinessUnits.map((businessUnit) => {
      businessUnit.stores = BusinessUnitMapper.expandStores(businessUnit.stores, allStores);
      return businessUnit;
    });
  };

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
              .map((associateRole) => BusinessUnitMapper.mapCommercetoolsAssociateRoleToAssociateRole(associateRole))
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
