import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import path from 'node:path';

export { Contract, ledger, type Ledger } from './managed/shadow-vault/contract/index.js';
import { Contract } from './managed/shadow-vault/contract/index.js';

const currentDir = path.resolve(new URL(import.meta.url).pathname, '..');
export const zkConfigPath = path.resolve(currentDir, 'managed', 'shadow-vault');

export const CompiledShadowVault = CompiledContract.make(
  'ShadowVault',
  Contract,
).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);
