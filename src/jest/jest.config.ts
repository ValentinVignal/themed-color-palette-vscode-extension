import type { Config } from '@jest/types';

// Or async function
export default async (): Promise<Config.InitialOptions> => {
  return {
    restoreMocks: true,
    verbose: true,
    collectCoverage: true,
    reporters: ['default'],
    testRegex: '.test.ts$',
  };
};
