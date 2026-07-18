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
import { MidnightWalletProvider } from './wallet.js';
import { buildProviders as buildDappProviders } from './providers.js';
import { CompiledShadowVault, ledger, zkConfigPath } from './contract.js';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';

(globalThis as any).WebSocket = WebSocket;

const logger = pino({ level: 'warn', transport: { target: 'pino-pretty' } });

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

async function setupWallet(seed: string) {
  const wallet = await MidnightWalletProvider.build(logger, env, { kind: 'seed', value: seed });
  await wallet.start();
  const state = await firstValueFrom(wallet.wallet.state());
  return { wallet, state };
}

async function main() {
  const rl = createInterface({ input, output, terminal: true });

  const contractAddress = process.env['CONTRACT_ADDRESS'];
  const seed = process.env['MIDNIGHT_SEED'];

  if (!contractAddress) {
    console.error('Set CONTRACT_ADDRESS to the deployed vault address.');
    process.exit(1);
  }
  if (!seed) {
    console.error('Set MIDNIGHT_SEED to your wallet seed (hex, no 0x prefix).');
    process.exit(1);
  }

  console.log('\n🔐 ShadowVault CLI');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Contract: ${contractAddress}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const { wallet, state } = await setupWallet(seed);
  const providers = buildDappProviders(wallet, zkConfigPath, config);

  // Must register DUST
  const nightRaw = unshieldedToken().raw;
  const unregistered = state.unshielded.availableCoins.filter(
    (coin: any) =>
      coin.utxo.type === nightRaw &&
      coin.meta.registeredForDustGeneration === false,
  );
  if (unregistered.length > 0) {
    logger.info(`Registering ${unregistered.length} NIGHT UTXO(s) for DUST...`);
    const recipe = await wallet.wallet.registerNightUtxosForDustGeneration(
      unregistered,
      wallet.unshieldedKeystore.getPublicKey(),
      (payload: Uint8Array) => wallet.unshieldedKeystore.signData(payload),
    );
    const finalized = await wallet.wallet.finalizeRecipe(recipe);
    await wallet.wallet.submitTransaction(finalized);
  }

  while (true) {
    const choice = await rl.question(`
  [1] 📊 View vault state
  [2] 💰 Withdraw tokens
  [3] 📈 Check my token balance
  [4] ❌ Exit
  > `);

    try {
      switch (choice.trim()) {
        case '1': {
          const queryState = await providers.publicDataProvider.queryContractState(contractAddress);
          if (!queryState) {
            console.log('  Contract not found.');
            break;
          }
          const stateView = ledger(queryState.data);
          console.log(`\n  📊 Vault State:`);
          console.log(`  Token color: ${toHex(stateView.token_color)}`);
          console.log(`  Initialized: ${stateView.initialized}`);
          console.log(`  Owner: ${toHex(stateView.owner)}`);
          break;
        }
        case '2': {
          const amountStr = await rl.question('  Amount to withdraw: ');
          const amount = BigInt(amountStr.trim());
          const currentState = await firstValueFrom(wallet.wallet.state());
          const addr = currentState.unshielded.address;
          const recipient = { bytes: addr.bytes ?? addr.data ?? addr };

          console.log(`  Withdrawing ${amount} tokens...`);
          await submitCallTx(providers, {
            compiledContract: CompiledShadowVault,
            contractAddress,
            privateStateId: 'shadowvault-cli',
            circuitId: 'withdraw',
            args: [recipient, amount],
          });
          console.log(`  ✅ Withdrew ${amount} tokens to your wallet!`);
          break;
        }
        case '3': {
          const currentState = await firstValueFrom(wallet.wallet.state());
          const color = toHex((await providers.publicDataProvider.queryContractState(contractAddress))!.data.token_color);
          const balance = currentState.unshielded.balances[color] ?? 0n;
          console.log(`\n  💰 Your token balance: ${balance}`);
          break;
        }
        case '4': {
          console.log('  Goodbye! 👋');
          await wallet.stop();
          return;
        }
        default:
          console.log('  Invalid choice.');
      }
    } catch (e) {
      console.error(`  ❌ Error: ${e instanceof Error ? e.message : e}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
