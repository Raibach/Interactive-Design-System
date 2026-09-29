/** @type {import('@custom-elements-manifest/analyzer').Config} */
export default {
  // Explicit file list - only the Lit components in src/components/lit
  globs: [
    'src/components/lit/*.ts',
    'src/components/lit/**/*.ts',
  ],
  // Exclude everything else
  exclude: [
    '**/*.test.ts', 
    '**/*.spec.ts', 
    '**/*.stories.ts',
    '**/*.tsx',
    'src/**/*.tsx',
    'src/hooks/**',
    'src/lib/**',
    'src/pages/**',
    'src/services/**',
    'src/utils/**',
    'src/shared/**',
    'src/components/ui/**',
    'dist/**',
    'vite-plugin-figma-asset.ts',
    'src/App.tsx',
    'src/main.tsx',
    'src/components/lit-v2/**',
    'src/components/lit/canvas/**',
    'src/components/lit/prompt-input/**',
  ],
  // Output to custom-elements.json in project root
  outdir: '.',
  // Enable features
  plugins: [
    {
      name: 'exclude-private',
      analyzePhase({ ts, moduleDoc }) {
        // Remove private/internal declarations
        moduleDoc.declarations = moduleDoc.declarations?.filter(d => {
          return !d.name?.startsWith('_') && !d.jsDoc?.tags?.some(t => t.title === 'private');
        });
      }
    }
  ],
};