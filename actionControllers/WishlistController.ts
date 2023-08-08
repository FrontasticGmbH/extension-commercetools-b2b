export * from './BaseWishlistController';
import { ActionContext, Request, Response } from '@frontastic/extension-types';
import { WishlistApi } from '../apis/WishlistApi';
import { getCurrency, getLocale } from '../utils/Request';
import { Account } from '@Types/account/Account';
import handleError from '@Commerce-commercetools/utils/handleError';

type ActionHook = (request: Request, actionContext: ActionContext) => Promise<Response>;

function getWishlistApi(request: Request, actionContext: ActionContext) {
  return new WishlistApi(actionContext.frontasticContext, getLocale(request), getCurrency(request));
}

function fetchStoreFromSession(request: Request): string {
  const store = request.sessionData?.organization?.store?.key;
  if (!store) {
    throw 'No organization in session';
  }
  return store;
}

function fetchAccountFromSession(request: Request): Account | undefined {
  return request.sessionData?.account;
}

function fetchAccountFromSessionEnsureLoggedIn(request: Request): Account {
  const account = fetchAccountFromSession(request);
  if (!account) {
    throw new Error('Not logged in.');
  }
  return account;
}

async function fetchWishlist(request: Request, wishlistApi: WishlistApi) {
  const account = fetchAccountFromSessionEnsureLoggedIn(request);
  const wishlistId = request.query.id;
  if (wishlistId !== undefined) {
    return await wishlistApi.getByIdForAccount(wishlistId, account);
  }
  return null;
}

export const getStoreWishlists: ActionHook = async (request, actionContext) => {
  try {
    const account = fetchAccountFromSessionEnsureLoggedIn(request);
    const wishlistApi = getWishlistApi(request, actionContext);
    const storeKey = fetchStoreFromSession(request);
    const wishlists = await wishlistApi.getForAccountStore(account, storeKey);

    return {
      statusCode: 200,
      body: JSON.stringify(wishlists),
      sessionData: request.sessionData,
    };
  } catch (error) {
    return handleError(error, request);
  }
};

export const getWishlists: ActionHook = async (request, actionContext) => {
  try {
    const account = fetchAccountFromSessionEnsureLoggedIn(request);

    const wishlistApi = getWishlistApi(request, actionContext);
    const wishlists = await wishlistApi.getForAccount(account);

    return {
      statusCode: 200,
      body: JSON.stringify(wishlists),
      sessionData: request.sessionData,
    };
  } catch (error) {
    return handleError(error, request);
  }
};

export const createWishlist: ActionHook = async (request, actionContext) => {
  const wishlistApi = getWishlistApi(request, actionContext);

  const body: {
    name?: string;
  } = JSON.parse(request.body);
  const account = fetchAccountFromSessionEnsureLoggedIn(request);

  const storeKey = fetchStoreFromSession(request);

  try {
    const wishlist = await wishlistApi.create(
      { accountId: account.accountId, name: body.name ?? 'Wishlist' },
      storeKey,
    );

    return {
      statusCode: 200,
      body: JSON.stringify(wishlist),
      sessionData: request.sessionData,
    };
  } catch (error) {
    return handleError(error, request);
  }
};

export const deleteWishlist: ActionHook = async (request, actionContext) => {
  try {
    const wishlistApi = getWishlistApi(request, actionContext);
    const wishlist = await fetchWishlist(request, wishlistApi);
    const storeKey = fetchStoreFromSession(request);

    const deletedWishlist = await wishlistApi.delete(wishlist, storeKey);

    return {
      statusCode: 200,
      body: JSON.stringify(deletedWishlist),
      sessionData: request.sessionData,
    };
  } catch (error) {
    return handleError(error, request);
  }
};

export const renameWishlist: ActionHook = async (request, actionContext) => {
  try {
    const { name } = JSON.parse(request.body);

    const wishlistApi = getWishlistApi(request, actionContext);

    let wishlist = await fetchWishlist(request, wishlistApi);

    wishlist = await wishlistApi.rename(wishlist, name);

    return {
      statusCode: 200,
      body: JSON.stringify(wishlist),
      sessionData: request.sessionData,
    };
  } catch (error) {
    return handleError(error, request);
  }
};
