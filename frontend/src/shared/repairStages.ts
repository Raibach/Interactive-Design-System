/**
 * THE REPAIR STAGES — one fact, two rooms.
 *
 * The Composer's repair flow moves a finding through queued, running and done. The Console draws
 * those same stages under Approvals. While the shell owned both, the map lived in its state and
 * reached the Console through a ref. It moves here because the two rooms will outlive the shell's
 * copy: whoever is mounted writes the map, and both read it.
 *
 * A module store, not context, because the Composer's box unmounts when another tab is selected
 * and the Console must still draw the stages it left.
 */
import { useSyncExternalStore } from 'react';

import type { RepairStages } from '@/shared/repair-types';

let stages: RepairStages = {};
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRepairStages(): RepairStages {
  return stages;
}

export function setRepairStages(
  next: RepairStages | ((prev: RepairStages) => RepairStages),
): void {
  const value = typeof next === 'function' ? (next as (prev: RepairStages) => RepairStages)(stages) : next;
  if (value === stages) return;
  stages = value;
  emit();
}

/** The map and its writer, shaped like a `useState` pair so call sites read unchanged. */
export function useRepairStages(): [RepairStages, typeof setRepairStages] {
  const value = useSyncExternalStore(subscribe, getRepairStages, getRepairStages);
  return [value, setRepairStages];
}
