# GEMINI - Global Engineering Standards

This document defines the quality and architectural standards for the FarmFlow project. Compliance with these standards is mandatory for all agents and contributors.

## 1. Architectural Principles (SOLID)

- **Single Responsibility (SRP):** Each file/class must have one reason to change. Components handle UI, hooks handle state/logic, and utils handle pure functions.
- **Open/Closed:** Prefer extension through composition rather than modification.
- **Dependency Inversion:** Depend on abstractions (interfaces) rather than concrete implementations (e.g., abstracting the database layer).

## 2. File & Component Standards

- **Max File Size:** No file should exceed 400 lines. Break large components into sub-components.
- **Hook Modularity:** One hook for one functional area (e.g., `useAuth`, `useSync`).
- **Naming Conventions:**
  - Components: `PascalCase.tsx`
  - Hooks: `useCamelCase.ts`
  - Constants: `SCREAMING_SNAKE_CASE`
- **TypeScript:** Use strict types. Avoid `any` at all costs. Prefer interfaces over types for public APIs.

## 3. Data & Sync Patterns

- **Offline-First:** All writes must be performed against the local PowerSync database.
- **Sync States:** Always handle `loading`, `error`, and `offline` states in UI components.
- **Conflict Resolution:** Use "Last Write Wins" or custom merging logic as defined in the sync controller.

## 4. Testing & Quality

- **Unit Tests:** Mandatory for all business logic (utils/hooks).
- **E2E Tests:** Required for critical paths (Auth, Sync, Logging).
- **Self-Healing:** Code must be instrumented with useful error logs to facilitate autonomous agent debugging.

## 6. Database Safety & Migrations

- **Schema Parity:** Supabase (Remote) and PowerSync (Local) schemas must be kept in 100% synchronization.
- **Migration Protocol:**
  - Never modify the database directly via Supabase Dashboard. Always use migration files.
  - Run the `validate-schema.ts` script before committing any schema changes.
- **Query Safety:**
  - Always use named parameters or prepared statements to prevent SQL injection.
  - Mandatory RLS: Every new table must have Row Level Security enabled and a membership-based policy applied.
  - Indexed Lookups: Favour indexed columns (`farm_id`, `field_id`, `created_at`) in `WHERE` clauses for scalability.
  - Type Mapping: Map Supabase `TIMESTAMPTZ` to PowerSync `ColumnType.TEXT` (ISO strings) for consistent sorting.
## 7. Automated Testing & Visual QA

- **E2E Toolchain:** Use Playwright for Web to validate critical paths.
- **Component Instrumentation:**
  - All interactive elements must have a `testID` prop.
  - Custom components should pass `testID` down to the root native element.
- **Visual Consistency:**
  - Any change to global styles or layout components requires running `npx playwright test --update-snapshots`.
  - Snapshots must be verified across Mobile (iPhone 12), Tablet (iPad gen 7), and Desktop Chromium.
- **Flaky-Resistant Patterns:**
  - Avoid hard waits (`setTimeout`). Use Playwright auto-waiting assertions like `expect(page.getByText(...)).toBeVisible()`.
  - For async data loading, use `page.waitForResponse(...)` or verify the presence of a loading indicator.
