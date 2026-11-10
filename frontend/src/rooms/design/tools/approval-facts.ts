/** The catalogue comparison an ingest produces for the approval queue, read from the ingest result and never carried on the preview. */

export interface ApprovalFacts {
  alreadyInCatalogue: boolean;
  existing?: { tag?: string; nodeId?: string; approvedAt?: string };
  collisions: Array<Record<string, any>>;
  instances: Array<Record<string, any>>;
}

/**
 * The one place the comparison is assembled. The preview does not carry it: the approval path
 * reads the ingest's own result when it needs the facts, so no field sits on the drawing with no
 * reader. Nothing here is drawn, and nothing here reads the catalogue itself.
 */
export function approvalFactsOf(
  result: Record<string, any>,
  existingName?: { tag?: string; nodeId?: string; approvedAt?: string } | null,
): ApprovalFacts {
  return {
    alreadyInCatalogue: !!result.alreadyInCatalogue,
    existing: existingName?.tag ? existingName : undefined,
    collisions: Array.isArray(result.nameCollisions) ? result.nameCollisions : [],
    instances: Array.isArray(result.nameInstances) ? result.nameInstances : [],
  };
}
