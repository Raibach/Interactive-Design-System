import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Storybook 10 configuration — restored 2026-08-25.
 *
 * The original .storybook/ directory was lost to an AI session; the
 * documentation layer under src/storybook/ survived and is consumed by
 * the in-app doc viewer (storybookDocLoader). Stories live beside their
 * components as *.stories.tsx.
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: [
    '@storybook/addon-onboarding',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-designs',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
  },
};

export default config;
