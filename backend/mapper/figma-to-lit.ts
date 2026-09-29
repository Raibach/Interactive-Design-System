/**
 * Figma → Lit Component Mapper (Two-Pass Pipeline)
 * 
 * Tag Naming Convention: f-{figmaIdWithColonAsHyphen}
 * Example: componentId "40001177:2458" → tag "f-40001177-2458"
 * 
 * This is the DEFINITIVE tag convention. Do NOT use toKebab(name) or any
 * semantic naming. The tag is a deterministic transform of the Figma ID.
 */

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  strokeWeight?: number;
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  effects?: FigmaEffect[];
  absoluteBoundingBox?: FigmaRect;
  layoutMode?: "NONE" | "HORIZONTAL" | "VERTICAL" | "GRID";
  primaryAxisSizingMode?: "AUTO" | "FIXED";
  counterAxisSizingMode?: "AUTO" | "FIXED";
  primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAxisAlignItems?: "MIN" | "CENTER" | "MAX";
  itemSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  counterAxisSpacing?: number;
  characters?: string;
  style?: FigmaTextStyle;
  characterStyleOverrides?: number[];
  styleOverrideTable?: Record<string, FigmaTextStyle>;
  componentId?: string;
  mainComponent?: FigmaNode;
}

export interface FigmaPaint {
  type: "SOLID" | "GRADIENT_LINEAR" | "GRADIENT_RADIAL" | "GRADIENT_ANGULAR" | "GRADIENT_DIAMOND" | "IMAGE" | "EMOJI";
  color?: { r: number; g: number; b: number; a?: number };
  opacity?: number;
  visible?: boolean;
}

export interface FigmaEffect {
  type: "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";
  color?: { r: number; g: number; b: number; a?: number };
  offset?: { x: number; y: number };
  radius?: number;
  spread?: number;
  visible?: boolean;
}

export interface FigmaRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigmaTextStyle {
  fontFamily?: string;
  fontWeight?: number;
  fontSize?: number;
  lineHeight?: { value: number; unit: "PIXELS" | "PERCENT" | "INTRINSIC" };
  letterSpacing?: { value: number; unit: "PIXELS" | "PERCENT" };
  textCase?: "NONE" | "UPPER" | "LOWER" | "TITLE";
  textDecoration?: "NONE" | "UNDERLINE" | "STRIKETHROUGH";
  textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  textAlignVertical?: "TOP" | "CENTER" | "BOTTOM";
}

export interface LitComponent {
  tag: string;
  className: string;
  extends: string | null;
  properties: LitProperty[];
  styles: string;
  template: string;
  imports: string[];
  instanceRefs: InstanceRef[];
}

export interface LitProperty {
  name: string;
  type: string;
  attribute?: string;
  reflect?: boolean;
  default?: string;
}

export interface InstanceRef {
  tag: string;
  slot?: string;
  properties?: Record<string, string>;
}

/**
 * THE DEFINITIVE TAG NAMING FUNCTION
 * 
 * Rule: f-{figmaIdWithColonAsHyphen}
 * 
 * Examples:
 *   "40001177:2458"  → "f-40001177-2458"
 *   "123:456"        → "f-123-456"
 *   "abc:def"        → "f-abc-def"
 * 
 * This satisfies HTML custom element constraints:
 * - Starts with letter (f)
 * - Contains hyphen (required for custom elements)
 * - No colons (invalid in tag names)
 * - Deterministic from Figma ID
 */
export function idToTag(figmaId: string): string {
  return `f-${figmaId.replace(":", "-")}`;
}

/**
 * Extract componentId from a Figma node (for instances)
 * Returns the componentId if this is an instance, null otherwise
 */
export function getComponentId(node: FigmaNode): string | null {
  return node.componentId || null;
}

/**
 * Map a Figma node to a Lit component definition
 * This is the core mapping function used in both passes
 */
export function mapFigmaNodeToLit(node: FigmaNode, context?: { isFrame?: boolean }): LitComponent {
  const tag = idToTag(node.id);
  const className = toPascalCase(node.name) || "Component";
  
  // Determine base class
  const extendsClass = inferBaseClass(node);
  
  // Extract properties from Figma node
  const properties = extractProperties(node);
  
  // Generate styles from Figma styling
  const styles = generateStyles(node);
  
  // Generate template from children
  const { template, instanceRefs, imports } = generateTemplate(node);
  
  return {
    tag,
    className,
    extends: extendsClass,
    properties,
    styles,
    template,
    imports,
    instanceRefs,
  };
}

/**
 * Pass 1: Process all components from Figma file
 * Returns a map of componentId → LitComponent
 */
export function mapComponentsPass(components: Record<string, FigmaNode>): Map<string, LitComponent> {
  const result = new Map<string, LitComponent>();
  
  for (const [componentId, node] of Object.entries(components)) {
    const litComponent = mapFigmaNodeToLit(node);
    result.set(componentId, litComponent);
  }
  
  return result;
}

/**
 * Pass 2: Process the target frame, resolving instance references
 * Uses the component map from Pass 1 to generate correct instance tags
 */
export function mapFramePass(
  frameNode: FigmaNode,
  componentMap: Map<string, LitComponent>
): LitComponent {
  // First map the frame itself
  const frameComponent = mapFigmaNodeToLit(frameNode, { isFrame: true });
  
  // Then resolve instance references in the frame's template
  // This is handled in generateTemplate which uses componentMap
  
  return frameComponent;
}

/**
 * Convert LitComponent to TypeScript source code
 */
export function litComponentToTs(component: LitComponent): string {
  const imports = [
    ...component.imports,
    `import { LitElement, html, css, property, customElement } from 'lit';`,
    `import { ${component.extends || "LitElement"} } from 'lit';`,
  ].filter((imp, i, arr) => arr.indexOf(imp) === i);
  
  const propertiesCode = component.properties
    .map(p => {
      const decorators = [
        `@property({ type: ${p.type} ${p.attribute ? `, attribute: "${p.attribute}"` : ""} ${p.reflect ? ", reflect: true" : ""} ${p.default ? `, default: ${p.default}` : ""} })`,
      ].join("\n  ");
      return `  ${decorators}\n  ${p.name}!: ${p.type};`;
    })
    .join("\n\n");
  
  const stylesCode = component.styles
    ? `@customElement('${component.tag}')\n${component.styles}`
    : `@customElement('${component.tag}')\n  static styles = css\`\`;`;
  
  return `// Auto-generated from Figma node: ${component.tag}
// DO NOT EDIT MANUALLY — changes will be overwritten on re-ingest

${imports.join("\n")}

${stylesCode}
export class ${component.className} extends ${component.extends || "LitElement"} {
${propertiesCode}

  render() {
    return html\`${component.template}\`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    '${component.tag}': ${component.className};
  }
}
`;
}

/**
 * Write component to file system
 */
export async function writeLitComponent(component: LitComponent, outputDir: string): Promise<string> {
  const fs = await import("fs");
  const path = await import("path");
  
  const fileName = `${component.tag}.ts`;
  const filePath = path.join(outputDir, fileName);
  
  // Ensure directory exists
  fs.mkdirSync(outputDir, { recursive: true });
  
  const tsContent = litComponentToTs(component);
  fs.writeFileSync(filePath, tsContent, "utf-8");
  
  return filePath;
}

// ============================================
// INTERNAL HELPERS
// ============================================

function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

function inferBaseClass(node: FigmaNode): string | null {
  // Button-like things
  if (node.name.toLowerCase().includes("button") || 
      (node.type === "INSTANCE" && node.name.toLowerCase().includes("button"))) {
    return "LitElement"; // Could extend a base Button class if we have one
  }
  
  // Input-like things
  if (node.name.toLowerCase().includes("input") || 
      node.name.toLowerCase().includes("field") ||
      node.name.toLowerCase().includes("textarea")) {
    return "LitElement";
  }
  
  // Link-like
  if (node.name.toLowerCase().includes("link") || 
      node.name.toLowerCase().includes("anchor")) {
    return "LitElement";
  }
  
  return "LitElement";
}

function extractProperties(node: FigmaNode): LitProperty[] {
  const props: LitProperty[] = [];
  
  // Common properties from Figma
  if (node.type === "TEXT" && node.characters) {
    props.push({
      name: "content",
      type: "String",
      attribute: "content",
      default: `""`,
    });
  }
  
  // Variant props from component properties
  // Figma component properties would be in node.componentPropertyDefinitions
  // For now, we extract basic visual props
  
  // Disabled state (common pattern)
  props.push({
    name: "disabled",
    type: "Boolean",
    attribute: "disabled",
    reflect: true,
    default: "false",
  });
  
  return props;
}

function generateStyles(node: FigmaNode): string {
  const rules: string[] = [];
  
  // Host display
  rules.push(":host { display: block; }");
  
  // Dimensions from absoluteBoundingBox
  if (node.absoluteBoundingBox) {
    const box = node.absoluteBoundingBox;
    rules.push(`:host { width: ${box.width}px; height: ${box.height}px; }`);
  }
  
  // Background/fills
  if (node.fills && node.fills.length > 0) {
    const fill = node.fills[0];
    if (fill.type === "SOLID" && fill.color) {
      const { r, g, b, a = 1 } = fill.color;
      const opacity = fill.opacity !== undefined ? fill.opacity : a;
      rules.push(`:host { background: rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${opacity}); }`);
    }
  }
  
  // Border/strokes
  if (node.strokes && node.strokes.length > 0) {
    const stroke = node.strokes[0];
    if (stroke.type === "SOLID" && stroke.color) {
      const { r, g, b, a = 1 } = stroke.color;
      const weight = node.strokeWeight || 1;
      const opacity = stroke.opacity !== undefined ? stroke.opacity : a;
      rules.push(`:host { border: ${weight}px solid rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${opacity}); }`);
    }
  }
  
  // Border radius
  if (node.cornerRadius !== undefined && node.cornerRadius > 0) {
    rules.push(`:host { border-radius: ${node.cornerRadius}px; }`);
  } else if (node.rectangleCornerRadii && node.rectangleCornerRadii.length === 4) {
    const [tl, tr, br, bl] = node.rectangleCornerRadii;
    rules.push(`:host { border-radius: ${tl}px ${tr}px ${br}px ${bl}px; }`);
  }
  
  // Effects (shadows)
  if (node.effects && node.effects.length > 0) {
    const shadows = node.effects
      .filter(e => e.visible !== false && (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW"))
      .map(e => {
        const offset = e.offset || { x: 0, y: 0 };
        const radius = e.radius || 0;
        const spread = e.spread || 0;
        const color = e.color ? `rgba(${Math.round(e.color.r * 255)}, ${Math.round(e.color.g * 255)}, ${Math.round(e.color.b * 255)}, ${e.color.a || 1})` : "rgba(0,0,0,0.25)";
        const inset = e.type === "INNER_SHADOW" ? "inset " : "";
        return `${inset}${offset.x}px ${offset.y}px ${radius}px ${spread}px ${color}`;
      })
      .join(", ");
    
    if (shadows) {
      rules.push(`:host { box-shadow: ${shadows}; }`);
    }
  }
  
  // Layout (flex/grid from auto-layout)
  if (node.layoutMode && node.layoutMode !== "NONE") {
    const direction = node.layoutMode === "HORIZONTAL" ? "row" : "column";
    rules.push(`:host { display: flex; flex-direction: ${direction}; }`);
    
    if (node.itemSpacing !== undefined) {
      rules.push(`:host { gap: ${node.itemSpacing}px; }`);
    }
    
    if (node.paddingLeft !== undefined || node.paddingRight !== undefined || 
        node.paddingTop !== undefined || node.paddingBottom !== undefined) {
      const pl = node.paddingLeft || 0;
      const pr = node.paddingRight || 0;
      const pt = node.paddingTop || 0;
      const pb = node.paddingBottom || 0;
      rules.push(`:host { padding: ${pt}px ${pr}px ${pb}px ${pl}px; }`);
    }
    
    // Alignment
    const alignMap: Record<string, string> = {
      "MIN": "flex-start",
      "CENTER": "center",
      "MAX": "flex-end",
      "SPACE_BETWEEN": "space-between",
    };
    if (node.primaryAxisAlignItems && alignMap[node.primaryAxisAlignItems]) {
      rules.push(`:host { justify-content: ${alignMap[node.primaryAxisAlignItems]}; }`);
    }
    if (node.counterAxisAlignItems && alignMap[node.counterAxisAlignItems]) {
      rules.push(`:host { align-items: ${alignMap[node.counterAxisAlignItems]}; }`);
    }
  }
  
  return `  static styles = css\`
${rules.map(r => `    ${r}`).join("\n")}
  \`;`;
}

function generateTemplate(node: FigmaNode): { template: string; instanceRefs: InstanceRef[]; imports: string[] } {
  const instanceRefs: InstanceRef[] = [];
  const imports: string[] = [];
  let template = "";
  
  // Handle text nodes
  if (node.type === "TEXT" && node.characters) {
    template = `\${this.content || "${escapeHtml(node.characters)}"}`;
    return { template, instanceRefs, imports };
  }
  
  // Handle instance nodes (component instances)
  if (node.type === "INSTANCE" && node.componentId) {
    const instanceTag = idToTag(node.componentId);
    instanceRefs.push({ tag: instanceTag });
    imports.push(instanceTag); // Track for potential dynamic import
    template = `<${instanceTag}></${instanceTag}>`;
    return { template, instanceRefs, imports };
  }
  
  // Handle container nodes with children
  if (node.children && node.children.length > 0) {
    const childTemplates = node.children.map(child => {
      const childResult = generateTemplate(child);
      instanceRefs.push(...childResult.instanceRefs);
      imports.push(...childResult.imports);
      return childResult.template;
    }).filter(Boolean);
    
    if (childTemplates.length > 0) {
      template = childTemplates.join("\n");
    }
  }
  
  // Default: slot for light DOM
  if (!template) {
    template = "<slot></slot>";
  }
  
  return { template, instanceRefs, imports };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """)
    .replace(/'/g, "&#039;");
}