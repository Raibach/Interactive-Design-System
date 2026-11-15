/**
 * PRESS A BOX'S BAR — open it, or close it. The seat keeps the set of open boxes; the frame draws
 * them. `toggle-output-window` flips one, `remove-output-window` closes one.
 */
export interface OutputWindowHost {
  _outputWindows: string[];
  requestUpdate(): void;
}

export const outputWindowAction = (host: OutputWindowHost, e: Event): void => {
  const d = ((e as CustomEvent).detail || {}) as { window?: string };
  const id = String(d.window || '');
  if (!id) return;
  const showing = host._outputWindows.includes(id);
  const next = e.type === 'toggle-output-window' ? !showing : false;
  host._outputWindows = next
    ? [...host._outputWindows, id]
    : host._outputWindows.filter((w) => w !== id);
  host.requestUpdate();
};
