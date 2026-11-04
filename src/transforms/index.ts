/**
 * Transform Registry
 *
 * Central registry for all available codemods.
 * Follows Codemod Registry pattern: <framework>/<version>/<transform>
 * Examples: automock/2/to-suites-v3, jest/28/to-v29
 */

export interface TransformInfo {
  /** Unique identifier for the transform (e.g., 'automock/2/to-suites-v3') */
  name: string;
  /** Human-readable description of what the transform does */
  description: string;
  /** Relative path to the transform module */
  path: string;
}

/**
 * Registry of all available transforms.
 * Add new transforms here as they are created.
 */
export const AVAILABLE_TRANSFORMS: TransformInfo[] = [
  {
    name: 'automock/2/to-suites-v3',
    description: 'Migrate from Automock v2 to Suites v3 unit testing framework',
    path: './transforms/automock/2/to-suites-v3',
  },
  {
    name: 'suites/3/to-suites-v4',
    description: 'Migrate Suites v3 source and type references to Suites v4',
    path: './transforms/suites/3/to-suites-v4',
  },
];

/**
 * Get transform info by name
 * @param name Transform name (e.g., 'automock/2/to-suites-v3')
 * @returns Transform info or null if not found
 */
export function getTransform(name: string): TransformInfo | null {
  return AVAILABLE_TRANSFORMS.find((t) => t.name === name) || null;
}

/**
 * Check if a transform name is valid
 * @param name Transform name to check
 * @returns True if the transform exists
 */
export function isValidTransform(name: string): boolean {
  return AVAILABLE_TRANSFORMS.some((t) => t.name === name);
}
