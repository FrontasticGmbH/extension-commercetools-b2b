import {
  QuoteRequest as CommercetoolsQuoteRequest,
  StagedQuote as CommercetoolsStagedQuote,
  Quote as CommercetoolsQuote,
  CartReference,
  QuoteState as CommercetoolsQuoteState,
} from '@commercetools/platform-sdk';
import { Locale } from '@Commerce-commercetools/interfaces/Locale';
import { CartMapper } from './CartMapper';
import { QuoteRequest } from '@Types/quote/QuoteRequest';
import { Cart } from '@Types/cart/Cart';
import { AccountMapper } from '@Commerce-commercetools/mappers/AccountMapper';
<<<<<<< Updated upstream
import { QuoteDraft, QuoteDraftState } from '@Types/quotes/QuoteDraft';
import { ProductMapper } from '@Commerce-commercetools/mappers/ProductMapper';
import { QuoteRequestState } from '@commercetools/platform-sdk/dist/declarations/src/generated/models/quote-request';
import { StagedQuoteState } from '@commercetools/platform-sdk/dist/declarations/src/generated/models/staged-quote';
import { QuoteState } from '@Types/quotes/Quote';

export class QuoteMappers {
  static commercetoolsQuoteRequestToQuoteDraft(
    commercetoolsQuoteRequest: CommercetoolsQuoteRequest,
    locale: Locale,
  ): QuoteDraft {
    return {
      quoteDraftId: commercetoolsQuoteRequest.id,
      key: commercetoolsQuoteRequest.key,
      version: commercetoolsQuoteRequest.version,
=======
import { QuoteDraft, QuoteDraftState } from '@Types/quote/QuoteDraft';
import { ProductMapper } from '@Commerce-commercetools/mappers/ProductMapper';
import { QuoteRequestState } from '@commercetools/platform-sdk/dist/declarations/src/generated/models/quote-request';
import { StagedQuoteState } from '@commercetools/platform-sdk/dist/declarations/src/generated/models/staged-quote';
import { Quote, QuoteState } from '@Types/quote/Quote';
import { StagedQuote } from '@Types/quote/StagedQuote';
import { DeprecatedQuote } from '@Types/quote/DeprecatedQuote';

export class QuoteMappers {
  static commercetoolsQuoteRequestToQuote(commercetoolsQuoteRequest: CommercetoolsQuoteRequest, locale: Locale): Quote {
    return {
      quoteDraftId: commercetoolsQuoteRequest.id,
      key: commercetoolsQuoteRequest.key,
>>>>>>> Stashed changes
      createdAt: new Date(commercetoolsQuoteRequest.createdAt),
      lastModifiedAt: new Date(commercetoolsQuoteRequest.lastModifiedAt),
      account: {
        accountId: commercetoolsQuoteRequest.customer.id,
      },
      buyerComment: commercetoolsQuoteRequest.comment,
      store: { key: commercetoolsQuoteRequest.store.key },
      businessUnit: { key: commercetoolsQuoteRequest.businessUnit.key },
      lineItems: CartMapper.commercetoolsLineItemsToLineItems(commercetoolsQuoteRequest.lineItems, locale),
      sum: ProductMapper.commercetoolsMoneyToMoney(commercetoolsQuoteRequest.totalPrice),
<<<<<<< Updated upstream
=======
      taxed: CartMapper.commercetoolsTaxedPriceToTaxed(commercetoolsQuoteRequest.taxedPrice, locale),
>>>>>>> Stashed changes
      shippingAddress: AccountMapper.commercetoolsAddressToAddress(commercetoolsQuoteRequest.shippingAddress),
      billingAddress: AccountMapper.commercetoolsAddressToAddress(commercetoolsQuoteRequest.billingAddress),
      quoteDraftState: this.commercetoolsQuoteStateToQuoteDraftState(commercetoolsQuoteRequest.quoteRequestState),
      itemShippingAddresses: commercetoolsQuoteRequest.itemShippingAddresses.map((itemShippingAddress) =>
        AccountMapper.commercetoolsAddressToAddress(itemShippingAddress),
      ),
    };
  }

<<<<<<< Updated upstream
=======
  static updateQuoteFromCommercetoolsStagedQuote(quotes: Quote[], commercetoolsStagedQuote: CommercetoolsStagedQuote) {
    const quoteToUpdate = quotes.find((quote) => quote.quoteDraftId === commercetoolsStagedQuote.quoteRequest.id);
    if (quoteToUpdate) {
      console.debug('quoteToUpdate:: ', quoteToUpdate);
      console.debug('commercetoolsStagedQuote:: ', commercetoolsStagedQuote);
      quoteToUpdate.sellerComment = commercetoolsStagedQuote.sellerComment;
      quoteToUpdate.quoteDraftState = this.commercetoolsQuoteStateToQuoteDraftState(
        commercetoolsStagedQuote.stagedQuoteState,
      );
      quoteToUpdate.lastModifiedAt = new Date(commercetoolsStagedQuote.lastModifiedAt);
      quoteToUpdate.expirationDate = new Date(commercetoolsStagedQuote.validTo);
    }
  }

  static updateQuoteFromCommercetoolsQuote(quotes: Quote[], commercetoolsQuote: CommercetoolsQuote) {
    const quoteToUpdate = quotes.find((quote) => quote.quoteDraftId === commercetoolsQuote.quoteRequest.id);
    if (quoteToUpdate) {
      console.debug('quoteToUpdate:: ', quoteToUpdate);
      console.debug('commercetoolsQuote:: ', commercetoolsQuote);
      quoteToUpdate.quoteId = commercetoolsQuote.id;
      quoteToUpdate.quoteState = this.commercetoolsQuoteStateToQuoteState(commercetoolsQuote.quoteState);
      quoteToUpdate.lastModifiedAt = new Date(commercetoolsQuote.lastModifiedAt);
      quoteToUpdate.expirationDate = new Date(commercetoolsQuote.validTo);
    }
  }

>>>>>>> Stashed changes
  static commercetoolsQuoteRequestsToQuoteRequests(
    results: CommercetoolsQuoteRequest[],
    locale: Locale,
  ): QuoteRequest[] {
    return results?.map((quote) => ({
      ...quote,
      customer: {
        accountId: quote.customer.id,
        ...(quote.customer?.obj ? AccountMapper.commercetoolsCustomerToAccount(quote.customer.obj, locale) : undefined),
      },
      lineItems: CartMapper.commercetoolsLineItemsToLineItems(quote.lineItems, locale),
    }));
  }

  static mapCommercetoolsQuote(results: CommercetoolsQuote[], locale: Locale): any[] {
    return results?.map((quote) => ({
      ...quote,
      customer: {
        accountId: quote.customer.id,
        ...(quote.customer?.obj ?? AccountMapper.commercetoolsCustomerToAccount(quote.customer.obj, locale)),
      },
      lineItems: CartMapper.commercetoolsLineItemsToLineItems(quote.lineItems, locale),
    }));
  }

  static mapCommercetoolsStagedQuote(results: CommercetoolsStagedQuote[], locale: Locale): any[] {
    return results.map((stagedQuote) => ({
      ...stagedQuote,
      quotationCart: this.mapQuotationCartReference(stagedQuote.quotationCart, locale),
    }));
  }

  static mapQuotationCartReference(cartReference: CartReference, locale: Locale): Cart {
    return cartReference.obj
      ? CartMapper.commercetoolsCartToCart(cartReference.obj, locale)
      : {
          cartId: cartReference.id,
        };
  }

  static commercetoolsQuoteStateToQuoteDraftState(
    commercetoolsQuoteState: QuoteRequestState | StagedQuoteState,
  ): QuoteDraftState {
    let quoteDraftState: QuoteDraftState;

    switch (true) {
      case commercetoolsQuoteState === 'Accepted':
        quoteDraftState = QuoteDraftState.Accepted;
        break;
      case commercetoolsQuoteState === 'Cancelled':
        quoteDraftState = QuoteDraftState.Cancelled;
        break;
      case commercetoolsQuoteState === 'Closed':
        quoteDraftState = QuoteDraftState.Closed;
        break;
      case commercetoolsQuoteState === 'Rejected':
        quoteDraftState = QuoteDraftState.Rejected;
        break;
      case commercetoolsQuoteState === 'Submitted':
        quoteDraftState = QuoteDraftState.Submitted;
        break;
<<<<<<< Updated upstream
=======
      case commercetoolsQuoteState === 'InProgress':
        quoteDraftState = QuoteDraftState.InProgress;
        break;
      case commercetoolsQuoteState === 'Sent':
        quoteDraftState = QuoteDraftState.Sent;
        break;
>>>>>>> Stashed changes
      default:
        break;
    }

    return quoteDraftState;
  }

  static commercetoolsQuoteStateToQuoteState(commercetoolsQuoteState: CommercetoolsQuoteState): QuoteState {
    let quoteState: QuoteState;

    switch (true) {
      case commercetoolsQuoteState === 'Accepted':
        quoteState = QuoteState.Accepted;
        break;
      case commercetoolsQuoteState === 'Declined':
        quoteState = QuoteState.Declined;
        break;
      case commercetoolsQuoteState === 'DeclinedForRenegotiation':
        quoteState = QuoteState.DeclinedForRenegotiation;
        break;
      case commercetoolsQuoteState === 'Failed':
        quoteState = QuoteState.Failed;
        break;
      case commercetoolsQuoteState === 'Pending':
        quoteState = QuoteState.Pending;
        break;
      case commercetoolsQuoteState === 'Withdrawn':
        quoteState = QuoteState.Withdrawn;
        break;
      default:
        break;
    }

    return quoteState;
  }
}
