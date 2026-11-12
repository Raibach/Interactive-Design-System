/**
 * <posthog-prechat> — THE PRODUCT ANALYTICS WELCOME, IN THE UX TAB'S OWN CHAT.
 *
 * PostHog's own no-thread screen is `scenes/max` in the framed application: `Intro` draws the
 * headline and subtitle, `SidebarQuestionInputWithSuggestions` draws the topic buttons and the
 * preset cards, and `suggestionTopics.tsx` holds the words and prompts. That screen could not be
 * mounted in our seat because it is a React application inside an iframe. This file is the visible
 * welcome ported into a Lit view, with the same headline, topic names, card titles, descriptions,
 * prompts and colourful treatment.
 *
 * WHAT IT DOES NOT OWN. It draws no input and sends no network request. Choosing a card dispatches
 * one of two events to the UX view:
 *
 *   `ux-prechat-send`  a complete preset prompt, which the UX view sends through its own door;
 *   `ux-prechat-fill`  a fill-in prompt (the person completes it), which the UX view places in the
 *                      seat's own input and focuses.
 *
 * The UX view owns the thread, the conversation and the turn. This file owns the welcome only.
 */
import { LitElement, html, css, nothing } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

interface TopicSuggestion {
  content: string;
  title?: string;
  description?: string;
  requiresUserInput?: boolean;
  hint?: string;
  iconType?: string;
}

interface SuggestionTopic {
  key: string;
  label: string;
  color: string;
  variant?: 'cards' | 'docs';
  suggestions: TopicSuggestion[];
}

/**
 * One small line per topic, in the same simple stroke as the rest of the room. The body is
 * inserted as SVG markup, not as a nested HTML template: a nested template loses the SVG
 * namespace and its paths paint nothing.
 */
function topicGlyph(key: string) {
  const svg = (body: string) => html`<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${unsafeSVG(body)}</svg>`;
  switch (key) {
    case 'sql':
      return svg('<ellipse cx="8" cy="4" rx="5" ry="2"></ellipse><path d="M3 4v8c0 1.1 2.2 2 5 2s5-.9 5-2V4"></path>');
    case 'session_replay':
      return svg('<circle cx="8" cy="8" r="6"></circle><path d="M6.8 5.6l4 2.4-4 2.4z"></path>');
    case 'error_tracking':
      return svg('<path d="M8 2l6 12H2L8 2z"></path><path d="M8 6v4M8 12v.4"></path>');
    case 'feature_flags':
      return svg('<path d="M4 2v12M4 3h8l-1.5 3L12 9H4"></path>');
    case 'experiments':
      return svg('<path d="M6 2h4M7 2v5L3 13h10L9 7V2"></path>');
    case 'surveys':
      return svg('<path d="M3 3h10v8H8l-3 2v-2H3z"></path><path d="M6 7l1.5 1.5L10 5.5"></path>');
    case 'learn':
      return svg('<path d="M3 3h4a2 2 0 012 2v9a2 2 0 00-2-2H3zM13 3H9a2 2 0 00-2 2v9a2 2 0 012-2h4z"></path>');
    default:
      return svg('<path d="M3 13V8M8 13V3M13 13V6"></path>');
  }
}

/** The topics and prompts PostHog's homepage uses, copied from `suggestionTopics.tsx`. */
const TOPICS: SuggestionTopic[] = [
  {
    key: 'analytics',
    label: 'Analytics',
    color: '#2d6cdf',
    suggestions: [
      {
        title: 'Run a funnel analysis',
        description: 'Conversion and drop-off across the Pirate Metrics (AARRR)',
        content: 'Create a funnel of the Pirate Metrics (AARRR)',
      },
      {
        title: 'Check retention',
        description: 'How many users came back over the last two weeks',
        content: 'What is the retention in the last two weeks?',
      },
      {
        title: 'Find popular pages',
        description: 'Your most visited pages and screens',
        content: 'What are the most popular pages or screens?',
      },
      {
        title: 'See top referrers',
        description: 'Where your traffic is coming from',
        content: 'What are the top referring domains?',
      },
    ],
  },
  {
    key: 'sql',
    label: 'SQL',
    color: '#e85d2a',
    suggestions: [
      {
        title: 'Write a SQL query',
        description: 'Query any of your data with HogQL',
        content: 'Write an SQL query to',
        requiresUserInput: true,
        hint: 'type a question you have about your data',
      },
      {
        title: 'Explore your warehouse',
        description: 'Query your synced external data sources',
        content: 'Show me the tables available in my data warehouse',
      },
      {
        title: 'Find your top events',
        description: 'Your most frequent events this week',
        content: 'Write a SQL query for my most frequent events in the last 7 days',
      },
      {
        title: 'Count active users',
        description: 'Weekly active users with SQL',
        content: 'Write a SQL query to count my weekly active users',
      },
    ],
  },
  {
    key: 'session_replay',
    label: 'Session replay',
    color: '#16a085',
    suggestions: [
      {
        title: 'Find recordings',
        description: 'Filter replays by user or action',
        content: 'Find recordings for',
        requiresUserInput: true,
        hint: 'type a specific user or behavior you want to find recordings for',
      },
      {
        title: 'Summarize sessions',
        description: 'What happened across recent replays',
        content: 'Summarize recent session recordings and highlight anything notable',
      },
      {
        title: 'Spot friction',
        description: 'Rage-clicks, dead-clicks, and confusion',
        content: 'Find session replays showing common user pain points or confusion',
      },
      {
        title: 'Watch error sessions',
        description: 'Replays where users hit an error',
        content: 'Find session recordings where users ran into errors',
        iconType: 'error_tracking',
      },
    ],
  },
  {
    key: 'error_tracking',
    label: 'Error tracking',
    color: '#d64545',
    suggestions: [
      {
        title: 'Find impactful errors',
        description: 'The exceptions hitting the most users',
        content: 'What are the most impactful errors affecting my users right now?',
      },
      {
        title: 'Triage new issues',
        description: 'Errors first seen this week',
        content: 'Show me new error issues from the last 7 days',
      },
      {
        title: 'Explain an error',
        description: 'Likely cause and where it fires',
        content: 'Explain the most common error in my app and where it happens',
      },
      {
        title: 'See error replays',
        description: 'Watch sessions where users hit an error',
        content: 'Find session recordings where users ran into errors',
        iconType: 'session_replay',
      },
    ],
  },
  {
    key: 'feature_flags',
    label: 'Feature flags',
    color: '#7c5cfc',
    suggestions: [
      {
        title: 'Roll out a feature',
        description: 'Gradually release a feature behind a flag',
        content: 'Create a flag to gradually roll out',
        requiresUserInput: true,
        hint: "type the feature you're launching",
      },
      {
        title: 'Create a multivariate flag',
        description: 'Test several variants of a feature',
        content: 'Create a multivariate flag for',
        requiresUserInput: true,
        hint: "type the feature you're testing",
      },
      {
        title: 'Audit your flags',
        description: 'Find stale or risky feature flags',
        content: 'Audit my feature flags for issues',
      },
      {
        title: 'Review flag usage',
        description: 'Which flags are still being evaluated',
        content: 'Which of my feature flags are still being evaluated?',
      },
    ],
  },
  {
    key: 'experiments',
    label: 'Experiments',
    color: '#c58a00',
    suggestions: [
      {
        title: 'Design an A/B test',
        description: 'Set up an experiment to test a change',
        content: 'Create an experiment to test',
        requiresUserInput: true,
        hint: 'type a change you have in mind',
      },
      {
        title: 'Review a running test',
        description: 'Check your experiments are set up correctly',
        content: 'Check if my running experiments are set up correctly',
      },
      {
        title: 'Interpret results',
        description: 'Significance and what to do next',
        content: 'Summarize the results of my most recent experiment and what to do next',
      },
      {
        title: 'Size an experiment',
        description: 'How long it needs to run for significance',
        content: 'How long should my experiment run to reach significance?',
      },
    ],
  },
  {
    key: 'surveys',
    label: 'Surveys',
    color: '#d9468f',
    suggestions: [
      {
        title: 'Launch an NPS survey',
        description: 'Collect Net Promoter Score from your users',
        content: 'Create a survey to collect NPS responses from users',
      },
      {
        title: 'Run a CSAT survey',
        description: 'Measure customer satisfaction',
        content: 'Create a survey to collect CSAT responses from users',
      },
      {
        title: 'Measure product-market fit',
        description: 'Ask how users would feel without your product',
        content: 'Create a survey to measure product market fit',
      },
      {
        title: 'Analyze survey responses',
        description: 'Surface themes to prioritize what to build',
        content: 'Analyze survey responses to prioritize key features our users are interested in',
      },
    ],
  },
  {
    key: 'learn',
    label: 'Learn',
    color: '#5b6b7f',
    variant: 'docs',
    suggestions: [
      {
        title: 'Create a feature flag',
        description: 'How flags work and how to set one up',
        content: 'How can I create a feature flag?',
      },
      {
        title: 'Watch session replays',
        description: 'Where to find recordings of real user sessions',
        content: 'Where do I watch session replays?',
      },
      {
        title: 'Set up an experiment',
        description: 'Get help configuring your first A/B test',
        content: 'Help me set up an experiment',
      },
      {
        title: 'Understand autocapture',
        description: 'What events PostHog collects automatically',
        content: 'Explain autocapture',
      },
      {
        title: 'Capture exceptions',
        description: 'Send errors to error tracking',
        content: 'How can I capture an exception?',
      },
    ],
  },
];

export class PostHogPrechat extends LitElement {
  static properties = {
    selected: { type: String, state: true },
  };

  declare selected: string;

  constructor() {
    super();
    this.selected = 'analytics';
  }

  private _choose(suggestion: TopicSuggestion): void {
    const detail = { prompt: suggestion.content, hint: suggestion.hint ?? '' };
    this.dispatchEvent(
      new CustomEvent(suggestion.requiresUserInput ? 'ux-prechat-fill' : 'ux-prechat-send', {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
      min-height: 0;
      width: 100%;
      color: #1c2f4e;
      font: 14px/1.45 'IBM Plex Sans', system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    .wrap {
      height: 100%;
      min-height: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 6px 4px 16px;
    }
    .mark {
      width: 30px;
      height: 30px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      color: #fff;
      background: linear-gradient(135deg, #f7a501 0%, #f54e00 52%, #2d6cdf 100%);
      box-shadow: 0 3px 10px rgba(245, 78, 0, 0.22);
      flex: 0 0 auto;
    }
    .mark svg { width: 17px; height: 17px; }
    h2 {
      margin: 0;
      text-align: center;
      font-size: 21px;
      line-height: 1.2;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: #1c2f4e;
      max-width: 440px;
    }
    .sub {
      margin: -2px 0 0;
      text-align: center;
      font-size: 12px;
      font-style: italic;
      color: rgba(28, 47, 78, 0.62);
    }
    .notice {
      margin: 0;
      text-align: center;
      font-size: 10px;
      line-height: 1.35;
      color: rgba(28, 47, 78, 0.46);
      max-width: 480px;
    }
    .topics {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px;
      max-width: 560px;
      padding-top: 2px;
    }
    .topic {
      appearance: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid rgba(28, 47, 78, 0.13);
      background: rgba(255, 255, 255, 0.76);
      color: #1c2f4e;
      border-radius: 999px;
      padding: 5px 10px 5px 7px;
      font: inherit;
      font-size: 12px;
      line-height: 1;
      cursor: pointer;
      transition: border-color 150ms ease, background 150ms ease, box-shadow 150ms ease;
    }
    .topic:hover {
      border-color: color-mix(in srgb, var(--topic-color) 45%, transparent);
      background: color-mix(in srgb, var(--topic-color) 7%, #fff);
    }
    .topic[aria-pressed="true"] {
      border-color: color-mix(in srgb, var(--topic-color) 55%, transparent);
      background: color-mix(in srgb, var(--topic-color) 10%, #fff);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--topic-color) 12%, transparent);
    }
    .topic svg {
      width: 15px;
      height: 15px;
      color: var(--topic-color);
      flex: 0 0 auto;
    }
    .cards {
      width: 100%;
      max-width: 620px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 7px;
      padding-top: 2px;
    }
    .card {
      appearance: none;
      display: flex;
      align-items: flex-start;
      gap: 9px;
      text-align: left;
      min-width: 0;
      padding: 10px 11px;
      border: 1px solid rgba(28, 47, 78, 0.1);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.62);
      color: inherit;
      font: inherit;
      cursor: pointer;
      transition: border-color 150ms ease, background 150ms ease, box-shadow 150ms ease;
    }
    .card:hover {
      border-color: color-mix(in srgb, var(--topic-color) 42%, transparent);
      background: color-mix(in srgb, var(--topic-color) 5%, #fff);
      box-shadow: 0 3px 12px rgba(28, 47, 78, 0.08);
    }
    .card-icon {
      width: 24px;
      height: 24px;
      border-radius: 7px;
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      color: var(--topic-color);
      background: color-mix(in srgb, var(--topic-color) 11%, #fff);
    }
    .card-icon svg { width: 15px; height: 15px; }
    .card-copy {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }
    .card-title {
      font-size: 12.5px;
      font-weight: 650;
      line-height: 1.25;
      color: #1c2f4e;
    }
    .card-desc {
      font-size: 11px;
      line-height: 1.3;
      color: rgba(28, 47, 78, 0.58);
    }
    .docs {
      width: 100%;
      max-width: 620px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-top: 2px;
    }
    .doc {
      appearance: none;
      width: 100%;
      text-align: left;
      padding: 8px 10px;
      border: 1px solid transparent;
      border-radius: 8px;
      background: transparent;
      color: rgba(28, 47, 78, 0.8);
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .doc:hover {
      border-color: color-mix(in srgb, var(--topic-color) 30%, transparent);
      background: color-mix(in srgb, var(--topic-color) 5%, #fff);
      color: #1c2f4e;
    }
    @media (max-width: 540px) {
      h2 { font-size: 18px; }
      .cards { grid-template-columns: minmax(0, 1fr); }
    }
  `;

  render() {
    const topic = TOPICS.find((t) => t.key === this.selected) ?? null;
    return html`
      <div class="wrap">
        <span class="mark" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 2.2l1.6 3.4 3.7.5-2.7 2.6.7 3.7L8 10.6l-3.3 1.8.7-3.7-2.7-2.6 3.7-.5z"></path>
          </svg>
        </span>
        <h2>How can I help you understand users?</h2>
        <p class="sub">Build something people want.</p>
        <p class="notice">PostHog AI can make mistakes. Check important information.</p>

        <div class="topics" role="group" aria-label="Topics">
          ${TOPICS.map(
            (t) => html`
              <button
                type="button"
                class="topic"
                style=${`--topic-color:${t.color}`}
                aria-pressed=${this.selected === t.key ? 'true' : 'false'}
                @click=${() => { this.selected = this.selected === t.key ? '' : t.key; }}
              >
                ${topicGlyph(t.key)}
                <span>${t.label}</span>
              </button>
            `,
          )}
        </div>

        ${topic
          ? topic.variant === 'docs'
            ? html`<div class="docs" style=${`--topic-color:${topic.color}`}>
                ${topic.suggestions.map(
                  (s) => html`<button type="button" class="doc" @click=${() => this._choose(s)}>${s.content}</button>`,
                )}
              </div>`
            : html`<div class="cards" style=${`--topic-color:${topic.color}`}>
                ${topic.suggestions.map(
                  (s) => html`
                    <button type="button" class="card" @click=${() => this._choose(s)}>
                      <span class="card-icon">${topicGlyph(s.iconType ?? topic.key)}</span>
                      <span class="card-copy">
                        <span class="card-title">${s.title ?? s.content}</span>
                        ${s.description ? html`<span class="card-desc">${s.description}</span>` : nothing}
                      </span>
                    </button>
                  `,
                )}
              </div>`
          : nothing}
      </div>
    `;
  }
}

if (!customElements.get('posthog-prechat')) {
  customElements.define('posthog-prechat', PostHogPrechat);
}

declare global {
  interface HTMLElementTagNameMap {
    'posthog-prechat': PostHogPrechat;
  }
}
