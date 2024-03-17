import { EvmBatchProcessor } from "@subsquid/evm-processor";
import { lookupArchive } from "@subsquid/archive-registry";

import * as factory from "./abi/factory";
import * as nfpManager from "./abi/NonfungiblePositionManager";
import * as pool from "./abi/pool";

export const FACTORY_CONTRACT =
  "0xabE1655110112D0E45EF91e94f8d757e4ddBA59C".toLowerCase();
export const NFPMANAGER_CONTRACT =
  "0x1FF2ADAa387dD27c22b31086E658108588eDa03a".toLowerCase();

export const processor = new EvmBatchProcessor()
  .setGateway(lookupArchive("moonbeam", { type: "EVM" }))
  .setRpcEndpoint("https://moonbeam-rpc.publicnode.com")
  .setFinalityConfirmation(75)
  .setBlockRange({ from: 2_649_799 })
  .setFields({
    log: {
      topics: true,
      data: true,
      transactionHash: true,
    },
    transaction: {
      input: true,
      gasPrice: true,
      gas: true,
    },
  })
  .addLog({
    address: [FACTORY_CONTRACT],
    topic0: [factory.events["Pool"].topic],
    transaction: true,
  })
  .addLog({
    address: [NFPMANAGER_CONTRACT],
    topic0: [
      nfpManager.events["Collect"].topic,
      nfpManager.events["DecreaseLiquidity"].topic,
      nfpManager.events["IncreaseLiquidity"].topic,
      nfpManager.events["Transfer"].topic,
    ],
    transaction: true,
  })
  .addLog({
    topic0: [
      pool.events["Initialize"].topic,
      pool.events["Swap"].topic,
      pool.events["Mint"].topic,
      pool.events["Burn"].topic,
      pool.events["Fee"].topic,
      pool.events["Collect"].topic,
      pool.events["CommunityFee"].topic,
    ],
    transaction: true,
  });
