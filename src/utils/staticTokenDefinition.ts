// Initialize a Token Definition with the attributes
export class StaticTokenDefinition {
  address: string;
  symbol: string;
  name: string;
  decimals: BigInt;

  // Initialize a Token Definition with its attributes
  constructor(address: string, symbol: string, name: string, decimals: BigInt) {
    this.address = address;
    this.symbol = symbol;
    this.name = name;
    this.decimals = decimals;
  }

  // Get all tokens with a static defintion
  static getStaticDefinitions(): Array<StaticTokenDefinition> {
    let staticDefinitions = new Array<StaticTokenDefinition>(0);
    // Add tokens
    return staticDefinitions;
  }

  // Helper for hardcoded tokens
  static fromAddress(tokenAddress: string): StaticTokenDefinition | null {
    let staticDefinitions = this.getStaticDefinitions();
    let tokenAddressHex = tokenAddress;

    // Search the definition using the address
    for (let i = 0; i < staticDefinitions.length; i++) {
      let staticDefinition = staticDefinitions[i];
      if (staticDefinition.address == tokenAddressHex) {
        return staticDefinition;
      }
    }

    // If not found, return null
    return null;
  }
}
