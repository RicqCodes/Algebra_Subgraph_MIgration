/* eslint-disable prefer-const */
import {
  Bundle,
  Burn,
  Factory,
  Mint,
  Pool,
  Swap,
  Tick,
  Token,
  PoolFeeData,
} from "../model";
import { Contract as PoolABI } from "../abi/pool";
import { convertTokenToDecimal, loadTransaction, safeDiv } from "../utils";
import {
  FACTORY_ADDRESS,
  ONE_BI,
  ZERO_BD,
  ZERO_BI,
  pools_list,
  TICK_SPACING,
} from "../utils/constants";
import {
  findEthPerToken,
  getEthPriceInUSD,
  getTrackedAmountUSD,
  priceToTokenPrices,
} from "../utils/pricing";
import {
  updatePoolDayData,
  updatePoolHourData,
  updateTickDayData,
  updateTokenDayData,
  updateTokenHourData,
  updateAlgebraDayData,
  updateFeeHourData,
} from "../utils/intervalUpdates";
import { createTick } from "../utils/tick";
import { DataHandlerContext, Log, decodeHex } from "@subsquid/evm-processor";
import { Store } from "../db";
import { EntityBuffer } from "../utils/entityBuffer";
import { BigDecimal } from "@subsquid/big-decimal";
import { UpdatedLog } from "../utils/interfaces";
import { BlockContext } from "../abi/abi.support";

export const handleInitialize = async (
  event: {
    price: bigint;
    tick: number;
  },
  log: Log,
  ctx: DataHandlerContext<Store>
): Promise<void> => {
  const poolAddress = log.address.toLowerCase();
  let pool: Pool | undefined = EntityBuffer.get("Pool", poolAddress) as
    | Pool
    | undefined;

  if (!pool) {
    pool = await ctx.store.get(Pool, {
      where: { id: poolAddress },
      relations: {
        token0: true,
        token1: true,
        poolDayData: true,
        poolHourData: true,
      },
    });
  }

  pool!.sqrtPrice = event.price;
  pool!.tick = BigInt(event.tick);

  EntityBuffer.add(pool!);
  // pool.save();

  // update token prices
  let token0: Token | undefined = EntityBuffer.get(
    "Token",
    pool!.token0.id.toLowerCase()
  ) as Token | undefined;
  if (!token0) {
    token0 = await ctx.store.get(Token, {
      where: { id: pool!.token0.id.toLowerCase() },
      relations: { tokenDayData: true, whitelistPools: true },
    });
  }
  let token1: Token | undefined = EntityBuffer.get(
    "Token",
    pool!.token1.id.toLowerCase()
  ) as Token | undefined;
  if (!token1) {
    token1 = await ctx.store.get(Token, {
      where: { id: pool!.token1.id.toLowerCase() },
      relations: { tokenDayData: true, whitelistPools: true },
    });
  }

  // update Matic price now that prices could have changed
  let bundle: Bundle | undefined = EntityBuffer.get("Bundle", "1") as
    | Bundle
    | undefined;

  if (!bundle) {
    bundle = await ctx.store.get(Bundle, "1");
  }

  bundle!.maticPriceUSD = await getEthPriceInUSD(ctx);

  EntityBuffer.add(bundle!);
  // bundle.save();

  await updatePoolDayData(log, ctx);
  await updatePoolHourData(log, ctx);

  // update token prices
  token0!.derivedMatic = await findEthPerToken(token0 as Token, ctx);
  token1!.derivedMatic = await findEthPerToken(token1 as Token, ctx);

  EntityBuffer.add(token0!);
  EntityBuffer.add(token1!);
};

export const handleMint = async (
  event: {
    sender: string;
    owner: string;
    bottomTick: number;
    topTick: number;
    liquidityAmount: bigint;
    amount0: bigint;
    amount1: bigint;
  },
  log: Log,
  ctx: DataHandlerContext<Store>
): Promise<void> => {
  let bundle: Bundle | undefined = EntityBuffer.get("Bundle", "1") as
    | Bundle
    | undefined;

  if (!bundle) {
    bundle = await ctx.store.get(Bundle, "1");
  }

  let poolAddress = log.address.toLowerCase();

  let pool: Pool | undefined = EntityBuffer.get("Pool", poolAddress) as
    | Pool
    | undefined;

  if (!pool) {
    pool = await ctx.store.get(Pool, {
      where: { id: log.address.toLowerCase() },
      relations: {
        token0: true,
        token1: true,
        poolDayData: true,
        poolHourData: true,
      },
    });
  }

  let factory: Factory | undefined = EntityBuffer.get(
    "Factory",
    FACTORY_ADDRESS.toLowerCase()
  ) as Factory | undefined;

  if (!factory) {
    factory = await ctx.store.get(Factory, FACTORY_ADDRESS.toLowerCase());
  }

  let token0: Token | undefined = EntityBuffer.get(
    "Token",
    pool!.token0.id.toLowerCase()
  ) as Token | undefined;

  if (!token0) {
    token0 = await ctx.store.get(Token, {
      where: { id: pool!.token0.id.toLowerCase() },
      relations: { tokenDayData: true, whitelistPools: true },
    });
  }

  let token1: Token | undefined = EntityBuffer.get(
    "Token",
    pool!.token1.id.toLowerCase()
  ) as Token | undefined;

  if (!token1) {
    token1 = await ctx.store.get(Token, {
      where: { id: pool!.token1.id.toLowerCase() },
      relations: { tokenDayData: true, whitelistPools: true },
    });
  }

  let amount0 = convertTokenToDecimal(event.amount0, token0!.decimals);
  let amount1 = convertTokenToDecimal(event.amount1, token1!.decimals);

  if (pools_list.includes(log.address)) {
    amount0 = convertTokenToDecimal(event.amount1, token0!.decimals);
    amount1 = convertTokenToDecimal(event.amount0, token1!.decimals);
  }

  let amountUSD = amount0
    .times(token0!.derivedMatic.times(bundle!.maticPriceUSD))
    .plus(amount1.times(token1!.derivedMatic.times(bundle!.maticPriceUSD)));

  // reset tvl aggregates until new amounts calculated
  factory!.totalValueLockedMatic = factory!.totalValueLockedMatic.minus(
    pool!.totalValueLockedMatic
  );

  // update globals
  factory!.txCount = BigInt(
    BigDecimal(factory!.txCount).plus(ONE_BI).toNumber()
  );

  // update token0 data
  token0!.txCount = BigInt(BigDecimal(token0!.txCount).plus(ONE_BI).toNumber());
  token0!.totalValueLocked = token0!.totalValueLocked.plus(amount0);
  token0!.totalValueLockedUSD = token0!.totalValueLocked.times(
    token0!.derivedMatic.times(bundle!.maticPriceUSD)
  );

  // update token1 data
  token1!.txCount = BigInt(BigDecimal(token1!.txCount).plus(ONE_BI).toNumber());
  token1!.totalValueLocked = token1!.totalValueLocked.plus(amount1);
  token1!.totalValueLockedUSD = token1!.totalValueLocked.times(
    token1!.derivedMatic.times(bundle!.maticPriceUSD)
  );

  // pool data
  pool!.txCount = BigInt(BigDecimal(pool!.txCount).plus(ONE_BI).toNumber());

  // Pools liquidity tracks the currently active liquidity given pools current tick.
  // We only want to update it on mint if the new position includes the current tick.
  if (
    (pool!.tick !== null || pool!.tick !== undefined) &&
    BigDecimal(event.bottomTick).lte(pool!.tick) &&
    BigDecimal(event.topTick).gt(pool!.tick)
  ) {
    pool!.liquidity = BigInt(
      BigDecimal(pool!.liquidity).plus(event.liquidityAmount).toNumber()
    );
  }
  pool!.totalValueLockedToken0 = pool!.totalValueLockedToken0.plus(amount0);
  pool!.totalValueLockedToken1 = pool!.totalValueLockedToken1.plus(amount1);
  pool!.totalValueLockedMatic = pool!.totalValueLockedToken0
    .times(token0!.derivedMatic)
    .plus(pool!.totalValueLockedToken1.times(token1!.derivedMatic));
  pool!.totalValueLockedUSD = pool!.totalValueLockedMatic.times(
    bundle!.maticPriceUSD
  );

  // reset aggregates with new amounts
  factory!.totalValueLockedMatic = factory!.totalValueLockedMatic.plus(
    pool!.totalValueLockedMatic
  );
  factory!.totalValueLockedUSD = factory!.totalValueLockedMatic.times(
    bundle!.maticPriceUSD
  );

  let transaction = await loadTransaction(log as UpdatedLog, ctx);

  let mint = new Mint({
    id:
      transaction.id.toString().toLowerCase() + "#" + pool!.txCount.toString(),
  });

  mint.transaction = transaction;
  mint.timestamp = transaction.timestamp;
  mint.pool = pool!;
  mint.token0 = pool!.token1;
  mint.owner = decodeHex(event.owner);
  mint.sender = decodeHex(event.sender);
  mint.origin = decodeHex(log.transaction!.from);
  mint.amount = event.liquidityAmount;
  mint.amount0 = amount0;
  mint.amount1 = amount1;
  mint.amountUSD = amountUSD;
  mint.tickLower = BigInt(event.bottomTick);
  mint.tickUpper = BigInt(event.topTick);

  // tick entities
  let lowerTickIdx = event.bottomTick;
  let upperTickIdx = event.topTick;

  let lowerTickId =
    poolAddress.toLowerCase() + "#" + BigInt(event.bottomTick).toString();
  let upperTickId =
    poolAddress.toLowerCase() + "#" + BigInt(event.topTick).toString();

  let lowerTick: Tick | undefined = EntityBuffer.get(
    "Tick",
    lowerTickId.toLowerCase()
  ) as Tick | undefined;

  if (!lowerTick) {
    lowerTick = await ctx.store.get(Tick, {
      where: { id: lowerTickId.toLowerCase() },
      relations: { pool: true },
    });
  }

  let upperTick: Tick | undefined = EntityBuffer.get(
    "Tick",
    upperTickId.toLowerCase()
  ) as Tick | undefined;

  if (!upperTick) {
    upperTick = await ctx.store.get(Tick, {
      where: { id: upperTickId.toLowerCase() },
      relations: { pool: true },
    });
  }

  if (!lowerTick) {
    lowerTick = await createTick(lowerTickId, lowerTickIdx, pool!.id, log, ctx);
  }

  if (!upperTick) {
    upperTick = await createTick(upperTickId, upperTickIdx, pool!.id, log, ctx);
  }

  let amount = event.liquidityAmount;
  lowerTick.liquidityGross = BigInt(
    BigDecimal(lowerTick.liquidityGross).plus(amount).toNumber()
  );
  lowerTick.liquidityNet = BigInt(
    BigDecimal(lowerTick.liquidityNet).plus(amount).toNumber()
  );
  upperTick.liquidityGross = BigInt(
    BigDecimal(upperTick.liquidityGross).plus(amount).toNumber()
  );
  upperTick.liquidityNet = BigInt(
    BigDecimal(upperTick.liquidityNet).minus(amount).toNumber()
  );

  // TODO: Update Tick's volume, fees, and liquidity provider count

  await updateAlgebraDayData(log, ctx);
  await updatePoolDayData(log, ctx);
  await updatePoolHourData(log, ctx);
  await updateTokenDayData(token0 as Token, log, ctx);
  await updateTokenDayData(token1 as Token, log, ctx);
  await updateTokenHourData(token0 as Token, log, ctx);
  await updateTokenHourData(token1 as Token, log, ctx);

  EntityBuffer.add(token0!);
  EntityBuffer.add(token1!);
  EntityBuffer.add(pool!);
  EntityBuffer.add(factory!);
  EntityBuffer.add(mint);

  // Update inner tick vars and save the ticks
  await updateTickFeeVarsAndSave(lowerTick, log, ctx);
  await updateTickFeeVarsAndSave(upperTick, log, ctx);
};

export const handleBurn = async (
  event: {
    owner: string;
    bottomTick: number;
    topTick: number;
    liquidityAmount: bigint;
    amount0: bigint;
    amount1: bigint;
  },
  log: Log,
  ctx: DataHandlerContext<Store>
): Promise<void> => {
  let bundle: Bundle | undefined = EntityBuffer.get("Bundle", "1") as
    | Bundle
    | undefined;

  if (!bundle) {
    bundle = await ctx.store.get(Bundle, "1");
  }

  let poolAddress = log.address;

  let pool: Pool | undefined = EntityBuffer.get(
    "Pool",
    poolAddress.toLowerCase()
  ) as Pool | undefined;

  if (!pool) {
    pool = await ctx.store.get(Pool, {
      where: { id: log.address.toLowerCase() },
      relations: {
        token0: true,
        token1: true,
      },
    });
  }

  let factory: Factory | undefined = EntityBuffer.get(
    "Factory",
    FACTORY_ADDRESS.toLowerCase()
  ) as Factory | undefined;

  if (!factory) {
    factory = await ctx.store.get(Factory, FACTORY_ADDRESS.toLowerCase());
  }

  let token0: Token | undefined = EntityBuffer.get(
    "Token",
    pool!.token0.id.toLowerCase()
  ) as Token | undefined;

  if (!token0) {
    token0 = await ctx.store.get(Token, {
      where: { id: pool!.token0.id.toLowerCase() },
      relations: { tokenDayData: true, whitelistPools: true },
    });
  }

  let token1: Token | undefined = EntityBuffer.get(
    "Token",
    pool!.token1.id.toLowerCase()
  ) as Token | undefined;

  if (!token1) {
    token1 = await ctx.store.get(Token, {
      where: { id: pool!.token1.id.toLowerCase() },
      relations: { tokenDayData: true, whitelistPools: true },
    });
  }

  let amount0 = convertTokenToDecimal(event.amount0, token0!.decimals);
  let amount1 = convertTokenToDecimal(event.amount1, token1!.decimals);

  if (pools_list.includes(log.address)) {
    amount0 = convertTokenToDecimal(event.amount1, token0!.decimals);
    amount1 = convertTokenToDecimal(event.amount0, token1!.decimals);
  }

  let amountUSD = amount0
    .times(token0!.derivedMatic.times(bundle!.maticPriceUSD))
    .plus(amount1.times(token1!.derivedMatic.times(bundle!.maticPriceUSD)));

  // reset tvl aggregates until new amounts calculated
  factory!.totalValueLockedMatic = factory!.totalValueLockedMatic.minus(
    pool!.totalValueLockedMatic
  );

  // update globals
  factory!.txCount = BigInt(
    BigDecimal(factory!.txCount).plus(ONE_BI).toNumber()
  );

  // update token0 data
  token0!.txCount = BigInt(BigDecimal(token0!.txCount).plus(ONE_BI).toNumber());
  token0!.totalValueLocked = token0!.totalValueLocked.minus(amount0);
  token0!.totalValueLockedUSD = token0!.totalValueLocked.times(
    token0!.derivedMatic.times(bundle!.maticPriceUSD)
  );

  // update token1 data
  token1!.txCount = BigInt(BigDecimal(token1!.txCount).plus(ONE_BI).toNumber());
  token1!.totalValueLocked = token1!.totalValueLocked.minus(amount1);
  token1!.totalValueLockedUSD = token1!.totalValueLocked.times(
    token1!.derivedMatic.times(bundle!.maticPriceUSD)
  );

  // pool data
  pool!.txCount = BigInt(BigDecimal(pool!.txCount).plus(ONE_BI).toNumber());
  // Pools liquidity tracks the currently active liquidity given pools current tick.
  // We only want to update it on burn if the position being burnt includes the current tick.
  if (
    (pool!.tick !== null || pool!.tick !== undefined) &&
    BigDecimal(event.bottomTick).lte(pool!.tick) &&
    BigDecimal(event.topTick).gt(pool!.tick)
  ) {
    pool!.liquidity = BigInt(
      BigDecimal(pool!.liquidity).minus(event.liquidityAmount).toNumber()
    );
  }

  pool!.totalValueLockedToken0 = pool!.totalValueLockedToken0.minus(amount0);
  pool!.totalValueLockedToken1 = pool!.totalValueLockedToken1.minus(amount1);
  pool!.totalValueLockedMatic = pool!.totalValueLockedToken0
    .times(token0!.derivedMatic)
    .plus(pool!.totalValueLockedToken1.times(token1!.derivedMatic));
  pool!.totalValueLockedUSD = pool!.totalValueLockedMatic.times(
    bundle!.maticPriceUSD
  );

  // reset aggregates with new amounts
  factory!.totalValueLockedMatic = factory!.totalValueLockedMatic.plus(
    pool!.totalValueLockedMatic
  );
  factory!.totalValueLockedUSD = factory!.totalValueLockedMatic.times(
    bundle!.maticPriceUSD
  );

  // burn entity
  let transaction = await loadTransaction(log as UpdatedLog, ctx);
  let burn = new Burn({
    id: transaction.id.toLowerCase() + "#" + pool!.txCount.toString(),
  });
  burn.transaction = transaction;
  burn.timestamp = transaction.timestamp;
  burn.pool = pool!;
  burn.token0 = pool!.token0;
  burn.token1 = pool!.token1;
  burn.owner = decodeHex(event.owner);
  burn.origin = decodeHex(log.transaction!.from);
  burn.amount = event.liquidityAmount;
  burn.amount0 = amount0;
  burn.amount1 = amount1;
  burn.amountUSD = amountUSD;
  burn.tickLower = BigInt(event.bottomTick);
  burn.tickUpper = BigInt(event.topTick);

  // tick entities
  let lowerTickId =
    poolAddress.toLowerCase() +
    "#" +
    BigInt(event.bottomTick).toString().toLowerCase();
  let upperTickId =
    poolAddress.toLowerCase() +
    "#" +
    BigInt(event.topTick).toString().toLowerCase();

  let lowerTick: Tick | undefined = EntityBuffer.get(
    "Tick",
    lowerTickId.toLowerCase()
  ) as Tick | undefined;

  if (!lowerTick) {
    lowerTick = await ctx.store.get(Tick, {
      where: { id: lowerTickId.toLowerCase() },
      relations: { pool: true },
    });
  }

  let upperTick: Tick | undefined = EntityBuffer.get(
    "Tick",
    upperTickId.toLowerCase()
  ) as Tick | undefined;

  if (!upperTick) {
    upperTick = await ctx.store.get(Tick, {
      where: { id: upperTickId.toLowerCase() },
      relations: { pool: true },
    });
  }

  let amount = event.liquidityAmount;
  lowerTick!.liquidityGross = BigInt(
    BigDecimal(lowerTick!.liquidityGross).minus(amount).toNumber()
  );
  lowerTick!.liquidityNet = BigInt(
    BigDecimal(lowerTick!.liquidityNet).minus(amount).toNumber()
  );
  upperTick!.liquidityGross = BigInt(
    BigDecimal(upperTick!.liquidityGross).minus(amount).toNumber()
  );
  upperTick!.liquidityNet = BigInt(
    BigDecimal(upperTick!.liquidityNet).plus(amount).toNumber()
  );

  await updateAlgebraDayData(log, ctx);
  await updatePoolDayData(log, ctx);
  await updatePoolHourData(log, ctx);
  await updateTokenDayData(token0 as Token, log, ctx);
  await updateTokenDayData(token1 as Token, log, ctx);
  await updateTokenHourData(token0 as Token, log, ctx);
  await updateTokenHourData(token1 as Token, log, ctx);
  await updateTickFeeVarsAndSave(lowerTick!, log, ctx);
  await updateTickFeeVarsAndSave(upperTick!, log, ctx);

  EntityBuffer.add(token0!);
  EntityBuffer.add(token1!);
  EntityBuffer.add(pool!);
  EntityBuffer.add(factory!);
  EntityBuffer.add(burn!);
};

export const handleSwap = async (
  event: {
    sender: string;
    recipient: string;
    amount0: bigint;
    amount1: bigint;
    price: bigint;
    liquidity: bigint;
    tick: number;
  },
  log: Log,
  ctx: DataHandlerContext<Store>
): Promise<void> => {
  let bundle: Bundle | undefined = EntityBuffer.get("Bundle", "1") as
    | Bundle
    | undefined;

  if (!bundle) {
    bundle = await ctx.store.get(Bundle, "1");
  }

  let factory: Factory | undefined = EntityBuffer.get(
    "Factory",
    FACTORY_ADDRESS.toLowerCase()
  ) as Factory | undefined;

  if (!factory) {
    factory = await ctx.store.get(Factory, FACTORY_ADDRESS.toLowerCase());
  }

  let pool: Pool | undefined = EntityBuffer.get(
    "Pool",
    log.address.toLowerCase()
  ) as Pool | undefined;

  if (!pool) {
    pool = await ctx.store.get(Pool, {
      where: { id: log.address.toLowerCase() },
      relations: {
        token0: true,
        token1: true,
      },
    });
  }

  let oldTick = pool!.tick;
  let flag = false;

  let token0: Token | undefined = EntityBuffer.get(
    "Token",
    pool!.token0.id.toLowerCase()
  ) as Token | undefined;

  if (!token0) {
    token0 = await ctx.store.get(Token, {
      where: { id: pool!.token0.id.toLowerCase() },
      relations: { tokenDayData: true, whitelistPools: true },
    });
  }

  let token1: Token | undefined = EntityBuffer.get(
    "Token",
    pool!.token1.id.toLowerCase()
  ) as Token | undefined;

  if (!token1) {
    token1 = await ctx.store.get(Token, {
      where: { id: pool!.token1.id.toLowerCase() },
      relations: { tokenDayData: true, whitelistPools: true },
    });
  }

  let amount0 = convertTokenToDecimal(event.amount0, token0!.decimals);
  let amount1 = convertTokenToDecimal(event.amount1, token1!.decimals);

  if (pools_list.includes(log.address)) {
    amount0 = convertTokenToDecimal(event.amount1, token0!.decimals);
    amount1 = convertTokenToDecimal(event.amount0, token1!.decimals);
  }

  // need absolute amounts for volume
  let amount0Abs = amount0;
  if (amount0.lt(ZERO_BD)) {
    amount0Abs = amount0.times(BigDecimal("-1"));
  } else {
    let communityFeeAmount = amount0.times(
      BigDecimal(
        BigDecimal(pool!.fee).times(pool!.communityFee0).toString()
      ).div(BigDecimal("1000000000"))
    );
    communityFeeAmount = communityFeeAmount.times(BigDecimal("1"));
    amount0 = amount0.minus(communityFeeAmount);
    amount0Abs = amount0;
  }

  let amount1Abs = amount1;
  if (amount1.lt(ZERO_BD)) {
    amount1Abs = amount1.times(BigDecimal("-1"));
  } else {
    let communityFeeAmount = amount1.times(
      BigDecimal(
        BigDecimal(pool!.fee).times(pool!.communityFee1).toString()
      ).div(BigDecimal("1000000000"))
    );
    communityFeeAmount = communityFeeAmount.times(BigDecimal("1"));
    amount1 = amount1.minus(communityFeeAmount);
    amount1Abs = amount1;
  }

  let amount0Matic = amount0Abs.times(token0!.derivedMatic);
  let amount1Matic = amount1Abs.times(token1!.derivedMatic);

  let amount0USD = amount0Matic.times(bundle!.maticPriceUSD);
  let amount1USD = amount1Matic.times(bundle!.maticPriceUSD);

  // get amount that should be tracked only - div 2 because cant count both input and output as volume
  let amountTotalUSDTrackedReturned = await getTrackedAmountUSD(
    amount0Abs,
    token0 as Token,
    amount1Abs,
    token1 as Token,
    ctx
  );

  let amountTotalUSDTracked = amountTotalUSDTrackedReturned.div(
    BigDecimal("2")
  );

  let amountTotalMaticTracked = safeDiv(
    amountTotalUSDTracked,
    bundle!.maticPriceUSD
  );
  let amountTotalUSDUntracked = amount0USD
    .plus(amount1USD)
    .div(BigDecimal("2"));

  let feesMatic = amountTotalMaticTracked
    .times(BigDecimal(pool!.fee))
    .div(BigDecimal("1000000"));
  let feesUSD = amountTotalUSDTracked
    .times(BigDecimal(pool!.fee))
    .div(BigDecimal("1000000"));
  let untrackedFees = amountTotalUSDUntracked
    .times(BigDecimal(pool!.fee))
    .div(BigDecimal("1000000"));

  // global updates
  factory!.txCount = BigInt(
    BigDecimal(factory!.txCount).plus(ONE_BI).toNumber()
  );
  factory!.totalVolumeMatic = factory!.totalVolumeMatic.plus(
    amountTotalMaticTracked
  );
  factory!.totalVolumeUSD = factory!.totalVolumeUSD.plus(amountTotalUSDTracked);
  factory!.untrackedVolumeUSD = factory!.untrackedVolumeUSD.plus(
    amountTotalUSDUntracked
  );
  factory!.totalFeesMatic = factory!.totalFeesMatic.plus(feesMatic);
  factory!.totalFeesUSD = factory!.totalFeesUSD.plus(feesUSD);

  // reset aggregate tvl before individual pool tvl updates
  let currentPoolTvlMatic = pool!.totalValueLockedMatic;
  factory!.totalValueLockedMatic =
    factory!.totalValueLockedMatic.minus(currentPoolTvlMatic);

  // pool volume
  pool!.volumeToken0 = pool!.volumeToken0.plus(amount0Abs);
  pool!.volumeToken1 = pool!.volumeToken1.plus(amount1Abs);
  pool!.volumeUSD = pool!.volumeUSD.plus(amountTotalUSDTracked);
  pool!.untrackedVolumeUSD = pool!.untrackedVolumeUSD.plus(
    amountTotalUSDUntracked
  );
  pool!.feesUSD = pool!.feesUSD.plus(feesUSD);
  pool!.untrackedFeesUSD = pool!.untrackedFeesUSD.plus(untrackedFees);
  pool!.txCount = BigInt(BigDecimal(pool!.txCount).plus(ONE_BI).toNumber());

  // Update the pool! with the new active liquidity, price, and tick.
  pool!.liquidity = event.liquidity;
  pool!.tick = BigInt(event.tick);
  pool!.sqrtPrice = event.price;
  pool!.totalValueLockedToken0 = pool!.totalValueLockedToken0.plus(amount0);
  pool!.totalValueLockedToken1 = pool!.totalValueLockedToken1.plus(amount1);

  // update token0 data
  token0!.volume = token0!.volume.plus(amount0Abs);
  token0!.totalValueLocked = token0!.totalValueLocked.plus(amount0);
  token0!.volumeUSD = token0!.volumeUSD.plus(amountTotalUSDTracked);
  token0!.untrackedVolumeUSD = token0!.untrackedVolumeUSD.plus(
    amountTotalUSDUntracked
  );
  token0!.feesUSD = token0!.feesUSD.plus(feesUSD);
  token0!.txCount = BigInt(BigDecimal(token0!.txCount).plus(ONE_BI).toNumber());

  // update token1 data
  token1!.volume = token1!.volume.plus(amount1Abs);
  token1!.totalValueLocked = token1!.totalValueLocked.plus(amount1);
  token1!.volumeUSD = token1!.volumeUSD.plus(amountTotalUSDTracked);
  token1!.untrackedVolumeUSD = token1!.untrackedVolumeUSD.plus(
    amountTotalUSDUntracked
  );
  token1!.feesUSD = token1!.feesUSD.plus(feesUSD);
  token1!.txCount = BigInt(BigDecimal(token1!.txCount).plus(ONE_BI).toNumber());

  // updated pool rates
  let prices = priceToTokenPrices(
    pool!.sqrtPrice,
    token0 as Token,
    token1 as Token
  );
  pool!.token0Price = prices[0];
  pool!.token1Price = prices[1];

  if (pools_list.includes(log.address)) {
    prices = priceToTokenPrices(
      pool!.sqrtPrice,
      token1 as Token,
      token0 as Token
    );
    pool!.token0Price = prices[1];
    pool!.token1Price = prices[0];
  }

  EntityBuffer.add(pool!);

  // update USD pricing
  bundle!.maticPriceUSD = await getEthPriceInUSD(ctx);
  EntityBuffer.add(bundle!);

  token0!.derivedMatic = await findEthPerToken(token0 as Token, ctx);
  token1!.derivedMatic = await findEthPerToken(token1 as Token, ctx);

  /**
   * Things afffected by new USD rates
   */
  pool!.totalValueLockedMatic = pool!.totalValueLockedToken0
    .times(token0!.derivedMatic)
    .plus(pool!.totalValueLockedToken1.times(token1!.derivedMatic));
  pool!.totalValueLockedUSD = pool!.totalValueLockedMatic.times(
    bundle!.maticPriceUSD
  );

  factory!.totalValueLockedMatic = factory!.totalValueLockedMatic.plus(
    pool!.totalValueLockedMatic
  );
  factory!.totalValueLockedUSD = factory!.totalValueLockedMatic.times(
    bundle!.maticPriceUSD
  );

  token0!.totalValueLockedUSD = token0!.totalValueLocked
    .times(token0!.derivedMatic)
    .times(bundle!.maticPriceUSD);
  token1!.totalValueLockedUSD = token1!.totalValueLocked
    .times(token1!.derivedMatic)
    .times(bundle!.maticPriceUSD);

  // create Swap event
  let transaction = await loadTransaction(log as UpdatedLog, ctx);
  let swap = new Swap({
    id: transaction.id.toLowerCase() + "#" + pool!.txCount.toString(),
  });
  swap.transaction = transaction;
  swap.timestamp = transaction.timestamp;
  swap.pool! = pool!;
  swap.token0 = pool!.token0;
  swap.token1 = pool!.token1;
  swap.sender = decodeHex(event.sender);
  swap.origin = decodeHex(log.transaction!.from);
  swap.liquidity = event.liquidity;
  swap.recipient = decodeHex(event.recipient);
  swap.amount0 = amount0;
  swap.amount1 = amount1;
  swap.amountUSD = amountTotalUSDTracked;
  swap.tick = BigInt(event.tick);
  swap.price = event.price;

  // update fee growth
  let lastBatchBlockHeader = { height: log.block.height };
  const ctxContract: BlockContext = {
    _chain: ctx._chain,
    block: lastBatchBlockHeader,
  };

  let poolContract = new PoolABI(
    ctxContract,
    lastBatchBlockHeader,
    log.address
  );
  let feeGrowthGlobal0X128 = await poolContract.totalFeeGrowth0Token();
  let feeGrowthGlobal1X128 = await poolContract.totalFeeGrowth1Token();
  pool!.feeGrowthGlobal0X128 = feeGrowthGlobal0X128;
  pool!.feeGrowthGlobal1X128 = feeGrowthGlobal1X128;

  // interval data
  let algebraDayData = await updateAlgebraDayData(log, ctx);
  let poolDayData = await updatePoolDayData(log, ctx);
  let poolHourData = await updatePoolHourData(log, ctx);
  let token0DayData = await updateTokenDayData(token0 as Token, log, ctx);
  let token1DayData = await updateTokenDayData(token1 as Token, log, ctx);
  let token0HourData = await updateTokenHourData(token0 as Token, log, ctx);
  let token1HourData = await updateTokenHourData(token1 as Token, log, ctx);

  if (amount0.lt(ZERO_BD)) {
    pool!.feesToken1 = pool!.feesToken1.plus(
      amount1.times(BigDecimal(pool!.fee)).div(BigDecimal("1000000"))
    );
    poolDayData.feesToken1 = poolDayData.feesToken1.plus(
      amount1.times(BigDecimal(pool!.fee)).div(BigDecimal("1000000"))
    );
  }

  if (amount1.lt(ZERO_BD)) {
    pool!.feesToken0 = pool!.feesToken0.plus(
      amount0.times(BigDecimal(pool!.fee)).div(BigDecimal("1000000"))
    );
    poolDayData.feesToken0 = poolDayData.feesToken0.plus(
      amount0.times(BigDecimal(pool!.fee)).div(BigDecimal("1000000"))
    );
  }

  // update volume metrics
  algebraDayData.volumeMatic = algebraDayData.volumeMatic.plus(
    amountTotalMaticTracked
  );
  algebraDayData.volumeUSD = algebraDayData.volumeUSD.plus(
    amountTotalUSDTracked
  );
  algebraDayData.feesUSD = algebraDayData.feesUSD.plus(feesUSD);

  poolDayData.volumeUSD = poolDayData.volumeUSD.plus(amountTotalUSDTracked);
  poolDayData.untrackedVolumeUSD = poolDayData.untrackedVolumeUSD.plus(
    amountTotalUSDUntracked
  );
  poolDayData.volumeToken0 = poolDayData.volumeToken0.plus(amount0Abs);
  poolDayData.volumeToken1 = poolDayData.volumeToken1.plus(amount1Abs);
  poolDayData.feesUSD = poolDayData.feesUSD.plus(feesUSD);

  poolHourData.untrackedVolumeUSD = poolHourData.untrackedVolumeUSD.plus(
    amountTotalUSDUntracked
  );
  poolHourData.volumeUSD = poolHourData.volumeUSD.plus(amountTotalUSDTracked);
  poolHourData.volumeToken0 = poolHourData.volumeToken0.plus(amount0Abs);
  poolHourData.volumeToken1 = poolHourData.volumeToken1.plus(amount1Abs);
  poolHourData.feesUSD = poolHourData.feesUSD.plus(feesUSD);

  token0DayData.volume = token0DayData.volume.plus(amount0Abs);
  token0DayData.volumeUSD = token0DayData.volumeUSD.plus(amountTotalUSDTracked);
  token0DayData.untrackedVolumeUSD = token0DayData.untrackedVolumeUSD.plus(
    amountTotalUSDTracked
  );
  token0DayData.feesUSD = token0DayData.feesUSD.plus(feesUSD);

  token0HourData.volume = token0HourData.volume.plus(amount0Abs);
  token0HourData.volumeUSD = token0HourData.volumeUSD.plus(
    amountTotalUSDTracked
  );
  token0HourData.untrackedVolumeUSD = token0HourData.untrackedVolumeUSD.plus(
    amountTotalUSDTracked
  );
  token0HourData.feesUSD = token0HourData.feesUSD.plus(feesUSD);

  token1DayData.volume = token1DayData.volume.plus(amount1Abs);
  token1DayData.volumeUSD = token1DayData.volumeUSD.plus(amountTotalUSDTracked);
  token1DayData.untrackedVolumeUSD = token1DayData.untrackedVolumeUSD.plus(
    amountTotalUSDTracked
  );
  token1DayData.feesUSD = token1DayData.feesUSD.plus(feesUSD);

  token1HourData.volume = token1HourData.volume.plus(amount1Abs);
  token1HourData.volumeUSD = token1HourData.volumeUSD.plus(
    amountTotalUSDTracked
  );
  token1HourData.untrackedVolumeUSD = token1HourData.untrackedVolumeUSD.plus(
    amountTotalUSDTracked
  );
  token1HourData.feesUSD = token1HourData.feesUSD.plus(feesUSD);

  EntityBuffer.add(swap);
  EntityBuffer.add(token0DayData!);
  EntityBuffer.add(token1DayData!);
  EntityBuffer.add(algebraDayData!);
  EntityBuffer.add(poolHourData!);
  EntityBuffer.add(poolDayData!);
  EntityBuffer.add(factory!);
  EntityBuffer.add(pool!);
  EntityBuffer.add(token0!);
  EntityBuffer.add(token1!);

  // Update inner vars of current or crossed ticks
  let newTick = pool!.tick;
  let modulo = BigDecimal(newTick).mod(TICK_SPACING);
  if (modulo.eq(ZERO_BI)) {
    // Current tick is initialized and needs to be updated
    await loadTickUpdateFeeVarsAndSave(Number(newTick), log, ctx);
  }

  let numIters = BigDecimal(oldTick).minus(newTick).abs().div(TICK_SPACING);

  if (numIters.gt(BigInt(100))) {
    // In case more than 100 ticks need to be updated ignore the update in
    // order to avoid timeouts. From testing this behavior occurs only upon
    // pool initialization. This should not be a big issue as the ticks get
    // updated later. For early users this error also disappears when calling
    // collect
  } else if (BigDecimal(newTick).gt(oldTick)) {
    let firstInitialized = BigDecimal(oldTick).plus(
      BigDecimal(TICK_SPACING).minus(modulo)
    );
    for (let i = firstInitialized; i.lte(newTick); i = i.plus(TICK_SPACING)) {
      await loadTickUpdateFeeVarsAndSave(i.toNumber(), log, ctx);
    }
  } else if (BigDecimal(newTick).lt(oldTick)) {
    let firstInitialized = BigDecimal(oldTick).minus(modulo);
    for (let i = firstInitialized; i.gte(newTick); i = i.minus(TICK_SPACING)) {
      await loadTickUpdateFeeVarsAndSave(i.toNumber(), log, ctx);
    }
  }
};

export const handleSetCommunityFee = async (
  event: {
    communityFee0New: number;
    communityFee1New: number;
  },
  log: Log,
  ctx: DataHandlerContext<Store>
): Promise<void> => {
  let pool: Pool | undefined = EntityBuffer.get(
    "Pool",
    log.address.toLowerCase()
  ) as Pool | undefined;

  if (!pool) {
    pool = await ctx.store.get(Pool, {
      where: { id: log.address.toLowerCase() },
      relations: {
        token0: true,
        token1: true,
        poolDayData: true,
        poolHourData: true,
      },
    });
  }

  if (pool) {
    pool.communityFee0 = BigInt(event.communityFee0New);
    pool.communityFee1 = BigInt(event.communityFee1New);

    EntityBuffer.add(pool);
  }
};

export const handleCollect = async (
  event: {
    owner: string;
    recipient: string;
    bottomTick: number;
    topTick: number;
    amount0: bigint;
    amount1: bigint;
  },
  log: Log,
  ctx: DataHandlerContext<Store>
): Promise<void> => {
  let transaction = await loadTransaction(log as UpdatedLog, ctx);

  let bundle: Bundle | undefined = EntityBuffer.get("Bundle", "1") as
    | Bundle
    | undefined;

  if (!bundle) {
    bundle = await ctx.store.get(Bundle, "1");
  }

  const poolAddress = log.address.toLowerCase();

  let pool: Pool | undefined = EntityBuffer.get(
    "Pool",
    poolAddress.toLowerCase()
  ) as Pool | undefined;

  if (!pool) {
    pool = await ctx.store.get(Pool, {
      where: { id: poolAddress },
      relations: {
        token0: true,
        token1: true,
        poolDayData: true,
        poolHourData: true,
      },
    });
  }

  let factory: Factory | undefined = EntityBuffer.get(
    "Factory",
    FACTORY_ADDRESS.toLowerCase()
  ) as Factory | undefined;

  if (!factory) {
    factory = await ctx.store.get(Factory, FACTORY_ADDRESS.toLowerCase());
  }

  let token0: Token | undefined = EntityBuffer.get(
    "Token",
    pool!.token0.id.toLowerCase()
  ) as Token | undefined;

  if (!token0) {
    token0 = await ctx.store.get(Token, {
      where: { id: pool!.token0.id.toLowerCase() },
      relations: { tokenDayData: true, whitelistPools: true },
    });
  }

  let token1: Token | undefined = EntityBuffer.get(
    "Token",
    pool!.token1.id.toLowerCase()
  ) as Token | undefined;

  if (!token1) {
    token1 = await ctx.store.get(Token, {
      where: { id: pool!.token1.id.toLowerCase() },
      relations: { tokenDayData: true, whitelistPools: true },
    });
  }

  let amount0 = convertTokenToDecimal(event.amount0, token0!.decimals);
  let amount1 = convertTokenToDecimal(event.amount1, token1!.decimals);

  if (transaction) {
    let burn = EntityBuffer.get(
      "Burn",
      transaction.id.toLowerCase() +
        "#" +
        BigDecimal(pool!.txCount).minus(ONE_BI).toString()
    ) as Burn | undefined;

    if (!burn) {
      burn = await ctx.store.get(
        Burn,
        transaction.id.toLowerCase() +
          "#" +
          BigDecimal(pool!.txCount).minus(ONE_BI).toString()
      );
    }

    if (burn) {
      amount0 = amount0.minus(burn.amount0);
      amount1 = amount1.minus(burn.amount1);
    }

    let burn2 = EntityBuffer.get(
      "Burn",
      transaction.id.toLowerCase() + "#" + pool!.txCount.toString()
    ) as Burn | undefined;

    if (!burn2) {
      burn2 = await ctx.store.get(
        Burn,
        transaction.id.toLowerCase() + "#" + pool!.txCount.toString()
      );
    }

    if (burn2) {
      amount0 = amount0.minus(burn2.amount0);
      amount1 = amount1.minus(burn2.amount1);
    }
  }

  let amountUSD = amount0
    .times(token0!.derivedMatic.times(bundle!.maticPriceUSD))
    .plus(amount1.times(token1!.derivedMatic.times(bundle!.maticPriceUSD)));

  // reset tvl aggregates until new amounts calculated
  factory!.totalValueLockedMatic = factory!.totalValueLockedMatic.minus(
    pool!.totalValueLockedMatic
  );

  // update globals
  factory!.txCount = BigInt(
    BigDecimal(factory!.txCount).plus(ONE_BI).toNumber()
  );

  // update token0 data
  token0!.txCount = BigInt(BigDecimal(token0!.txCount).plus(ONE_BI).toNumber());
  token0!.totalValueLocked = token0!.totalValueLocked.minus(amount0);
  token0!.totalValueLockedUSD = token0!.totalValueLocked.times(
    token0!.derivedMatic.times(bundle!.maticPriceUSD)
  );

  // update token1 data
  token1!.txCount = BigInt(BigDecimal(token1!.txCount).plus(ONE_BI).toNumber());
  token1!.totalValueLocked = token1!.totalValueLocked.minus(amount1);
  token1!.totalValueLockedUSD = token1!.totalValueLocked.times(
    token1!.derivedMatic.times(bundle!.maticPriceUSD)
  );

  // pool data
  pool!.txCount = BigInt(BigDecimal(pool!.txCount).plus(ONE_BI).toNumber());

  pool!.totalValueLockedToken0 = pool!.totalValueLockedToken0.minus(amount0);
  pool!.totalValueLockedToken1 = pool!.totalValueLockedToken1.minus(amount1);
  pool!.totalValueLockedMatic = pool!.totalValueLockedToken0
    .times(token0!.derivedMatic)
    .plus(pool!.totalValueLockedToken1.times(token1!.derivedMatic));
  pool!.totalValueLockedUSD = pool!.totalValueLockedMatic.times(
    bundle!.maticPriceUSD
  );

  // reset aggregates with new amounts
  factory!.totalValueLockedMatic = factory!.totalValueLockedMatic.plus(
    pool!.totalValueLockedMatic
  );
  factory!.totalValueLockedUSD = factory!.totalValueLockedMatic.times(
    bundle!.maticPriceUSD
  );

  EntityBuffer.add(token0!);
  EntityBuffer.add(token1!);
  EntityBuffer.add(pool!);
  EntityBuffer.add(factory!);
};

const updateTickFeeVarsAndSave = async (
  tick: Tick,
  log: Log,
  ctx: DataHandlerContext<Store>
): Promise<void> => {
  let poolAddress = log.address;

  let lastBatchBlockHeader = { height: log.block.height };

  const ctxContract: BlockContext = {
    _chain: ctx._chain,
    block: lastBatchBlockHeader,
  };

  let poolContract = new PoolABI(
    ctxContract,
    lastBatchBlockHeader,
    poolAddress
  );

  let tickResult = await poolContract.ticks(Number(tick.tickIdx));
  tick.feeGrowthOutside0X128 = tickResult.outerFeeGrowth0Token;
  tick.feeGrowthOutside1X128 = tickResult.outerFeeGrowth0Token;

  EntityBuffer.add(tick);

  await updateTickDayData(tick, log, ctx);
};

export const handleChangeFee = async (
  event: {
    fee: number;
  },
  log: Log,
  ctx: DataHandlerContext<Store>
): Promise<void> => {
  const poolAddress = log.address.toLowerCase();
  let pool: Pool | undefined = EntityBuffer.get("Pool", poolAddress) as
    | Pool
    | undefined;

  if (!pool) {
    pool = await ctx.store.get(Pool, {
      where: { id: poolAddress },
      relations: {
        token0: true,
        token1: true,
      },
    });
  }

  pool!.fee = BigInt(event.fee);

  EntityBuffer.add(pool!);
  let fee: PoolFeeData | undefined = EntityBuffer.get(
    "PoolFeeData",
    poolAddress + "#" + log.block.timestamp.toString()
  ) as PoolFeeData | undefined;

  if (!fee) {
    fee = await ctx.store.get(
      PoolFeeData,
      poolAddress + "#" + log.block.timestamp.toString()
    );
  }

  if (!fee) {
    fee = new PoolFeeData({
      id: log.block.timestamp.toString() + poolAddress,
    });
    fee.pool = poolAddress;
    fee.fee = BigInt(event.fee);
    fee.timestamp = BigInt(log.block.timestamp);
  } else {
    fee.fee = BigInt(event.fee);
  }
  await updateFeeHourData(log, ctx, BigInt(event.fee));

  EntityBuffer.add(fee);
};

const loadTickUpdateFeeVarsAndSave = async (
  tickId: number,
  log: Log,
  ctx: DataHandlerContext<Store>
): Promise<void> => {
  let poolAddress = log.address.toLowerCase();
  let tick: Tick | undefined = EntityBuffer.get(
    "Tick",
    poolAddress.concat("#").concat(tickId.toString())
  ) as Tick | undefined;

  if (!tick) {
    tick = await ctx.store.get(
      Tick,
      poolAddress.concat("#").concat(tickId.toString())
    );
  }

  if (tick != undefined) {
    await updateTickFeeVarsAndSave(tick!, log, ctx);
  }
};
