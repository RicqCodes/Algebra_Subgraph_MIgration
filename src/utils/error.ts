export class RpcError extends Error {
  public readonly code: number;
  public readonly data?: any;

  constructor(info: any) {
    super(info.message);
    this.code = info.code;
    this.data = info.data;
  }

  get name(): string {
    return "RpcError";
  }
}
