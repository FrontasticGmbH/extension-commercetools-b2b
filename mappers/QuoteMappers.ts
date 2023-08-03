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
import { QuoteDraftState } from '@Types/quote/QuoteDraft';
import { ProductMapper } from '@Commerce-commercetools/mappers/ProductMapper';
import { QuoteRequestState } from '@commercetools/platform-sdk/dist/declarations/src/generated/models/quote-request';
import { StagedQuoteState } from '@commercetools/platform-sdk/dist/declarations/src/generated/models/staged-quote';
import { Quote, QuoteState } from '@Types/quote/Quote';

export class QuoteMappers {
  static commercetoolsQuoteRequestToQuote(commercetoolsQuoteRequest: CommercetoolsQuoteRequest, locale: Locale): Quote {
    return {
      quoteDraftId: commercetoolsQuoteRequest.id,
      key: commercetoolsQuoteRequest.key,
      quoteDraftCreatedAt: new Date(commercetoolsQuoteRequest.createdAt),
      quoteDraftLastModifiedAt: new Date(commercetoolsQuoteRequest.lastModifiedAt),
      account: {
        accountId: commercetoolsQuoteRequest.customer.id,
        ...(commercetoolsQuoteRequest.customer?.obj
          ? AccountMapper.commercetoolsCustomerToAccount(commercetoolsQuoteRequest.customer.obj, locale)
          : undefined),
      },
      buyerComment: commercetoolsQuoteRequest.comment,
      store: { key: commercetoolsQuoteRequest.store.key },
      businessUnit: { key: commercetoolsQuoteRequest.businessUnit.key },
      quoteDraftLineItems: CartMapper.commercetoolsLineItemsToLineItems(commercetoolsQuoteRequest.lineItems, locale),
      quoteDraftSum: ProductMapper.commercetoolsMoneyToMoney(commercetoolsQuoteRequest.totalPrice),
      quoteDraftTax: CartMapper.commercetoolsTaxedPriceToTaxed(commercetoolsQuoteRequest.taxedPrice, locale),
      shippingAddress: AccountMapper.commercetoolsAddressToAddress(commercetoolsQuoteRequest.shippingAddress),
      billingAddress: AccountMapper.commercetoolsAddressToAddress(commercetoolsQuoteRequest.billingAddress),
      quoteDraftState: this.commercetoolsQuoteStateToQuoteDraftState(commercetoolsQuoteRequest.quoteRequestState),
      itemShippingAddresses: commercetoolsQuoteRequest.itemShippingAddresses.map((itemShippingAddress) =>
        AccountMapper.commercetoolsAddressToAddress(itemShippingAddress),
      ),
    };
  }

  static updateQuoteFromCommercetoolsStagedQuote(quotes: Quote[], commercetoolsStagedQuote: CommercetoolsStagedQuote) {
    const quoteToUpdate = quotes.find((quote) => quote.quoteDraftId === commercetoolsStagedQuote.quoteRequest.id);
    if (quoteToUpdate) {
      quoteToUpdate.sellerComment = commercetoolsStagedQuote.sellerComment;
      quoteToUpdate.quoteDraftState = this.commercetoolsQuoteStateToQuoteDraftState(
        commercetoolsStagedQuote.stagedQuoteState,
      );
      quoteToUpdate.quoteDraftLastModifiedAt = new Date(commercetoolsStagedQuote.lastModifiedAt);
      quoteToUpdate.quoteDraftExpirationDate = new Date(commercetoolsStagedQuote.validTo);
    }
  }

  static updateQuoteFromCommercetoolsQuote(quotes: Quote[], commercetoolsQuote: CommercetoolsQuote, locale: Locale) {
    const quoteToUpdate = quotes.find((quote) => quote.quoteDraftId === commercetoolsQuote.quoteRequest.id);
    if (quoteToUpdate) {
      quoteToUpdate.quoteId = commercetoolsQuote.id;
      quoteToUpdate.key = commercetoolsQuote.key;
      quoteToUpdate.quoteState = this.commercetoolsQuoteStateToQuoteState(commercetoolsQuote.quoteState);
      quoteToUpdate.quoteCreatedAt = new Date(commercetoolsQuote.createdAt);
      quoteToUpdate.quoteLastModifiedAt = new Date(commercetoolsQuote.lastModifiedAt);
      quoteToUpdate.quoteLineItems = CartMapper.commercetoolsLineItemsToLineItems(commercetoolsQuote.lineItems, locale);
      quoteToUpdate.quoteSum = ProductMapper.commercetoolsMoneyToMoney(commercetoolsQuote.totalPrice);
      quoteToUpdate.quoteTax = CartMapper.commercetoolsTaxedPriceToTaxed(commercetoolsQuote.taxedPrice, locale);
      quoteToUpdate.quoteExpirationDate = new Date(commercetoolsQuote.validTo);
    }
  }

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
      case commercetoolsQuoteState === 'InProgress':
        quoteDraftState = QuoteDraftState.InProgress;
        break;
      case commercetoolsQuoteState === 'Sent':
        quoteDraftState = QuoteDraftState.Sent;
        break;
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
