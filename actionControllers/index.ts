import * as AccountActions from './AccountController';
import {
  extender,
  AccountAction,
  CartAction,
  BusinessAction,
  ProductAction,
  WishlistAction,
  StoreAction,
  QuoteAction,
} from 'cofe-ct-b2b-ecommerce';
import * as ProjectActions from 'cofe-ct-ecommerce/actionControllers/ProjectController';
import * as BusinessUnitActions from './BusinessUnitController';
import * as StoreActions from './StoreController';
import * as CartActions from './CartController';
import * as DashboardActions from './DashboardController';
import * as SubscriptionActions from './SubscriptionController';

export const actions = {
  account: extender(AccountAction, AccountActions),
  cart: extender(CartAction, CartActions),
  store: extender(StoreAction, StoreActions),
  'business-unit': extender(BusinessAction, BusinessUnitActions),
  product: ProductAction,
  wishlist: WishlistAction,
  quote: QuoteAction,
  dashboard: DashboardActions,
  project: ProjectActions,
  subscription: SubscriptionActions,
};
