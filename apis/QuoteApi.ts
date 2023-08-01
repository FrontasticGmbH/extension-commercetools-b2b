import {
  QuoteRequest as CommercetoolsQuoteRequest,
  QuoteRequestDraft,
  Quote as CommercetoolsQuote,
  StagedQuote as CommercetoolsStagedQuote,
  QuoteState,
  QuoteRequestState,
} from '@commercetools/platform-sdk';
import { BaseApi } from './BaseApi';
import { QuoteRequest } from '@Types/quotes/QuoteRequest';
import { DeprecatedQuote } from '@Types/quotes/DeprecatedQuote';
import { StagedQuote } from '@Types/quotes/StagedQuote';
import { QuoteMappers } from '../mappers/QuoteMappers';
import { Cart } from '@Types/cart/Cart';
import { QuoteDraft } from '@Types/quotes/QuoteDraft';

export class QuoteApi extends BaseApi {
  createQuote: (quoteDraft: QuoteDraft, cart: Cart) => Promise<QuoteDraft> = async (
    quoteDraft: QuoteDraft,
    cart: Cart,
  ) => {
    try {
      const cartVersion = parseInt(cart.cartVersion, 10);
      const locale = await this.getCommercetoolsLocal();

      const quoteRequest: QuoteRequestDraft = {
        cart: {
          typeId: 'cart',
          id: cart.cartId,
        },
        cartVersion,
        comment: quoteDraft.buyerComment,
      };

      return this.requestBuilder()
        .quoteRequests()
        .post({
          body: {
            ...quoteRequest,
          },
        })
        .execute()
        .then((response) => {
          return QuoteMappers.commercetoolsQuoteRequestToQuoteDraft(response.body, locale);
        })
        .catch((error) => {
          throw error;
        });
    } catch {
      throw '';
    }
  };

  getStagedQuote: (ID: string) => Promise<CommercetoolsStagedQuote> = async (ID: string) => {
    try {
      return this.requestBuilder()
        .stagedQuotes()
        .withId({ ID })
        .get({
          queryArgs: {
            expand: ['customer', 'quotationCart'],
            sort: 'createdAt desc',
          },
        })
        .execute()
        .then((response) => {
          return response.body;
        })
        .catch((error) => {
          throw error;
        });
    } catch {
      throw '';
    }
  };

  getQuoteRequest: (ID: string) => Promise<CommercetoolsQuoteRequest> = async (ID: string) => {
    try {
      return this.requestBuilder()
        .quoteRequests()
        .withId({ ID })
        .get({
          queryArgs: {
            expand: ['customer'],
            sort: 'createdAt desc',
          },
        })
        .execute()
        .then((response) => {
          return response.body;
        })
        .catch((error) => {
          throw error;
        });
    } catch {
      throw '';
    }
  };

  getQuote: (ID: string) => Promise<CommercetoolsQuote> = async (ID: string) => {
    try {
      return this.requestBuilder()
        .quotes()
        .withId({ ID })
        .get()
        .execute()
        .then((response) => {
          return response.body;
        })
        .catch((error) => {
          throw error;
        });
    } catch {
      throw '';
    }
  };

  getQuoteRequestsByCustomer: (customerId: string) => Promise<QuoteRequest[]> = async (customerId: string) => {
    try {
      const locale = await this.getCommercetoolsLocal();

      return this.requestBuilder()
        .quoteRequests()
        .get({
          queryArgs: {
            where: `customer(id="${customerId}")`,
            expand: 'customer',
            sort: 'createdAt desc',
            limit: 50,
          },
        })
        .execute()
        .then((response) => {
          return QuoteMappers.commercetoolsQuoteRequestsToQuoteRequests(response.body.results, locale);
        })
        .catch((error) => {
          throw error;
        });
    } catch {
      throw '';
    }
  };

  getStagedQuotesByCustomer: (customerId: string) => Promise<StagedQuote[]> = async (customerId: string) => {
    const locale = await this.getCommercetoolsLocal();
    try {
      return this.requestBuilder()
        .stagedQuotes()
        .get({
          queryArgs: {
            where: `customer(id="${customerId}")`,
            expand: ['customer', 'quotationCart'],
            sort: 'createdAt desc',
            limit: 50,
          },
        })
        .execute()
        .then((response) => {
          return QuoteMappers.mapCommercetoolsStagedQuote(response.body.results, locale);
        })
        .catch((error) => {
          throw error;
        });
    } catch {
      throw '';
    }
  };

  getQuotesByCustomer: (customerId: string) => Promise<DeprecatedQuote[]> = async (customerId: string) => {
    const locale = await this.getCommercetoolsLocal();
    try {
      return this.requestBuilder()
        .quotes()
        .get({
          queryArgs: {
            where: `customer(id="${customerId}")`,
            expand: 'customer',
            sort: 'createdAt desc',
            limit: 50,
          },
        })
        .execute()
        .then((response) => {
          return QuoteMappers.mapCommercetoolsQuote(response.body.results, locale);
        })
        .catch((error) => {
          throw error;
        });
    } catch {
      throw '';
    }
  };

  getQuoteRequestsByBusinessUnit: (businessUnitKeys: string) => Promise<QuoteRequest[]> = async (
    businessUnitKeys: string,
  ) => {
    const locale = await this.getCommercetoolsLocal();
    try {
      return this.requestBuilder()
        .quoteRequests()
        .get({
          queryArgs: {
            where: `businessUnit(key in (${businessUnitKeys}))`,
            expand: 'customer',
            sort: 'createdAt desc',
            limit: 50,
          },
        })
        .execute()
        .then((response) => {
          return QuoteMappers.commercetoolsQuoteRequestsToQuoteRequests(response.body.results, locale);
        })
        .catch((error) => {
          throw error;
        });
    } catch {
      throw '';
    }
  };

  getStagedQuotesByBusinessUnit: (businessUnitKeys: string) => Promise<StagedQuote[]> = async (
    businessUnitKeys: string,
  ) => {
    const locale = await this.getCommercetoolsLocal();
    try {
      return this.requestBuilder()
        .stagedQuotes()
        .get({
          queryArgs: {
            where: `businessUnit(key in (${businessUnitKeys}))`,
            expand: ['customer', 'quotationCart'],
            sort: 'createdAt desc',
            limit: 50,
          },
        })
        .execute()
        .then((response) => {
          return QuoteMappers.mapCommercetoolsStagedQuote(response.body.results, locale);
        })
        .catch((error) => {
          throw error;
        });
    } catch {
      throw '';
    }
  };

  getQuotesByBusinessUnit: (businessUnitKeys: string) => Promise<DeprecatedQuote[]> = async (
    businessUnitKeys: string,
  ) => {
    const locale = await this.getCommercetoolsLocal();
    try {
      return this.requestBuilder()
        .quotes()
        .get({
          queryArgs: {
            where: `businessUnit(key in (${businessUnitKeys}))`,
            expand: 'customer',
            sort: 'createdAt desc',
            limit: 50,
          },
        })
        .execute()
        .then((response) => {
          return QuoteMappers.mapCommercetoolsQuote(response.body.results, locale);
        })
        .catch((error) => {
          throw error;
        });
    } catch {
      throw '';
    }
  };

  updateQuoteState: (ID: string, quoteState: QuoteState) => Promise<CommercetoolsQuote> = async (
    ID: string,
    quoteState: QuoteState,
  ) => {
    try {
      return this.getQuote(ID).then((quote) => {
        return this.requestBuilder()
          .quotes()
          .withId({ ID })
          .post({
            body: {
              actions: [
                {
                  action: 'changeQuoteState',
                  quoteState: quoteState,
                },
              ],
              version: quote.version,
            },
          })
          .execute()
          .then((response) => {
            return response.body;
          })
          .catch((error) => {
            throw error;
          });
      });
    } catch {
      throw '';
    }
  };

  updateQuoteRequestState: (ID: string, quoteRequestState: QuoteRequestState) => Promise<CommercetoolsQuoteRequest> =
    async (ID: string, quoteRequestState: QuoteRequestState) => {
      try {
        return this.getQuoteRequest(ID).then((quoteRequest) => {
          return this.requestBuilder()
            .quoteRequests()
            .withId({ ID })
            .post({
              body: {
                actions: [
                  {
                    action: 'changeQuoteRequestState',
                    quoteRequestState,
                  },
                ],
                version: quoteRequest.version,
              },
            })
            .execute()
            .then((response) => {
              return response.body;
            })
            .catch((error) => {
              throw error;
            });
        });
      } catch {
        throw '';
      }
    };
}
