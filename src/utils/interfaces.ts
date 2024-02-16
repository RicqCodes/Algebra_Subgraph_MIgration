import { Log } from "@subsquid/evm-processor";

type UpdatedTransaction = {
  gas: string;
  gasPrice: string;
};

export type UpdatedLog = Log & {
  transaction: Log["transaction"] & UpdatedTransaction;
};
