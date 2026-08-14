# Task 15 fix round 11

- Fixed canonical signed-envelope parsing by projecting full records into exact scenario and observation schemas.
- Exported a pure semantic evidence verifier and made the release CLI invoke it with the complete required scenario set.
- Added a valid full-record envelope regression plus malformed and duplicate rejection coverage.
- Runs axe after actual signing failure, grant denial, refund, dispute, delivery failure, and delivery retry transitions.

External provider acceptance remains unexecuted and unclaimed.
