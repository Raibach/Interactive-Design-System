/** The ingest's report to the designer: the two-channel reconciliation, what the data check compared, what it could not see, the named keys, the named differences, and the accept question. */

/** The data check compares the spec to the generated code; it cannot see the screen. Say both. */
export function ingestFidelityLine(result: Record<string, any>): string {
  const exactness = result?.fidelity?.exactness as
    | { exact?: number; compared?: number }
    | null;
  const matched = Number(exactness?.exact ?? 0);
  const twoPass = result?.twoPass as
    | { counts?: Record<string, number>; rows?: Array<Record<string, any>> }
    | null;
  const rows = Array.isArray(twoPass?.rows) ? twoPass.rows : [];
  const mirrored = rows.filter(
    (row) => row?.outcome === "differ" && row?.causeKind === "flip",
  ).length;
  const unconfirmed = Number(twoPass?.counts?.["rest-only"] ?? 0);
  const data = twoPass
    ? `Data fidelity: ${matched} facts matched the code. ${mirrored} were mirrored, and ${unconfirmed} were unconfirmed.`
    : "Data fidelity: the comparison counts were not returned.";
  return `${data}\n\nVisual fidelity: Unverified (requires browser rendering).`;
}

export function buildIngestSummary(
  result: Record<string, any>,
  blocking: string[],
): string {
  const validationFailure = result?.validationFailure as
    | { profile?: string; keys?: string[] }
    | null;
  const validationKeys = Array.isArray(validationFailure?.keys)
    ? validationFailure.keys
    : [];
  const validationKeySet = new Set(validationKeys);
  const remainingBlocking = validationKeySet.size
    ? blocking.filter(
        (one) =>
          !Array.from(validationKeySet).some((key) => one.includes(`\`${key}\``)),
      )
    : blocking;

  // THE RECONCILIATION IS THE TWO-CHANNEL ONE, not the single-channel gate's exactness. The
  // server's own sentence names the layers both channels confirmed, the facts that differ, and
  // the facts that exist on only one channel; it is the same sentence the step log printed.
  const twoPass = result?.twoPass as
    | { summary?: string; mcpError?: string | null }
    | null;
  const countsLine = String(
    twoPass?.summary ?? "The two-channel reconciliation was not returned.",
  );

  const keysLine = validationKeys.length
    ? [
        [
          `The design states ${validationKeys.length === 1 ? "a key" : `${validationKeys.length} keys`} that no examination covers:`,
          ...validationKeys.map((key) => {
            const meaning: Record<string, string> = {
              arcData:
                "the geometry of a vector arc; the drawing does not read it. Fix: read the arc data and draw the arc",
              componentProperties:
                "the values an instance carries from its component; the component does not carry them. Fix: read the instance's property values and carry them",
              maxWidth:
                "the maximum width a layer may take; the drawing does not apply it. Fix: read the maximum width and apply it",
            };
            return `- \`${key}\` — ${
              meaning[key] ??
              "no examination covers this key. Fix: add an examination for it, or declare it configuration"
            }.`;
          }),
        ].join("\n"),
        "The component is drawn, and it may be wrong where these keys apply.",
      ].join("\n\n")
    : "";

  const actionLine = validationKeys.length
    ? `**What to do:** add an examination for ${validationKeys.length === 1 ? "that key" : "each named key"}, or declare it configuration if it needs no drawing. Then run the ingest again.`
    : "**What to do:** read the named differences below, fix the drawing or the measurement, then run the ingest again.";
  const profile = String(validationFailure?.profile ?? "");

  return [
    validationKeys.length
      ? "**The drawing is shown; the design is not fully examined.**"
      : "**The drawing is shown with differences.**",
    countsLine,
    ingestFidelityLine(result),
    keysLine,
    actionLine,
    profile ? "```\n" + profile + "\n```" : "",
    remainingBlocking.length
      ? "**Other differences:**\n" + remainingBlocking.map((one) => `- ${one}`).join("\n")
      : "",
    "**Do you accept the drawing as it stands?** [Accept](action:preview-accept) or [Discard](action:preview-discard).",
  ].filter(Boolean).join("\n\n");
}
