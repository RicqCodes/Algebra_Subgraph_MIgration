/* eslint-disable prefer-const */
import { ONE_BD, ZERO_BD, ZERO_BI } from "./constants";
import { Bundle, Pool, Token } from "../model/generated";
import { exponentToBigDecimal, safeDiv } from "../utils/index";
import { BigDecimal } from "@subsquid/big-decimal";
import { EntityBuffer } from "./entityBuffer";
import { DataHandlerContext } from "@subsquid/evm-processor";
import { Store } from "../db";

const WMatic_ADDRESS = "0xacc15dc74880c9944775448304b263d191c6077f";
const USDC_WMatic_03_POOL = "0xab8c35164a8e3ef302d18da953923ea31f0fe393";

// token where amounts should contribute to tracked volume and liquidity
// usually tokens that many tokens are paired with s
export let WHITELIST_TOKENS: string[] = [
  "0xacc15dc74880c9944775448304b263d191c6077f", // WGLMR
  "0x931715fee2d06333043d11f658c8ce934ac61d0c", // USDC
  "0xffffffffea09fb06d082fd1275cd48b191cbcd1d", // USDT
  "0xffffffff1fcacbd218edc0eba20fc2308c778080", // DOT
];

let MINIMUM_Matic_LOCKED = BigDecimal("0");

let Q192 = Math.pow(2, 192);

let STABLE_COINS: string[] = [
  "0x931715fee2d06333043d11f658c8ce934ac61d0c", // USDC
  "0xffffffffea09fb06d082fd1275cd48b191cbcd1d", // USDT
  "0x322e86852e492a7ee17f28a78c663da38fb33bfb", // FRAX
];

export function priceToTokenPrices(
  price: BigInt,
  token0: Token,
  token1: Token
): BigDecimal[] {
  let num = BigDecimal(+price).times(+price);
  let denom = BigDecimal(Q192.toString());
  let price1 = num
    .div(denom)
    .times(exponentToBigDecimal(token0.decimals))
    .div(exponentToBigDecimal(token1.decimals));

  let price0 = safeDiv(BigDecimal("1"), price1);
  return [price0, price1];
}

export const getEthPriceInUSD = async (
  ctx: DataHandlerContext<Store>
): Promise<BigDecimal> => {
  let usdcPool: Pool | undefined = EntityBuffer.get(
    "Pool",
    USDC_WMatic_03_POOL.toLowerCase()
  ) as Pool | undefined;

  if (!usdcPool) {
    usdcPool = await ctx.store.get(Pool, USDC_WMatic_03_POOL.toLowerCase());
  }

  if (usdcPool) {
    return usdcPool!.token0Price;
  } else {
    return ZERO_BD;
  }
};

/**
 * Search through graph to find derived Eth per token.
 * @todo update to be derived Matic (add stablecoin estimates)
 **/
export const findEthPerToken = async (
  token: Token,
  ctx: DataHandlerContext<Store>
): Promise<BigDecimal> => {
  if (token.id == WMatic_ADDRESS) {
    return ONE_BD;
  }
  let whiteList = token.whitelistPools;
  // for now just take USD from pool with greatest TVL
  // need to update this to actually detect best rate based on liquidity distribution
  let largestLiquidityMatic = ZERO_BD;
  let priceSoFar = ZERO_BD;

  let bundle: Bundle | undefined = EntityBuffer.get("Bundle", "1") as
    | Bundle
    | undefined;

  if (!bundle) {
    bundle = await ctx.store.get(Bundle, "1");
  }

  // hardcoded fix for incorrect rates
  // if whitelist includes token - get the safe price
  if (STABLE_COINS.includes(token.id)) {
    priceSoFar = safeDiv(ONE_BD, bundle!.maticPriceUSD);
  } else {
    for (let i = 0; i < whiteList.length; ++i) {
      let poolAddress = whiteList[i];

      let pool: Pool | undefined = EntityBuffer.get(
        "Pool",
        poolAddress.id.toLowerCase()
      ) as Pool | undefined;

      if (!pool) {
        pool = await ctx.store.get(Pool, poolAddress.id.toLowerCase());
      }

      if (BigDecimal(pool!.liquidity).gt(ZERO_BI)) {
        if (pool!.token0.id == token.id) {
          // whitelist token is token1
          let token1: Token | undefined = EntityBuffer.get(
            "Token",
            pool!.token1.id.toLowerCase()
          ) as Token | undefined;

          if (!token1) {
            token1 = await ctx.store.get(Token, pool!.token1.id.toLowerCase());
          }

          // get the derived Matic in pool
          let maticLocked = pool!.totalValueLockedToken1.times(
            token1!.derivedMatic
          );
          if (
            maticLocked.gt(largestLiquidityMatic) &&
            maticLocked.gt(MINIMUM_Matic_LOCKED)
          ) {
            largestLiquidityMatic = maticLocked;
            // token1 per our token * Eth per token1
            priceSoFar = pool!.token1Price.times(
              token1!.derivedMatic as BigDecimal
            );
          }
        }
        if (pool!.token1.id == token.id) {
          let token0: Token | undefined = EntityBuffer.get(
            "Token",
            pool!.token0.id.toLowerCase()
          ) as Token | undefined;

          if (!token0) {
            token0 = await ctx.store.get(Token, pool!.token0.id.toLowerCase());
          }

          // get the derived Matic in pool
          let maticLocked = pool!.totalValueLockedToken0.times(
            token0!.derivedMatic
          );
          if (
            maticLocked.gt(largestLiquidityMatic) &&
            maticLocked.gt(MINIMUM_Matic_LOCKED)
          ) {
            largestLiquidityMatic = maticLocked;
            // token0 per our token * Matic per token0
            priceSoFar = pool!.token0Price.times(
              token0!.derivedMatic as BigDecimal
            );
          }
        }
      }
    }
  }
  return priceSoFar; // nothing was found return 0
};

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export const getTrackedAmountUSD = async (
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token,
  ctx: DataHandlerContext<Store>
): Promise<BigDecimal> => {
  let bundle: Bundle | undefined = EntityBuffer.get("Bundle", "1") as
    | Bundle
    | undefined;

  if (!bundle) {
    bundle = await ctx.store.get(Bundle, "1");
  }

  let price0USD = token0.derivedMatic.times(bundle!.maticPriceUSD);
  let price1USD = token1.derivedMatic.times(bundle!.maticPriceUSD);

  // both are whitelist tokens, return sum of both amounts
  if (
    WHITELIST_TOKENS.includes(token0.id) &&
    WHITELIST_TOKENS.includes(token1.id)
  ) {
    return tokenAmount0.times(price0USD).plus(tokenAmount1.times(price1USD));
  }

  // take double value of the whitelisted token amount
  if (
    WHITELIST_TOKENS.includes(token0.id) &&
    !WHITELIST_TOKENS.includes(token1.id)
  ) {
    return tokenAmount0.times(price0USD).times(BigDecimal("2"));
  }

  // take double value of the whitelisted token amount
  if (
    !WHITELIST_TOKENS.includes(token0.id) &&
    WHITELIST_TOKENS.includes(token1.id)
  ) {
    return tokenAmount1.times(price1USD).times(BigDecimal("2"));
  }

  // neither token is on white list, tracked amount is 0
  return ZERO_BD;
};
