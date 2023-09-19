import { ActionContext, Request, Response } from '@frontastic/extension-types';
import { getCurrency, getLocale } from '../utils/Request';
import { CartApi } from '../apis/CartApi';
import { QuoteApi } from '../apis/QuoteApi';
import { CartFetcher } from '@Commerce-commercetools/utils/CartFetcher';
import { QuoteRequest } from '@Types/quote/QuoteRequest';
import { fetchAccountFromSession } from '@Commerce-commercetools/utils/fetchAccountFromSession';
import { AccountAuthenticationError } from '@Commerce-commercetools/errors/AccountAuthenticationError';
import { QuoteQuery } from '@Types/query/QuoteQuery';
import { FilterTypes } from '@Types/query/Filter';
import { TermFilter } from '@Types/query/TermFilter';
import { Filter } from '@Types/query/Filter';
import { SortAttributes } from '@Types/query/ProductQuery';
import { SortOrder } from '@Types/query/ProductQuery';

type ActionHook = (request: Request, actionContext: ActionContext) => Promise<Response>;

export interface QuoteRequestBody {
  comment: string;
}

function queryParamsToSortAttributes(queryParams: any) {
  const sortAttributes: SortAttributes = {};

  if (queryParams.sortAttributes) {
    let sortAttribute;

    for (sortAttribute of Object.values(queryParams.sortAttributes)) {
      const key = Object.keys(sortAttribute)[0];
      sortAttributes[key] = sortAttribute[key] ? sortAttribute[key] : SortOrder.ASCENDING;
    }
  }

  return sortAttributes;
}

function queryParamsToFilters(queryParams: any) {
  const filters: Filter[] = [];
  let key: any;
  let filterData: any;

  if (queryParams.filters) {
    for ([key, filterData] of Object.entries(queryParams.filters)) {
      // Force terms as an array if exist
      if (filterData?.terms && !Array.isArray(filterData.terms)) {
        filterData.terms = Object.values(filterData.terms);
      }

      if (filterData.terms !== undefined) {
        filters.push({
          type: FilterTypes.TERM,
          identifier: key,
          terms: filterData.terms.map((facetValueData: string) => facetValueData),
        } as TermFilter);
      }
    }
  }

  return filters;
}

export const createQuoteRequest: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const quoteApi = new QuoteApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const quoteBody: QuoteRequestBody = JSON.parse(request.body);
  let quoteRequest: QuoteRequest = {
    buyerComment: quoteBody.comment,
  };

  const account = fetchAccountFromSession(request);
  if (account === undefined) {
    throw new AccountAuthenticationError({ message: 'Not logged in.' });
  }

  const cart = await CartFetcher.fetchCart(request, actionContext);

  quoteRequest = await quoteApi.createQuoteRequest(quoteRequest, cart);

  await cartApi.deleteCart(cart, account, request.sessionData?.organization);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(quoteRequest),
    sessionData: {
      ...request.sessionData,
      cartId: undefined,
    },
  };

  return response;
};

/**
 * @deprecated
 */
export const getQuotes: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const quoteApi = new QuoteApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const account = fetchAccountFromSession(request);
  if (account === undefined) {
    throw new AccountAuthenticationError({ message: 'Not logged in.' });
  }

  const quotes = await quoteApi.getQuotes(account);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(quotes),
    sessionData: request.sessionData,
  };

  return response;
};

export const query: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const quoteApi = new QuoteApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const account = fetchAccountFromSession(request);
  if (account === undefined) {
    throw new AccountAuthenticationError({ message: 'Not logged in.' });
  }

  const quoteQuery: QuoteQuery = {
    accountId: account.accountId,
    limit: request.query?.limit ?? undefined,
    cursor: request.query?.cursor ?? undefined,
    filters: queryParamsToFilters(request.query),
    sortAttributes: queryParamsToSortAttributes(request.query),
  };

  const queryResult = await quoteApi.query(quoteQuery);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(queryResult),
    sessionData: request.sessionData,
  };

  return response;
};

export const queryQuoteRequests: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const quoteApi = new QuoteApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const account = fetchAccountFromSession(request);
  if (account === undefined) {
    throw new AccountAuthenticationError({ message: 'Not logged in.' });
  }

  const quoteQuery: QuoteQuery = {
    accountId: account.accountId,
    limit: request.query?.limit ?? undefined,
    cursor: request.query?.cursor ?? undefined,
    filters: queryParamsToFilters(request.query),
    sortAttributes: queryParamsToSortAttributes(request.query),
  };

  const queryResult = await quoteApi.queryQuoteRequests(quoteQuery);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(queryResult),
    sessionData: request.sessionData,
  };

  return response;
};

export const acceptQuote: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const account = fetchAccountFromSession(request);
  if (account === undefined) {
    throw new AccountAuthenticationError({ message: 'Not logged in.' });
  }

  const quoteApi = new QuoteApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const quoteId = request.query?.['id'];

  const quote = await quoteApi.acceptQuote(quoteId);

  const cartId =
    quote.quoteRequest.quotationCart.cartId ??
    (await quoteApi.getQuote(quote.quoteId)).quoteRequest.quotationCart.cartId;

  let cart = await cartApi.getById(cartId);

  cart = await cartApi.setEmail(cart, quote.quoteRequest.account.email);
  cart = await cartApi.setCustomerId(cart, quote.quoteRequest.account.accountId, account);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(quote),
    sessionData: {
      ...request.sessionData,
      cartId: cart.cartId,
    },
  };

  return response;
};

export const declineQuote: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const quoteApi = new QuoteApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const quoteId = request.query?.['id'];

  const quote = await quoteApi.declineQuote(quoteId);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(quote),
    sessionData: {
      ...request.sessionData,
    },
  };

  return response;
};

export const renegotiateQuote: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const quoteApi = new QuoteApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const quoteId = request.query?.['id'];
  const buyerComment = JSON.parse(request.body).comment;

  const quote = await quoteApi.renegotiateQuote(quoteId, buyerComment);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(quote),
    sessionData: {
      ...request.sessionData,
    },
  };

  return response;
};

export const cancelQuoteRequest: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const quoteApi = new QuoteApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const quoteRequestId = request.query?.['id'];

  const quoteRequest = await quoteApi.cancelQuoteRequest(quoteRequestId);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(quoteRequest),
    sessionData: {
      ...request.sessionData,
    },
  };

  return response;
};
