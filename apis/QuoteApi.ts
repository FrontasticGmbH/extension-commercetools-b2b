import {
  QuoteRequest as CommercetoolsQuoteRequest,
  QuoteRequestDraft,
  Quote as CommercetoolsQuote,
  StagedQuote as CommercetoolsStagedQuote,
} from '@commercetools/platform-sdk';
import { BaseApi } from './BaseApi';
import { QuoteMapper } from '../mappers/QuoteMapper';
import { Cart } from '@Types/cart/Cart';
import { QuoteRequest, QuoteRequestState } from '@Types/quote/QuoteRequest';
import { Account } from '@Types/account/Account';
import { Quote, QuoteState } from '@Types/quote/Quote';
import { ExternalError } from '@Commerce-commercetools/utils/Errors';

export class QuoteApi extends BaseApi {
  createQuoteRequest: (quoteDraft: QuoteRequest, cart: Cart) => Promise<QuoteRequest> = async (
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
        return QuoteMapper.commercetoolsQuoteRequestToQuoteRequest(response.body, locale);
      })
      .catch((error) => {
        throw new ExternalError({ status: error.code, message: error.message, body: error.body });
      });
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
        return response.body.results.map((commercetoolsQuoteRequest) => {
          const quote: Quote = {
            quotedRequested: QuoteMapper.commercetoolsQuoteRequestToQuoteRequest(commercetoolsQuoteRequest, locale),
          };

          return quote;
        });
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
          QuoteMapper.updateQuotesFromCommercetoolsStagedQuotes(quotes, commercetoolsStagedQuote);
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
          QuoteMapper.updateQuotesFromCommercetoolsQuotes(quotes, commercetoolsQuote, locale);
        });
      })
      .catch((error) => {
        throw new ExternalError({ status: error.code, message: error.message, body: error.body });
      });

    return quotes;
  };

  acceptQuote: (quoteId: string) => Promise<Quote> = async (quoteId: string) => {
    const locale = await this.getCommercetoolsLocal();

    return this.getQuote(quoteId).then((quote) => {
      return this.requestBuilder()
        .quotes()
        .withId({ ID: quoteId })
        .post({
          body: {
            actions: [
              {
                action: 'changeQuoteState',
                quoteState: QuoteState.Accepted,
              },
            ],
            version: quote.version,
          },
        })
        .execute()
        .then((response) => {
          return QuoteMapper.commercetoolsQuoteToQuote(response.body, locale);
        })
        .catch((error) => {
          throw new ExternalError({ status: error.code, message: error.message, body: error.body });
        });
    });
  };

  declineQuote: (quoteId: string) => Promise<Quote> = async (quoteId: string) => {
    const locale = await this.getCommercetoolsLocal();

    return this.getQuote(quoteId).then((quote) => {
      return this.requestBuilder()
        .quotes()
        .withId({ ID: quoteId })
        .post({
          body: {
            actions: [
              {
                action: 'changeQuoteState',
                quoteState: QuoteState.Declined,
              },
            ],
            version: quote.version,
          },
        })
        .execute()
        .then((response) => {
          return QuoteMapper.commercetoolsQuoteToQuote(response.body, locale);
        })
        .catch((error) => {
          throw new ExternalError({ status: error.code, message: error.message, body: error.body });
        });
    });
  };

  cancelQuoteRequest: (quoteRequestId: string) => Promise<QuoteRequest> = async (quoteRequestId: string) => {
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
          return QuoteMapper.commercetoolsQuoteRequestToQuoteRequest(response.body, locale);
        })
        .catch((error) => {
          throw new ExternalError({ status: error.code, message: error.message, body: error.body });
        });
    });
  };
}
