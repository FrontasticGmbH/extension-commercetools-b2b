import { Customer as commercetoolsCustomer, CustomerToken } from '@commercetools/platform-sdk';
import { Locale } from '@Commerce-commercetools/interfaces/Locale';
import { Account } from '@Types/account/Account';
import { Address } from '@Types/account/Address';
import { BaseAddress } from '@commercetools/platform-sdk/dist/declarations/src/generated/models/common';
import { AccountToken } from '@Types/account/AccountToken';
import { AccountRegisterBody } from '@Commerce-commercetools/actionControllers/AccountController';
import { parseBirthday } from '@Commerce-commercetools/utils/parseBirthday';
import { Request } from '@frontastic/extension-types';

export class BaseAccountMapper {
  static commercetoolsCustomerToAccount(commercetoolsCustomer: commercetoolsCustomer, locale: Locale): Account {
    return {
      accountId: commercetoolsCustomer.id,
      email: commercetoolsCustomer.email,
      salutation: commercetoolsCustomer?.salutation,
      firstName: commercetoolsCustomer?.firstName,
      lastName: commercetoolsCustomer?.lastName,
      birthday: commercetoolsCustomer?.dateOfBirth ? new Date(commercetoolsCustomer.dateOfBirth) : undefined,
      confirmed: commercetoolsCustomer.isEmailVerified,
      addresses: this.commercetoolsCustomerToAddresses(commercetoolsCustomer, locale),
    } as Account;
  }

  static commercetoolsCustomerTokenToToken(commercetoolsCustomerToken: CustomerToken, account: Account): AccountToken {
    return {
      tokenValidUntil: new Date(commercetoolsCustomerToken.expiresAt),
      token: commercetoolsCustomerToken.value,
      email: account.email,
    };
  }

  static commercetoolsCustomerToAddresses(commercetoolsCustomer: commercetoolsCustomer, locale: Locale): Address[] {
    const addresses: Address[] = [];

    commercetoolsCustomer.addresses.forEach((commercetoolsAddress) => {
      addresses.push({
        addressId: commercetoolsAddress.id,
        salutation: commercetoolsAddress.salutation ?? undefined,
        firstName: commercetoolsAddress.firstName ?? undefined,
        lastName: commercetoolsAddress.lastName ?? undefined,
        streetName: commercetoolsAddress.streetName ?? undefined,
        streetNumber: commercetoolsAddress.streetNumber ?? undefined,
        additionalStreetInfo: commercetoolsAddress.additionalStreetInfo ?? undefined,
        additionalAddressInfo: commercetoolsAddress.additionalAddressInfo ?? undefined,
        postalCode: commercetoolsAddress.postalCode ?? undefined,
        city: commercetoolsAddress.city ?? undefined,
        country: commercetoolsAddress.country ?? undefined,
        state: commercetoolsAddress.state ?? undefined,
        phone: commercetoolsAddress.phone ?? undefined,
        isDefaultBillingAddress: commercetoolsAddress.id === commercetoolsCustomer.defaultBillingAddressId,
        isBillingAddress: commercetoolsCustomer.billingAddressIds.includes(commercetoolsAddress.id),
        isDefaultShippingAddress: commercetoolsAddress.id === commercetoolsCustomer.defaultShippingAddressId,
        isShippingAddress: commercetoolsCustomer.shippingAddressIds.includes(commercetoolsAddress.id),
      } as Address);
    });

    return addresses;
  }

  static addressToCommercetoolsAddress(address: Address): BaseAddress {
    return {
      id: address.addressId,
      // key: Guid.newGuid(),
      salutation: address.salutation,
      firstName: address.firstName,
      lastName: address.lastName,
      streetName: address.streetName,
      streetNumber: address.streetNumber,
      additionalStreetInfo: address.additionalStreetInfo,
      additionalAddressInfo: address.additionalAddressInfo,
      postalCode: address.postalCode,
      city: address.city,
      country: address.country,
      state: address.state,
      phone: address.phone,
    } as BaseAddress;
  }

  static requestToAccount(request: Request): Account {
    const accountRegisterBody: AccountRegisterBody = JSON.parse(request.body);

    const account: Account = {
      email: accountRegisterBody?.email,
      confirmed: accountRegisterBody?.confirmed,
      password: accountRegisterBody?.password,
      salutation: accountRegisterBody?.salutation,
      firstName: accountRegisterBody?.firstName,
      lastName: accountRegisterBody?.lastName,
      birthday: parseBirthday(accountRegisterBody),
      addresses: [],
    };

    if (accountRegisterBody.billingAddress) {
      accountRegisterBody.billingAddress.isDefaultBillingAddress = true;
      accountRegisterBody.billingAddress.isDefaultShippingAddress = !(
        accountRegisterBody.shippingAddress !== undefined
      );

      account.addresses.push(accountRegisterBody.billingAddress);
    }

    if (accountRegisterBody.shippingAddress) {
      accountRegisterBody.shippingAddress.isDefaultShippingAddress = true;
      accountRegisterBody.shippingAddress.isDefaultBillingAddress = !(accountRegisterBody.billingAddress !== undefined);

      account.addresses.push(accountRegisterBody.shippingAddress);
    }

    return account;
  }
}
