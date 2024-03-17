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
    type: string;
    data: { token0: string; token1: string; pool: string };
    log: Log;
    decoded: any;
  },
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
    factory.poolCount = ZERO_BI;
    factory.totalVolumeUSD = ZERO_BD;
    factory.totalVolumeMatic = ZERO_BD;
    factory.totalFeesUSD = ZERO_BD;
    factory.totalFeesMatic = ZERO_BD;
    factory.untrackedVolumeUSD = ZERO_BD;
    factory.totalValueLockedUSD = ZERO_BD;
    factory.totalValueLockedMatic = ZERO_BD;
    factory.totalValueLockedUSDUntracked = ZERO_BD;
    factory.totalValueLockedMaticUntracked = ZERO_BD;
    factory.txCount = ZERO_BI;
    factory.owner = ADDRESS_ZERO;

    // create new bundle for tracking matic price
    let bundle = new Bundle({ id: "1" });
    bundle.maticPriceUSD = ZERO_BD;

    EntityBuffer.add(bundle);
  }

  factory.poolCount = BigInt(
    BigDecimal(factory.poolCount).plus(ONE_BI).toNumber()
  );

  let pool = new Pool({ id: event.data.pool.toLowerCase() }) as Pool;

  let token0_address = event.data.token0.toLowerCase();
  let token1_address = event.data.token1.toLowerCase();

  let token0: Token | undefined = EntityBuffer.get("Token", token0_address) as
    | Token
    | undefined;
  if (!token0) {
    token0 = await ctx.store.get(Token, {
      where: { id: token0_address },
      relations: { whitelistPools: true },
    });
  }

  let token1: Token | undefined = EntityBuffer.get("Token", token1_address) as
    | Token
    | undefined;
  if (!token1) {
    token1 = await ctx.store.get(Token, {
      where: { id: token1_address },
      relations: { whitelistPools: true },
    });
  }

  if (pools_list.includes(event.data.pool.toLowerCase())) {
    token0 = EntityBuffer.get("Token", event.data.token1.toLowerCase()) as
      | Token
      | undefined;
    token1 = EntityBuffer.get("Token", event.data.token0.toLowerCase()) as
      | Token
      | undefined;

    if (!token0)
      token0 = await ctx.store.get(Token, {
        where: { id: event.data.token1.toLowerCase() },
        relations: { whitelistPools: true },
      });
    if (!token1)
      token1 = await ctx.store.get(Token, {
        where: { id: event.data.token0.toLowerCase() },
        relations: { whitelistPools: true },
      });

    token0_address = event.data.token1;
    token1_address = event.data.token0;
  }

  // fetch info if null
  if (!token0) {
    token0 = new Token({ id: token0_address });
    token0.symbol = event.decoded.token0.symbol;
    token0.name = event.decoded.token0.name;
    token0.totalSupply = event.decoded.token0.totalSupply;

    // token0.symbol =  await fetchTokenSymbol(token0_address, ctx);
    // token0.name = await fetchTokenName(token0_address, ctx);
    // token0.totalSupply = BigInt(
    //   Number(await fetchTokenTotalSupply(token0_address, ctx))
    // );
    // let decimals = await fetchTokenDecimals(token0_address, ctx);

    // bail if we couldn't figure out the decimals
    // if (!decimals) {
    //   ctx.log.debug("mybug the decimal on token 0 was null");
    //   return;
    // }

    token0.decimals = BigInt(event.decoded.token0.decimals.toString());
    token0.derivedMatic = ZERO_BD;
    token0.volume = ZERO_BD;
    token0.volumeUSD = ZERO_BD;
    token0.feesUSD = ZERO_BD;
    token0.untrackedVolumeUSD = ZERO_BD;
    token0.totalValueLocked = ZERO_BD;
    token0.totalValueLockedUSD = ZERO_BD;
    token0.totalValueLockedUSDUntracked = ZERO_BD;
    token0.txCount = ZERO_BI;
    token0.poolCount = ZERO_BI;
    token0.whitelistPools = [];
  }

  if (!token1) {
    console.log("theres no token1 so i am running");
    token1 = new Token({ id: token1_address });
    token1.symbol = event.decoded.token1.symbol;
    token1.name = event.decoded.token1.name;
    token1.totalSupply = event.decoded.token1.totalSupply;

    // token1.symbol =
    // token1.symbol = await fetchTokenSymbol(token1_address, ctx);
    // token1.name = await fetchTokenName(token1_address, ctx);
    // token1.totalSupply = BigInt(
    //   Number(await fetchTokenTotalSupply(token1_address, ctx))
    // );
    // let decimals = await fetchTokenDecimals(token1_address, ctx);
    // // bail if we couldn't figure out the decimals
    // if (!decimals) {
    //   ctx.log.debug("mybug the decimal on token 0 was null");
    //   return;
    // }
    token1.decimals = BigInt(event.decoded.token1.decimals.toString());
    token1.derivedMatic = ZERO_BD;
    token1.volume = ZERO_BD;
    token1.volumeUSD = ZERO_BD;
    token1.untrackedVolumeUSD = ZERO_BD;
    token1.feesUSD = ZERO_BD;
    token1.totalValueLocked = ZERO_BD;
    token1.totalValueLockedUSD = ZERO_BD;
    token1.totalValueLockedUSDUntracked = ZERO_BD;
    token1.txCount = ZERO_BI;
    token1.poolCount = ZERO_BI;
    token1.whitelistPools = [];
  }

  let token0PoolWhitelist: TokenPoolWhitelist | undefined;
  let token1PoolWhitelist: TokenPoolWhitelist | undefined;
  // update white listed pools
  if (WHITELIST_TOKENS.includes(token0.id)) {
    let newPools = token1.whitelistPools || [];
    token0PoolWhitelist = new TokenPoolWhitelist({
      id: `${token1.id}-${pool.id}`,
      pool: pool,
      token: token0,
    });
    newPools.push(token0PoolWhitelist);
    token1.whitelistPools = newPools;
  }
  if (WHITELIST_TOKENS.includes(token1.id)) {
    let newPools = token0.whitelistPools || [];
    token1PoolWhitelist = new TokenPoolWhitelist({
      id: `${token0.id}-${pool.id}`,
      pool: pool,
      token: token1,
    });
    newPools.push(token1PoolWhitelist);
    token0.whitelistPools = newPools;
  }

  pool.token0 = token0;
  pool.token1 = token1;
  pool.fee = BigInt(100);
  pool.createdAtTimestamp = BigInt(event.log.block.timestamp);
  pool.createdAtBlockNumber = BigInt(event.log.block.height);
  pool.liquidityProviderCount = ZERO_BI;
  pool.txCount = ZERO_BI;
  pool.liquidity = ZERO_BI;
  pool.sqrtPrice = ZERO_BI;
  pool.feeGrowthGlobal0X128 = ZERO_BI;
  pool.feeGrowthGlobal1X128 = ZERO_BI;
  pool.communityFee0 = ZERO_BI;
  pool.communityFee1 = ZERO_BI;
  pool.token0Price = ZERO_BD;
  pool.token1Price = ZERO_BD;
  pool.observationIndex = ZERO_BI;
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
  pool.untrackedFeesUSD = ZERO_BD;
  pool.collectedFeesToken0 = ZERO_BD;
  pool.collectedFeesToken1 = ZERO_BD;
  pool.collectedFeesUSD = ZERO_BD;
  pool.tick = BigInt("0");

  // await ctx.store.upsert(token0)
  // await ctx.store.upsert(token1)
  EntityBuffer.add(token0);
  EntityBuffer.add(token1);
  EntityBuffer.add(pool);
  if (token0PoolWhitelist !== undefined) EntityBuffer.add(token0PoolWhitelist);
  if (token1PoolWhitelist != undefined) EntityBuffer.add(token1PoolWhitelist!);
  EntityBuffer.add(factory);
};
