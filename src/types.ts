import type { Collection, JSCodeshift } from 'jscodeshift';

/**
 * CLI options
 */
export interface CliOptions {
  dry: boolean;
  force: boolean;
  parser: string;
  print: boolean;
  verbose: boolean;
  allowCriticalErrors: boolean;
  doubles?: 'jest' | 'vitest';
  di?: 'nestjs' | 'inversify';
}

/**
 * File transformation result
 */
export interface TransformResult {
  filePath: string;
  transformed: boolean;
  changes: string[];
  warnings: string[];
  errors: string[];
}

/**
 * Analysis context for a file
 */
export interface AnalysisContext {
  isSuitesContext: boolean;
  needsMockedImport: boolean;
  needsUnitReferenceImport: boolean;
  retrievedDependencies: Set<string>;
  stubUsages: Map<string, boolean>;
  mockConfigurations: Map<string, boolean>;
}

/**
 * Mock configuration strategy
 */
export type MockStrategy = 'impl' | 'final';

/**
 * Mock configuration details
 */
export interface MockConfiguration {
  dependency: string;
  strategy: MockStrategy;
  recommendedStrategy: MockStrategy;
  hasStubs: boolean;
  isRetrieved: boolean;
  isAmbiguous: boolean;
}

/**
 * Transformer function signature
 */
export type Transformer = (
  j: JSCodeshift,
  root: Collection,
  context: AnalysisContext
) => void;

/**
 * Analyzer function signature
 */
export type Analyzer = (source: string) => Partial<AnalysisContext>;

/**
 * Validation error severity levels
 */
export type ValidationSeverity = 'error' | 'warning' | 'critical';

/**
 * Individual validation error
 */
export interface ValidationError {
  rule: string;
  message: string;
  severity: ValidationSeverity;
  line?: number;
  column?: number;
}

/**
 * Validation result with detailed errors
 */
export interface ValidationResult {
  success: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  criticalErrors: ValidationError[];
}

/**
 * Transform output including code and validation
 */
export interface TransformOutput {
  code: string;
  validation: ValidationResult;
}

/**
 * Migration summary statistics
 */
export interface MigrationSummary {
  filesProcessed: number;
  filesTransformed: number;
  filesSkipped: number;
  errors: number;
}
