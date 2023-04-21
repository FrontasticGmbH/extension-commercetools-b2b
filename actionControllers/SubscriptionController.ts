import { ActionContext, Request, Response } from '@frontastic/extension-types';
import { SubscriptionApi } from '../apis/SubscriptionApi';
import { Account } from '@Types/account/Account';
import { getLocale } from 'cofe-ct-ecommerce/utils/Request';

type ActionHook = (request: Request, actionContext: ActionContext) => Promise<Response>;

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

export const getAllSubscriptions: ActionHook = async (request, actionContext) => {
  const account = fetchAccountFromSessionEnsureLoggedIn(request);

  const subscriptionApi = new SubscriptionApi(actionContext.frontasticContext, getLocale(request));
  const subscriptions = await subscriptionApi.getSubscriptionsForAccount(account.accountId);

  return {
    statusCode: 200,
    body: JSON.stringify(subscriptions),
    sessionData: request.sessionData,
  };
};
