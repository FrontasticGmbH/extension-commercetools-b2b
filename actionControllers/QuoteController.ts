import { ActionContext, Request, Response } from '@frontastic/extension-types';
import { getCurrency, getLocale } from '../utils/Request';
import { CartApi } from '../apis/CartApi';
import { QuoteApi } from '../apis/QuoteApi';
import { CartFetcher } from '@Commerce-commercetools/utils/CartFetcher';
import { QuoteRequest } from '@Types/quote/QuoteRequest';
import { fetchAccountFromSession } from '@Commerce-commercetools/utils/fetchAccountFromSession';
import { AccountAuthenticationError } from '@Commerce-commercetools/errors/AccountAuthenticationError';

type ActionHook = (request: Request, actionContext: ActionContext) => Promise<Response>;

export interface QuoteRequestBody {
  comment: string;
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

export const acceptQuote: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const account = fetchAccountFromSession(request);
  if (account === undefined) {
    throw new AccountAuthenticationError({ message: 'Not logged in.' });
  }

  const quoteApi = new QuoteApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const quoteId = request.query?.['id'];

  const quote = await quoteApi.acceptQuote(quoteId);

  let cart = quote.quotationCart ?? (await quoteApi.getQuote(quote.quoteId)).quotationCart;

  cart = await cartApi.setEmail(cart, quote.quotedRequested.account.email);
  cart = await cartApi.setCustomerId(cart, quote.quotedRequested.account.accountId, account);

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
