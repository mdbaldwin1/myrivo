-- Publish v2 of the legal documents affected by digital products.
--
-- v1 said nothing about files: nothing required a merchant to hold the rights
-- to what they sell, nothing told a buyer how delivery works or what they may
-- do with a purchased file, and the storefront privacy notice did not mention
-- delivery data. Content matches apps/web/lib/legal/seeded-documents.ts.
--
-- Each v2 inherits its document's own is_required flag: the platform terms are
-- a required acceptance, while the storefront documents are baselines stores
-- copy rather than something a merchant accepts. Publishing a newer required
-- version re-prompts acceptance at the consent gate; v1 rows are left intact
-- as the historical record of what was accepted.

insert into public.legal_document_versions (
  legal_document_id, version_label, status, is_required,
  effective_at, published_at, content_markdown, content_hash, change_summary
)
select doc.id, 'v2', 'published',
  coalesce((
    select prior.is_required from public.legal_document_versions prior
    where prior.legal_document_id = doc.id and prior.status = 'published'
    order by prior.published_at desc nulls last, prior.id desc limit 1
  ), true),
  now(), now(), $$# Myrivo Terms and Conditions

## 1. Scope

These Terms and Conditions govern access to and use of Myrivo websites, dashboards, hosted storefront technology, commerce tooling, analytics, messaging, APIs, and related services (collectively, the "Services"). These terms apply to merchants, staff users, shoppers with Myrivo accounts, and any other person who accesses or uses the Services.

If you use a storefront powered by Myrivo, additional store-specific customer terms may also apply to the transaction you enter into with that store. Those store-facing terms supplement these platform terms and do not replace the responsibilities you owe under these terms when you use Myrivo technology, accounts, or related services.

## 2. Eligibility and Accounts

You must provide accurate information when creating or using a Myrivo account, keep your credentials confidential, and promptly notify us if you suspect unauthorized access or misuse. You are responsible for all activity that occurs through your account, workspace, API credentials, or store configuration unless the activity results directly from Myrivo's failure to maintain reasonable security controls.

You may not access or use the Services if doing so would violate applicable law, sanctions restrictions, export controls, or contractual restrictions that apply to you.

## 3. Myrivo Platform Role

Myrivo provides the software, hosting, operational tooling, and integrated service layer that powers the platform and Myrivo-hosted storefront experiences. Unless Myrivo expressly identifies itself as the seller for a specific transaction, Myrivo is not the merchant of record for goods sold by an independent store using the Services.

Myrivo may update, improve, suspend, or discontinue parts of the Services, including features, integrations, or workflows, when reasonably necessary for security, legal compliance, reliability, maintenance, or product evolution.

## 4. Merchant Responsibilities

If you operate a store on Myrivo, you are responsible for the accuracy, legality, and completeness of your store content, catalog data, policies, pricing, fulfillment promises, product claims, notices, and customer communications that you control. You are also responsible for ensuring your storefront operations comply with laws that apply to your business, products, customers, and locations.

You must not use Myrivo to sell unlawful, infringing, unsafe, deceptive, or prohibited goods or services, or to misrepresent stock, shipping, pickup, refunds, taxes, discounts, or customer rights.

If you sell digital products, you must hold the rights necessary to distribute and sell every file you upload, including any copyright, licence, model or property release, trademark, or other permission that the file requires. You must not upload or sell a file you did not create unless the rights holder has authorised you to distribute and sell it on these terms, and you must affirm those rights for each file when you add it. Myrivo may remove a file, unpublish a product, suspend digital selling, or terminate an account in response to a credible infringement report, and you remain responsible for refunds, chargebacks, and claims arising from files you were not entitled to sell.

## 5. Shopper Transactions

When you place an order through a Myrivo-powered storefront, you agree to provide accurate and current purchase, contact, pickup, delivery, and payment information. Stores may reject, limit, cancel, or refund orders when required by law, platform rules, fraud prevention, inventory limits, pricing errors, fulfillment constraints, or policy enforcement.

Order acceptance occurs when the store confirms the order or otherwise begins fulfillment, not merely when you submit a checkout request. Taxes, shipping, pickup fees, discounts, and fulfillment timing may vary by store and order context.

## 6. Payments, Fees, and Third-Party Services

The Services may rely on third-party providers for payment processing, tax calculations, shipping, analytics, messaging, file storage, authentication, and related infrastructure. Your use of those parts of the Services may also be subject to the applicable provider's terms and privacy commitments.

Merchants authorize Myrivo and its service providers to process fees, payouts, refunds, and related operational events in accordance with the pricing, billing, and store configuration in effect at the time of the transaction.

## 7. Acceptable Use

You may not:

- interfere with or disrupt the Services, security controls, or platform integrity
- reverse engineer, scrape, or extract data from the Services except as expressly allowed by law or written agreement
- upload malware, abusive content, or unlawful material
- sell, or offer for sale, a digital file you do not hold the rights to distribute and sell
- circumvent feature gates, billing rules, access controls, audit controls, or governance workflows
- use the Services for spam, fraud, deceptive conduct, or harassment
- attempt unauthorized access to accounts, stores, systems, or data

## 8. Content, IP, and Feedback

As between you and Myrivo, you retain rights in the content you lawfully submit to the Services. You grant Myrivo the rights reasonably necessary to host, copy, transmit, display, process, secure, back up, moderate, and otherwise operate the Services in connection with that content.

Myrivo and its licensors retain all rights in the Services, software, documentation, branding, and platform materials except for the limited rights expressly granted to you. If you provide suggestions or feedback, Myrivo may use that feedback without restriction or compensation.

## 9. Suspension and Termination

Myrivo may restrict, suspend, or terminate access to all or part of the Services when reasonably necessary to protect the platform, investigate misuse, address security or legal risk, enforce these terms, respond to governmental requests, or prevent harm to customers, merchants, or third parties.

You may stop using the Services at any time. Sections that by their nature should survive termination, including sections relating to fees owed, intellectual property, disclaimers, liability limits, auditability, and dispute handling, will survive.

## 10. Disclaimers

To the maximum extent permitted by law, the Services are provided on an "as is" and "as available" basis. Myrivo does not guarantee uninterrupted availability, error-free operation, or that the Services will meet every business, legal, tax, accessibility, or regulatory requirement applicable to a particular user, store, or transaction.

Merchants remain responsible for reviewing and approving their configurations, policies, connected services, and live storefront readiness before going live.

## 11. Limitation of Liability

To the maximum extent permitted by law, Myrivo will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost revenue, lost data, business interruption, loss of goodwill, or procurement of substitute services, even if advised of the possibility of those damages.

To the maximum extent permitted by law, Myrivo's aggregate liability arising out of or relating to the Services will not exceed the greater of (a) the amounts paid to Myrivo for the affected Services during the twelve months before the event giving rise to the claim or (b) one hundred U.S. dollars (USD $100).

Nothing in these terms limits liability that cannot be limited under applicable law.

## 12. Indemnity

You agree to defend, indemnify, and hold harmless Myrivo, its affiliates, and their personnel from claims, damages, losses, liabilities, costs, and expenses arising out of or related to your content, store operations, products, misuse of the Services, breach of these terms, or violation of law or third-party rights.

## 13. Governing Law and Disputes

These terms are governed by applicable law and, unless mandatory law requires otherwise, disputes will be resolved in the courts that have jurisdiction over Myrivo's principal place of business or other contractually agreed forum. You and Myrivo agree to cooperate in good faith to resolve disputes before escalating formal proceedings when reasonably possible.

## 14. Changes to These Terms

Myrivo may update these terms from time to time. When material updates are required, Myrivo may publish a new version, update the effective date, and request renewed acceptance where appropriate. Continued use of the Services after an updated version takes effect constitutes acceptance of the updated terms to the extent permitted by law.

## 15. Contact

Questions about these terms may be sent to legal@myrivo.com.$$,
  '2338004f814f9aa420f2db93d921c10225e5c60ec061c81cabe21c28dc6108da',
  'Digital product rights: merchants must hold the rights to every file they sell'
from public.legal_documents doc
where doc.key = 'platform_terms'
  and not exists (
    select 1 from public.legal_document_versions existing
    where existing.legal_document_id = doc.id and existing.version_label = 'v2'
  );

insert into public.legal_document_versions (
  legal_document_id, version_label, status, is_required,
  effective_at, published_at, content_markdown, content_hash, change_summary
)
select doc.id, 'v2', 'published',
  coalesce((
    select prior.is_required from public.legal_document_versions prior
    where prior.legal_document_id = doc.id and prior.status = 'published'
    order by prior.published_at desc nulls last, prior.id desc limit 1
  ), true),
  now(), now(), $$# Terms & Conditions

## 1. Scope

These Terms & Conditions govern your use of the {storeName} storefront and any purchases or interactions you make through it. By accessing the storefront or placing an order, you agree to these terms and any store policies, notices, and operational information presented with the storefront.

This storefront is hosted on Myrivo. Myrivo provides the technology platform used to operate the storefront, but unless expressly stated otherwise, {storeName} is the seller responsible for the products, product descriptions, pricing, fulfillment promises, returns, and customer service associated with purchases from this storefront.

## 2. Orders and Acceptance

When you place an order, you agree that the information you provide is accurate, complete, and current. Submission of an order request does not guarantee acceptance. We may reject, limit, cancel, or refund orders when necessary for inventory reasons, pricing errors, fraud prevention, legal compliance, fulfillment constraints, misuse, or other legitimate operational reasons.

## 3. Pricing, Taxes, and Payment

Prices, promotions, availability, shipping or pickup fees, and applicable taxes may change without notice before an order is submitted. Payment processing is handled through supported payment providers. By placing an order, you represent that you are authorized to use the selected payment method and that the billing and payment details you provide are accurate.

## 4. Fulfillment, Pickup, Shipping, Returns, and Support

Shipping, pickup, return, support, and refund expectations are described throughout the storefront and in the store's policy content. Please review those details carefully before completing a purchase. Fulfillment timing may vary based on inventory, made-to-order production, pickup scheduling, shipping-carrier performance, and circumstances outside the store's reasonable control.

Digital products are delivered as files rather than shipped. After payment, an access link is emailed to the address used at checkout. That link is personal to the order, expires after a limited period, and allows a limited number of downloads per file; you can request a fresh link from the storefront if it expires or is exhausted. Download the files promptly and keep your own copy. If a payment is fully refunded or a dispute is decided against the order, access to the files ends; a partial refund leaves access in place.

## 5. Storefront Use Rules

You may not use the storefront in a way that is unlawful, fraudulent, abusive, harassing, infringing, disruptive, or technically harmful. You may not interfere with storefront security, checkout flows, pricing displays, review systems, availability controls, or any other feature of the storefront or supporting platform.

## 6. Product and Content Information

We try to present product, pricing, availability, fulfillment, and policy information accurately, but mistakes can happen. Images, colors, packaging, timing, and presentation may vary from what is displayed on your device or from earlier storefront content. We reserve the right to correct errors and update storefront information when necessary.

## 7. Intellectual Property

The storefront, branding, product descriptions, imagery, copy, and other content made available by the store are protected by applicable intellectual property laws. You may not copy, reproduce, republish, modify, or exploit storefront content except as allowed by law or with the store's prior written permission.

Buying a digital product does not transfer ownership of it. Unless the store grants you different rights in writing, a purchased file is licensed to you for personal, non-commercial use: you may not resell, redistribute, sublicense, share the file or its access link, or use it commercially. Previews shown on the storefront are watermarked samples and are not the purchased file.

## 8. Disclaimers

To the maximum extent permitted by law, the storefront and products are provided on an "as available" basis. Except where required by law, we do not guarantee uninterrupted access, error-free storefront operation, or that every product or fulfillment estimate will always be available exactly as displayed.

## 9. Limitation of Liability

To the maximum extent permitted by law, {storeName} will not be liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, lost savings, or loss of data arising out of or relating to your use of the storefront or any purchase made through it. Nothing in these terms limits liability that cannot be limited under applicable law.

## 10. Governing Law

These terms are governed by the laws of {governingLawRegion}, without regard to conflict-of-law principles, except where mandatory law requires a different result.

## 11. Changes to These Terms

We may update these Terms & Conditions from time to time to reflect storefront, operational, legal, or policy changes. Updated terms become effective when published to the storefront or on the stated effective date, as applicable.

## 12. Contact

If you have questions about these terms, contact us at {termsContactEmail}.$$,
  'b014a64bbc616b0dec1b6ef26d445f98fa0ca4c1658d147f2f4648022f48bcb9',
  'Digital delivery, access limits, and the personal-use licence for purchased files'
from public.legal_documents doc
where doc.key = 'store_terms_base'
  and not exists (
    select 1 from public.legal_document_versions existing
    where existing.legal_document_id = doc.id and existing.version_label = 'v2'
  );

insert into public.legal_document_versions (
  legal_document_id, version_label, status, is_required,
  effective_at, published_at, content_markdown, content_hash, change_summary
)
select doc.id, 'v2', 'published',
  coalesce((
    select prior.is_required from public.legal_document_versions prior
    where prior.legal_document_id = doc.id and prior.status = 'published'
    order by prior.published_at desc nulls last, prior.id desc limit 1
  ), true),
  now(), now(), $$# Privacy Policy

## 1. Scope

This Privacy Policy explains how {storeName} collects, uses, discloses, and protects information when customers browse the storefront, place orders, join store-managed email lists, request support, or otherwise interact with the store.

This storefront is powered by Myrivo. Myrivo provides the hosted commerce platform and supporting operational services used by the store. As a result, some information may be processed both by {storeName} and by Myrivo or Myrivo-supported service providers in order to operate the storefront and complete transactions.

## 2. Information We Collect

Depending on how you interact with the storefront, we may collect:

- contact information, such as your name, email address, phone number, and support-request details
- order information, such as items purchased, shipping or pickup details, order notes, discount usage, and transaction history
- payment-related information processed through our payment providers
- digital delivery information, such as which files an order grants access to, when access links are issued or re-sent, and how many downloads have been used
- marketing and communication preferences, including newsletter subscriptions and unsubscribe choices
- device, browser, analytics, and storefront interaction data used to understand storefront usage and improve operations
- privacy-request, legal, or support records you submit through the storefront or related channels

## 3. How We Use Information

We may use information to:

- process and fulfill orders
- coordinate pickup, delivery, shipping, returns, refunds, and customer support
- communicate with you about orders, service updates, or store responses
- operate, maintain, analyze, and improve the storefront experience
- send marketing communications where permitted and where you have not opted out
- prevent fraud, misuse, abuse, and technical or operational issues
- comply with legal, tax, accounting, and recordkeeping obligations

## 4. How Information Is Shared

We may share information:

- with Myrivo and service providers that support storefront hosting, payments, analytics, messaging, fulfillment, customer support, storage, fraud prevention, and related operations
- with shipping, delivery, pickup, or logistics partners as needed to complete an order
- with professional advisors or authorities when reasonably necessary for legal compliance, claims, security, or enforcement
- in connection with a business transfer, sale, or restructuring involving the store, to the extent permitted by law

We do not disclose personal information more broadly than is reasonably necessary to operate the storefront, fulfill transactions, communicate with customers, or comply with applicable law.

## 5. Marketing, Cookies, and Similar Technologies

The storefront may use cookies, local storage, analytics, and similar technologies to keep the storefront working, remember preferences, understand traffic and conversion activity, and improve the customer experience. Marketing emails should include unsubscribe mechanisms, and you may opt out of promotional emails at any time using the unsubscribe link or by contacting us.

## 6. Retention

We retain information for as long as reasonably necessary to provide products and services, maintain store and transaction records, resolve disputes, comply with legal obligations, and protect the store and platform from abuse or misuse.

## 7. Security

We use reasonable safeguards designed to protect customer information, including platform-level protections provided through Myrivo and operational controls used by the store. No method of transmission or storage is completely secure, but we work to reduce risk and limit unnecessary access.

## 8. Your Choices and Privacy Requests

Depending on your location, you may have rights to request access to, correction of, deletion of, or other action relating to your personal information. You may also have rights relating to marketing communications and certain data uses or disclosures.

To submit a privacy question or request, contact {privacyContactEmail} or use any privacy request mechanism made available on the storefront.

## 9. Children's Privacy

The storefront is not intended for children under 13, and we do not knowingly collect personal information from children in a manner prohibited by law.

## 10. Changes to This Policy

We may update this Privacy Policy from time to time to reflect operational, legal, or platform changes. When material changes are made, the updated version will be published through the storefront with a revised effective date where appropriate.

## 11. Contact

Questions about this Privacy Policy or the store's privacy practices may be sent to {privacyContactEmail}.$$,
  'a0e3f8831aab3b119d1683f80e6c292b01df932a142328884c5c1aaece07c2db',
  'Digital delivery information added to collected data'
from public.legal_documents doc
where doc.key = 'store_privacy_base'
  and not exists (
    select 1 from public.legal_document_versions existing
    where existing.legal_document_id = doc.id and existing.version_label = 'v2'
  );
