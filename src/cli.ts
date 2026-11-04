import { Command, Option } from 'commander';
import { createLogger } from './utils/logger';
import type { CliOptions } from './types';
import { runTransform } from './runner';
import { checkGitStatus } from './utils/git-safety';
import {
  getTransform,
  AVAILABLE_TRANSFORMS,
} from './transforms';

const program = new Command();

program
  .name('@suites/codemod')
  .description('Code transformation tool for the Suites testing framework')
  .version('0.1.0', '-v, --version', 'Output the current version')
  .helpOption('-h, --help', 'Display help message')
  .argument(
    '[codemod]',
    'Codemod slug to run. See "https://github.com/suites-dev/suites-unit-codemod".'
  )
  .argument('[source]', 'Path to source files or directory to transform including glob patterns.', '.')
  .option('-d, --dry', 'Dry run (no changes are made to files)', false)
  .option('-f, --force', 'Bypass Git safety checks and forcibly run codemods', false)
  .option('-p, --print', 'Print transformed files to stdout, useful for development', false)
  .option('--verbose', 'Show more information about the transform process', false)
  .option('--parser <parser>', 'Parser to use (tsx, ts, babel)', 'tsx')
  .addOption(new Option('--doubles <adapter>', 'Suites v4 doubles adapter').choices(['jest', 'vitest']))
  .addOption(new Option('--di <adapter>', 'Suites v4 dependency injection adapter').choices(['nestjs', 'inversify']))
  .option('--allow-critical-errors', 'Allow writes even when critical validation errors are present', false)
  .action(
    async (
      codemodArg: string | undefined,
      sourceArg: string | undefined,
      options: CliOptions
    ) => {
      const logger = createLogger(options.verbose);

      // Validate codemod is provided
      if (!codemodArg) {
        logger.error('Codemod argument required.');
        logger.info('\nAvailable codemods:');
        AVAILABLE_TRANSFORMS.forEach((t) => {
          console.log(`  ${t.name}`);
          console.log(`    ${t.description}\n`);
        });
        logger.info('Example usage:');
        logger.info(`  npx @suites/codemod ${AVAILABLE_TRANSFORMS[0].name} ./src`);
        process.exit(1);
      }

      const codemodName = codemodArg;
      const sourcePath = sourceArg || '.';

      const transformInfo = getTransform(codemodName);
      if (!transformInfo) {
        logger.error(`Unknown codemod: ${codemodName}`);
        logger.info('\nAvailable codemods:');
        AVAILABLE_TRANSFORMS.forEach((t) => {
          console.log(`  ${t.name}`);
          console.log(`    ${t.description}\n`);
        });
        process.exit(1);
      }

      try {
        // Git safety check (unless in dry or force mode)
        if (!options.dry && !options.force) {
          checkGitStatus(logger);
        }

        // Show header with dynamic transform name
        logger.section(`🔄 Suites Codemod - ${transformInfo.description}`);

        if (options.dry) {
          logger.info('Running in dry mode (no changes are made to files)');
        }

        if (options.force && !options.dry) {
          logger.warn('Bypassing git safety checks (--force enabled)');
        }

        logger.newline();

        // Run the transformation
        const summary = await runTransform(sourcePath, transformInfo, options, logger);
        if (summary.errors > 0) process.exitCode = 1;
      } catch (error) {
        logger.newline();
        logger.error('Transformation failed:');
        logger.error((error as Error).message);

        if (options.verbose && (error as Error).stack) {
          logger.debug((error as Error).stack!);
        }

        process.exit(1);
      }
    }
  );

// Parse arguments
program.parse();
