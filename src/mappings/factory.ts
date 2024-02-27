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
  console.log(
    event.token0.toLowerCase() === "0xffffffff1fcacbd218edc0eba20fc2308c778080",
    "token0 is eq to it",
    event.token0
  );
  console.log(
    event.token1.toLowerCase() === "0xffffffff1fcacbd218edc0eba20fc2308c778080",
    "token1 is eq to it",
    event.token1
  );

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
    factory.totalVolumeUSD = ZERO_BD;
    factory.totalVolumeMatic = ZERO_BD;
    factory.totalFeesUSD = ZERO_BD;
    factory.totalFeesMatic = ZERO_BD;
    factory.untrackedVolumeUSD = ZERO_BD;
    factory.totalValueLockedUSD = ZERO_BD;
    factory.totalValueLockedMatic = ZERO_BD;
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
    token0 = await ctx.store.get(Token, {
      where: { id: token0_address },
      relations: { tokenDayData: true, whitelistPools: true },
    });
  }

  let token1: Token | undefined = EntityBuffer.get("Token", token1_address) as
    | Token
    | undefined;
  if (!token1) {
    token1 = await ctx.store.get(Token, {
      where: { id: token1_address },
      relations: { tokenDayData: true, whitelistPools: true },
    });
  }

  if (pools_list.includes(event.pool.toLowerCase())) {
    console.log("yes we are running");
    token0 = EntityBuffer.get("Token", event.token1.toLowerCase()) as
      | Token
      | undefined;
    token1 = EntityBuffer.get("Token", event.token0.toLowerCase()) as
      | Token
      | undefined;

    if (!token0)
      token0 = await ctx.store.get(Token, {
        where: { id: event.token1.toLowerCase() },
        relations: { tokenDayData: true, whitelistPools: true },
      });
    if (!token1)
      token1 = await ctx.store.get(Token, {
        where: { id: event.token0.toLowerCase() },
        relations: { tokenDayData: true, whitelistPools: true },
      });

    token0_address = event.token1;
    token1_address = event.token0;
  }

  // fetch info if null
  if (!token0) {
    token0 = new Token({ id: token0_address });
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
    console.log("theres no token1 so i am running");
    token1 = new Token({ id: token1_address });
    token1.symbol = await fetchTokenSymbol(token1_address, ctx);
    token1.name = await fetchTokenName(token1_address, ctx);
    token1.totalSupply = BigInt(
      Number(await fetchTokenTotalSupply(token1_address, ctx))
    );
    let decimals = await fetchTokenDecimals(token1_address, ctx);
    // bail if we couldn't figure out the decimals
    if (!decimals) {
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
  pool.untrackedFeesUSD = ZERO_BD;
  pool.collectedFeesToken0 = ZERO_BD;
  pool.collectedFeesToken1 = ZERO_BD;
  pool.collectedFeesUSD = ZERO_BD;
  pool.tick = BigInt("0");

  console.log(token0.id, "token0 outside of any statement");
  console.log(token1.id, "token1 outside of any statement");

  // create the tracked contract based on the template
  // PoolTemplate.create(event.params.pool);
  EntityBuffer.add(token0);
  EntityBuffer.add(token1);
  if (token0PoolWhitelist !== undefined) EntityBuffer.add(token0PoolWhitelist);
  if (token1PoolWhitelist != undefined) EntityBuffer.add(token1PoolWhitelist!);
  EntityBuffer.add(pool);
  EntityBuffer.add(factory);
};
