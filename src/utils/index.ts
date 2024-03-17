/* eslint-disable prefer-const */
import { BigDecimal } from "@subsquid/big-decimal";
import { ONE_BI, ZERO_BI, ZERO_BD, ONE_BD } from "../utils/constants";
import { Transaction } from "../model";
import { EntityBuffer } from "./entityBuffer";
import { DataHandlerContext, Log } from "@subsquid/evm-processor";
import { Store } from "../db";
import { EvmTransaction } from "@subsquid/evm-processor/lib/interfaces/evm";
import { UpdatedLog } from "./interfaces";

export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
  let bd = BigDecimal("1");
  for (
    let i = ZERO_BI;
    BigInt(i) > BigInt(decimals.toString());
    i = i + ONE_BI
  ) {
    bd = bd.times(BigDecimal("10"));
  }
  return bd;
}

// return 0 if denominator is 0 in division
export function safeDiv(amount0: BigDecimal, amount1: BigDecimal): BigDecimal {
  if (amount1.eq(ZERO_BD)) {
    return ZERO_BD;
  } else {
    return amount0.div(amount1);
  }
}
export function bigDecimalExponated(
  value: BigDecimal,
  power: bigint
): BigDecimal {
  // Ensure power is within the safe integer range
  if (power < Number.MIN_SAFE_INTEGER || power > Number.MAX_SAFE_INTEGER) {
    throw new Error("Power value is out of the safe integer range.");
  }

  // Convert bigint to number for the pow method
  const powerNumber = Number(power);

  const valueData = Math.pow(value.toNumber(), powerNumber);
  return BigDecimal(valueData);
}

export function tokenAmountToDecimal(
  tokenAmount: BigInt,
  exchangeDecimals: BigInt
): BigDecimal {
  if (exchangeDecimals == ZERO_BI) {
    return BigDecimal(tokenAmount.toString());
  }
  return BigDecimal(tokenAmount.toString()).div(
    exponentToBigDecimal(exchangeDecimals)
  );
}

export function priceToDecimal(
  amount: BigDecimal,
  exchangeDecimals: BigInt
): BigDecimal {
  if (exchangeDecimals == ZERO_BI) {
    return amount;
  }
  return safeDiv(amount, exponentToBigDecimal(exchangeDecimals));
}

export function equalToZero(value: BigDecimal): boolean {
  const formattedVal = parseFloat(value.toString());
  const zero = parseFloat(ZERO_BD.toString());
  if (zero == formattedVal) {
    return true;
  }
  return false;
}

export function isNullEthValue(value: string): boolean {
  return (
    value ==
    "0x0000000000000000000000000000000000000000000000000000000000000001"
  );
}

export function bigDecimalExp18(): BigDecimal {
  return BigDecimal("1000000000000000000");
}

export function convertTokenToDecimal(
  tokenAmount: BigInt,
  exchangeDecimals: BigInt
): BigDecimal {
  if (exchangeDecimals == ZERO_BI) {
    return BigDecimal(tokenAmount.toString());
  }
  return BigDecimal(tokenAmount.toString()).div(
    exponentToBigDecimal(exchangeDecimals)
  );
}

export function convertEthToDecimal(matic: BigInt): BigDecimal {
  return BigDecimal(matic.toString()).div(exponentToBigDecimal(BigInt(18)));
}

export const loadTransaction = async (
  log: UpdatedLog,
  ctx: DataHandlerContext<Store>
): Promise<Transaction> => {
  let transaction: Transaction | undefined = EntityBuffer.get(
    "Transaction",
    log.transaction!.hash.toLowerCase()!
  ) as Transaction | undefined;

  if (!transaction) {
    transaction = await ctx.store.get(
      Transaction,
      log.transaction?.hash.toLowerCase()!
    );
  }

  if (!transaction) {
    transaction = new Transaction({ id: log.transaction!.hash.toLowerCase()! });
  }

  transaction.blockNumber = BigInt(log.block.height);
  transaction.timestamp = BigInt(log.block.timestamp);
  transaction.gasLimit = BigInt(log.transaction!.gas);
  transaction.gasPrice = BigInt(log.transaction!.gasPrice);

  EntityBuffer.add(transaction);
  return transaction as Transaction;
};
