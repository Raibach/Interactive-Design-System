/**
 * THE REPAIR STAGE TYPES — one home, re-exported under the name the rooms import.
 *
 * `RepairStage` and `RepairStages` are declared beside the functions that produce them
 * (`shared/catalogHealth.ts`), so there is exactly one definition. The Console room's
 * boundary names them at `@/shared/repair-types`; this module keeps that address working
 * without a second copy of the type.
 */
export type { RepairStage, RepairStages } from '@/shared/catalogHealth';
