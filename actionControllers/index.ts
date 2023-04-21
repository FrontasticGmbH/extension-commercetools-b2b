import * as AccountActions from './AccountController';
import { ProductAction, WishlistAction, QuoteAction, AssociateAction } from 'cofe-ct-b2b-ecommerce';
import * as ProjectActions from './ProjectController';
import * as BusinessUnitActions from './BusinessUnitController';
import * as StoreActions from './StoreController';
import * as CartActions from './CartController';
import * as DashboardActions from './DashboardController';
import * as SubscriptionActions from './SubscriptionController';

export const actions = {
  account: AccountActions,
  cart: CartActions,
  store: StoreActions,
  'business-unit': BusinessUnitActions,
  product: ProductAction,
  wishlist: WishlistAction,
  quote: QuoteAction,
  dashboard: DashboardActions,
  project: ProjectActions,
  subscription: SubscriptionActions,
  associate: AssociateAction,
};
