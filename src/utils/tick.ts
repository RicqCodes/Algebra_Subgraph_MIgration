/* eslint-disable prefer-const */
import { DataHandlerContext, Log } from "@subsquid/evm-processor";
import { bigDecimalExponated, safeDiv } from ".";
import { Pool, Tick } from "../model";
import { ONE_BD, ZERO_BD, ZERO_BI } from "./constants";
import { EntityBuffer } from "./entityBuffer";
import { Store } from "../db";
import { BigDecimal } from "@subsquid/big-decimal";

export const createTick = async (
  tickId: string,
  tickIdx: number,
  poolId: string,
  log: Log,
  ctx: DataHandlerContext<Store>
): Promise<Tick> => {
  let tick = new Tick({ id: tickId.toLowerCase() });
  tick.tickIdx = BigInt(tickIdx);

  let pool: Pool | undefined = EntityBuffer.get(
    "Pool",
    poolId.toLowerCase()
  ) as Pool | undefined;

  if (!pool) {
    pool = await ctx.store.get(Pool, {
      where: { id: poolId },
      relations: {
        token0: true,
        token1: true,
      },
    });
  }

  tick.pool = pool!;
  tick.poolAddress = poolId;

  tick.createdAtTimestamp = BigInt(log.block.timestamp);
  tick.createdAtBlockNumber = BigInt(log.block.height);
  tick.liquidityGross = ZERO_BI;
  tick.liquidityNet = ZERO_BI;
  tick.liquidityProviderCount = ZERO_BI;

  tick.price0 = ONE_BD;
  tick.price1 = ONE_BD;

  // 1.0001^tick is token1/token0.
  let price0 = bigDecimalExponated(BigDecimal("1.0001"), BigInt(tickIdx));
  tick.price0 = price0;
  tick.price1 = safeDiv(ONE_BD, price0);

  tick.volumeToken0 = ZERO_BD;
  tick.volumeToken1 = ZERO_BD;
  tick.volumeUSD = ZERO_BD;
  tick.feesUSD = ZERO_BD;
  tick.untrackedVolumeUSD = ZERO_BD;
  tick.collectedFeesToken0 = ZERO_BD;
  tick.collectedFeesToken1 = ZERO_BD;
  tick.collectedFeesUSD = ZERO_BD;
  tick.liquidityProviderCount = ZERO_BI;
  tick.feeGrowthOutside0X128 = ZERO_BI;
  tick.feeGrowthOutside1X128 = ZERO_BI;

  EntityBuffer.add(tick);
  return tick;
};
