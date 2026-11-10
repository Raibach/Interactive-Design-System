import { describe, expect, it } from 'vitest';
import { formatToolInventory } from './tool-inventory';

describe('the Tools greeting inventory', () => {
  it('names an available tool from data', () => {
    expect(formatToolInventory([{ label: 'Figma ingest', status: 'available' }]))
      .toBe('Figma ingest');
  });

  it('adds a tool by adding an entry, and carries its status', () => {
    expect(formatToolInventory([
      { label: 'Figma ingest', status: 'available' },
      { label: 'Flow mapper', status: 'not built' },
    ])).toBe('Figma ingest; Flow mapper (not built)');
  });

  it('says when the inventory is empty instead of inventing one', () => {
    expect(formatToolInventory([])).toBe('no tool is available yet');
  });
});
