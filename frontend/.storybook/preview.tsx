import type { Preview, Decorator } from '@storybook/react-vite';
import '../src/index.css';

/** Render stories against a dark workspace backdrop consistent with the app shell. */
const withWorkspaceTheme: Decorator = (Story) => (
  <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
    <Story />
  </div>
);

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: { disable: true },
  },
  decorators: [withWorkspaceTheme],
};

export default preview;
