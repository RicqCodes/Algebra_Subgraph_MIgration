// import { RpcClient } from "@subsquid/rpc-client";

// class CustomRpcClient extends RpcClient {
//   constructor(options: RpcClientOptions) {
//     super(options);
//   }

//   protected receiveResult(
//     call: RpcRequest,
//     res: RpcResponse,
//     validateResult?: ResultValidator,
//     validateError?: ErrorValidator
//   ): any {
//     // Implement custom error handling logic here
//     //@ts-ignore
//     if (this.log?.isDebug()) {
//         //@ts-ignore
//       this.log.debug(
//         {
//           rpcId: call.id,
//           rpcMethod: call.method,
//           rpcParams: call.params,
//           rpcResponse: res,
//         },
//         "rpc response"
//       );
//     }
//     try {
//       if (res.error) {
//         const errorResponse = validateError
//           ? validateError(res.error, call)
//           : new RpcError(res.error);
//         // Instead of throwing, wrap the error in a structure to identify it as an error response
//         return { error: true, data: errorResponse };
//       } else if (validateResult) {
//         return { error: false, data: validateResult(res.result, call) };
//       } else {
//         return { error: false, data: res.result };
//       }
//     } catch (err: any) {
//       // Wrap the thrown error similarly
//       const wrappedError = addErrorContext(err, {
//         rpcUrl: this.url,
//         rpcId: call.id,
//         rpcMethod: call.method,
//         rpcParams: call.params,
//         rpcResponse: res,
//       });
//       return { error: true, data: wrappedError };
//     }
//   }
// }
