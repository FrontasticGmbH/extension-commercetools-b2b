import { fetchAccountFromSession } from '@Commerce-commercetools/utils/fetchAccountFromSession';

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

export const getWishlists: ActionHook = async (request, actionContext) => {
  try {
    const account = fetchAccountFromSessionEnsureLoggedIn(request);

    const storeKey = request.query?.['storeKey'] ?? undefined;

    const wishlistApi = getWishlistApi(request, actionContext);
    const wishlists = storeKey
      ? await wishlistApi.getByStoreKeyForAccount(storeKey, account)
      : await wishlistApi.getForAccount(account);

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

  const storeKey = request.query?.['storeKey'] ?? request.sessionData?.organization?.store?.key;

  if (!storeKey) {
    throw new Error('No storeKey');
  }

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
    const storeKey = request.query?.['storeKey'] ?? request.sessionData?.organization?.store?.key;

    if (!storeKey) {
      throw new Error('No storeKey');
    }

    await wishlistApi.delete(wishlist, storeKey);

    return {
      statusCode: 200,
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
