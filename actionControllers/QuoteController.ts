import { ActionContext, Request, Response } from '@frontastic/extension-types';
import { Cart as CommercetoolsCart } from '@commercetools/platform-sdk';
import { getCurrency, getLocale } from '../utils/Request';
<<<<<<< Updated upstream
import { QuoteRequest } from '@Types/quotes/QuoteRequest';
import { DeprecatedQuote } from '@Types/quotes/DeprecatedQuote';
import { StagedQuote } from '@Types/quotes/StagedQuote';
=======
import { QuoteRequest } from '@Types/quote/QuoteRequest';
import { DeprecatedQuote } from '@Types/quote/DeprecatedQuote';
import { StagedQuote } from '@Types/quote/StagedQuote';
>>>>>>> Stashed changes
import { CartApi } from '../apis/CartApi';
import { QuoteApi } from '../apis/QuoteApi';
import { Cart } from '@Types/cart/Cart';
import { CartFetcher } from '@Commerce-commercetools/utils/CartFetcher';
<<<<<<< Updated upstream
import { QuoteDraft } from '@Types/quotes/QuoteDraft';
import { fetchAccountFromSession } from '@Commerce-commercetools/utils/fetchAccountFromSession';
=======
import { QuoteDraft } from '@Types/quote/QuoteDraft';
import { fetchAccountFromSession } from '@Commerce-commercetools/utils/fetchAccountFromSession';
import { AccountAuthenticationError } from '@Commerce-commercetools/errors/AccountAuthenticationError';
>>>>>>> Stashed changes

type ActionHook = (request: Request, actionContext: ActionContext) => Promise<Response>;

export interface QuoteRequestBody {
  comment: string;
  // businessUnitKey?: string;
}

const mergeQuotesOverview = (quoteRequests: QuoteRequest[], stagedQuotes: StagedQuote[], quotes: DeprecatedQuote[]) => {
  // combine quote-requests + quote + staged-quote
  return quoteRequests?.map((quoteRequest) => {
    const stagedQuote = stagedQuotes?.find((stagedQuote) => stagedQuote.quoteRequest.id === quoteRequest.id);
    if (stagedQuote) {
      // @ts-ignore
      quoteRequest.staged = stagedQuote;
      // @ts-ignore
      quoteRequest.quoteRequestState = stagedQuote.stagedQuoteState;
    }
    const quote = quotes?.find((quote) => quote.quoteRequest.id === quoteRequest.id);
    if (quote) {
      // @ts-ignore
      quoteRequest.quoted = quote;
      // @ts-ignore
      quoteRequest.quoteRequestState = quote.quoteState;
    }
    return quoteRequest;
  });
};

export const createQuote: ActionHook = async (request: Request, actionContext: ActionContext) => {
<<<<<<< Updated upstream
  console.debug('createQuote');
=======
>>>>>>> Stashed changes
  const quoteApi = new QuoteApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const quoteBody: QuoteRequestBody = JSON.parse(request.body);
  let quoteDraft: QuoteDraft = {
    buyerComment: quoteBody.comment,
  };
<<<<<<< Updated upstream

  const cart = await CartFetcher.fetchCart(request, actionContext);
  const account = fetchAccountFromSession(request);
=======

  const account = fetchAccountFromSession(request);
  if (account === undefined) {
    throw new AccountAuthenticationError({ message: 'Not logged in.' });
  }

  const cart = await CartFetcher.fetchCart(request, actionContext);
>>>>>>> Stashed changes

  quoteDraft = await quoteApi.createQuote(quoteDraft, cart);

  await cartApi.deleteCart(cart, account, request.sessionData?.organization);
<<<<<<< Updated upstream

  console.debug('createQuote quoteDraft:: ', quoteDraft);
=======
>>>>>>> Stashed changes

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(quoteDraft),
    sessionData: {
      ...request.sessionData,
      cartId: undefined,
    },
  };

  return response;
};

<<<<<<< Updated upstream
=======
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

>>>>>>> Stashed changes
export const getMyQuotesOverview: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const quoteApi = new QuoteApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const accountId = request.sessionData?.account?.accountId;
  if (!accountId) {
    throw new Error('No active user');
  }

  const quoteRequests = await quoteApi.getQuoteRequestsByCustomer(accountId);
  const stagedQuotes = await quoteApi.getStagedQuotesByCustomer(accountId);
  const quotes = await quoteApi.getQuotesByCustomer(accountId);

  console.debug('quoteRequests:: ', quoteRequests);
  console.debug('stagedQuotes:: ', stagedQuotes);
  console.debug('quotes:: ', quotes);

  const res = mergeQuotesOverview(quoteRequests, stagedQuotes, quotes);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(res),
    sessionData: request.sessionData,
  };

  return response;
};

export const getBusinessUnitQuotesOverview: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const quoteApi = new QuoteApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const keys = request.query['keys'];

  if (!keys) {
    throw new Error('No business unit');
  }

  const quoteRequests = await quoteApi.getQuoteRequestsByBusinessUnit(keys);
  const stagedQuotes = await quoteApi.getStagedQuotesByBusinessUnit(keys);
  const quotes = await quoteApi.getQuotesByBusinessUnit(keys);

  const res = mergeQuotesOverview(quoteRequests, stagedQuotes, quotes);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(res),
    sessionData: request.sessionData,
  };

  return response;
};

export const updateQuoteState: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const quoteApi = new QuoteApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const ID = request.query?.['id'];
  const { state } = JSON.parse(request.body);

  const quote = await quoteApi.updateQuoteState(ID, state);
  const sessionData = { ...request.sessionData };

  if (state === 'Accepted') {
    const stagedQuote = await quoteApi.getStagedQuote(quote.stagedQuote.id);

    const commercetoolsCart = stagedQuote.quotationCart.obj as CommercetoolsCart;

    const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));
    let cart = await cartApi.getById(commercetoolsCart.id);
    cart = await cartApi.setEmail(cart, stagedQuote.customer.obj.email);
    cart = (await cartApi.setCustomerId(cart as Cart, stagedQuote.customer.obj.id, request.sessionData?.account, {
      ...request.sessionData?.organization,
      businessUnit: {
        key: commercetoolsCart.businessUnit?.key,
      },
    })) as Cart;

    sessionData.cartId = cart.cartId;
  }

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(quote),
    sessionData,
  };

  return response;
};

export const updateQuoteRequestState: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const quoteApi = new QuoteApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const ID = request.query?.['id'];
  const { state } = JSON.parse(request.body);

  const quoteRequest = await quoteApi.updateQuoteRequestState(ID, state);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(quoteRequest),
  };

  return response;
};
