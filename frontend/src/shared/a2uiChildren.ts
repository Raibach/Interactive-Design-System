/**
 * THE LEGACY OBJECT CHILD MAP, CONVERTED TO THE STANDARD A2UI FORM.
 *
 * The old renderer accepted `children` keyed by region. A2UI v0.9.1's `ChildList` is an array,
 * and the region each child stands in is a separate `placements` map with one ComponentId per
 * region. The official validator refuses the object form by name, and it is right to. This
 * converts one such object: one child in a region becomes that child in the array plus its
 * placement; a region holding several becomes a standard `Column` container in the array, with
 * the several children under it.
 */
export function normalizeLegacyChildren(components: Array<Record<string, any>>): void {
  const legacy = components.filter(
    (entry) =>
      entry?.children
      && !Array.isArray(entry.children)
      && typeof entry.children === 'object'
      && typeof (entry.children as Record<string, unknown>).componentId !== 'string'
      && typeof (entry.children as Record<string, unknown>).path !== 'string',
  );

  for (const entry of legacy) {
    const raw = entry.children as Record<string, unknown>;
    const ids: string[] = [];
    const regions: Record<string, string> = {};

    for (const [region, value] of Object.entries(raw)) {
      const list = (Array.isArray(value) ? value : [value])
        .filter((id): id is string => typeof id === 'string' && id !== String(entry.id))
        .filter((id) => components.some((row) => String(row?.id) === id));
      if (list.length === 0) continue;

      if (list.length === 1) {
        ids.push(list[0]);
        regions[region] = list[0];
        continue;
      }

      const stackId = `${String(entry.id)}-${region}-stack`;
      if (!components.some((row) => String(row?.id) === stackId)) {
        components.push({ id: stackId, component: 'Column', children: list });
      }
      ids.push(stackId);
      regions[region] = stackId;
    }

    entry.children = ids;
    entry.placements = regions;
  }
}
