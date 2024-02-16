/* eslint-disable prefer-const */
import { Contract as FactoryContract } from "../abi/factory";
import { BigDecimal } from "@subsquid/big-decimal";
import { Multicall } from "../abi/multicall";

export const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
export const FACTORY_ADDRESS = "0xabE1655110112D0E45EF91e94f8d757e4ddBA59C";
const MULTICALL_CONTRACT = "0x5ba1e12693dc8f9c48aad8770482f4739beed696";

// export const multicall = new Multicall(ctx, lastBlock, MULTICALL_CONTRACT);

export let ZERO_BI = BigDecimal(0);
export let ONE_BI = BigDecimal(1);
export let ZERO_BD = BigDecimal("0");
export let ONE_BD = BigDecimal("1");
export let BI_18 = BigInt(18);
export let TICK_SPACING = BigInt(60);

export let pools_list = [""];
