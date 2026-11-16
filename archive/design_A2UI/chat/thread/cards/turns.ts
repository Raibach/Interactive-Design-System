/**
 * THE THREAD'S TURNS — a turn's role, its words as structure, and the turn template.
 *
 * The drawing stays with the thread element; this file is the turn's behaviour: which role it
 * is, how a host message's lines become headers, bold, lists and a raw block, and how the turn
 * hands its links to the action-links slice and its click to the element.
 */
import { html, nothing, type TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { renderMarkdown } from '@/shared/richText';
import { actionButton, actionSegments } from './action-links';
import type { ChatMessage } from './types';
import '../../parts/design-user-response-bubble';

export type TurnRole = 'user' | 'assistant';

export const turnRole = (m: ChatMessage): TurnRole => {
  const raw = String(m.role ?? (m as { type?: string }).type ?? 'assistant');
  return raw === 'user' || raw === 'question' ? 'user' : 'assistant';
};

/** A host message's lines as structure. The text is interpolated as values, never as HTML. */
export const richText = (text: string): unknown[] => {
  const out: unknown[] = [];
  let list: 'ul' | 'ol' | null = null;
  let items: unknown[] = [];
  let fence: string[] | null = null;
  const flush = () => {
    if (!list) return;
    out.push(list === 'ol' ? html`<ol>${items}</ol>` : html`<ul>${items}</ul>`);
    list = null;
    items = [];
  };
  const inline = (line: string): unknown[] =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part) => {
      const bold = part.match(/^\*\*([^*]+)\*\*$/);
      return bold ? html`<strong>${bold[1]}</strong>` : part;
    });
  for (const line of String(text ?? '').split('\n')) {
    if (line.trim().startsWith('```')) {
      if (fence) {
        out.push(html`<pre class="raw">${fence.join('\n')}</pre>`);
        fence = null;
      } else {
        flush();
        fence = [];
      }
      continue;
    }
    if (fence) {
      fence.push(line);
      continue;
    }
    const bullet = line.match(/^\s*[-•]\s+(.*)$/);
    if (bullet) {
      if (list !== 'ul') {
        flush();
        list = 'ul';
      }
      items.push(html`<li>${inline(bullet[1])}</li>`);
      continue;
    }
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (numbered) {
      if (list !== 'ol') {
        flush();
        list = 'ol';
      }
      items.push(html`<li>${inline(numbered[1])}</li>`);
      continue;
    }
    flush();
    if (!line.trim()) {
      out.push(html`<div class="gap"></div>`);
      continue;
    }
    const header = line.match(/^#{1,3}\s+(.*)$/) || line.match(/^\*\*([^*]+)\*\*$/);
    if (header) {
      out.push(html`<div class="hd">${inline(header[1])}</div>`);
      continue;
    }
    out.push(html`<div class="line">${inline(line)}</div>`);
  }
  flush();
  if (fence) out.push(html`<pre class="raw">${fence.join('\n')}</pre>`);
  return out;
};

export interface TurnViewState {
  doneActions: string[];
  spentActions: string[];
  spentTurn: string;
  highlightNodeId?: string;
  onSend: (e: Event, action: string, turn: string) => void;
  onTurnClick: (m: ChatMessage) => void;
}

export const turnView = (m: ChatMessage, s: TurnViewState): TemplateResult => {
  const role = turnRole(m);
  return html`<div
    class="turn ${role} ${m.alert ? 'alert' : ''} ${m.result ? 'result' : ''} ${m.nodeId ? 'linked' : ''} ${m.nodeId && m.nodeId === s.highlightNodeId ? 'hl' : ''}"
    data-node-id=${m.nodeId ?? nothing}
    title=${m.nodeId ? 'The note on the canvas this is about — click to point at it' : nothing}
    @click=${() => s.onTurnClick(m)}
  >${m.label ? html`<div class="note">${m.label}</div>` : nothing}${role === 'user'
    ? html`<user-response-bubble .text=${String(m.content ?? '')}></user-response-bubble>`
    : m.result
      ? html`<div class="body markdown-body">${unsafeHTML(renderMarkdown(String(m.content ?? '')))}</div>`
      : html`<div class="body">${actionSegments(String(m.content ?? ''), role === 'assistant').map((seg) => (seg.action !== undefined
          ? actionButton(seg.label, seg.action, String(m.content ?? ''), {
              doneActions: s.doneActions,
              spentActions: s.spentActions,
              spentTurn: s.spentTurn,
              onSend: s.onSend,
            })
          : richText(seg.text ?? '')))}</div>`}</div>`;
};
