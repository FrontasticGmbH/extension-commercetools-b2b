import { BusinessUnit, BusinessUnitStatus, BusinessUnitType, StoreMode } from '@Types/business-unit/BusinessUnit';
import { StoreApi } from './StoreApi';
import { Organization } from '@Commerce-commercetools/interfaces/Organization';
import { StoreMapper } from '../mappers/StoreMapper';
import { BusinessUnit as CommercetoolsBusinessUnit, BusinessUnitPagedQueryResponse } from '@commercetools/platform-sdk';
import { BusinessUnitMapper } from '../mappers/BusinessUnitMapper';
import { BaseApi } from '@Commerce-commercetools/apis/BaseApi';
import { Store } from '@Types/store/Store';
import { Account } from '@Types/account/Account';
import { BusinessUnitDraft } from '@commercetools/platform-sdk/dist/declarations/src/generated/models/business-unit';
import { ExternalError } from '@Commerce-commercetools/utils/Errors';
import { businessUnitKeyFormatter } from '@Commerce-commercetools/utils/BussinessUnitFormatter';
import { AssociateRole } from '@Types/business-unit/Associate';

const MAX_LIMIT = 50;

export class BusinessUnitApi extends BaseApi {
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

  createForAccountAndStore: (account: Account, store: Store, config: Record<string, string>) => Promise<BusinessUnit> =
    async (account: Account, store: Store, config: Record<string, string>) => {
      const locale = await this.getCommercetoolsLocal();

      const businessUnitKey = businessUnitKeyFormatter(account.companyName);

      const businessUnitDraft: BusinessUnitDraft = {
        key: businessUnitKey,
        name: account.companyName,
        status: BusinessUnitStatus.Active,
        stores: [
          {
            typeId: 'store',
            id: store.id,
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
                  key: config.defaultBuyerRoleKey,
                  typeId: 'associate-role',
                },
              },
              {
                associateRole: {
                  key: config.defaultAdminRoleKey,
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

  delete: (key: string) => Promise<any> = async (key: string) => {
    try {
      return this.getCommercetoolsBusinessUnitByKey(key).then((bu) => {
        return this.requestBuilder()
          .businessUnits()
          .withKey({ key })
          .delete({
            queryArgs: {
              version: bu.version,
            },
          })
          .execute()
          .then((res) => res.body);
      });
    } catch (e) {
      throw e;
    }
  };

  update: (key: string, actions: any[]) => Promise<any> = async (key: string, actions: any[]) => {
    try {
      return this.getCommercetoolsBusinessUnitByKey(key).then((res) => {
        return this.requestBuilder()
          .businessUnits()
          .withKey({ key })
          .post({
            body: {
              version: res.version,
              actions,
            },
          })
          .execute()
          .then((res) => res.body);
      });
    } catch (e) {
      console.log(e);

      throw e;
    }
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

  // TODO: this method should be protected
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

    const config = this.frontasticContext?.project?.configuration?.associateRoles;
    if (!config?.defaultAdminRoleKey) {
      throw new Error('Configuration error. No "defaultAdminRoleKey" exists');
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
            config.defaultAdminRoleKey,
          ),
        )
      : justParents
          // sort by Admin first
          .sort((a, b) =>
            BusinessUnitMapper.isAssociateRoleKeyInCommercetoolsBusinessUnit(
              a,
              account.accountId,
              config.defaultAdminRoleKey,
            )
              ? -1
              : BusinessUnitMapper.isAssociateRoleKeyInCommercetoolsBusinessUnit(
                  b,
                  account.accountId,
                  config.defaultAdminRoleKey,
                )
              ? 1
              : 0,
          );
  };

  protected getRootBusinessUnitsForAssociate: (
    businessUnits: BusinessUnit[],
    account: Account,
    filterAdmin?: boolean,
  ) => BusinessUnit[] = (businessUnits: BusinessUnit[], account: Account, filterAdmin?: boolean) => {
    if (!businessUnits.length) {
      return [];
    }

    const config = this.frontasticContext?.project?.configuration?.associateRoles;
    if (!config?.defaultAdminRoleKey) {
      throw new Error('Configuration error. No "defaultAdminRoleKey" exists');
    }

    const rootBusinessUnits = businessUnits.filter((businessUnit) => !businessUnit.parentUnit);
    if (rootBusinessUnits.length) {
      return rootBusinessUnits;
    }

    // Filter out the businessUnits that their ancestor is also in the list
    const businessUnitsWithNoAncestors = businessUnits.filter((businessUnit) => {
      return (
        businessUnits.findIndex((currentBusinessUnit) => currentBusinessUnit.key === businessUnit.parentUnit?.key) ===
        -1
      );
    });

    if (filterAdmin) {
      return businessUnitsWithNoAncestors.filter((businessUnit) =>
        BusinessUnitMapper.isAssociateRoleKeyInBusinessUnit(businessUnit, account, config.defaultAdminRoleKey),
      );
    }

    return (
      businessUnitsWithNoAncestors
        // sort by Admin first
        .sort((a, b) =>
          BusinessUnitMapper.isAssociateRoleKeyInBusinessUnit(a, account, config.defaultAdminRoleKey)
            ? -1
            : BusinessUnitMapper.isAssociateRoleKeyInBusinessUnit(b, account, config.defaultAdminRoleKey)
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

      const config = this.frontasticContext?.project?.configuration?.associateRoles;
      if (!config?.defaultAdminRoleKey || !config?.defaultSuperUserRoleKey) {
        throw new Error('Configuration error. No "defaultAdminRoleKey" exists');
      }

      const commercetoolsBusinessUnits = await this.getCommercetoolsBusinessUnitsForUser(account);
      const rootCommercetoolsBusinessUnits = this.getRootCommercetoolsBusinessUnitsForAssociate(
        commercetoolsBusinessUnits,
        account,
      );

      const superUserList = rootCommercetoolsBusinessUnits.filter((bu) =>
        BusinessUnitMapper.isAssociateRoleKeyInCommercetoolsBusinessUnit(
          bu,
          account.accountId,
          config.defaultSuperUserRoleKey,
        ),
      );

      if (superUserList.length >= 1) {
        // If this is a superuser, we don't return any business unit. The FE will handle this and show all the
        // business units instead

        // TODO: return specific error
        throw new Error('superuser');
      }

      if (rootCommercetoolsBusinessUnits.length) {
        const commercetoolsBusinessUnit = await this.getBusinessUnitWithExplicitStores(
          rootCommercetoolsBusinessUnits[0],
        );

        const storeKeys = commercetoolsBusinessUnit?.stores?.map((store) => `"${store.key}"`).join(' ,');

        const storeApi = new StoreApi(this.frontasticContext, this.locale, this.currency);
        const allStores = await storeApi.query(`key in (${storeKeys})`);

        // TODO: expand the stores info in businessUnit with allStores;

        return BusinessUnitMapper.commercetoolsBusinessUnitToBusinessUnit(
          commercetoolsBusinessUnit,
          locale,
          allStores,
          // account.accountId,
          // config.defaultAdminRoleKey,
        );

        // businessUnit.stores = BusinessUnitMapper.expandStores(businessUnit.stores, allStores);
        // return businessUnit;
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

  get: (key: string, account?: Account) => Promise<BusinessUnit> = async (key: string, account?: Account) => {
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

    let tree: CommercetoolsBusinessUnit[] = [];
    const storeApi = new StoreApi(this.frontasticContext, this.locale, this.currency);
    const config = this.frontasticContext?.project?.configuration?.associateRoles;
    if (!config?.defaultAdminRoleKey) {
      throw new Error('Configuration error. No "defaultAdminRoleKey" exists');
    }

    const results = await this.getCommercetoolsBusinessUnitsForUser(account);
    tree = this.getRootCommercetoolsBusinessUnitsForAssociate(results, account, false).map(
      (commercetoolsBusinessUnit) => ({
        ...commercetoolsBusinessUnit,
        parentUnit: null,
      }),
    );

    if (tree.length) {
      // get the whole organization nodes
      const { results } = await this.query(`topLevelUnit(key="${tree[0].topLevelUnit.key}")`, 'associates[*].customer');
      const tempParents = [...tree];

      // filter results and add nodes to tree if they are descendents of tree nodes
      while (tempParents.length) {
        const [item] = tempParents.splice(0, 1);
        const children = results.filter((bu) => bu.parentUnit?.key === item.key);
        if (children.length) {
          children.forEach((child) => {
            tempParents.push(child);
            tree.push(child);
          });
        }
      }
    }

    const storeKeys = tree
      .reduce((prev: Store[], curr) => {
        prev = prev.concat(curr.stores || []);
        return prev;
      }, [])
      ?.map((store) => `"${store.key}"`)
      .join(' ,');

    const allStores = storeKeys ? await storeApi.query(`key in (${storeKeys})`) : [];

    return tree.map((commercetoolsBusinessUnit) =>
      BusinessUnitMapper.commercetoolsBusinessUnitToBusinessUnit(commercetoolsBusinessUnit, locale, allStores),
    );
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
