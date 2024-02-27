import { TypeormDatabase } from "@subsquid/typeorm-store";
import { processor, FACTORY_CONTRACT, NFPMANAGER_CONTRACT } from "./processor";
import * as factory from "./abi/factory";
import * as nfpManager from "./abi/NonfungiblePositionManager";
import * as pool from "./abi/pool";
import {
  handleBurn,
  handleChangeFee,
  handleCollect,
  handleInitialize,
  handleMint,
  handleSetCommunityFee,
  handleSwap,
} from "./mappings/core";
import { handlePoolCreated } from "./mappings/factory";
import {
  handleDecreaseLiquidity,
  handleIncreaseLiquidity,
  handleCollectManager,
  handleTransfer,
} from "./mappings/position-manager";
import { Pool } from "./model";
import { EntityBuffer } from "./utils/entityBuffer";

let factoryPools: Set<string>;

processor.run(new TypeormDatabase(), async (ctx) => {
  if (!factoryPools) {
    factoryPools = await ctx.store
      .findBy(Pool, {})
      .then((q) => new Set(q.map((i) => i.id)));
  }

  for (let c of ctx.blocks) {
    for (let log of c.logs) {
      if (log.address.toLowerCase() === FACTORY_CONTRACT) {
        if (log.topics[0] === factory.events["Pool"].topic) {
          console.log("factory pool is running right now");
          const eventData = factory.events["Pool"].decode(log);
          await handlePoolCreated(eventData, log, ctx);
          console.log("factory pool finished running");
        }
      } else if (log.address.toLowerCase() === NFPMANAGER_CONTRACT) {
        if (log.topics[0] === nfpManager.events["Collect"].topic) {
          console.log("collect is running");
          const eventDataCollect = nfpManager.events["Collect"].decode(log);
          await handleCollectManager(eventDataCollect, log, ctx);
        } else if (
          log.topics[0] === nfpManager.events["DecreaseLiquidity"].topic
        ) {
          console.log("decrease liquidity is running");
          const eventDataDecrease =
            nfpManager.events["DecreaseLiquidity"].decode(log);
          await handleDecreaseLiquidity(eventDataDecrease, log, ctx);
        } else if (
          log.topics[0] === nfpManager.events["IncreaseLiquidity"].topic
        ) {
          console.log("increase liquidity is running");
          const eventDataIncrease =
            nfpManager.events["IncreaseLiquidity"].decode(log);
          await handleIncreaseLiquidity(eventDataIncrease, log, ctx);
        } else if (log.topics[0] === nfpManager.events["Transfer"].topic) {
          console.log("transfer is running");
          const eventDataTransfer = nfpManager.events["Transfer"].decode(log);
          await handleTransfer(eventDataTransfer, log, ctx);
        }
      } else {
        if (log.topics[0] === pool.events["Initialize"].topic) {
          console.log("initialize running");
          const eventData = pool.events["Initialize"].decode(log);
          await handleInitialize(eventData, log, ctx);
        } else if (log.topics[0] === pool.events["Swap"].topic) {
          console.log("swap running");
          const eventData = pool.events["Swap"].decode(log);
          await handleSwap(eventData, log, ctx);
        } else if (log.topics[0] === pool.events["Mint"].topic) {
          console.log("mint running");
          const eventData = pool.events["Mint"].decode(log);
          await handleMint(eventData, log, ctx);
        } else if (log.topics[0] === pool.events["Burn"].topic) {
          console.log("burn running");
          const eventData = pool.events["Burn"].decode(log);
          await handleBurn(eventData, log, ctx);
        } else if (log.topics[0] === pool.events["Fee"].topic) {
          console.log("handle change fee running");
          const eventData = pool.events["Fee"].decode(log);
          await handleChangeFee(eventData, log, ctx);
        } else if (log.topics[0] === pool.events["Collect"].topic) {
          console.log("handle collect running");
          const eventData = pool.events["Collect"].decode(log);
          await handleCollect(eventData, log, ctx);
        } else if (log.topics[0] === pool.events["CommunityFee"].topic) {
          console.log("set commuinity fee running");
          const eventData = pool.events["CommunityFee"].decode(log);
          await handleSetCommunityFee(eventData, log, ctx);
        }
      }
    }
  }
  for (let entities of EntityBuffer.flush()) {
    await ctx.store.upsert(entities);
  }
});
