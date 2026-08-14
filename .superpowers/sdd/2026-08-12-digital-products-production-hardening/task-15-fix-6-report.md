# Task 15 fix round 6

- Replaced connection-local GUC trust with a singleton, database-owned nonproduction configuration inaccessible to application roles.
- Unified observation parsing around one strict Zod schema used by the server and Playwright evidence writer.
- Removed synthetic financial actions from browser acceptance. Refunds use Stripe test API; dispute outcomes require an explicitly configured audited provider helper and otherwise fail before the suite.
- Added exact composition, manifest-version, and unique five-grant verification.
- Expanded mobile and desktop accessibility coverage through recovery success, merchant resend, populated cart, download activation, dynamic axe checks, keyboard focus, zoom, and reduced motion.

External provider execution is not claimed without its credentials and fixture. Local Supabase workflow remains dependent on Docker availability.
