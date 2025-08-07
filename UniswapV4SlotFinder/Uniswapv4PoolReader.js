import { ethers } from 'ethers';
import { fileURLToPath } from 'url';
import path from 'path';

// Get current file path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Uniswap V4 PoolManager contract ABI (minimal for extsload)
const POOL_MANAGER_ABI = [
  "function extsload(bytes32 slot) external view returns (bytes32)"
];

// Configuration
const POOL_MANAGER_ADDRESS = "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408"; // Base Sepolia PoolManager
const POOL_STATE_SLOT = 6; // Storage slot where _pools mapping is located
const RPC_URL = "https://sepolia.base.org"; // Base Sepolia RPC

class UniswapV4PoolReader {
  constructor(rpcUrl, poolManagerAddress) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.poolManager = new ethers.Contract(
      poolManagerAddress, 
      POOL_MANAGER_ABI, 
      this.provider
    );
  }

  /**
   * Calculate storage slot for a specific pool ID
   * @param {string} poolId - The pool ID (bytes32)
   * @returns {string} The calculated storage slot
   */
  calculatePoolStorageSlot(poolId) {
    const encodedSlot = ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "uint256"],
      [poolId, POOL_STATE_SLOT]
    );
    return ethers.keccak256(encodedSlot);
  }

  /**
   * Read raw pool state data from storage
   * @param {string} poolId - The pool ID (bytes32)
   * @returns {Promise<string>} Raw storage data
   */
  async readPoolStateRaw(poolId) {
    try {
      const storageSlot = this.calculatePoolStorageSlot(poolId);
      console.log(`Pool ID: ${poolId}`);
      console.log(`Calculated storage slot: ${storageSlot}`);
      
      const rawData = await this.poolManager.getFunction("extsload(bytes32)").staticCall(storageSlot);
      console.log(`Raw storage data: ${rawData}`);
      
      return rawData;
    } catch (error) {
      console.error("Error reading pool state:", error);
      throw error;
    }
  }

  /**
   * Decode pool state from raw storage data
   * Note: Bit positions may need adjustment based on actual Pool.State struct
   * @param {string} rawData - Raw storage data
   * @returns {Object} Decoded pool state
   */
  decodePoolState(rawData) {
    const data = BigInt(rawData);
    
    // These bit positions are estimates and may need adjustment
    // based on the actual Pool.State struct layout in Uniswap V4
    const sqrtPriceX96 = data & ((1n << 160n) - 1n);
    const tick = (data >> 160n) & ((1n << 24n) - 1n);
    const protocolFee = (data >> 184n) & ((1n << 24n) - 1n);
    const lpFee = (data >> 208n) & ((1n << 24n) - 1n);
    
    // Convert tick from unsigned to signed if needed
    const maxTickValue = (1n << 23n) - 1n;
    const signedTick = tick > maxTickValue ? tick - (1n << 24n) : tick;
    
    return {
      sqrtPriceX96: sqrtPriceX96.toString(),
      tick: signedTick.toString(),
      protocolFee: protocolFee.toString(),
      lpFee: lpFee.toString(),
      rawData: rawData
    };
  }

  /**
   * Get human-readable pool information
   * @param {string} poolId - The pool ID (bytes32)
   * @returns {Promise<Object>} Decoded pool information
   */
  async getPoolInfo(poolId) {
    try {
      const rawData = await this.readPoolStateRaw(poolId);
      const decodedState = this.decodePoolState(rawData);
      
      // Calculate actual price from sqrtPriceX96
      const sqrtPrice = Number(decodedState.sqrtPriceX96) / (2 ** 96);
      const price = sqrtPrice * sqrtPrice;
      
      return {
        poolId,
        ...decodedState,
        calculatedPrice: price,
        sqrtPrice: sqrtPrice
      };
    } catch (error) {
      console.error("Error getting pool info:", error);
      throw error;
    }
  }

  /**
   * Read multiple pools in batch
   * @param {string[]} poolIds - Array of pool IDs
   * @returns {Promise<Object[]>} Array of pool information
   */
  async batchReadPools(poolIds) {
    const promises = poolIds.map(poolId => this.getPoolInfo(poolId));
    return Promise.all(promises);
  }

  /**
   * Calculate Pool ID from pool parameters
   * @param {string} currency0 - Token 0 address
   * @param {string} currency1 - Token 1 address  
   * @param {number} fee - Fee tier
   * @param {number} tickSpacing - Tick spacing
   * @param {string} hookAddress - Hook contract address
   * @returns {string} Calculated Pool ID
   */
  calculatePoolId(currency0, currency1, fee, tickSpacing, hookAddress = ethers.ZeroAddress) {
    // Ensure currency0 < currency1 (Uniswap convention)
    const [token0, token1] = currency0.toLowerCase() < currency1.toLowerCase() 
      ? [currency0, currency1] 
      : [currency1, currency0];

    const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint24", "int24", "address"],
      [token0, token1, fee, tickSpacing, hookAddress]
    );
    
    return ethers.keccak256(encodedParams);
  }
}

// Usage examples
async function main() {
  console.log("Starting Uniswap V4 Pool Reader...");
  console.log("=".repeat(50));
  
  const reader = new UniswapV4PoolReader(RPC_URL, POOL_MANAGER_ADDRESS);

  try {
    console.log("\n1. Testing connection to PoolManager...");
    console.log(`PoolManager Address: ${POOL_MANAGER_ADDRESS}`);
    console.log(`RPC URL: ${RPC_URL}`);
    
    // Method 1: Read pool by known Pool ID
    console.log("\n2. Reading known Pool ID...");
    const knownPoolId = "0x2b12523c52f9376439968e70e1f10ccc106ac80781bf40b0c8eeb2c19a22382e";
    const poolInfo = await reader.getPoolInfo(knownPoolId);
    console.log("Pool Info:", JSON.stringify(poolInfo, null, 2));

    // Method 2: Calculate Pool ID and read
    console.log("\n3. Calculating Pool ID from parameters...");
    const currency0 = "0x77933D339C88458450676156820D6e28bCc98BF5"; // B0x
    const currency1 = "0xfb4cCCd1485FD56C1E6BF93274778d2F7aBe546D"; // 0xBTC
    const fee = 8388608; // Dynamic Fee
    const tickSpacing = 60;
    const hookAddress = "0x70Fe3Fa2f8065898706674Acd03D7b2696161000"; // Hook Address
    
    const calculatedPoolId = reader.calculatePoolId(currency0, currency1, fee, tickSpacing, hookAddress);
    console.log("Calculated Pool ID:", calculatedPoolId);
    
    const calculatedPoolInfo = await reader.getPoolInfo(calculatedPoolId);
    console.log("Calculated Pool Info:", JSON.stringify(calculatedPoolInfo, null, 2));

    // Method 3: Format price example
    console.log("\n4. Price formatting example...");
    if (poolInfo && poolInfo.sqrtPriceX96) {
      const formattedPrice = formatPrice(poolInfo.sqrtPriceX96);
      console.log(`Formatted Price: ${formattedPrice}`);
    }

  } catch (error) {
    console.error("Script error:", error.message);
    console.error("Full error:", error);
  }
  
  console.log("\n" + "=".repeat(50));
  console.log("Script completed.");
}

// Helper function to convert price to human readable format
function formatPrice(sqrtPriceX96, decimals0 = 18, decimals1 = 18) {
  const sqrtPrice = Number(sqrtPriceX96) / (2 ** 96);
  const price = sqrtPrice * sqrtPrice;
  
  // Adjust for token decimals
  const adjustedPrice = price * (10 ** (decimals0 - decimals1));
  
  return adjustedPrice;
}

// Export for use in other modules
export { UniswapV4PoolReader, formatPrice };

// Always run main function when this file is executed directly
main().catch(console.error);