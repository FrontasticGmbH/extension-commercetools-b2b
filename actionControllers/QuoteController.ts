import { ActionContext, Request, Response } from '@frontastic/extension-types';
import { Cart as CommercetoolsCart } from '@commercetools/platform-sdk';
import { getCurrency, getLocale } from '../utils/Request';
import { CartApi } from '../apis/CartApi';
import { QuoteApi } from '../apis/QuoteApi';
import { Cart } from '@Types/cart/Cart';
import { CartFetcher } from '@Commerce-commercetools/utils/CartFetcher';
import { QuoteRequest } from '@Types/quote/QuoteRequest';
import { fetchAccountFromSession } from '@Commerce-commercetools/utils/fetchAccountFromSession';
import { AccountAuthenticationError } from '@Commerce-commercetools/errors/AccountAuthenticationError';
import { QuoteState } from '@Types/quote/Quote';

type ActionHook = (request: Request, actionContext: ActionContext) => Promise<Response>;

export interface QuoteRequestBody {
  comment: string;
}

export const createQuote: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const quoteApi = new QuoteApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));
  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const quoteBody: QuoteRequestBody = JSON.parse(request.body);
  let quoteDraft: QuoteRequest = {
    buyerComment: quoteBody.comment,
  };

  const account = fetchAccountFromSession(request);
  if (account === undefined) {
    throw new AccountAuthenticationError({ message: 'Not logged in.' });
  }

  const cart = await CartFetcher.fetchCart(request, actionContext);

  quoteDraft = await quoteApi.createQuote(quoteDraft, cart);

  await cartApi.deleteCart(cart, account, request.sessionData?.organization);

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

export const updateQuoteState: ActionHook = async (request: Request, actionContext: ActionContext) => {
  console.debug('updateQuoteState', request.body);

  const quoteApi = new QuoteApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const ID = request.query?.['id'];
  const { state } = JSON.parse(request.body);

  const quote = await quoteApi.updateQuoteState(ID, state);
  const sessionData = { ...request.sessionData };

  if (state === QuoteState.Accepted) {
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

export const cancelQuoteRequest: ActionHook = async (request: Request, actionContext: ActionContext) => {
  const quoteApi = new QuoteApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));

  const quoteRequestId = request.query?.['id'];

  const quoteRequest = await quoteApi.cancelQuoteRequest(quoteRequestId);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(quoteRequest),
  };

  return response;
};
