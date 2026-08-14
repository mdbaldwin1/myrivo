# Task 15 fix round 10

- Separates entitlement used counts, issued grants, and released reservation audit rows.
- Requires unchanged used/issued state around the one-shot signing fault, exactly one new released row, and a later issued retry.
- Stores actual immediate grace before/after counts and the reused grant ID.
- Replacement evidence carries old-before, old-after, and new byte hashes, filenames, and version IDs.
- Exports a canonical strict signed-evidence envelope with scenario and observation parsing plus duplicate rejection.
- Makes named download and 200%-zoom action checks mandatory in the accessibility suite.

External provider execution remains required before claiming release acceptance.
