import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';
import { A2UISurfaceContainer } from './A2UISurfaceContainer';
import { eventBus } from '@/shared/event-bus';

/**
 * The A2UI surface container is the zero-executable-code output window:
 * AI commands arrive over the event bus, pass tag-registry validation,
 * and render declaratively. These stories exercise that real pipeline —
 * no mocked internals.
 */
const meta: Meta<typeof A2UISurfaceContainer> = {
  title: 'A2UI/Surface Container',
  component: A2UISurfaceContainer,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    column: {
      control: 'radio',
      options: ['left', 'middle'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof A2UISurfaceContainer>;

const DEMO_SESSION = 'storybook-demo';

export const EmptySurface: Story = {
  args: {
    sessionId: DEMO_SESSION,
    column: 'middle',
  },
};

/**
 * Emits genuine AiCommands over the event bus — set-text plus a
 * declarative add-button whose action dispatches `a2ui:action` on click
 * (never eval'd code, per the protocol posture).
 */
const CommandEmitter = () => {
  useEffect(() => {
    const ts = () => new Date().toISOString();
    eventBus.emit({
      sessionId: DEMO_SESSION,
      command: 'set-text',
      tag: 'set-text',
      props: { content: 'Compiled output assembled by the AI surface.' },
      timestamp: ts(),
    });
    eventBus.emit({
      sessionId: DEMO_SESSION,
      command: 'add-button',
      tag: 'add-button',
      props: { label: 'Run compiled prompt', action: 'run-compiled-prompt' },
      timestamp: ts(),
    });
  }, []);

  return <A2UISurfaceContainer sessionId={DEMO_SESSION} column="middle" />;
};

export const DeclarativeCommands: Story = {
  render: () => <CommandEmitter />,
};
