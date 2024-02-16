import { WHITELIST_TOKENS } from "./../utils/pricing";
/* eslint-disable prefer-const */
import {
  FACTORY_ADDRESS,
  ZERO_BI,
  ONE_BI,
  ZERO_BD,
  ADDRESS_ZERO,
  pools_list,
} from "./../utils/constants";
import { Factory, Pool, Token, Bundle, TokenPoolWhitelist } from "../model";
// import { Pool as PoolTemplate} from '../types/templates'
import {
  fetchTokenSymbol,
  fetchTokenName,
  fetchTokenTotalSupply,
  fetchTokenDecimals,
} from "../utils/token";
import { DataHandlerContext, Log } from "@subsquid/evm-processor";
import { Store } from "../db";
import { EntityBuffer } from "../utils/entityBuffer";
import { BigDecimal } from "@subsquid/big-decimal";

export const handlePoolCreated = async (
  event: {
    token0: string;
    token1: string;
    pool: string;
  },
  log: Log,
  ctx: DataHandlerContext<Store>
): Promise<void> => {
  // temp fix

  let factory: Factory | undefined = EntityBuffer.get(
    "Factory",
    FACTORY_ADDRESS.toLowerCase()
  ) as Factory | undefined;

  if (!factory) {
    factory = await ctx.store.get(Factory, FACTORY_ADDRESS.toLowerCase());
  }

  // load factory
  if (!factory) {
    factory = new Factory({ id: FACTORY_ADDRESS.toLowerCase() });
    factory.poolCount = BigInt(ZERO_BI.toNumber());
    factory.totalVolumeMatic = ZERO_BD;
    factory.totalVolumeUSD = ZERO_BD;
    factory.untrackedVolumeUSD = ZERO_BD;
    factory.totalFeesUSD = ZERO_BD;
    factory.totalFeesMatic = ZERO_BD;
    factory.totalValueLockedMatic = ZERO_BD;
    factory.totalValueLockedUSD = ZERO_BD;
    factory.totalValueLockedUSDUntracked = ZERO_BD;
    factory.totalValueLockedMaticUntracked = ZERO_BD;
    factory.txCount = BigInt(ZERO_BI.toNumber());
    factory.owner = ADDRESS_ZERO;

    // create new bundle for tracking matic price
    let bundle = new Bundle({ id: "1" });
    bundle.maticPriceUSD = ZERO_BD;

    EntityBuffer.add(bundle);
  }

  factory.poolCount = BigInt(
    BigDecimal(factory.poolCount).plus(ONE_BI).toNumber()
  );

  let pool = new Pool({ id: event.pool.toLowerCase() }) as Pool;

  let token0_address = event.token0.toLowerCase();
  let token1_address = event.token1.toLowerCase();

  let token0: Token | undefined = EntityBuffer.get("Token", token0_address) as
    | Token
    | undefined;

  if (!token0) {
    token0 = await ctx.store.get(Token, token0_address);
  }

  let token1: Token | undefined = EntityBuffer.get("Token", token1_address) as
    | Token
    | undefined;

  if (!token1) {
    token1 = await ctx.store.get(Token, token1_address);
  }

  if (pools_list.includes(event.pool)) {
    token0 = await ctx.store.get(Token, event.token1.toLowerCase());
    token1 = await ctx.store.get(Token, event.token0.toLowerCase());

    token0_address = event.token1;
    token1_address = event.token0;
  }

  // fetch info if null
  if (!token0) {
    token0 = new Token({ id: token0_address.toLowerCase() });
    token0.symbol = await fetchTokenSymbol(token0_address, ctx);
    token0.name = await fetchTokenName(token0_address, ctx);
    token0.totalSupply = BigInt(
      Number(await fetchTokenTotalSupply(token0_address, ctx))
    );
    let decimals = await fetchTokenDecimals(token0_address, ctx);

    // bail if we couldn't figure out the decimals
    if (!decimals) {
      ctx.log.debug("mybug the decimal on token 0 was null");
      return;
    }

    token0.decimals = BigInt(decimals.toString());
    token0.derivedMatic = ZERO_BD;
    token0.volume = ZERO_BD;
    token0.volumeUSD = ZERO_BD;
    token0.feesUSD = ZERO_BD;
    token0.untrackedVolumeUSD = ZERO_BD;
    token0.totalValueLocked = ZERO_BD;
    token0.totalValueLockedUSD = ZERO_BD;
    token0.totalValueLockedUSDUntracked = ZERO_BD;
    token0.txCount = BigInt(ZERO_BI.toNumber());
    token0.poolCount = BigInt(ZERO_BI.toNumber());
    token0.whitelistPools = [];
  }

  if (!token1) {
    token1 = new Token({ id: token1_address.toLowerCase() });
    token1.symbol = await fetchTokenSymbol(token1_address, ctx);
    token1.name = await fetchTokenName(token1_address, ctx);
    token1.totalSupply = BigInt(
      Number(await fetchTokenTotalSupply(token1_address, ctx))
    );
    let decimals = await fetchTokenDecimals(token1_address, ctx);
    // bail if we couldn't figure out the decimals
    if (decimals === null) {
      ctx.log.debug("mybug the decimal on token 0 was null");
      return;
    }
    token1.decimals = BigInt(decimals.toString());
    token1.derivedMatic = ZERO_BD;
    token1.volume = ZERO_BD;
    token1.volumeUSD = ZERO_BD;
    token1.untrackedVolumeUSD = ZERO_BD;
    token1.feesUSD = ZERO_BD;
    token1.totalValueLocked = ZERO_BD;
    token1.totalValueLockedUSD = ZERO_BD;
    token1.totalValueLockedUSDUntracked = ZERO_BD;
    token1.txCount = BigInt(ZERO_BI.toNumber());
    token1.poolCount = BigInt(ZERO_BI.toNumber());
    token1.whitelistPools = [];
  }

  // update white listed pools
  if (WHITELIST_TOKENS.includes(token0.id)) {
    let newPools = token1.whitelistPools;
    const tokenPoolWhitelist = new TokenPoolWhitelist({
      id: pool.id,
      pool: pool,
      token: token0,
    });
    EntityBuffer.add(tokenPoolWhitelist);
    newPools.push(tokenPoolWhitelist);
    token1.whitelistPools = newPools;
  }
  if (WHITELIST_TOKENS.includes(token1.id)) {
    const tokenPoolWhitelist = new TokenPoolWhitelist({
      id: pool.id,
      pool: pool,
      token: token1,
    });
    EntityBuffer.add(tokenPoolWhitelist);
    let newPools = token0.whitelistPools;
    newPools.push(tokenPoolWhitelist);
    token0.whitelistPools = newPools;
  }

  pool.token0 = token0;
  pool.token1 = token1;
  pool.fee = BigInt(100);
  pool.createdAtTimestamp = BigInt(log.block.timestamp);
  pool.createdAtBlockNumber = BigInt(log.block.height);
  pool.liquidityProviderCount = BigInt(ZERO_BI.toNumber());
  pool.txCount = BigInt(ZERO_BI.toNumber());
  pool.liquidity = BigInt(ZERO_BI.toNumber());
  pool.sqrtPrice = BigInt(ZERO_BI.toNumber());
  pool.feeGrowthGlobal0X128 = BigInt(ZERO_BI.toNumber());
  pool.feeGrowthGlobal1X128 = BigInt(ZERO_BI.toNumber());
  pool.communityFee0 = BigInt(ZERO_BI.toNumber());
  pool.communityFee1 = BigInt(ZERO_BI.toNumber());
  pool.token0Price = ZERO_BD;
  pool.token1Price = ZERO_BD;
  pool.observationIndex = BigInt(ZERO_BI.toNumber());
  pool.totalValueLockedToken0 = ZERO_BD;
  pool.totalValueLockedToken1 = ZERO_BD;
  pool.totalValueLockedUSD = ZERO_BD;
  pool.totalValueLockedMatic = ZERO_BD;
  pool.totalValueLockedUSDUntracked = ZERO_BD;
  pool.volumeToken0 = ZERO_BD;
  pool.volumeToken1 = ZERO_BD;
  pool.volumeUSD = ZERO_BD;
  pool.feesUSD = ZERO_BD;
  pool.feesToken0 = ZERO_BD;
  pool.feesToken1 = ZERO_BD;
  pool.untrackedVolumeUSD = ZERO_BD;

  pool.collectedFeesToken0 = ZERO_BD;
  pool.collectedFeesToken1 = ZERO_BD;
  pool.collectedFeesUSD = ZERO_BD;

  EntityBuffer.add(pool);
  // create the tracked contract based on the template
  // PoolTemplate.create(event.params.pool);

  EntityBuffer.add(token0);
  EntityBuffer.add(token1);
  EntityBuffer.add(factory);
  // token0.save();
  // token1.save();
  // factory.save();
};
