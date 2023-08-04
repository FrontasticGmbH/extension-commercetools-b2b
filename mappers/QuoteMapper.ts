import {
  QuoteRequest as CommercetoolsQuoteRequest,
  StagedQuote as CommercetoolsStagedQuote,
  Quote as CommercetoolsQuote,
  QuoteState as CommercetoolsQuoteState,
} from '@commercetools/platform-sdk';
import { Locale } from '@Commerce-commercetools/interfaces/Locale';
import { CartMapper } from './CartMapper';
import { AccountMapper } from '@Commerce-commercetools/mappers/AccountMapper';
import { QuoteRequest, QuoteRequestState } from '@Types/quote/QuoteRequest';
import { ProductMapper } from '@Commerce-commercetools/mappers/ProductMapper';
import { QuoteRequestState as CommercetoolsQuoteRequestState } from '@commercetools/platform-sdk/dist/declarations/src/generated/models/quote-request';
import { StagedQuoteState as CommercetoolsStagedQuoteState } from '@commercetools/platform-sdk/dist/declarations/src/generated/models/staged-quote';
import { Quote, QuoteState } from '@Types/quote/Quote';

export class QuoteMapper {
  static commercetoolsQuoteToQuote(commercetoolsQuote: CommercetoolsQuote, locale: Locale): Quote {
    return {
      quoteId: commercetoolsQuote.id,
      key: commercetoolsQuote.key,
      quoteState: this.commercetoolsQuoteStateToQuoteState(commercetoolsQuote.quoteState),
      createdAt: new Date(commercetoolsQuote.createdAt),
      lastModifiedAt: new Date(commercetoolsQuote.lastModifiedAt),
      lineItems: CartMapper.commercetoolsLineItemsToLineItems(commercetoolsQuote.lineItems, locale),
      sum: ProductMapper.commercetoolsMoneyToMoney(commercetoolsQuote.totalPrice),
      tax: CartMapper.commercetoolsTaxedPriceToTaxed(commercetoolsQuote.taxedPrice, locale),
      buyerComment: commercetoolsQuote.buyerComment,
      sellerComment: commercetoolsQuote.sellerComment,
      expirationDate: new Date(commercetoolsQuote.validTo),
      quotedRequested: {
        ...(commercetoolsQuote.quoteRequest?.obj
          ? this.commercetoolsQuoteRequestToQuoteRequest(commercetoolsQuote.quoteRequest.obj, locale)
          : undefined),
      },
      quotationCart: {
        cartId: commercetoolsQuote.stagedQuote?.obj?.quotationCart?.id,
        ...(commercetoolsQuote.stagedQuote?.obj?.quotationCart?.obj
          ? CartMapper.commercetoolsCartToCart(commercetoolsQuote.stagedQuote.obj.quotationCart.obj, locale)
          : undefined),
      },
      quoteVersion: commercetoolsQuote.version.toString(),
    };
  }

  static commercetoolsQuoteRequestToQuoteRequest(
    commercetoolsQuoteRequest: CommercetoolsQuoteRequest,
    locale: Locale,
  ): QuoteRequest {
    return {
      quoteRequestId: commercetoolsQuoteRequest.id,
      key: commercetoolsQuoteRequest.key,
      createdAt: new Date(commercetoolsQuoteRequest.createdAt),
      lastModifiedAt: new Date(commercetoolsQuoteRequest.lastModifiedAt),
      account: {
        accountId: commercetoolsQuoteRequest.customer.id,
        ...(commercetoolsQuoteRequest.customer?.obj
          ? AccountMapper.commercetoolsCustomerToAccount(commercetoolsQuoteRequest.customer.obj, locale)
          : undefined),
      },
      buyerComment: commercetoolsQuoteRequest.comment,
      store: { key: commercetoolsQuoteRequest.store.key },
      businessUnit: { key: commercetoolsQuoteRequest.businessUnit.key },
      lineItems: CartMapper.commercetoolsLineItemsToLineItems(commercetoolsQuoteRequest.lineItems, locale),
      sum: ProductMapper.commercetoolsMoneyToMoney(commercetoolsQuoteRequest.totalPrice),
      tax: CartMapper.commercetoolsTaxedPriceToTaxed(commercetoolsQuoteRequest.taxedPrice, locale),
      shippingAddress: AccountMapper.commercetoolsAddressToAddress(commercetoolsQuoteRequest.shippingAddress),
      billingAddress: AccountMapper.commercetoolsAddressToAddress(commercetoolsQuoteRequest.billingAddress),
      quoteRequestState: this.commercetoolsQuoteStateToQuoteDraftState(commercetoolsQuoteRequest.quoteRequestState),
      itemShippingAddresses: commercetoolsQuoteRequest.itemShippingAddresses.map((itemShippingAddress) =>
        AccountMapper.commercetoolsAddressToAddress(itemShippingAddress),
      ),
      quoteRequestVersion: commercetoolsQuoteRequest.version.toString(),
    };
  }

  static updateQuotesFromCommercetoolsStagedQuotes(
    quotes: Quote[],
    commercetoolsStagedQuote: CommercetoolsStagedQuote,
    locale: Locale,
  ) {
    const quoteToUpdate = quotes.find(
      (quote) => quote.quotedRequested.quoteRequestId === commercetoolsStagedQuote.quoteRequest.id,
    );
    if (quoteToUpdate) {
      quoteToUpdate.quotedRequested.sellerComment = commercetoolsStagedQuote.sellerComment;
      quoteToUpdate.quotedRequested.quoteRequestState = this.commercetoolsQuoteStateToQuoteDraftState(
        commercetoolsStagedQuote.stagedQuoteState,
      );
      quoteToUpdate.quotedRequested.lastModifiedAt = new Date(commercetoolsStagedQuote.lastModifiedAt);
      quoteToUpdate.quotedRequested.expirationDate = new Date(commercetoolsStagedQuote.validTo);
      quoteToUpdate.quotationCart = {
        cartId: commercetoolsStagedQuote.quotationCart?.id,
        ...(commercetoolsStagedQuote.quotationCart?.obj
          ? CartMapper.commercetoolsCartToCart(commercetoolsStagedQuote.quotationCart.obj, locale)
          : undefined),
      };
      quoteToUpdate.quotedRequested.quoteRequestVersion = commercetoolsStagedQuote.version.toString();
    }
  }

  static updateQuotesFromCommercetoolsQuotes(quotes: Quote[], commercetoolsQuote: CommercetoolsQuote, locale: Locale) {
    const quoteToUpdate = quotes.find(
      (quote) => quote.quotedRequested.quoteRequestId === commercetoolsQuote.quoteRequest.id,
    );
    if (quoteToUpdate) {
      quoteToUpdate.quoteId = commercetoolsQuote.id;
      quoteToUpdate.key = commercetoolsQuote.key;
      quoteToUpdate.quoteState = this.commercetoolsQuoteStateToQuoteState(commercetoolsQuote.quoteState);
      quoteToUpdate.createdAt = new Date(commercetoolsQuote.createdAt);
      quoteToUpdate.lastModifiedAt = new Date(commercetoolsQuote.lastModifiedAt);
      quoteToUpdate.lineItems = CartMapper.commercetoolsLineItemsToLineItems(commercetoolsQuote.lineItems, locale);
      quoteToUpdate.sum = ProductMapper.commercetoolsMoneyToMoney(commercetoolsQuote.totalPrice);
      quoteToUpdate.tax = CartMapper.commercetoolsTaxedPriceToTaxed(commercetoolsQuote.taxedPrice, locale);
      quoteToUpdate.buyerComment = commercetoolsQuote.buyerComment;
      quoteToUpdate.sellerComment = commercetoolsQuote.sellerComment;
      quoteToUpdate.expirationDate = new Date(commercetoolsQuote.validTo);
      quoteToUpdate.quoteVersion = commercetoolsQuote.version.toString();
    }
  }

  static commercetoolsQuoteStateToQuoteDraftState(
    commercetoolsQuoteState: CommercetoolsQuoteRequestState | CommercetoolsStagedQuoteState,
  ): QuoteRequestState {
    let quoteDraftState: QuoteRequestState;

    switch (true) {
      case commercetoolsQuoteState === 'Accepted':
        quoteDraftState = QuoteRequestState.Accepted;
        break;
      case commercetoolsQuoteState === 'Cancelled':
        quoteDraftState = QuoteRequestState.Cancelled;
        break;
      case commercetoolsQuoteState === 'Closed':
        quoteDraftState = QuoteRequestState.Closed;
        break;
      case commercetoolsQuoteState === 'Rejected':
        quoteDraftState = QuoteRequestState.Rejected;
        break;
      case commercetoolsQuoteState === 'Submitted':
        quoteDraftState = QuoteRequestState.Submitted;
        break;
      case commercetoolsQuoteState === 'InProgress':
        quoteDraftState = QuoteRequestState.InProgress;
        break;
      case commercetoolsQuoteState === 'Sent':
        quoteDraftState = QuoteRequestState.Sent;
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
