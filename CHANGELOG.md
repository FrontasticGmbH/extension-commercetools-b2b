
## Version 2.6.0 (2025-06-24)

** New Features & Improvements **

- update account login response
- rename variable, pass in accountGroupIds into session
- add support for multiple customer groups
- add if check for discount and include missing field
- use commercetoolsCartDiscountToCartDiscount and add more properties for multiBuyLineItems
- discount target fix and mapping update
- removed usage of streamId and replace by the new dataSourceId field

** Bug Fixes **

- returned correct dynamic page type for approval rules page
- handle single value on product filter query

## Version 2.5.0 (2025-06-09)

** New Features & Improvements **

- Get storeKey using the method to look into the query and the session
- Switch method to standard class method for uniformity
- View all wishlists for associates in same business units
- Show full acount information on wishlist
- Migrate from commercetools/sdk-client-v2 to commercetools/ts-client
- Added approvalStatus for orders with approval flow
- Validated accountId before we build cart api


** Bug Fixes **

- Get the error code from statusCode instead of code

## Version 2.4.0 (2025-05-12)


** New Features & Improvements **

- Replace account session fetching with AccountFetcher utility and remove deprecated methods
- Added info to the cart error code and support 400 errors
- Added target to the discount
- Remove redundant getByStoreKeyForAccount method
- Migrated existing shopping list endpoints to new associate shopping list endpoints
- Implemented dynamic filter support for products
- Implemented dynamic filters for category


** Bug Fixes **

- Validated discount target before map it

## Version 2.3.1 (2025-04-15)


** New Features & Improvements **

* Update permissions
* Make changes to getAssociate logic
* Use new endpoint for getAssociate action


** Bug Fixes **

* Add productSlug to LineItem mapping
* Aligend discount code to not  add the cart gift and handle invalid discount codes

## Version 2.3.0 (2025-04-07)

** New Features & Improvements **

* Update cart and shipping info structures to use taxRate instead of taxIncludedInPrice, and enhance shipping method handling
* Add error handling for missing checkout config in B2B and B2C

## Version 2.2.0 (2025-03-17)

** New Features & Improvements **

* removed missing log
* added product selection ids on PDP queries for B2B
* used full name to loop over variants
* generated product url using, if exist, the first matching variant
* set meta fields undefined if empty in B2C and B2B
* switch to using LocalizedValue.getLocalizedValue
* map meta data fields for products and categories
* add method to retrieve session data in BaseApi
* mapped cart returned by accoun login method in B2B
* set order number during checkout session


** Bug Fixes **

* restored product limit filter
* handled product queries with multiple or/and and a single or/and
* store the first product selection on the session
* ensured that if no local or default local exist, first locale available is returned

## Version 2.0.0 (2025-02-03)

** New Features & Improvements **

* Added customer group to orders
* Implement PR feedback - update customerGroup to accountGroup, move mapper to account
* Map customer groups
* Add mapping for customer groups
* Upgraded extension-types version in B2B and used new preloadedValue field


** Bug Fixes **

* modify PDP validation

## Version 1.16.0 (2025-01-13)


** New Features & Improvements **

* Use same BU variable and simplify password setting
* Set company name on new associates added to existing BU

## Version 1.15.1 (2024-12-16)

** Bug Fixes **

- Added storeKey on wishlist creation

## Version 1.15.0 (2024-11-21)


** New Features & Improvements **

* Modify attribute values to test CI lint
* Updated to use alpha v2 of the coFE SDK
* Fix weak cryptographic algorithm

## Version 1.14.0 (2024-11-05)

** New Features and Improvements **

- Added hostURl to the CoCo SDK client to see that url into the dev logs 
- Handled multi level category and included categoryId and categoryRef fields
- Used all matched variants when checking if anything match
- Reduced cache time to 60 seconds
- Include supplyChannelId when mapping shopping list items to not make items out of stock
- Set order number if missing when query orders

** Bug fixes **

- Used only the attribute name for set product types 

## Version 1.13.0 (2024-10-02)

** New Features and Improvements **

- Upgrades to support version Next.js version 14.2.9, React v18.3.1, Yarn4 .4.1 and Typescript version 5.5.4 
- Set order number if missing when query orders

** Bug fixes **

- Remove unneeded cart fields during recreation 

## Version 1.12.0 (2024-08-30)

** New Features and Improvements **

- Enhance region extraction from commercetools host URL:
- Validated active cart status before fetch it
- Fetch POnumber from order or custom field
- Removed product type from facet name

## Version 1.11.0 (2024-08-15)

** New Features and Improvements **

- Add checkout
- Concatenated product type name to the attribute name on searchableAttributes
- Used label as key for searchable attributes
- Handled enum filter types when applying B2B product filters
- Casted query type after verify if it's string or localized string
- Handled localized string values as part of product list query
- Applied default sort on B2B search
- Added currency and channel post filter when price facet filter applied
- Reuse method to rearange search queries
- Set order asc on distinct facet values
- Get facet type from facet expresion

## Version 1.10.0 (2024-08-01)
** New Features and Improvements **

- Set human readable label to product facet
- Don't set order state at order creation so it fallback to default state
- Moved approval rule creation together with other appravals methods
- Set correct name for approvals and drafts
- Added missing approval rules dynamic handler
- Added data-source handlers for approval flows and rules
- Added routers for approval rules and flows
- Aligned names with other routers
- Added schemas for approval rules and flows and remove previews
- Removes JSON.parse duct tape
- Undefined cart or empty rejectors
- Added a method to find master data sorce and comments on private data access
- Added spare parts data source, product id to product types, mappers
- Added types for data-sourced on B2B and removed duplicated code for categories
- Added type map for reference and aligned types

## Version 1.9.0 (2024-06-28)

** New Features and Improvements **

## Version 1.8.0 (2024-06-24)

** New Features and Improvements **
- Handle default sorting attributes on B2B
- Handle when not matching variants exist on product mapper
- Included method to handle search sorting products
- Support localized attribute
- Update productId field
- Update interface naming
- Fix matchingVariants undefined error
- Use markMatchingVariant for price filter

** Bug fixes **
- Handle boolean facets and verify when they are selected

## Version 1.7.1 (2024-06-06)

** New Features and Improvements **

* Added business unit create and reject approval flow actions
* Created busniess unit queryApprovalRules, updateApprovalRule and queryApprovalFlows actions
* Added business unit createApprovalRule action
* Removed unsetting of split shipping after adding line items
* Added missing distribution and supply channel when adding items on a recreated cart

## Version 1.7.0 (2024-05-16)

** New Features and Improvements **

- Adds deserialization to queryParams sortAttributes helper

** Bug fixes **

- Modified quote filter to use the accountId only when requested

- Modified order filter to use the accountId only when requested

## Version 1.6.1 (2024-05-09)

** New Features and Improements **

- Set either customersId or anonymousId when cart is recreated
- Setting default channels on login

## Version 1.6.0 (2024-04-26)

** New Features and Improvements **

- Restructured, reorganized folders

## Version 1.5.0 (2024-04-04)

** New Features and Improvements **

- Added store key

## Version 1.4.0 (2024-02-22)

** New Features and Improvements **

- Replaced get wishlists with query wishlists
- Added endpoint to clear the cart from the session 
- Replaced get wishlists with query wishlist

** Bug fixes **

- Return channel information as part of store in getBusinessUnit action

## Version 1.3.0 (2024-01-24)

** New Features and Improvements **

- Implemented index and session storage for Pages
- Added dynamic page handlers from ordes and quotes
- Add filter query params
- Modified the verification mail for b2b associate

** Bug fixes **

- Parse body before use it in cart fetcher

## Version 1.2.0 (2023-10-24)

** New Features and Improvements **

- Cleanup deprecated code
- Add generic paginated result type and support custom queries in search filters
- Get category slug using regex
- Add filters and sort for orders
- Implement handling for quote request along with quotes dynamic page
- Ensured associated are not mapped as undefined for business units
- Allowed business unit and store from body and throw exception if cart cannot be fetched

** Bug fixes **

- Handle order dynamic pages as orders instead of carts
- Added cart path reference

## Version 1.1.0 (2023-09-27)

** New Features and Improvements **

- Refactor B2B functionalities

## Version 1.0.0 (2023-05-24)

** New Features and Improvements **

- Initial release
