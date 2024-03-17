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
import { Log } from "@subsquid/evm-processor";
import { abi as ERC20ABI, functions as ERC20Functions } from "./abi/ERC20";
import {
  abi as PoolABI,
  Contract as PoolContract,
  functions as PoolFunctions,
} from "./abi/pool";
import {
  abi as NFPMABI,
  functions as NFPMFunctions,
} from "./abi/NonfungiblePositionManager";
import { BlockContext, Func } from "./abi/abi.support";
import { addErrorContext } from "@subsquid/util-internal";
import { RpcError } from "./utils/error";

const poolMap = new Set();
processor.run(new TypeormDatabase({ supportHotBlocks: true }), async (ctx) => {
  // @ts-ignore
  ctx._chain.client.receiveResult = receiveResult;

  const pools = await ctx.store.find(Pool);
  pools.forEach((pool) => {
    poolMap.add(pool.id);
  });

  const eventDataList = await collectEventData(ctx);
  const { batchRequests, requestContexts } = await prepareBatchCalls(
    eventDataList
  );

  const results = await executeBatchCalls(ctx, batchRequests);
  // throw new Error("Stop here ");
  results &&
    results.forEach((resultWrapper: any, index: number) => {
      const { eventType, callType, tokenIndex, eventDataIndex } =
        requestContexts[index];
      const eventData = eventDataList[eventDataIndex];

      // Skip processing this result if it indicates an error
      if (resultWrapper.error) {
        return; // Move to the next result
      }

      // Extract the actual result data since there's no error
      const result = resultWrapper.data;

      // Initialize eventData.decoded if it doesn't exist
      if (!eventData.decoded) {
        eventData.decoded = {};
      }
      if (eventType === "Pool") {
        if (!eventData.decoded.token0) {
          eventData.decoded.token0 = {};
        }
        if (!eventData.decoded.token1) {
          eventData.decoded.token1 = {};
        }
        const decodedValue = decodeResult(result, callType);
        // throw new Error("stop here");
        const tokenKey = tokenIndex === 0 ? "token0" : "token1";
        eventData.decoded[tokenKey][callType] = decodedValue;
      } else if (eventType === "Swap") {
        if (!eventData.decoded.totalFeeGrowth0Token) {
          eventData.decoded.totalFeeGrowth0Token = "";
        }
        if (!eventData.decoded.totalFeeGrowth1Token) {
          eventData.decoded.totalFeeGrowth0Token = "";
        }

        const tokenKey =
          tokenIndex === 0 ? "totalFeeGrowth0Token" : "totalFeeGrowth1Token";
        let decodedValue = decodeResult(result, callType);
        // Define an asynchronous function to fetch data from the contract if necessary
        const fetchFromContractIfNeeded = async () => {
          if (!decodedValue || decodedValue === "") {
            let lastBatchBlockHeader = { height: eventData.log.block.height };
            const ctxContract: BlockContext = {
              _chain: ctx._chain,
              block: lastBatchBlockHeader,
            };

            let poolContract = new PoolContract(
              ctxContract,
              eventData.log.address
            );

            // Fetch from contract based on the token index
            if (tokenIndex === 0) {
              return await poolContract.totalFeeGrowth0Token();
            } else {
              return await poolContract.totalFeeGrowth1Token();
            }
          }
          return decodedValue;
        };

        // Use the async function to set the decoded value
        fetchFromContractIfNeeded()
          .then((fetchedValue) => {
            eventData.decoded[tokenKey] = fetchedValue || decodedValue;
          })
          .catch((error) => {
            // console.error("Error fetching data from contract: ", error);
            // Handle error or assign a default value if necessary
          });
      } else if (
        eventType === "Transfer" ||
        eventType === "ManagerCollect" ||
        eventType === "DecreaseLiquidity" ||
        eventType === "IncreaseLiquidity"
      ) {
        if (!eventData.decoded.positions) {
          eventData.decoded.positions = "";
        }
        eventData.decoded.positions = decodeResult(result, callType);
      }
    });

  await processEvents(eventDataList, ctx);

  for (let entities of EntityBuffer.flush()) {
    await ctx.store.upsert(entities);
    // await ctx.store.upsert(EntityBuffer.flush());
  }
});

async function collectEventData(ctx: any) {
  let eventDataList: any[] = [];

  for (let c of ctx.blocks) {
    for (let log of c.logs) {
      let eventData = null;

      if (
        log.address.toLowerCase() === FACTORY_CONTRACT &&
        log.topics[0] === factory.events["Pool"].topic
      ) {
        const decodedEventData = factory.events["Pool"].decode(log);
        poolMap.add(decodedEventData.pool.toLowerCase());
        eventData = {
          type: "Pool",
          topic: factory.events["Pool"].topic,
          data: decodedEventData,
          log: log,
        };
      } else if (log.address.toLowerCase() === NFPMANAGER_CONTRACT) {
        if (log.topics[0] === nfpManager.events["Collect"].topic) {
          const decodedEventData = nfpManager.events["Collect"].decode(log);
          eventData = {
            type: "ManagerCollect",
            topic: nfpManager.events["Collect"].topic,
            data: decodedEventData,
            log: log,
          };
        } else if (
          log.topics[0] === nfpManager.events["DecreaseLiquidity"].topic
        ) {
          const decodedEventData =
            nfpManager.events["DecreaseLiquidity"].decode(log);
          eventData = {
            type: "DecreaseLiquidity",
            topic: nfpManager.events["DecreaseLiquidity"].topic,
            data: decodedEventData,
            log: log,
          };
        } else if (
          log.topics[0] === nfpManager.events["IncreaseLiquidity"].topic
        ) {
          const decodedEventData =
            nfpManager.events["IncreaseLiquidity"].decode(log);
          eventData = {
            type: "IncreaseLiquidity",
            topic: nfpManager.events["IncreaseLiquidity"].topic,
            data: decodedEventData,
            log: log,
          };
        } else if (log.topics[0] === nfpManager.events["Transfer"].topic) {
          const decodedEventData = nfpManager.events["Transfer"].decode(log);
          eventData = {
            type: "Transfer",
            topic: nfpManager.events["Transfer"].topic,
            data: decodedEventData,
            log: log,
          };
        }
      } else if (poolMap.has(log.address.toLowerCase())) {
        if (log.topics[0] === pool.events["Initialize"].topic) {
          const decodedEventData = pool.events["Initialize"].decode(log);
          eventData = {
            type: "Initialize",
            topic: pool.events["Initialize"].topic,
            data: decodedEventData,
            log: log,
          };
        } else if (log.topics[0] === pool.events["Swap"].topic) {
          const decodedEventData = pool.events["Swap"].decode(log);
          eventData = {
            type: "Swap",
            topic: pool.events["Swap"].topic,
            data: decodedEventData,
            log: log,
          };
        } else if (log.topics[0] === pool.events["Mint"].topic) {
          const decodedEventData = pool.events["Mint"].decode(log);
          eventData = {
            type: "Mint",
            topic: pool.events["Mint"].topic,
            data: decodedEventData,
            log: log,
          };
        } else if (log.topics[0] === pool.events["Burn"].topic) {
          const decodedEventData = pool.events["Burn"].decode(log);
          eventData = {
            type: "Burn",
            topic: pool.events["Burn"].topic,
            data: decodedEventData,
            log: log,
          };
        } else if (log.topics[0] === pool.events["Fee"].topic) {
          const decodedEventData = pool.events["Fee"].decode(log);
          eventData = {
            type: "Fee",
            topic: pool.events["Fee"].topic,
            data: decodedEventData,
            log: log,
          };
        } else if (log.topics[0] === pool.events["Collect"].topic) {
          const decodedEventData = pool.events["Collect"].decode(log);
          eventData = {
            type: "Collect",
            topic: pool.events["Collect"].topic,
            data: decodedEventData,
            log: log,
          };
        } else if (log.topics[0] === pool.events["CommunityFee"].topic) {
          const decodedEventData = pool.events["CommunityFee"].decode(log);
          eventData = {
            type: "CommunityFee",
            topic: pool.events["CommunityFee"].topic,
            data: decodedEventData,
            log: log,
          };
        }
      }

      if (eventData) {
        eventDataList.push(eventData);
      }
    }
  }
  return eventDataList;
}

async function prepareBatchCalls(
  eventDataList: {
    type: string;
    data: any;
    log: Log;
  }[]
) {
  let batchRequests: any[] = [];
  let requestContexts: any[] = [];

  eventDataList.forEach((eventData, eventDataIndex) => {
    const blockHeight = "0x" + eventData.log.block.height.toString(16);
    if (eventData.type === "Pool") {
      const { token0, token1 } = eventData.data;
      // Loop over each token
      [token0, token1].forEach((tokenAddress, tokenIndex) => {
        // Create requests for each attribute to be fetched
        ["symbol", "name", "totalSupply", "decimals"].forEach((callType) => {
          const func = getFunctionForCallType(callType);
          if (func) {
            batchRequests.push({
              method: "eth_call",
              params: [{ to: tokenAddress, data: func }, blockHeight],
            });
            requestContexts.push({
              eventType: eventData.type,
              tokenAddress,
              callType,
              eventDataIndex,
              tokenIndex,
            });
          }
        });
      });
    } else if (eventData.type === "Swap") {
      // For Swap, handle both totalFeeGrowth0Token and totalFeeGrowth1Token
      ["totalFeeGrowth0Token", "totalFeeGrowth1Token"].forEach(
        (callType, tokenIndex) => {
          const func = getFunctionForCallType(callType);
          if (func) {
            batchRequests.push({
              method: "eth_call",
              params: [{ to: eventData.log.address, data: func }, blockHeight],
            });
            requestContexts.push({
              eventType: eventData.type,
              callType,
              eventDataIndex,
              tokenIndex,
            });
          }
        }
      );
    } else if (
      eventData.type === "ManagerCollect" ||
      eventData.type === "DecreaseLiquidity" ||
      eventData.type === "IncreaseLiquidity" ||
      eventData.type === "Transfer"
    ) {
      ["positions"].forEach((callType, tokenIndex) => {
        const func = getFunctionForCallType(callType, [eventData.data.tokenId]);
        if (func) {
          batchRequests.push({
            method: "eth_call",
            params: [{ to: eventData.log.address, data: func }, blockHeight],
          });
          requestContexts.push({
            eventType: eventData.type,
            callType,
            eventDataIndex,
            tokenIndex,
          });
        }
      });
    } else if (eventData.type === "Burn" || eventData.type === "Mint") {
      ["tick_low", "tick_high"].forEach((callType, tokenIndex) => {
        const params = [
          tokenIndex === 0 ? eventData.data.bottomTick : eventData.data.topTick,
        ];

        const func = getFunctionForCallType(callType, params);
        if (func) {
          batchRequests.push({
            method: "eth_call",
            params: [{ to: eventData.log.address, data: func }, blockHeight],
          });
          requestContexts.push({
            eventType: eventData.type,
            callType,
            eventDataIndex,
            tokenIndex,
          });
        }
      });
    }
  });
  return { batchRequests, requestContexts };
}

function decodeResult(result: any, callType: string) {
  try {
    let decodedValue;
    switch (callType) {
      case "symbol":
        decodedValue = ERC20Functions.symbol.decodeResult(result);
        break;
      case "name":
        decodedValue = ERC20Functions.name.decodeResult(result);
        break;
      case "totalSupply":
        decodedValue = ERC20Functions.totalSupply.decodeResult(result);
        break;
      case "decimals":
        decodedValue = ERC20Functions.decimals.decodeResult(result);
        break;
      case "totalFeeGrowth0Token":
        decodedValue = PoolFunctions.totalFeeGrowth0Token.decodeResult(result);
        break;
      case "totalFeeGrowth1Token":
        decodedValue = PoolFunctions.totalFeeGrowth1Token.decodeResult(result);
        break;
      case "positions":
        decodedValue = NFPMFunctions.positions.decodeResult(result);
        break;
      case "tick_low":
      case "tick_high":
        decodedValue = PoolFunctions.ticks.decodeResult(result);
        break;
      default:
        console.warn(`Unknown callType: ${callType}`);
        return null;
    }
    return decodedValue;
  } catch (error) {
    console.error(`Error decoding result for callType ${callType}: ${error}`);
  }
}

function getFunctionForCallType(callType: string, param?: any[]) {
  switch (callType) {
    case "symbol":
      return ERC20Functions.symbol.encode([]);
    case "name":
      return ERC20Functions.name.encode([]);
    case "totalSupply":
      return ERC20Functions.totalSupply.encode([]);
    case "decimals":
      return ERC20Functions.decimals.encode([]);
    case "totalFeeGrowth0Token":
      return PoolFunctions.totalFeeGrowth0Token.encode([]);
    case "totalFeeGrowth1Token":
      return PoolFunctions.totalFeeGrowth1Token.encode([]);
    case "positions":
      return NFPMFunctions.positions.encode(param as [bigint]);
    case "tick_low":
    case "tick_high":
      return PoolFunctions.ticks.encode(param as [number]);
    default:
      return null;
  }
}

async function executeBatchCalls(ctx: any, batchRequests: any[]) {
  // try {
  const results = await ctx._chain.client.batchCall(batchRequests);
  return results;
  // } catch (err) {
  //   console.log("error batching");
  // }
}

async function processEvents(eventDataList: any[], ctx: any) {
  for (const eventData of eventDataList) {
    // console.log(eventData.type, "event type");
    if (eventData.type === "Pool") {
      await handlePoolCreated(eventData, ctx);
    } else if (eventData.type === "ManagerCollect") {
      await handleCollectManager(eventData, ctx);
    } else if (eventData.type === "DecreaseLiquidity") {
      await handleDecreaseLiquidity(eventData, ctx);
    } else if (eventData.type === "IncreaseLiquidity") {
      await handleIncreaseLiquidity(eventData, ctx);
    } else if (eventData.type === "Transfer") {
      await handleTransfer(eventData, ctx);
    } else if (eventData.type === "Initialize") {
      await handleInitialize(eventData, ctx);
    } else if (eventData.type === "Swap") {
      await handleSwap(eventData, ctx);
    } else if (eventData.type === "Mint") {
      await handleMint(eventData, ctx);
    } else if (eventData.type === "Burn") {
      await handleBurn(eventData, ctx);
    } else if (eventData.type === "Fee") {
      await handleChangeFee(eventData, ctx);
    } else if (eventData.type === "Collect") {
      await handleCollect(eventData, ctx);
    } else if (eventData.type === "CommunityFee") {
      await handleSetCommunityFee(eventData, ctx);
    }
  }
}

function receiveResult(
  call: any,
  res: any,
  validateResult?: any,
  validateError?: any
): any {
  // Implement custom error handling logic here
  //@ts-ignore
  if (this.log?.isDebug()) {
    //@ts-ignore
    this.log.debug(
      {
        rpcId: call.id,
        rpcMethod: call.method,
        rpcParams: call.params,
        rpcResponse: res,
      },
      "rpc response"
    );
  }
  try {
    if (res.error) {
      if (validateError) {
        return validateError(res.error, call);
      } else {
        return { error: true, data: new RpcError(res.error) };
      }
      // Instead of throwing, wrap the error in a structure to identify it as an error response
    } else if (validateResult) {
      return { error: false, data: validateResult(res.result, call) };
    } else {
      return { error: false, data: res.result };
    }
  } catch (err: any) {
    // Wrap the thrown error similarly
    const wrappedError = addErrorContext(err, {
      // @ts-ignore
      rpcUrl: this.url,
      rpcId: call.id,
      rpcMethod: call.method,
      rpcParams: call.params,
      rpcResponse: res,
    });
    return { error: true, data: wrappedError };
  }
}
