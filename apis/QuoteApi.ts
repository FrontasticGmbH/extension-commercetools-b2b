import { QuoteRequest as CommercetoolsQuoteRequest, QuoteRequestDraft } from '@commercetools/platform-sdk';
import { BaseApi } from './BaseApi';
import { QuoteMapper } from '../mappers/QuoteMapper';
import { Cart } from '@Types/cart/Cart';
import { QuoteRequest, QuoteRequestState } from '@Types/quote/QuoteRequest';
import { Quote, QuoteState } from '@Types/quote/Quote';
import { ExternalError } from '@Commerce-commercetools/utils/Errors';
import { QuoteQuery } from '@Types/query/QuoteQuery';
import { getOffsetFromCursor } from '@Commerce-commercetools/utils/Pagination';
import { Result } from '@Types/quote/Result';
import { ProductMapper } from '@Commerce-commercetools/mappers/ProductMapper';

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

  getQuote: (quoteId: string) => Promise<Quote> = async (quoteId: string) => {
    const locale = await this.getCommercetoolsLocal();
    return this.requestBuilder()
      .quotes()
      .withId({ ID: quoteId })
      .get({
        queryArgs: {
          expand: ['customer', 'quoteRequest', 'stagedQuote'],
        },
      })
      .execute()
      .then((response) => {
        return QuoteMapper.commercetoolsQuoteToQuote(response.body, locale);
      })
      .catch((error) => {
        throw new ExternalError({ status: error.code, message: error.message, body: error.body });
      });
  };

  query: (quoteQuery: QuoteQuery) => Promise<Result> = async (quoteQuery: QuoteQuery) => {
    const locale = await this.getCommercetoolsLocal();
    const limit = +quoteQuery.limit || undefined;

    return this.requestBuilder()
      .quotes()
      .get({
        queryArgs: {
          where: `customer(id="${quoteQuery.accountId}")`,
          expand: ['quoteRequest', 'stagedQuote'],
          sort: 'lastModifiedAt desc',
          limit: limit,
          offset: getOffsetFromCursor(quoteQuery.cursor),
        },
      })
      .execute()
      .then((response) => {
        const quotes = response.body.results.map((commercetoolsQuote) => {
          return QuoteMapper.commercetoolsQuoteToQuote(commercetoolsQuote, locale);
        });

        const result: Result = {
          total: response.body.total,
          items: quotes,
          count: response.body.count,
          previousCursor: ProductMapper.calculatePreviousCursor(response.body.offset, response.body.count),
          nextCursor: ProductMapper.calculateNextCursor(response.body.offset, response.body.count, response.body.total),
          query: quoteQuery,
        };
        return result;
      })
      .catch((error) => {
        throw new ExternalError({ status: error.code, message: error.message, body: error.body });
      });
  };

  queryQuoteRequests: (quoteQuery: QuoteQuery) => Promise<Result> = async (quoteQuery: QuoteQuery) => {
    const locale = await this.getCommercetoolsLocal();
    const limit = +quoteQuery.limit || undefined;

    const result = await this.requestBuilder()
      .quoteRequests()
      .get({
        queryArgs: {
          where: `customer(id="${quoteQuery.accountId}")`,
          // where: [`customer(id="${quoteQuery.accountId}")`, 'quoteRequestState="Accepted"'],
          sort: 'lastModifiedAt desc',
          limit: limit,
          offset: getOffsetFromCursor(quoteQuery.cursor),
        },
      })
      .execute()
      .then((response) => {
        const quoteRequests = response.body.results.map((commercetoolsQuoteRequest) => {
          return QuoteMapper.commercetoolsQuoteRequestToQuoteRequest(commercetoolsQuoteRequest, locale);
        });

        const result: Result = {
          total: response.body.total,
          items: quoteRequests,
          count: response.body.count,
          previousCursor: ProductMapper.calculatePreviousCursor(response.body.offset, response.body.count),
          nextCursor: ProductMapper.calculateNextCursor(response.body.offset, response.body.count, response.body.total),
          query: quoteQuery,
        };
        return result;
      })
      .catch((error) => {
        throw error;
      });

    const quoteRequestIdsWhereClause = `quoteRequest(id in (${(result.items as QuoteRequest[])
      .map((quoteRequest) => `"${quoteRequest.quoteRequestId}"`)
      .join(' ,')}))`;

    await this.requestBuilder()
      .stagedQuotes()
      .get({
        queryArgs: {
          where: quoteRequestIdsWhereClause,
        },
      })
      .execute()
      .then((response) => {
        return response.body.results.map((commercetoolsStagedQuote) => {
          const quoteToUpdate = (result.items as QuoteRequest[]).find(
            (quoteRequest) => quoteRequest.quoteRequestId === commercetoolsStagedQuote.quoteRequest.id,
          );

          if (quoteToUpdate) {
            QuoteMapper.updateQuoteRequestFromCommercetoolsStagedQuote(quoteToUpdate, commercetoolsStagedQuote);
          }
        });
      })
      .catch((error) => {
        throw error;
      });

    return result;
  };

  acceptQuote: (quoteId: string) => Promise<Quote> = async (quoteId: string) => {
    const locale = await this.getCommercetoolsLocal();

    return this.getQuote(quoteId).then((quote) => {
      return this.requestBuilder()
        .quotes()
        .withId({ ID: quoteId })
        .post({
          queryArgs: {
            expand: ['quoteRequest', 'quoteRequest.customer', 'stagedQuote.quotationCart'],
          },
          body: {
            actions: [
              {
                action: 'changeQuoteState',
                quoteState: QuoteState.Accepted,
              },
            ],
            version: parseInt(quote.quoteVersion, 10),
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
          queryArgs: {
            expand: ['quoteRequest', 'quoteRequest.customer'],
          },
          body: {
            actions: [
              {
                action: 'changeQuoteState',
                quoteState: QuoteState.Declined,
              },
            ],
            version: parseInt(quote.quoteVersion, 10),
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

  renegotiateQuote: (quoteId: string, buyerComment?: string) => Promise<Quote> = async (
    quoteId: string,
    buyerComment?: string,
  ) => {
    const locale = await this.getCommercetoolsLocal();

    return this.getQuote(quoteId).then((quote) => {
      return this.requestBuilder()
        .quotes()
        .withId({ ID: quoteId })
        .post({
          queryArgs: {
            expand: ['quoteRequest', 'quoteRequest.customer'],
          },
          body: {
            actions: [
              {
                action: 'requestQuoteRenegotiation',
                buyerComment: buyerComment,
              },
            ],
            version: parseInt(quote.quoteVersion, 10),
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
