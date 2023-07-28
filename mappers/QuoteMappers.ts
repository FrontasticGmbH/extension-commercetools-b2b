import {
  LineItem as CommercetoolsLineItem,
  QuoteRequest as CommercetoolsQuoteRequest,
  StagedQuote as CommercetoolsStagedQuote,
  Quote as CommercetoolsQuote,
  CartReference,
} from '@commercetools/platform-sdk';
import { Locale } from '@Commerce-commercetools/interfaces/Locale';
import { CartMapper } from './CartMapper';
import { QuoteRequest } from '@Types/quotes/QuoteRequest';
import { Cart } from '@Types/cart/Cart';
import { LineItem } from '@Types/cart/LineItem';
import { AccountMapper } from '@Commerce-commercetools/mappers/AccountMapper';

export class QuoteMappers {
  static mapCommercetoolsQuoteRequest(results: CommercetoolsQuoteRequest[], locale: Locale): QuoteRequest[] {
    return results?.map((quote) => ({
      ...quote,
      customer: {
        accountId: quote.customer.id,
        ...(quote.customer?.obj ? AccountMapper.commercetoolsCustomerToAccount(quote.customer.obj, locale) : undefined),
      },
      lineItems: this.mapCommercetoolsLineitems(quote.lineItems, locale),
    }));
  }

  static mapCommercetoolsQuote(results: CommercetoolsQuote[], locale: Locale): any[] {
    return results?.map((quote) => ({
      ...quote,
      customer: {
        accountId: quote.customer.id,
        ...(quote.customer?.obj ?? AccountMapper.commercetoolsCustomerToAccount(quote.customer.obj, locale)),
      },
      lineItems: this.mapCommercetoolsLineitems(quote.lineItems, locale),
    }));
  }

  static mapCommercetoolsStagedQuote(results: CommercetoolsStagedQuote[], locale: Locale): any[] {
    return results.map((stagedQuote) => ({
      ...stagedQuote,
      quotationCart: this.mapQuotationCartReference(stagedQuote.quotationCart, locale),
    }));
  }

  static mapQuotationCartReference(cartReference: CartReference, locale: Locale): Cart | CartReference {
    return cartReference.obj ? CartMapper.commercetoolsCartToCart(cartReference.obj, locale) : cartReference;
  }

  static mapCommercetoolsLineitems(lineitems: CommercetoolsLineItem[], locale: Locale): LineItem[] {
    return CartMapper.commercetoolsLineItemsToLineItems(lineitems, locale);
  }
}
