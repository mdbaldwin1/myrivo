---
slug: release-operations-and-deployments
title: Release Operations and Deployments
summary: Run safe application releases, verify environment readiness, and know which commands and routes matter when something goes wrong.
category: Operations
audience: Platform admins, release operators, and support leads
lastUpdated: March 2026
owner: Platform Operations
reviewCadence: Monthly
reviewBy: 2026-04-15
---

## Deployment Surface
Production deployment is branch-driven and Vercel-backed. Releases should only promote reviewed, validated changes.

Primary references:

- `main` for release promotion
- `develop` for integration
- `docs/runbooks/deployment-vercel.md` for environment and workflow details

## Required Verification Commands
Before approving release promotion, run the project validation set in the touched workspace:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

If the release changes database shape, verify migration readiness before deployment.

## Production Validation Routes
After deployment, validate the highest-risk routes first:

- `/`
- `/pricing`
- `/signup`
- `/dashboard`
- `/dashboard/admin`
- `/s/:storeSlug`
- `/checkout`

## Related Docs

- `/docs/admin-dashboard-and-operations`
- `/docs/support-operations-and-escalation`
