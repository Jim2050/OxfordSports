# OxfordSports Implementation Blueprint (YASIR v4)

## 1. Scope Lock (Source of Truth)
This implementation is locked to:
- `WEBSITE_CATEGORIES_YASIR (4).xlsx`

All taxonomy, mapping, migration, and UI updates must align to this file only.

## 2. Evidence Snapshot
### 2.1 Excel Evidence (YASIR v4)
Extracted from `Sheet1` (rows 1-20 category matrix):
- HOME: 0 subcategories
- FOOTWEAR: 11
- CLOTHING: 18
- LICENSED TEAM CLOTHING: 16
- ACCESSORIES: 11
- B GRADE: 0
- JOB LOTS: 0
- UNDER £5: 0
- BRANDS: 11
- SPORTS: 18

### 2.2 Live Database Evidence (Active products)
Current category distribution:
- CLOTHING: 2975
- FOOTWEAR: 1729
- LICENSED TEAM CLOTHING: 426
- Womens: 234
- ACCESSORIES: 229
- Mens: 145
- Junior: 53
- B GRADE: 19
- Clothing: 7
- B Grade: 4
- cLOTHING: 1

Critical findings:
- SPORTS_CATEGORY_COUNT = 0
- JOB_LOTS_COUNT = 0

Implication:
- Sports page appears empty because products are not categorized with primary category = SPORTS.
- Job Lots appears empty because there are no active products with category = JOB LOTS.

## 3. Architecture Principles
1. Canonical taxonomy only (single source of truth).
2. Deterministic migration (no ambiguous silent reassignment).
3. Idempotent imports (safe re-runs, no duplicate side effects).
4. Query performance first (indexed, normalized filter fields).
5. UI generated from taxonomy API to avoid hardcoded drift.
6. Backward compatibility for old URLs and legacy category values during transition.

## 4. Target Taxonomy Model
## 4.1 Canonical fields on products
Add normalized fields (read optimized):
- `categoryCanonical` (uppercase controlled value)
- `subcategoryCanonical` (uppercase controlled value)
- `sportCanonical` (nullable; one of SPORTS list)
- `genderCanonical` (MENS/WOMENS/JUNIOR/UNISEX/UNKNOWN)
- `brandCanonical` (uppercase normalized)

Keep original source fields for audit/debug:
- `category`
- `subcategory`
- `brand`

## 4.2 Taxonomy registry collection
Create collection `taxonomy_registry` with versioning:
- version: `yasir4-v1`
- categories[]
- subcategoriesByCategory{}
- aliases: old -> canonical
- splitRules: deterministic mapping rules
- metadata: createdAt, approvedBy

Use this registry in:
- import pipeline
- API filter resolver
- frontend navigation builder

## 5. Sports and Job Lots Strategy (Approved-safe)
## 5.1 Sports
Use SPORTS as a discoverability lens (facet), not mandatory primary category migration.

Reason:
- Existing catalog is primarily merch-category structured (Footwear/Clothing/etc.)
- Forcing primary category SPORTS would destabilize current navigation and MOQ behavior.

Implementation:
- Tag products with `sportCanonical` via deterministic rules.
- `/products?category=SPORTS` resolves to `sportCanonical != null` (or requested sport subcategory).

## 5.2 Job Lots
- Add explicit Job Lots visibility in header nav.
- Provide admin flow to mark products as Job Lots.
- Keep empty-state UX clean when count is zero.

## 6. Import Pipeline (Fast, Scalable, Reliable)
## 6.1 Pipeline stages
1. Upload -> store batch metadata (`import_batches`)
2. Parse workbook to staging (`import_rows_staging`)
3. Canonicalize against taxonomy registry
4. Validate hard constraints
5. Deduplicate (within batch + against catalog)
6. Bulk upsert to products in chunked transactions
7. Post-commit metrics + anomaly report

## 6.2 Reliability controls
- Batch checksum + row fingerprint for idempotency
- Strict reject list for unknown categories/subcategories
- Ambiguous split rows sent to review queue (not auto-committed)
- Retry policy for transient DB/network failures
- Dead-letter capture for failed rows

## 6.3 Performance controls
- Use `bulkWrite` chunks (500-1000 rows configurable)
- Lean projection where possible
- Disable expensive per-row lookups (preload maps in memory)
- Use upsert key on canonical SKU

## 7. Database Optimization Plan
## 7.1 Required indexes
Products collection:
- `{ isActive: 1, categoryCanonical: 1, subcategoryCanonical: 1 }`
- `{ isActive: 1, sportCanonical: 1 }`
- `{ isActive: 1, brandCanonical: 1 }`
- `{ sku: 1 }` unique (or canonical SKU unique index if required)
- text/search indexes kept separate from transactional filters

Taxonomy collections:
- categories: `{ name: 1 }` unique, `{ slug: 1 }` unique
- subcategories: `{ categoryId: 1, name: 1 }` unique

## 7.2 Query path
- API should filter on canonical indexed fields.
- Avoid regex on hot path where exact canonical match is possible.
- Regex fallback only for backward compatibility period.

## 8. UI Accuracy and Stability Plan
1. Replace hardcoded nav trees with API-driven taxonomy payload.
2. Render category/subcategory menu from `taxonomy_registry` + active counts.
3. Keep route compatibility:
   - Old labels redirect/resolve via alias map.
4. Add explicit Job Lots to main header menu.
5. Sports page should surface products via `sportCanonical` query path.

## 9. Migration Plan (Zero-surprise)
## 9.1 Pre-migration
- Full backup snapshot (products + categories + subcategories)
- Dry-run migration report with counts by target category/subcategory
- Stakeholder sign-off on dry-run report

## 9.2 Migration steps
1. Seed categories/subcategories from YASIR v4 (non-destructive first)
2. Populate canonical fields from existing product values
3. Apply alias normalization (case and wording fixes)
4. Apply split rules (deterministic only)
5. Flag ambiguous rows for manual review
6. Recompute category/subcategory/sport counts

## 9.3 Post-migration checks
- No product loss check (before vs after count)
- Distribution sanity checks
- SPORTS and JOB LOTS expected behavior verification
- URL and filter contract tests pass

## 10. Validation Matrix
## 10.1 Functional
- Every category/subcategory in YASIR v4 resolves products correctly
- Sports hub no longer empty when sport-tagged products exist
- Job Lots visible and queryable

## 10.2 Data integrity
- No duplicate SKU creation from re-import
- No null canonical category for active products
- No orphan subcategories

## 10.3 Performance
- P95 product list API under target SLA after indexing
- Import throughput measured (rows/minute) and stable under large files

## 11. Rollout and Rollback
## 11.1 Rollout
- Deploy behind feature flag: `TAXONOMY_V4_ENABLED`
- Canary verification in production with read-only diagnostics
- Enable write paths after validation

## 11.2 Rollback
- Toggle feature flag off
- Restore from pre-migration snapshot if needed
- Revert to legacy query fields

## 12. Delivery Sequence (Execution Order)
1. Finalize taxonomy registry from YASIR v4
2. Implement canonical fields + indexes
3. Implement importer staging/idempotency/canonicalization
4. Implement API resolver changes (Sports lens + aliases)
5. Implement UI dynamic menu + Job Lots header item
6. Run dry-run migration and review report
7. Execute production migration
8. Run post-release validation pack

## 13. Non-Negotiable Quality Gates
- No direct production mutation without dry-run report
- No ambiguous split auto-assignment
- No UI menu hardcoded divergence from taxonomy registry
- No regex-only filter path for canonical queries

## 14. Notes for Current Client Comment
Client note: "no Job Lot category" and "Sports category is empty"
- Root cause confirmed by live DB counts (both zero in primary category values).
- This blueprint resolves both while preserving existing merchandising structure and fast query performance.
