import {
  QuoteRequest as CommercetoolsQuoteRequest,
  QuoteRequestDraft,
  Quote as CommercetoolsQuote,
  StagedQuote as CommercetoolsStagedQuote,
  QuoteState,
  QuoteRequestState,
} from '@commercetools/platform-sdk';
import { BaseApi } from './BaseApi';
import { QuoteMappers } from '../mappers/QuoteMappers';
import { Cart } from '@Types/cart/Cart';
import { QuoteDraft } from '@Types/quote/QuoteDraft';
import { Account } from '@Types/account/Account';
import { Quote } from '@Types/quote/Quote';

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
          return QuoteMappers.commercetoolsQuoteRequestToQuote(response.body, locale);
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

  getQuotes: (account: Account) => Promise<Quote[]> = async (account: Account) => {
    const locale = await this.getCommercetoolsLocal();

    try {
      const quotes = await this.requestBuilder()
        .quoteRequests()
        .get({
          queryArgs: {
            where: `customer(id="${account.accountId}")`,
            expand: 'customer',
            sort: 'createdAt desc',
            limit: 50,
          },
        })
        .execute()
        .then((response) => {
          return response.body.results.map((commercetoolsQuoteRequest) =>
            QuoteMappers.commercetoolsQuoteRequestToQuote(commercetoolsQuoteRequest, locale),
          );
        })
        .catch((error) => {
          throw error;
        });

      await this.requestBuilder()
        .stagedQuotes()
        .get({
          queryArgs: {
            where: `customer(id="${account.accountId}")`,
            expand: ['customer', 'quotationCart'],
            sort: 'createdAt desc',
            limit: 50,
          },
        })
        .execute()
        .then((response) => {
          return response.body.results.map((commercetoolsStagedQuote) => {
            QuoteMappers.updateQuoteFromCommercetoolsStagedQuote(quotes, commercetoolsStagedQuote);
          });
        })
        .catch((error) => {
          throw error;
        });

      await this.requestBuilder()
        .quotes()
        .get({
          queryArgs: {
            where: `customer(id="${account.accountId}")`,
            expand: 'customer',
            sort: 'createdAt desc',
            limit: 50,
          },
        })
        .execute()
        .then((response) => {
          return response.body.results.map((commercetoolsQuote) => {
            QuoteMappers.updateQuoteFromCommercetoolsQuote(quotes, commercetoolsQuote, locale);
          });
        })
        .catch((error) => {
          throw error;
        });

      return quotes;
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
