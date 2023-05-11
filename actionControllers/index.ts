import * as AccountActions from './AccountController';
import * as ProductAction from './ProductController';
import * as WishlistAction from './WishlistController';
import * as QuoteAction from './QuoteController';
import * as AssociateAction from './AssociateController';
import * as ProjectActions from './ProjectController';
import * as BusinessUnitActions from './BusinessUnitController';
import * as StoreActions from './StoreController';
import * as CartActions from './CartController';
import * as SubscriptionActions from './SubscriptionController';

export const actions = {
  account: AccountActions,
  cart: CartActions,
  store: StoreActions,
  'business-unit': BusinessUnitActions,
  product: ProductAction,
  wishlist: WishlistAction,
  quote: QuoteAction,
  project: ProjectActions,
  subscription: SubscriptionActions,
  associate: AssociateAction,
};
