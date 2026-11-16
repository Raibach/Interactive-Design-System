/**
 * <a2ui-official-lit-renderer> — THE DESIGN ROOM'S SURFACE, DRAWN BY THE OFFICIAL LIT CLIENT.
 *
 * A drop-in for `<a2ui-renderer>`: the same `components`, `dataModel`, `surfaceId` and `system`
 * properties, the same `updateComplete` promise, the same shadow root and the same
 * `a2ui:validation-failed` event. Inside the shadow root is the official `A2uiSurface` over the
 * official `MessageProcessor`, using the Lit bridge over the room's own catalogue.
 *
 * A component assignment replaces the surface; a data-only assignment sends `updateDataModel`,
 * so the elements survive.
 */
import {A2uiSurface} from '@a2ui/lit/v0_9';
import {MessageProcessor, type Catalog} from '@a2ui/web_core/v0_9';
import {normalizeLegacyChildren} from '@/shared/a2uiChildren';
import {createOfficialLitCatalog, LIT_APP_TAGS} from './officialLitBridge';
import {createOfficialLitComposerCatalog} from './officialLitComposerBridge';

const VERSION = 'v0.9.1';

export class OfficialLitRenderer extends HTMLElement {
  private surfaceEl: A2uiSurface | null = null;
  private processor: MessageProcessor | null = null;
  private _system = 'surface-design';
  private catalog: Catalog<any, any> | null = null;

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
    if (!this.style.display) {
      this.style.cssText = 'display:block;width:100%;height:100%;min-height:0;flex:1 1 auto;min-width:0;';
    }
    if (!this.surfaceEl) {
      if (!customElements.get('a2ui-surface')) {
        customElements.define('a2ui-surface', A2uiSurface);
      }
      this.surfaceEl = document.createElement('a2ui-surface') as A2uiSurface;
      this.surfaceEl.style.cssText = 'display:block;width:100%;height:100%;min-height:0;';
      this.shadowRoot!.appendChild(this.surfaceEl);
    }
    this.processor = new MessageProcessor([this.ensureCatalog()]);
    this._treeDirty = true;
    this.schedule();
  }

  disconnectedCallback(): void {
    this._connected = false;
    if (this.surfaceEl) this.surfaceEl.surface = undefined;
    this.surfaceEl?.remove();
    this.surfaceEl = null;
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

  /** The catalogue the surface resolves through: the design room's or the prompt-composer one. */
  set system(value: string) {
    const next = String(value || 'surface-design');
    if (next === this._system) return;
    this._system = next;
    this.catalog = null;
    if (this._connected) {
      this.processor = new MessageProcessor([this.ensureCatalog()]);
      if (this.surfaceEl) this.surfaceEl.surface = undefined;
      this._treeDirty = true;
      this.schedule();
    }
  }

  get system(): string {
    return this._system;
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

  private ensureCatalog(): Catalog<any, any> {
    if (!this.catalog) {
      this.catalog = this._system === 'prompt-composer'
        ? createOfficialLitComposerCatalog()
        : createOfficialLitCatalog();
    }
    return this.catalog;
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
    const finish = () => resolve?.();

    const processor = this.processor;
    const surfaceEl = this.surfaceEl;
    if (!processor || !surfaceEl) {
      finish();
      return;
    }
    const catalog = this.ensureCatalog();

    try {
      const surfaceId = this._surfaceId || 'main';
      const exists = processor.getSurface(surfaceId) !== undefined;
      const messages: Array<Record<string, unknown>> = [];

      if (this._treeDirty) {
        const components = this._components.map((component) => ({
          ...(component as Record<string, any>),
        }));
        normalizeLegacyChildren(components);
        if (exists) messages.push({version: VERSION, deleteSurface: {surfaceId}});
        messages.push({
          version: VERSION,
          createSurface: {surfaceId, catalogId: catalog.id},
        });
        if (components.length > 0) {
          messages.push({
            version: VERSION,
            updateComponents: {surfaceId, components},
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
        console.error(`[a2ui-official-lit-renderer] ${body.code}: ${body.message}`, body.path ?? '');
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
      if (!surface) {
        finish();
        return;
      }

      surfaceEl.surface = surface as any;
      this._treeDirty = false;
      void this.afterSurface(surfaceEl).finally(finish);
    } catch (error) {
      console.error('[a2ui-official-lit-renderer] the surface could not be drawn', error);
      this.dispatchEvent(
        new CustomEvent('a2ui:validation-failed', {
          bubbles: true,
          composed: true,
          detail: {code: 'RENDER_FAILED', componentId: undefined, path: undefined},
        }),
      );
      finish();
    }
  }

  private async afterSurface(surfaceEl: A2uiSurface): Promise<void> {
    await surfaceEl.updateComplete;
    const root = (this._components as Array<Record<string, any>>).find(
      (component) => String(component?.id) === 'root',
    );
    const appTag = root ? LIT_APP_TAGS[String(root.component)] : undefined;
    const adapter = appTag
      ? (this.shadowRoot?.querySelector(`a2ui-lit-${appTag}`) as (HTMLElement & {updateComplete?: Promise<unknown>}) | null)
      : null;
    if (adapter?.updateComplete) await adapter.updateComplete;
  }
}

if (!customElements.get('a2ui-official-lit-renderer')) {
  customElements.define('a2ui-official-lit-renderer', OfficialLitRenderer);
}

declare global {
  interface HTMLElementTagNameMap {
    'a2ui-official-lit-renderer': OfficialLitRenderer;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'a2ui-official-lit-renderer': React.DetailedHTMLProps<
        React.HTMLAttributes<OfficialLitRenderer> & {
          system?: string;
          ref?: React.Ref<OfficialLitRenderer>;
        },
        OfficialLitRenderer
      >;
    }
  }
}
