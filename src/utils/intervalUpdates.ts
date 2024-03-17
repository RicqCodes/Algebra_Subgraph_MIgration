import { ZERO_BD, ZERO_BI, ONE_BI } from "./constants";
/* eslint-disable prefer-const */
import {
  AlgebraDayData,
  Factory,
  Pool,
  PoolDayData,
  Token,
  TokenDayData,
  TokenHourData,
  Bundle,
  PoolHourData,
  TickDayData,
  FeeHourData,
  Tick,
} from "../model/generated";
import { FACTORY_ADDRESS } from "./constants";
import { DataHandlerContext, Log } from "@subsquid/evm-processor";
import { Store } from "../db";
import { EntityBuffer } from "./entityBuffer";
import { BigDecimal } from "@subsquid/big-decimal";

/**
 * Tracks global aggregate data over daily windows
 * @param event
 */
export const updateAlgebraDayData = async (
  log: Log,
  ctx: DataHandlerContext<Store>
): Promise<AlgebraDayData> => {
  let algebra: Factory | undefined = EntityBuffer.get(
    "Factory",
    FACTORY_ADDRESS.toLowerCase()
  ) as Factory | undefined;

  if (!algebra) {
    algebra = await ctx.store.get(Factory, FACTORY_ADDRESS.toLowerCase());
  }

  let timestamp = Number(log.block.timestamp);
  let dayID = timestamp / 86400; // rounded
  let dayStartTimestamp = dayID * 86400;

  let algebraDayData: AlgebraDayData | undefined = EntityBuffer.get(
    "AlgebraDayData",
    dayID.toString().toLowerCase()
  ) as AlgebraDayData | undefined;

  if (!algebraDayData) {
    algebraDayData = await ctx.store.get(
      AlgebraDayData,
      dayID.toString().toLowerCase()
    );
  }

  if (!algebraDayData) {
    algebraDayData = new AlgebraDayData({ id: dayID.toString().toLowerCase() });
    algebraDayData.date = BigInt(dayStartTimestamp);
    algebraDayData.volumeMatic = ZERO_BD;
    algebraDayData.volumeUSD = ZERO_BD;
    algebraDayData.volumeUSDUntracked = ZERO_BD;
    algebraDayData.feesUSD = ZERO_BD;
  }
  algebraDayData.tvlUSD = algebra!.totalValueLockedUSD;
  algebraDayData.txCount = algebra!.txCount;

  EntityBuffer.add(algebraDayData);
  // algebraDayData.save();
  return algebraDayData as AlgebraDayData;
};

export const updatePoolDayData = async (
  log: Log,
  ctx: DataHandlerContext<Store>
): Promise<PoolDayData> => {
  let timestamp = Number(log.block.timestamp);
  console.log(timestamp, "timestamp from updatePoolDayData");
  let dayID = timestamp / 86400;
  console.log(dayID, "day id from update pool day data");
  let dayStartTimestamp = dayID * 86400;
  let dayPoolID = log.address
    .toLowerCase()
    .concat("-")
    .concat(dayID.toString());

  let pool: Pool | undefined = EntityBuffer.get(
    "Pool",
    log.address.toLowerCase()
  ) as Pool | undefined;

  if (!pool) {
    pool = await ctx.store.get(Pool, log.address.toLowerCase());
  }

  let poolDayData: PoolDayData | undefined = EntityBuffer.get(
    "PoolDayData",
    dayPoolID
  ) as PoolDayData | undefined;

  if (!poolDayData) {
    poolDayData = await ctx.store.get(PoolDayData, dayPoolID);
  }

  if (!poolDayData) {
    poolDayData = new PoolDayData({ id: dayPoolID });
    poolDayData.date = BigInt(dayStartTimestamp);
    poolDayData.pool = pool!;
    // things that dont get initialized always
    poolDayData.volumeToken0 = ZERO_BD;
    poolDayData.volumeToken1 = ZERO_BD;
    poolDayData.volumeUSD = ZERO_BD;
    poolDayData.untrackedVolumeUSD = ZERO_BD;
    poolDayData.feesUSD = ZERO_BD;
    poolDayData.txCount = BigInt(ZERO_BI.toNumber());
    poolDayData.feeGrowthGlobal0X128 = BigInt(ZERO_BI.toNumber());
    poolDayData.feeGrowthGlobal1X128 = BigInt(ZERO_BI.toNumber());
    poolDayData.open = pool!.token0Price;
    poolDayData.high = pool!.token0Price;
    poolDayData.low = pool!.token0Price;
    poolDayData.close = pool!.token0Price;
  }

  if (pool!.token0Price.gt(poolDayData.high)) {
    poolDayData.high = pool!.token0Price;
  }
  if (pool!.token0Price.lt(poolDayData.low)) {
    poolDayData.low = pool!.token0Price;
  }

  poolDayData.liquidity = pool!.liquidity;
  poolDayData.sqrtPrice = pool!.sqrtPrice;
  poolDayData.feeGrowthGlobal0X128 = pool!.feeGrowthGlobal0X128;
  poolDayData.feeGrowthGlobal1X128 = pool!.feeGrowthGlobal1X128;
  poolDayData.token0Price = pool!.token0Price;
  poolDayData.token1Price = pool!.token1Price;
  poolDayData.feesToken0 = pool!.feesToken0;
  poolDayData.feesToken1 = pool!.feesToken1;
  poolDayData.tick = pool!.tick;
  poolDayData.tvlUSD = pool!.totalValueLockedUSD;
  poolDayData.txCount = BigInt(
    BigDecimal(poolDayData.txCount).plus(ONE_BI).toNumber()
  );

  EntityBuffer.add(poolDayData);

  return poolDayData as PoolDayData;
};

export const updateFeeHourData = async (
  log: Log,
  ctx: DataHandlerContext<Store>,
  Fee: BigInt
): Promise<void> => {
  let timestamp = Number(log.block.timestamp);
  let hourIndex = timestamp / 3600;
  let hourStartUnix = hourIndex * 3600;
  let hourFeeID = log.address
    .toLowerCase()
    .concat("-")
    .concat(hourIndex.toString());

  let FeeHourDataEntity: FeeHourData | undefined = EntityBuffer.get(
    "FeeHourData",
    hourFeeID
  ) as FeeHourData | undefined;

  if (!FeeHourDataEntity) {
    FeeHourDataEntity = await ctx.store.get(FeeHourData, hourFeeID);
  }

  if (FeeHourDataEntity) {
    FeeHourDataEntity.timestamp = BigInt(hourStartUnix);
    FeeHourDataEntity.fee = FeeHourDataEntity.fee + BigInt(Fee.toString());
    FeeHourDataEntity.changesCount =
      BigInt(FeeHourDataEntity.changesCount.toString()) +
      BigInt(ONE_BI.toNumber());

    if (FeeHourDataEntity.maxFee < BigInt(Fee.toString()))
      FeeHourDataEntity.maxFee = BigInt(Fee.toString());
    if (FeeHourDataEntity.minFee > BigInt(Fee.toString()))
      FeeHourDataEntity.minFee = BigInt(Fee.toString());
    FeeHourDataEntity.endFee = BigInt(Fee.toString());
  } else {
    FeeHourDataEntity = new FeeHourData({ id: hourFeeID.toLowerCase() });
    FeeHourDataEntity.timestamp = BigInt(hourStartUnix);
    FeeHourDataEntity.fee = BigInt(Fee.toString());
    FeeHourDataEntity.changesCount = BigInt(ONE_BI.toNumber());
    FeeHourDataEntity.pool = log.address;
    if (Fee != BigInt(ZERO_BI.toNumber())) {
      FeeHourDataEntity.startFee = BigInt(Fee.toString());
      FeeHourDataEntity.endFee = BigInt(Fee.toString());
      FeeHourDataEntity.maxFee = BigInt(Fee.toString());
      FeeHourDataEntity.minFee = BigInt(Fee.toString());
    }
  }
  // FeeHourDataEntity.save();
  EntityBuffer.add(FeeHourDataEntity);
};

export const updatePoolHourData = async (
  log: Log,
  ctx: DataHandlerContext<Store>
): Promise<PoolHourData> => {
  let timestamp = Number(log.block.timestamp);
  let hourIndex = timestamp / 3600; // get unique hour within unix history
  let hourStartUnix = hourIndex * 3600; // want the rounded effect
  let hourPoolID = log.address
    .toLowerCase()
    .concat("-")
    .concat(hourIndex.toString());

  let pool: Pool | undefined = EntityBuffer.get(
    "Pool",
    log.address.toLowerCase()!
  ) as Pool | undefined;

  if (!pool) {
    pool = await ctx.store.get(Pool, log.address.toLowerCase());
  }

  let poolHourData: PoolHourData | undefined = EntityBuffer.get(
    "PoolHourData",
    hourPoolID
  ) as PoolHourData | undefined;

  if (!poolHourData) {
    poolHourData = await ctx.store.get(PoolHourData, hourPoolID);
  }

  if (!poolHourData) {
    poolHourData = new PoolHourData({ id: hourPoolID });
    poolHourData.periodStartUnix = BigInt(hourStartUnix);
    poolHourData.pool = pool!;
    // things that dont get initialized always
    poolHourData.volumeToken0 = ZERO_BD;
    poolHourData.volumeToken1 = ZERO_BD;
    poolHourData.volumeUSD = ZERO_BD;
    poolHourData.untrackedVolumeUSD = ZERO_BD;
    poolHourData.txCount = BigInt(ZERO_BI.toNumber());
    poolHourData.feesUSD = ZERO_BD;
    poolHourData.feeGrowthGlobal0X128 = BigInt(ZERO_BI.toNumber());
    poolHourData.feeGrowthGlobal1X128 = BigInt(ZERO_BI.toNumber());
    poolHourData.open = pool!.token0Price;
    poolHourData.high = pool!.token0Price;
    poolHourData.low = pool!.token0Price;
    poolHourData.close = pool!.token0Price;
  }

  if (pool!.token0Price.gt(poolHourData.high)) {
    poolHourData.high = pool!.token0Price;
  }
  if (pool!.token0Price.lt(poolHourData.low)) {
    poolHourData.low = pool!.token0Price;
  }

  poolHourData.liquidity = pool!.liquidity;
  poolHourData.sqrtPrice = pool!.sqrtPrice;
  poolHourData.token0Price = pool!.token0Price;
  poolHourData.token1Price = pool!.token1Price;
  poolHourData.feeGrowthGlobal0X128 = pool!.feeGrowthGlobal0X128;
  poolHourData.feeGrowthGlobal1X128 = pool!.feeGrowthGlobal1X128;
  poolHourData.close = pool!.token0Price;
  poolHourData.tick = pool!.tick;
  poolHourData.tvlUSD = pool!.totalValueLockedUSD;
  poolHourData.txCount = BigInt(
    BigDecimal(poolHourData.txCount).plus(ONE_BI).toNumber()
  );

  EntityBuffer.add(poolHourData);
  return poolHourData as PoolHourData;
};

export const updateTokenDayData = async (
  token: Token,
  log: Log,
  ctx: DataHandlerContext<Store>
): Promise<TokenDayData> => {
  let bundle: Bundle | undefined = EntityBuffer.get("Bundle", "1") as
    | Bundle
    | undefined;

  if (!bundle) {
    bundle = await ctx.store.get(Bundle, "1");
  }

  let timestamp = Number(log.block.timestamp);
  let dayID = timestamp / 86400;
  let dayStartTimestamp = dayID * 86400;
  let tokenDayID = token.id
    .toString()
    .toLowerCase()
    .concat("-")
    .concat(dayID.toString());
  let tokenPrice = token.derivedMatic.times(bundle!.maticPriceUSD);

  let tokenDayData: TokenDayData | undefined = EntityBuffer.get(
    "TokenDayData",
    tokenDayID
  ) as TokenDayData | undefined;

  if (!tokenDayData) {
    tokenDayData = await ctx.store.get(TokenDayData, tokenDayID);
  }

  if (!tokenDayData) {
    tokenDayData = new TokenDayData({ id: tokenDayID.toLowerCase() });
    tokenDayData.date = BigInt(dayStartTimestamp);
    tokenDayData.token = token;
    tokenDayData.volume = ZERO_BD;
    tokenDayData.volumeUSD = ZERO_BD;
    tokenDayData.feesUSD = ZERO_BD;
    tokenDayData.untrackedVolumeUSD = ZERO_BD;
    tokenDayData.open = tokenPrice;
    tokenDayData.high = tokenPrice;
    tokenDayData.low = tokenPrice;
    tokenDayData.close = tokenPrice;
  }

  if (tokenPrice.gt(tokenDayData.high)) {
    tokenDayData.high = tokenPrice;
  }

  if (tokenPrice.lt(tokenDayData.low)) {
    tokenDayData.low = tokenPrice;
  }

  tokenDayData.close = tokenPrice;
  tokenDayData.priceUSD = token.derivedMatic.times(bundle!.maticPriceUSD);
  tokenDayData.totalValueLocked = token.totalValueLocked;
  tokenDayData.totalValueLockedUSD = token.totalValueLockedUSD;

  EntityBuffer.add(tokenDayData);
  // tokenDayData.save();

  return tokenDayData as TokenDayData;
};

export const updateTokenHourData = async (
  token: Token,
  log: Log,
  ctx: DataHandlerContext<Store>
): Promise<TokenHourData> => {
  let bundle: Bundle | undefined = EntityBuffer.get("Bundle", "1") as
    | Bundle
    | undefined;

  if (!bundle) {
    bundle = await ctx.store.get(Bundle, "1");
  }

  let timestamp = Number(log.block.timestamp);
  let hourIndex = timestamp / 3600; // get unique hour within unix history
  let hourStartUnix = hourIndex * 3600; // want the rounded effect
  let tokenHourID = token.id
    .toString()
    .toLowerCase()
    .concat("-")
    .concat(hourIndex.toString());

  let tokenHourData: TokenHourData | undefined = EntityBuffer.get(
    "TokenHourData",
    tokenHourID
  ) as TokenHourData | undefined;

  if (!tokenHourData) {
    tokenHourData = await ctx.store.get(TokenHourData, tokenHourID);
  }

  let tokenPrice = token.derivedMatic.times(bundle!.maticPriceUSD);

  if (!tokenHourData) {
    tokenHourData = new TokenHourData({ id: tokenHourID.toLowerCase() });
    tokenHourData.periodStartUnix = BigInt(hourStartUnix);
    tokenHourData.token = token;
    tokenHourData.volume = ZERO_BD;
    tokenHourData.volumeUSD = ZERO_BD;
    tokenHourData.untrackedVolumeUSD = ZERO_BD;
    tokenHourData.feesUSD = ZERO_BD;
    tokenHourData.open = tokenPrice;
    tokenHourData.high = tokenPrice;
    tokenHourData.low = tokenPrice;
    tokenHourData.close = tokenPrice;
  }

  if (tokenPrice.gt(tokenHourData.high)) {
    tokenHourData.high = tokenPrice;
  }

  if (tokenPrice.lt(tokenHourData.low)) {
    tokenHourData.low = tokenPrice;
  }

  tokenHourData.close = tokenPrice;
  tokenHourData.priceUSD = tokenPrice;
  tokenHourData.totalValueLocked = token.totalValueLocked;
  tokenHourData.totalValueLockedUSD = token.totalValueLockedUSD;

  EntityBuffer.add(tokenHourData);
  // tokenHourData.save();

  return tokenHourData as TokenHourData;
};

export const updateTickDayData = async (
  tick: Tick,
  log: Log,
  ctx: DataHandlerContext<Store>
): Promise<TickDayData> => {
  let timestamp = Number(log.block.timestamp);
  let dayID = timestamp / 86400;
  let dayStartTimestamp = dayID * 86400;
  let tickDayDataID = tick.id
    .toLowerCase()
    .concat("-")
    .concat(dayID.toString());

  let tickDayData: TickDayData | undefined = EntityBuffer.get(
    "TickDayData",
    tickDayDataID.toLowerCase()
  ) as TickDayData | undefined;

  if (!tickDayData) {
    tickDayData = await ctx.store.get(TickDayData, tickDayDataID);
  }

  if (!tickDayData) {
    tickDayData = new TickDayData({ id: tickDayDataID });
    tickDayData.date = BigInt(dayStartTimestamp);
    tickDayData.pool = tick.pool;
    tickDayData.tick = tick;
  }
  tickDayData.liquidityGross = tick.liquidityGross;
  tickDayData.liquidityNet = tick.liquidityNet;
  tickDayData.volumeToken0 = tick.volumeToken0;
  tickDayData.volumeToken1 = tick.volumeToken0;
  tickDayData.volumeUSD = tick.volumeUSD;
  tickDayData.feesUSD = tick.feesUSD;
  tickDayData.feeGrowthOutside0X128 = tick.feeGrowthOutside0X128;
  tickDayData.feeGrowthOutside1X128 = tick.feeGrowthOutside1X128;

  EntityBuffer.add(tickDayData);

  return tickDayData as TickDayData;
};
