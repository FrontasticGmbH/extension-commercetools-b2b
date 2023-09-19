import { ActionContext, Request, Response } from '@frontastic/extension-types';
import { getCurrency, getLocale } from '../utils/Request';
import { CartApi } from '../apis/CartApi';
import { QuoteApi } from '../apis/QuoteApi';
import { CartFetcher } from '@Commerce-commercetools/utils/CartFetcher';
import { QuoteRequest, QuoteRequestState } from '@Types/quote/QuoteRequest';
import { fetchAccountFromSession } from '@Commerce-commercetools/utils/fetchAccountFromSession';
import { AccountAuthenticationError } from '@Commerce-commercetools/errors/AccountAuthenticationError';
import { QuoteQuery } from '@Types/query/QuoteQuery';
import { SortAttributes } from '@Types/query/ProductQuery';
import { SortOrder } from '@Types/query/ProductQuery';
import { QuoteState } from '@Types/quote/Quote';

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

function queryParamsToQuoteStates(queryParams: any) {
  const quoteStates: (QuoteState | QuoteRequestState)[] = [];

  queryParams.quoteStates?.map((quoteState: string) => {
    if (Object.values(QuoteState).includes(quoteState as any)) {
      quoteStates.push(quoteState as QuoteState);
      return;
    }

    if (Object.values(QuoteRequestState).includes(quoteState as any)) {
      quoteStates.push(quoteState as QuoteRequestState);
      return;
    }
  });

  return quoteStates;
}

function queryParamsToQuoteIds(queryParams: any) {
  const quoteIds: string[] = [];

  if (queryParams?.quoteIds && Array.isArray(queryParams?.quoteIds)) {
    queryParams?.quoteIds.map((quoteId: string | number) => {
      quoteIds.push(quoteId.toString());
    });
  }

  return quoteIds;
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
    quoteIds: queryParamsToQuoteIds(request.query),
    quoteStates: queryParamsToQuoteStates(request.query),
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
    quoteIds: queryParamsToQuoteIds(request.query),
    quoteStates: queryParamsToQuoteStates(request.query),
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
