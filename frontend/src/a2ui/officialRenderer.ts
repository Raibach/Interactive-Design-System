/**
 * <a2ui-official-renderer> — THE DESIGN ROOM'S SURFACE, DRAWN BY THE OFFICIAL CLIENT.
 *
 * It is a drop-in for `<a2ui-renderer>`: the same `components`, `dataModel`, `surfaceId` and
 * `system` properties, the same `updateComplete` promise, the same shadow root, and the same
 * `a2ui:validation-failed` event. The shell that creates it does not change.
 *
 * Inside the shadow root it mounts the official `A2uiSurface` over the official
 * `MessageProcessor`, with the catalogue the bridge built from the room's own `catalog.json`.
 * A component assignment replaces the surface (the old renderer replaced the tree); a data-only
 * assignment sends `updateDataModel`, so the elements and their scroll positions survive.
 */
import React from 'react';
import {flushSync} from 'react-dom';
import {createRoot, type Root} from 'react-dom/client';
import {MessageProcessor} from '@a2ui/web_core/v0_9';
import {A2uiSurface} from '@a2ui/react/v0_9';
import {createOfficialDesignCatalog} from './officialBridge';

const VERSION = 'v0.9.1';

export class OfficialDesignRenderer extends HTMLElement {
  private root: Root | null = null;
  private mount: HTMLDivElement | null = null;
  private processor: MessageProcessor | null = null;
  private readonly catalog = createOfficialDesignCatalog();

  private _surfaceId = '';
  private _components: unknown[] = [];
  private _dataModel: Record<string, unknown> = {};
  private _treeDirty = true;
  private _connected = false;
  private _scheduled = false;
  private _resolveUpdate: (() => void) | null = null;
  private _updateComplete: Promise<void> = Promise.resolve();

  constructor() {
    super();
    this.attachShadow({mode: 'open'});
  }

  connectedCallback(): void {
    this._connected = true;
    if (!this.mount || !this.root) {
      this.mount = document.createElement('div');
      this.mount.style.cssText = 'display:block;width:100%;height:100%;min-height:0;';
      this.shadowRoot!.appendChild(this.mount);
      this.root = createRoot(this.mount);
      this.processor = new MessageProcessor([this.catalog]);
    }
    this._treeDirty = true;
    this.schedule();
  }

  disconnectedCallback(): void {
    this._connected = false;
    this.root?.unmount();
    this.root = null;
    this.mount?.remove();
    this.mount = null;
    this.processor = null;
  }

  set surfaceId(value: string) {
    const next = String(value ?? '');
    if (next === this._surfaceId) return;
    this._surfaceId = next;
    this._treeDirty = true;
    this.schedule();
  }

  get surfaceId(): string {
    return this._surfaceId;
  }

  /** The catalogue is the design room's; the shell still sets this property. */
  set system(_value: string) {
    /* The official surface resolves through the bridged design catalogue only. */
  }

  get system(): string {
    return 'surface-design';
  }

  set components(value: unknown[]) {
    this._components = Array.isArray(value) ? value : [];
    this._treeDirty = true;
    this.schedule();
  }

  get components(): unknown[] {
    return this._components;
  }

  set dataModel(value: Record<string, unknown>) {
    this._dataModel = value && typeof value === 'object' ? value : {};
    this.schedule();
  }

  get dataModel(): Record<string, unknown> {
    return this._dataModel;
  }

  get updateComplete(): Promise<void> {
    return this._updateComplete;
  }

  private schedule(): void {
    if (!this._connected) return;
    if (!this._resolveUpdate) {
      this._updateComplete = new Promise<void>((resolve) => {
        this._resolveUpdate = resolve;
      });
    }
    if (this._scheduled) return;
    this._scheduled = true;
    queueMicrotask(() => {
      this._scheduled = false;
      this.draw();
    });
  }

  private draw(): void {
    const resolve = this._resolveUpdate;
    this._resolveUpdate = null;
    try {
      const processor = this.processor;
      const root = this.root;
      if (!processor || !root) return;

      const surfaceId = this._surfaceId || 'main';
      const exists = processor.getSurface(surfaceId) !== undefined;
      const messages: Array<Record<string, unknown>> = [];

      if (this._treeDirty) {
        if (exists) {
          messages.push({version: VERSION, deleteSurface: {surfaceId}});
        }
        messages.push({
          version: VERSION,
          createSurface: {surfaceId, catalogId: this.catalog.id},
        });
        if (this._components.length > 0) {
          messages.push({
            version: VERSION,
            updateComponents: {surfaceId, components: this._components},
          });
        }
      }

      messages.push({
        version: VERSION,
        updateDataModel: {surfaceId, path: '/', value: this._dataModel},
      });

      const errors = processor.processMessagesWithErrors(messages);
      for (const error of errors) {
        const body = error.error;
        console.error(
          `[a2ui-official-renderer] ${body.code}: ${body.message}`,
          body.path ?? '',
        );
        this.dispatchEvent(
          new CustomEvent('a2ui:validation-failed', {
            bubbles: true,
            composed: true,
            detail: {
              code: body.code,
              componentId: (body as {componentId?: string}).componentId,
              path: body.path,
            },
          }),
        );
      }

      const surface = processor.getSurface(surfaceId);
      if (surface) {
        flushSync(() => {
          root.render(React.createElement(A2uiSurface, {surface: surface as any}));
        });
      }
      this._treeDirty = false;
    } catch (error) {
      console.error('[a2ui-official-renderer] the surface could not be drawn', error);
      this.dispatchEvent(
        new CustomEvent('a2ui:validation-failed', {
          bubbles: true,
          composed: true,
          detail: {code: 'RENDER_FAILED', componentId: undefined, path: undefined},
        }),
      );
    } finally {
      resolve?.();
    }
  }
}

if (!customElements.get('a2ui-official-renderer')) {
  customElements.define('a2ui-official-renderer', OfficialDesignRenderer);
}
