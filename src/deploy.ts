import { randomBytes } from 'node:crypto';
import { WebSocket } from 'ws';
import { firstValueFrom } from 'rxjs';
import { filter, timeout as rxTimeout } from 'rxjs/operators';
import pino from 'pino';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { deployContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { type EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';
import { UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { toHex, fromHex } from '@midnight-ntwrk/midnight-js-utils';
import { getConfig } from './config.js';
import { MidnightWalletProvider, syncWallet } from './wallet.js';
import { buildProviders } from './providers.js';
import { CompiledShadowVault, ledger, zkConfigPath } from './contract.js';

(globalThis as any).WebSocket = WebSocket;

const logger = pino({ level: 'info', transport: { target: 'pino-pretty' } });

const config = getConfig();
setNetworkId(config.networkId);

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

const seed = process.env['MIDNIGHT_SEED'];
if (!seed) {
  throw new Error('Set MIDNIGHT_SEED to your wallet seed (hex, no 0x prefix).');
}

const wallet = await MidnightWalletProvider.build(logger, env, { kind: 'seed', value: seed });
await wallet.start();

// Read the address from the wallet's first state update
const initialState = await firstValueFrom(wallet.wallet.state());
const address = UnshieldedAddress.codec
  .encode(config.networkId, initialState.unshielded.address)
  .asString();
logger.info(`Fund this address with tNIGHT: ${address}`);

const nightRaw = unshieldedToken().raw;

// 1) Wait until NIGHT arrives
logger.info('Waiting for NIGHT to arrive...');
await firstValueFrom(
  wallet.wallet.state().pipe(
    filter((s: any) => (s.unshielded.balances[nightRaw] ?? 0n) > 0n),
    rxTimeout({ each: 30 * 60_000 }),
  ),
);
logger.info('NIGHT received.');

// 2) Wait for unshielded channel to finish syncing
logger.info('Waiting for the unshielded channel to sync...');
const syncedState = await firstValueFrom(
  wallet.wallet.state().pipe(
    filter((s: any) => s.unshielded.progress?.isStrictlyComplete() === true),
    rxTimeout({ each: 30 * 60_000 }),
  ),
);
logger.info('Unshielded channel synced.');

// 3) Register NIGHT UTXOs for DUST generation
const unregistered = syncedState.unshielded.availableCoins.filter(
  (coin: any) =>
    coin.utxo.type === nightRaw &&
    coin.meta.registeredForDustGeneration === false,
);

if (unregistered.length > 0) {
  logger.info(`Registering ${unregistered.length} NIGHT UTXO(s) for DUST generation...`);
  const recipe = await wallet.wallet.registerNightUtxosForDustGeneration(
    unregistered,
    wallet.unshieldedKeystore.getPublicKey(),
    (payload: Uint8Array) => wallet.unshieldedKeystore.signData(payload),
  );
  const finalized = await wallet.wallet.finalizeRecipe(recipe);
  const txId = await wallet.wallet.submitTransaction(finalized);
  logger.info(`DUST registration submitted: ${txId}`);
} else {
  logger.info('NIGHT is already registered for DUST generation.');
}

// 4) Wait until DUST is spendable
logger.info('Waiting for DUST to be generated from your NIGHT...');
const dustDeadline = Date.now() + 30 * 60_000;
let dustBalance = 0n;
while (Date.now() < dustDeadline) {
  const s = await firstValueFrom(wallet.wallet.state());
  try {
    dustBalance = s.dust.balance(new Date());
  } catch {
    dustBalance = 0n;
  }
  logger.info(`  dust balance: ${dustBalance}`);
  if (dustBalance > 0n) break;
  await new Promise((r) => setTimeout(r, 15_000));
}
if (dustBalance <= 0n) {
  throw new Error('Timed out waiting for DUST to be generated.');
}
logger.info(`DUST available: ${dustBalance}`);

// Build providers after wallet is ready
const providers = buildProviders(wallet, zkConfigPath, config);

// The owner secret gates the initialize circuit
const ownerSecret = randomBytes(32);
logger.info(`Owner secret: ${toHex(ownerSecret)}`);

// Deploy the vault contract
const deployed = await deployContract(providers, {
  compiledContract: CompiledShadowVault,
  privateStateId: 'shadowvault',
  initialPrivateState: {},
  args: [ownerSecret],
});
const contractAddress = deployed.deployTxData.public.contractAddress;
logger.info(`ShadowVault deployed at: ${contractAddress}`);

async function readLedger() {
  const state = await providers.publicDataProvider.queryContractState(contractAddress);
  return ledger(state!.data);
}

logger.info(`Initialized: ${(await readLedger()).initialized}`);

// Initialize the vault with 10,000 tokens
const supply = 10_000n;

await submitCallTx(providers, {
  compiledContract: CompiledShadowVault,
  contractAddress,
  privateStateId: 'shadowvault',
  circuitId: 'initialize',
  args: [ownerSecret, supply],
});

const afterInit = await readLedger();
logger.info(`Initialized after init: ${afterInit.initialized}`);
logger.info(`Token color: ${toHex(afterInit.token_color)}`);

// Withdraw some tokens to our wallet
function toUserAddressBytes(unshielded: any): Uint8Array {
  const pk = unshielded?.state?.publicKey ?? unshielded?.publicKey;
  if (pk?.address instanceof Uint8Array) return pk.address;
  if (typeof pk?.addressHex === 'string') return fromHex(pk.addressHex);
  const addr = unshielded?.address;
  if (addr?.bytes instanceof Uint8Array) return addr.bytes;
  if (addr?.data instanceof Uint8Array) return addr.data;
  if (typeof addr?.addressHex === 'string') return fromHex(addr.addressHex);
  throw new Error('Could not find raw unshielded address bytes.');
}

const recipient = { bytes: toUserAddressBytes(syncedState.unshielded) };

await submitCallTx(providers, {
  compiledContract: CompiledShadowVault,
  contractAddress,
  privateStateId: 'shadowvault',
  circuitId: 'withdraw',
  args: [recipient, 100n],
});

const after = await syncWallet(logger, wallet.wallet, 60 * 60_000);
const color = toHex(afterInit.token_color);
logger.info(`Wallet balance of the token: ${after.unshielded.balances[color] ?? 0n}`);

logger.info('✅ ShadowVault deployed and tested successfully!');
logger.info(`Contract address: ${contractAddress}`);
logger.info(`Token color: ${color}`);
logger.info(`Owner secret: ${toHex(ownerSecret)}`);

await wallet.stop();
