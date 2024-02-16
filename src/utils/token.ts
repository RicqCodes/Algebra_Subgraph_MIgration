/* eslint-disable prefer-const */
import { Contract as ERC20 } from "../abi/ERC20";
import { Contract as ERC20SymbolBytes } from "../abi/ERC20SymbolBytes";
import { Contract as ERC20NameBytes } from "../abi/ERC20NameBytes";
import { StaticTokenDefinition } from "./staticTokenDefinition";
import { isNullEthValue } from ".";
import { DataHandlerContext } from "@subsquid/evm-processor";
import { Store } from "../db";
import { BlockContext } from "../abi/abi.support";

export const fetchTokenSymbol = async (
  tokenAddress: string,
  ctx: DataHandlerContext<Store>
): Promise<string> => {
  let lastBatchBlockHeader = ctx.blocks[ctx.blocks.length - 1].header;
  const ctxContract: BlockContext = {
    _chain: ctx._chain,
    block: lastBatchBlockHeader,
  };

  let contract = new ERC20(ctxContract, lastBatchBlockHeader, tokenAddress);
  let contractSymbolBytes = new ERC20SymbolBytes(
    ctxContract,
    lastBatchBlockHeader,
    tokenAddress
  );

  // try types string and bytes32 for symbol
  let symbolValue = "unknown";
  let symbolResult = await contract.symbol();
  if (!symbolResult) {
    let symbolResultBytes = await contractSymbolBytes.symbol();
    if (symbolResultBytes) {
      // for broken pairs that have no symbol function exposed
      if (!isNullEthValue(symbolResultBytes)) {
        symbolValue = symbolResultBytes.toString();
      } else {
        // try with the static definition
        let staticTokenDefinition =
          StaticTokenDefinition.fromAddress(tokenAddress);
        if (staticTokenDefinition != null) {
          symbolValue = staticTokenDefinition.symbol;
        }
      }
    }
  } else {
    symbolValue = symbolResult;
  }

  return symbolValue;
};

export const fetchTokenName = async (
  tokenAddress: string,
  ctx: DataHandlerContext<Store>
): Promise<string> => {
  let lastBatchBlockHeader = ctx.blocks[ctx.blocks.length - 1].header;
  const ctxContract: BlockContext = {
    _chain: ctx._chain,
    block: lastBatchBlockHeader,
  };

  let contract = new ERC20(ctxContract, lastBatchBlockHeader, tokenAddress);
  let contractNameBytes = new ERC20NameBytes(
    ctxContract,
    lastBatchBlockHeader,
    tokenAddress
  );

  // try types string and bytes32 for name
  let nameValue = "unknown";
  let nameResult = await contract.name();
  if (!nameResult) {
    let nameResultBytes = await contractNameBytes.name();
    if (nameResultBytes) {
      // for broken exchanges that have no name function exposed
      if (!isNullEthValue(nameResultBytes)) {
        nameValue = nameResultBytes.toString();
      } else {
        // try with the static definition
        let staticTokenDefinition =
          StaticTokenDefinition.fromAddress(tokenAddress);
        if (staticTokenDefinition != null) {
          nameValue = staticTokenDefinition.name;
        }
      }
    }
  } else {
    nameValue = nameResult;
  }

  return nameValue;
};

export const fetchTokenTotalSupply = async (
  tokenAddress: string,
  ctx: DataHandlerContext<Store>
): Promise<BigInt> => {
  let lastBatchBlockHeader = ctx.blocks[ctx.blocks.length - 1].header;
  const ctxContract: BlockContext = {
    _chain: ctx._chain,
    block: lastBatchBlockHeader,
  };

  let contract = new ERC20(ctxContract, lastBatchBlockHeader, tokenAddress);

  let totalSupplyValue = BigInt("1");
  let totalSupplyResult = await contract.totalSupply();
  totalSupplyValue = totalSupplyResult;

  return totalSupplyValue as BigInt;
};

export const fetchTokenDecimals = async (
  tokenAddress: string,
  ctx: DataHandlerContext<Store>
): Promise<BigInt> => {
  let lastBatchBlockHeader = ctx.blocks[ctx.blocks.length - 1].header;
  const ctxContract: BlockContext = {
    _chain: ctx._chain,
    block: lastBatchBlockHeader,
  };

  let contract = new ERC20(ctxContract, lastBatchBlockHeader, tokenAddress);

  // try types uint8 for decimals
  let decimalValue = BigInt("1");
  let decimalResult = await contract.decimals();
  if (decimalResult) {
    decimalValue = BigInt(decimalResult);
  } else {
    // try with the static definition
    let staticTokenDefinition = StaticTokenDefinition.fromAddress(tokenAddress);
    if (staticTokenDefinition != null) {
      return staticTokenDefinition.decimals;
    }
  }

  return decimalValue;
};
