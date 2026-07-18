import { WebSocket } from 'ws';
import { firstValueFrom } from 'rxjs';
import { filter, timeout as rxTimeout } from 'rxjs/operators';
import pino from 'pino';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { type EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';
import { UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { fromHex } from '@midnight-ntwrk/midnight-js-utils';
import { getConfig } from './config.js';
import { MidnightWalletProvider } from './wallet.js';
import { buildProviders } from './providers.js';
import { CompiledShadowVault, zkConfigPath } from './contract.js';

(globalThis as any).WebSocket = WebSocket;

const logger = pino({ level: 'warn', transport: { target: 'pino-pretty' } });
const config = getConfig();
setNetworkId(config.networkId);

const CONTRACT_ADDRESS = process.env['CONTRACT_ADDRESS'];
if (!CONTRACT_ADDRESS) throw new Error('Set CONTRACT_ADDRESS');
const AMOUNT = BigInt(process.env['AMOUNT'] || '10');
const SEED = process.env['MIDNIGHT_SEED'] ?? '0000000000000000000000000000000000000000000000000000000000000001';

const env: EnvironmentConfiguration = {
  walletNetworkId: config.networkId,
  networkId: config.networkId,
  indexer: config.indexer,
  indexerWS: config.indexerWS,
  node: config.node,
  nodeWS: config.nodeWS,
  faucet: config.faucet,
  proofServer: config.proofServer,
};

const wallet = await MidnightWalletProvider.build(logger, env, { kind: 'seed', value: SEED });
await wallet.start();
const state = await firstValueFrom(wallet.wallet.state());

// Register DUST if needed
const nightRaw = unshieldedToken().raw;
const unregistered = state.unshielded.availableCoins.filter(
  (coin: any) => coin.utxo.type === nightRaw && coin.meta.registeredForDustGeneration === false,
);
if (unregistered.length > 0) {
  const recipe = await wallet.wallet.registerNightUtxosForDustGeneration(
    unregistered,
    wallet.unshieldedKeystore.getPublicKey(),
    (p: Uint8Array) => wallet.unshieldedKeystore.signData(p),
  );
  await wallet.wallet.submitTransaction(await wallet.wallet.finalizeRecipe(recipe));
}

const providers = buildProviders(wallet, zkConfigPath, config);

// Build recipient address from wallet state
const addr = state.unshielded.address;
const recipient = { bytes: addr.bytes ?? addr.data ?? addr };

try {
  await submitCallTx(providers, {
    compiledContract: CompiledShadowVault,
    contractAddress: CONTRACT_ADDRESS,
    privateStateId: 'shadowvault',
    circuitId: 'withdraw',
    args: [recipient, AMOUNT],
  });
  
  // Get new balance
  const afterState = await firstValueFrom(wallet.wallet.state());
  const colorHex = process.env['TOKEN_COLOR'] || '';
  const balance = colorHex ? afterState.unshielded.balances[colorHex] ?? 0n : 0n;
  
  console.log(JSON.stringify({
    status: 'ok',
    amount: AMOUNT.toString(),
    balance: balance.toString(),
    timestamp: new Date().toISOString(),
  }));
} catch (e: any) {
  console.log(JSON.stringify({
    status: 'error',
    error: e.message || String(e),
    timestamp: new Date().toISOString(),
  }));
}

await wallet.stop();
