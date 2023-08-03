import {
  QuoteRequest as CommercetoolsQuoteRequest,
  QuoteRequestDraft,
  Quote as CommercetoolsQuote,
  StagedQuote as CommercetoolsStagedQuote,
} from '@commercetools/platform-sdk';
import { BaseApi } from './BaseApi';
import { QuoteMappers } from '../mappers/QuoteMappers';
import { Cart } from '@Types/cart/Cart';
import { QuoteRequest, QuoteRequestState } from '@Types/quote/QuoteRequest';
import { Account } from '@Types/account/Account';
import { Quote, QuoteState } from '@Types/quote/Quote';
import { ExternalError } from '@Commerce-commercetools/utils/Errors';

export class QuoteApi extends BaseApi {
  createQuote: (quoteDraft: QuoteRequest, cart: Cart) => Promise<QuoteRequest> = async (
    quoteDraft: QuoteRequest,
    cart: Cart,
  ) => {
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
        throw new ExternalError({ status: error.code, message: error.message, body: error.body });
      });
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
          throw new ExternalError({ status: error.code, message: error.message, body: error.body });
        });
    } catch {
      throw '';
    }
  };

  getQuotes: (account: Account) => Promise<Quote[]> = async (account: Account) => {
    const locale = await this.getCommercetoolsLocal();

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
        throw new ExternalError({ status: error.code, message: error.message, body: error.body });
      });

    return quotes;
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

  updateQuoteRequestState: (
    quoteRequestId: string,
    quoteRequestState: QuoteRequestState,
  ) => Promise<CommercetoolsQuoteRequest> = async (quoteRequestId: string, quoteRequestState: QuoteRequestState) => {
    try {
      return this.getQuoteRequest(quoteRequestId).then((quoteRequest) => {
        return this.requestBuilder()
          .quoteRequests()
          .withId({ ID: quoteRequestId })
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

  cancelQuoteRequest: (quoteRequestId: string) => Promise<Quote> = async (quoteRequestId: string) => {
    const locale = await this.getCommercetoolsLocal();

    return this.getQuoteRequest(quoteRequestId).then((quoteRequest) => {
      return this.requestBuilder()
        .quoteRequests()
        .withId({ ID: quoteRequestId })
        .post({
          body: {
            actions: [
              {
                action: 'changeQuoteRequestState',
                quoteRequestState: QuoteRequestState.Cancelled,
              },
            ],
            version: quoteRequest.version,
          },
        })
        .execute()
        .then((response) => {
          return QuoteMappers.commercetoolsQuoteRequestToQuote(response.body, locale);
        })
        .catch((error) => {
          throw new ExternalError({ status: error.code, message: error.message, body: error.body });
        });
    });
  };
}
