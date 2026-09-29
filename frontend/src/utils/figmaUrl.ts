/**
 * Figma URL parser — extracts fileKey and nodeId from Figma links.
 * 
 * Supports formats:
 *   https://figma.com/file/:fileKey/...
 *   https://figma.com/design/:fileKey/...
 *   https://figma.com/proto/:fileKey/...
 * 
 * Node ID in URL uses hyphen (1234-5678), API uses colon (1234:5678).
 *
 * WHAT IS RETURNED IS THE WHOLE NODE — the location included (`I40001206:3418;40001205:5529`),
 * because that is what Figma's endpoints round-trip. Which half of it identifies the COMPONENT
 * is a different question, answered by `nodeIdentity` in `@/shared/node-id`, and the two are
 * kept apart on purpose: the occurrence is a location and only the reference is the component.
 */

import { nodeIdentity } from '@/shared/node-id';

export interface ParsedFigmaUrl {
  fileKey: string;
  nodeId?: string;
  /** The component part of the node — see `@/shared/node-id`. Never used for the round trip. */
  nodeIdentity?: string;
}

export function parseFigmaUrl(url: string): ParsedFigmaUrl {
  try {
    const parsed = new URL(url);
    
    // Validate hostname
    if (!parsed.hostname.includes("figma.com") && !parsed.hostname.includes("figma.cc")) {
      throw new Error("Not a Figma URL");
    }

    // Extract file key from pathname: /file/:key, /design/:key, /proto/:key
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const fileKeyIndex = pathParts.findIndex(p => ["file", "design", "proto"].includes(p));
    
    if (fileKeyIndex === -1 || fileKeyIndex + 1 >= pathParts.length) {
      throw new Error("Could not extract file key from URL");
    }

    const fileKey = pathParts[fileKeyIndex + 1];

    // Extract node-id from query params or pathname
    // Query: ?node-id=1234-5678
    // Path: /node-id/1234-5678/
    let nodeId: string | undefined;
    
    const queryNodeId = parsed.searchParams.get("node-id");
    if (queryNodeId) {
      nodeId = queryNodeId.replace(/-/g, ":");
    } else {
      const pathNodeIdIndex = pathParts.findIndex(p => p === "node-id");
      if (pathNodeIdIndex !== -1 && pathNodeIdIndex + 1 < pathParts.length) {
        nodeId = pathParts[pathNodeIdIndex + 1].replace(/-/g, ":");
      }
    }

    // A URL carries the location with its colons written as hyphens, so `I1:2;3:4` arrives as
    // `I1-2;3-4`. Only the hyphens of the parts either side of the `;` are colons; the `;` itself
    // is what separates the component from the occurrence, and it survives the trip untouched.
    return { fileKey, nodeId, nodeIdentity: nodeId ? nodeIdentity(nodeId) : undefined };
  } catch (error) {
    throw new Error(`Invalid Figma URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validates if a string is a Figma URL (file, design, or proto).
 */
export function isFigmaUrl(url: string): boolean {
  try {
    parseFigmaUrl(url);
    return true;
  } catch {
    return false;
  }
}