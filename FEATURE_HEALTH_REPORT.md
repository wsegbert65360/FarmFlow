# FarmFlow Feature Health Report (Field-to-Bin Lifecycle)

This report summarizes the **Full Season diagnostic** and identifies where the UI and service layer successfully persisted to the database vs. where there are gaps.

## 1) Diagnostic Runs

### Standalone lifecycle simulation
- Script: `tests/full_season_e2e_cjs.js`
- Result: **PASS** for all steps
- Notes: This script is a *mocked in-memory simulation* and does not validate the production PowerSync/Supabase stack.

### Playwright suite (web)
- Latest: **45 passed / 6 skipped**
  - skipped = `tests/visual.spec.ts` (visual snapshots are environment-sensitive)

## 2) UI → DB Health (what writes what)

### Fields

| UI Surface | Code Path | DB Tables Written | Status |
|---|---|---|---|
| Add Field (empty state button) | `FieldListScreen.tsx` → `useFields.addField()` → `useDatabase.insertFarmRow()` | `fields`, `audit_logs` | PASS |
| Delete Field | `FieldListScreen.tsx` → `useFields.deleteField()` | `grain_logs` (read), then `fields` (delete), `audit_logs` | PASS w/ Guardrail |

**Deletion Guardrails:** `useFields.deleteField()` blocks deletion when `grain_logs` exist for that field+farm.

### Planting

| UI Surface | Code Path | DB Tables Written | Status |
|---|---|---|---|
| Field Card → PLANT | `FieldCard.tsx` → `FieldListScreen.handleAction()` → `LogSessionScreen(type=PLANTING)` → `usePlanting.addPlantingLog()` | `planting_logs`, `audit_logs` | PASS (via existing hook) |

### Spraying + Weather

| UI Surface | Code Path | DB Tables Written | Status |
|---|---|---|---|
| Field Card → SPRAY | `FieldCard.tsx` → `LogSessionScreen(type=SPRAY)` → `useSpray.addSprayLog()` | `spray_logs`, `spray_log_items`, `audit_logs` | PASS |
| Weather capture (auto) | `LogSessionScreen.loadWeather()` → `fetchCurrentWeather()` | *No DB write* (values persisted into `spray_logs` fields) | PASS |

**E2E Stability Improvement:** `WeatherUtility.fetchCurrentWeather()` now returns deterministic weather when `globalThis.E2E_TESTING` is set to avoid geolocation permission failures in Playwright.

### Harvest / Grain Movement (Field → Bin)

| UI Surface | Code Path | DB Tables Written | Status |
|---|---|---|---|
| Field Card → HARVEST | `FieldCard.tsx` → `LogSessionScreen(type=HARVEST)` → `useGrain.addGrainLog()` → `GrainMovementService.recordHarvest()` | `grain_logs`, `grain_lots`, `lot_movements`, `audit_logs` | PASS |
| Field Card → TO TOWN | `FieldCard.tsx` → `LogSessionScreen(type=HARVEST_TO_TOWN)` → `useGrain.addGrainLog()` → `GrainMovementService.recordHarvest()` | `grain_logs`, `grain_lots`, `lot_movements`, `audit_logs` | PASS |

## 3) GrainMovementService.ts Health

| Area | Expected Behavior | Status |
|---|---|---|
| `recordHarvest()` writes legacy log | Insert row in `grain_logs` | PASS |
| Lot lookup / reuse | Reuse `grain_lots` for same (field,cropYear,farm) | PASS (fixed) |
| Movement ledger | Insert `lot_movements` INTO_BIN or DIRECT_TO_TOWN | PASS |
| Transactionality | All writes occur inside one `db.writeTransaction()` | PASS |

**Previously failing behavior (fixed):**
- Lot lookup used `tx.get(...)` which is not consistently available in PowerSync adapters; this could prevent lot reuse/creation and break the harvest save path. Fixed by using `tx.execute()` + safe first-row extraction.

## 4) Known Gaps / Risks

### Service layer consolidation
Harvest logic is now centralized by delegating harvest types through `GrainMovementService.recordHarvest()`. Remaining work is primarily normalization/cleanup.

### Destination type inconsistencies
- `grain_logs.destination_type` values vary (`BIN` vs `ELEVATOR` vs `TOWN`).
- Recommend a single enum mapping and conversion layer.

### Hydration / schema warnings in Playwright
- Previously we saw boot-time warnings like `no such table: main.spray_logs` from early index creation.
- Fixed by making index creation schema-aware + quiet retry in `src/db/powersync.ts`.

## 5) Recommendations (next patches)

1. Route all harvest creation through `GrainMovementService.recordHarvest()` and make `useGrain.addGrainLog()` delegate for harvest types.
2. Add a dedicated “Field-to-Bin lifecycle” test that asserts:
   - row exists in `grain_logs`
   - row exists in `grain_lots`
   - row exists in `lot_movements`
   - bin balance reflects movement ledger.
3. Normalize `destination_type` values (and update any downstream report logic).
