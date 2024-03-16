/* eslint-disable prefer-const */
import { Pool, Position, PositionSnapshot, Tick, Token } from "../model";
import {
  ADDRESS_ZERO,
  FACTORY_ADDRESS,
  ZERO_BD,
  ZERO_BI,
  pools_list,
} from "../utils/constants";
import { convertTokenToDecimal, loadTransaction } from "../utils";
import { Contract as NonfungiblePositionManager } from "../abi/NonfungiblePositionManager";
import { Contract as FactoryContract } from "../abi/factory";
import { DataHandlerContext, Log, decodeHex } from "@subsquid/evm-processor";
import { Store } from "../db";
import { EntityBuffer } from "../utils/entityBuffer";
import { BlockContext } from "../abi/abi.support";
import { UpdatedLog } from "../utils/interfaces";
import { BigDecimal } from "@subsquid/big-decimal";

// calling blockchain for update
const getPosition = async (
  log: Log,
  ctx: DataHandlerContext<Store>,
  tokenId: BigInt,
  positionResult: any[]
): Promise<Position | undefined> => {
  let position: Position | undefined = EntityBuffer.get(
    "Position",
    tokenId.toString().toLowerCase()
  ) as Position | undefined;

  if (!position) {
    position = await ctx.store.get(Position, {
      where: { id: tokenId.toString().toLowerCase() },
      relations: {
        pool: true,
        token0: true,
        token1: true,
        tickLower: true,
        tickUpper: true,
      },
    });
  }

  if (!position) {
    if (!positionResult) {
      let lastBatchBlockHeader = { height: log.block.height };
      const ctxContract: BlockContext = {
        _chain: ctx._chain,
        block: lastBatchBlockHeader,
      };

      let contract = new NonfungiblePositionManager(
        ctxContract,
        lastBatchBlockHeader,
        log.address
      );
      positionResult = await contract.positions(BigInt(tokenId.toString()));
    }

    // the following call reverts in situations where the position is minted
    // and deleted in the same block
    if (positionResult) {
      let lastBatchBlockHeader = { height: log.block.height };
      const ctxContract: BlockContext = {
        _chain: ctx._chain,
        block: lastBatchBlockHeader,
      };

      let factoryContract = new FactoryContract(
        ctxContract,
        lastBatchBlockHeader,
        FACTORY_ADDRESS
      );

      let poolAddress = await factoryContract.poolByPair(
        positionResult[2],
        positionResult[3]
      );

      let pool = EntityBuffer.get("Pool", poolAddress.toLowerCase()) as
        | Pool
        | undefined;
      if (!pool) {
        pool = await ctx.store.get(Pool, {
          where: { id: poolAddress.toLowerCase() },
          relations: {
            token0: true,
            token1: true,
          },
        });
      }

      position = new Position({ id: tokenId.toString().toLowerCase() });
      // The owner gets correctly updated in the Transfer handler
      position.owner = decodeHex(ADDRESS_ZERO);
      position.pool = pool!;
      if (pools_list.includes(position.pool.id.toLowerCase())) {
        let token0 = EntityBuffer.get(
          "Token",
          positionResult[3].toLowerCase()
        ) as Token;
        if (!token0)
          token0 = (await ctx.store.get(
            Token,
            positionResult[3].toLowerCase()
          )) as Token;

        let token1 = EntityBuffer.get(
          "Token",
          positionResult[2].toLowerCase()
        ) as Token;
        if (!token1)
          token1 = (await ctx.store.get(
            Token,
            positionResult[2].toLowerCase()
          )) as Token;

        position.token0 = token0;
        position.token1 = token1;
      } else {
        let token0 = EntityBuffer.get(
          "Token",
          positionResult[2].toLowerCase()
        ) as Token;
        if (!token0)
          token0 = (await ctx.store.get(
            Token,
            positionResult[2].toLowerCase()
          )) as Token;

        let token1 = EntityBuffer.get(
          "Token",
          positionResult[3].toLowerCase()
        ) as Token;
        if (!token1)
          token1 = (await ctx.store.get(
            Token,
            positionResult[3].toLowerCase()
          )) as Token;

        position.token0 = token0;
        position.token1 = token1;
      }

      let tickLower = EntityBuffer.get(
        "Tick",
        position.pool.id
          .toLowerCase()
          .toLowerCase()
          .concat("#")
          .concat(positionResult[4].toString().toLowerCase())
      ) as Tick;
      if (!tickLower)
        tickLower = (await ctx.store.get(
          Tick,
          position.pool.id
            .toLowerCase()
            .toLowerCase()
            .concat("#")
            .concat(positionResult[4].toString().toLowerCase())
        )) as Tick;

      let tickUpper = EntityBuffer.get(
        "Tick",
        position.pool.id
          .toLowerCase()
          .concat("#")
          .concat(positionResult[5].toString())
      ) as Tick;
      if (!tickUpper)
        tickUpper = (await ctx.store.get(
          Tick,
          position.pool.id
            .toLowerCase()
            .concat("#")
            .concat(positionResult[5].toString())
        )) as Tick;

      const tx = await loadTransaction(log as UpdatedLog, ctx);

      position.tickLower = tickLower;
      position.tickUpper = tickUpper;
      position.liquidity = BigInt(ZERO_BI.toNumber());
      position.depositedToken0 = ZERO_BD;
      position.depositedToken1 = ZERO_BD;
      position.withdrawnToken0 = ZERO_BD;
      position.withdrawnToken1 = ZERO_BD;
      position.collectedToken0 = ZERO_BD;
      position.collectedToken1 = ZERO_BD;
      position.collectedFeesToken0 = ZERO_BD;
      position.collectedFeesToken1 = ZERO_BD;
      position.transaction = tx;
      position.feeGrowthInside0LastX128 = positionResult[7];
      position.feeGrowthInside1LastX128 = positionResult[8];
    }
  }

  return position;
};

// calling blockchain for update
const updateFeeVars = async (
  tokenId: bigint,
  position: Position,
  positionResult: any,
  log: Log,
  ctx: DataHandlerContext<Store>
): Promise<Position> => {
  if (!positionResult) {
    let lastBatchBlockHeader = ctx.blocks[ctx.blocks.length - 1].header;
    const ctxContract: BlockContext = {
      _chain: ctx._chain,
      block: lastBatchBlockHeader,
    };

    let positionManagerContract = new NonfungiblePositionManager(
      ctxContract,
      lastBatchBlockHeader,
      log.address
    );
    positionResult = await positionManagerContract.positions(
      BigInt(tokenId.toString())
    );
  }
  if (positionResult) {
    position.feeGrowthInside0LastX128 = positionResult[7];
    position.feeGrowthInside1LastX128 = positionResult[8];
  }
  return position;
};

const savePositionSnapshot = async (
  position: Position,
  log: Log,
  ctx: DataHandlerContext<Store>
): Promise<void> => {
  let positionSnapshot = new PositionSnapshot({
    id: position.id
      .toLowerCase()
      .concat("#")
      .concat(log.block.height.toString()),
  });
  positionSnapshot.owner = position.owner;
  positionSnapshot.pool = position.pool;
  positionSnapshot.position = position;
  positionSnapshot.blockNumber = BigInt(log.block.height);
  positionSnapshot.timestamp = BigInt(log.block.timestamp);
  positionSnapshot.liquidity = position.liquidity;

  const tx = await loadTransaction(log as UpdatedLog, ctx);

  if (pools_list.includes(position.pool.id)) {
    positionSnapshot.depositedToken0 = position.depositedToken1;
    positionSnapshot.depositedToken1 = position.depositedToken0;
    positionSnapshot.withdrawnToken0 = position.withdrawnToken1;
    positionSnapshot.withdrawnToken1 = position.withdrawnToken0;
    positionSnapshot.collectedFeesToken0 = position.collectedFeesToken1;
    positionSnapshot.collectedFeesToken1 = position.collectedFeesToken0;
    positionSnapshot.transaction = tx;
    positionSnapshot.feeGrowthInside0LastX128 =
      position.feeGrowthInside1LastX128;
    positionSnapshot.feeGrowthInside1LastX128 =
      position.feeGrowthInside0LastX128;
  } else {
    positionSnapshot.depositedToken0 = position.depositedToken0;
    positionSnapshot.depositedToken1 = position.depositedToken1;
    positionSnapshot.withdrawnToken0 = position.withdrawnToken0;
    positionSnapshot.withdrawnToken1 = position.withdrawnToken1;
    positionSnapshot.collectedFeesToken0 = position.collectedFeesToken0;
    positionSnapshot.collectedFeesToken1 = position.collectedFeesToken1;
    positionSnapshot.transaction = tx;
    positionSnapshot.feeGrowthInside0LastX128 =
      position.feeGrowthInside0LastX128;
    positionSnapshot.feeGrowthInside1LastX128 =
      position.feeGrowthInside1LastX128;
  }

  EntityBuffer.add(positionSnapshot);
};

// calling getPosition - that calls blockchain for update
export const handleIncreaseLiquidity = async (
  event: {
    data: {
      tokenId: bigint;
      liquidity: bigint;
      actualLiquidity: bigint;
      amount0: bigint;
      amount1: bigint;
      pool: string;
    };
    log: Log;
    decoded: {
      positions?: any;
    };
  },
  ctx: DataHandlerContext<Store>
): Promise<void> => {
  let position = await getPosition(
    event.log,
    ctx,
    event.data.tokenId,
    event.decoded?.positions
  );

  // position was not able to be fetched
  if (!position) {
    return;
  }

  let token0 = EntityBuffer.get(
    "Token",
    position.token0.id.toLowerCase()
  ) as Token;
  if (!token0)
    token0 = (await ctx.store.get(
      Token,
      position.token0.id.toLowerCase()
    )) as Token;

  let token1 = EntityBuffer.get(
    "Token",
    position.token1.id.toLowerCase()
  ) as Token;
  if (!token1)
    token1 = (await ctx.store.get(
      Token,
      position.token1.id.toLowerCase()
    )) as Token;

  let amount1 = ZERO_BD;
  let amount0 = ZERO_BD;

  if (pools_list.includes(position.pool.id))
    amount0 = convertTokenToDecimal(event.data.amount1, token0!.decimals);
  else amount0 = convertTokenToDecimal(event.data.amount0, token0!.decimals);

  if (pools_list.includes(position.pool.id))
    amount1 = convertTokenToDecimal(event.data.amount0, token1!.decimals);
  else amount1 = convertTokenToDecimal(event.data.amount1, token1!.decimals);

  position.liquidity = BigInt(
    BigDecimal(position.liquidity).plus(event.data.liquidity).toNumber()
  );
  position.depositedToken0 = position.depositedToken0.plus(amount0);
  position.depositedToken1 = position.depositedToken1.plus(amount1);

  // recalculatePosition(position)

  EntityBuffer.add(position);

  await savePositionSnapshot(position, event.log, ctx);
};

// calling getPosition & updateFeeVars - that both calls blockchain for update
export const handleDecreaseLiquidity = async (
  event: {
    data: {
      tokenId: bigint;
      liquidity: bigint;
      amount0: bigint;
      amount1: bigint;
    };
    log: Log;
    decoded: {
      positions: any;
    };
  },
  ctx: DataHandlerContext<Store>
): Promise<void> => {
  let position = await getPosition(
    event.log,
    ctx,
    event.data.tokenId,
    event.decoded?.positions
  );

  // position was not able to be fetched
  if (!position) {
    return;
  }

  let token0 = EntityBuffer.get(
    "Token",
    position.token0.id.toLowerCase()
  ) as Token;
  if (!token0)
    token0 = (await ctx.store.get(
      Token,
      position.token0.id.toLowerCase()
    )) as Token;

  let token1 = EntityBuffer.get(
    "Token",
    position.token1.id.toLowerCase()
  ) as Token;
  if (!token1)
    token1 = (await ctx.store.get(
      Token,
      position.token1.id.toLowerCase()
    )) as Token;

  let amount1 = ZERO_BD;
  let amount0 = ZERO_BD;

  if (pools_list.includes(position.pool.id.toLowerCase()))
    amount0 = convertTokenToDecimal(event.data.amount1, token0!.decimals);
  else amount0 = convertTokenToDecimal(event.data.amount0, token0!.decimals);

  if (pools_list.includes(position.pool.id.toLowerCase()))
    amount1 = convertTokenToDecimal(event.data.amount0, token1!.decimals);
  else amount1 = convertTokenToDecimal(event.data.amount1, token1!.decimals);

  position.liquidity = BigInt(
    BigDecimal(position.liquidity).minus(event.data.liquidity).toNumber()
  );
  position.withdrawnToken0 = position.withdrawnToken0.plus(amount0);
  position.withdrawnToken1 = position.withdrawnToken1.plus(amount1);

  position = await updateFeeVars(
    event.data.tokenId,
    position,
    event.decoded?.positions,
    event.log,
    ctx
  );

  // recalculatePosition(position)

  EntityBuffer.add(position);

  await savePositionSnapshot(position, event.log, ctx);
};

// calling getPosition & updateFeeVars - that both calls blockchain for update
export const handleCollectManager = async (
  event: {
    data: {
      tokenId: bigint;
      recipient: string;
      amount0: bigint;
      amount1: bigint;
    };
    log: Log;
    decoded: {
      positions: any;
    };
  },
  ctx: DataHandlerContext<Store>
): Promise<void> => {
  let position = await getPosition(
    event.log,
    ctx,
    event.data.tokenId,
    event.decoded?.positions
  );

  // position was not able to be fetched
  if (!position) {
    return;
  }

  let token0 = EntityBuffer.get(
    "Token",
    position.token0.id.toLowerCase()
  ) as Token;
  if (!token0)
    token0 = (await ctx.store.get(
      Token,
      position.token0.id.toLowerCase()
    )) as Token;

  let token1 = EntityBuffer.get(
    "Token",
    position.token1.id.toLowerCase()
  ) as Token;
  if (!token1)
    token1 = (await ctx.store.get(
      Token,
      position.token1.id.toLowerCase()
    )) as Token;

  let amount1 = ZERO_BD;
  let amount0 = ZERO_BD;

  if (pools_list.includes(position.pool.id.toLowerCase()))
    amount0 = convertTokenToDecimal(event.data.amount1, token0!.decimals);
  else amount0 = convertTokenToDecimal(event.data.amount0, token0!.decimals);

  if (pools_list.includes(position.pool.id.toLowerCase()))
    amount1 = convertTokenToDecimal(event.data.amount0, token1!.decimals);
  else amount1 = convertTokenToDecimal(event.data.amount1, token1!.decimals);

  position.collectedToken0 = position.collectedToken0.plus(amount0);
  position.collectedToken1 = position.collectedToken1.plus(amount1);

  position.collectedFeesToken0 = position.collectedToken0.minus(
    position.withdrawnToken0
  );
  position.collectedFeesToken1 = position.collectedToken1.minus(
    position.withdrawnToken1
  );

  position = await updateFeeVars(
    event.data.tokenId,
    position,
    event.decoded.positions,
    event.log,
    ctx
  );

  EntityBuffer.add(position);

  await savePositionSnapshot(position, event.log, ctx);
};

// calling getPosition - that calls blockchain for update
export const handleTransfer = async (
  event: {
    data: {
      from: string;
      to: string;
      tokenId: bigint;
    };
    log: Log;
    decoded: {
      positions: any;
    };
  },
  ctx: DataHandlerContext<Store>
): Promise<void> => {
  let position = await getPosition(
    event.log,
    ctx,
    event.data.tokenId,
    event.decoded?.positions
  );
  // position was not able to be fetched
  if (!position) {
    return;
  }

  position.owner = decodeHex(event.data.to);
  EntityBuffer.add(position);
  await savePositionSnapshot(position, event.log, ctx);
};
