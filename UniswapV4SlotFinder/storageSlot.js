import { ethers } from 'ethers';

// Configuration
const POOL_MANAGER_ADDRESS = "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408";
const RPC_URL = "https://sepolia.base.org";
const KNOWN_POOL_ID = "0x2b12523c52f9376439968e70e1f10ccc106ac80781bf40b0c8eeb2c19a22382e";

// Expected data from your working script
const EXPECTED_RAW_DATA = "0x000000004e20000000fd435c000000000000000000085a6afa601db20218ff54";

class StorageSlotFinder {
  constructor(rpcUrl, poolManagerAddress) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  calculateStorageSlot(poolId, slotNumber) {
    const encodedSlot = ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "uint256"],
      [poolId, slotNumber]
    );
    return ethers.keccak256(encodedSlot);
  }

  async readStorageSlot(storageSlot) {
    try {
      const data = await this.provider.getStorage(POOL_MANAGER_ADDRESS, storageSlot);
      return data;
    } catch (error) {
      console.error(`Error reading slot ${storageSlot}:`, error.message);
      return null;
    }
  }

  async findCorrectPoolsSlot() {
    console.log("=== FINDING CORRECT STORAGE SLOT FOR _pools MAPPING ===");
    console.log(`Pool Manager: ${POOL_MANAGER_ADDRESS}`);
    console.log(`Pool ID: ${KNOWN_POOL_ID}`);
    console.log(`Expected Data: ${EXPECTED_RAW_DATA}`);
    console.log("");

    // Test slots 0-20 (most mappings are in early slots)
    for (let slotNumber = 0; slotNumber <= 20; slotNumber++) {
      console.log(`\n--- Testing Slot ${slotNumber} ---`);
      
      const storageSlot = this.calculateStorageSlot(KNOWN_POOL_ID, slotNumber);
      console.log(`Calculated storage slot: ${storageSlot}`);
      
      const data = await this.readStorageSlot(storageSlot);
      
      if (data) {
        console.log(`Raw data: ${data}`);
        
        if (data === EXPECTED_RAW_DATA) {
          console.log(`🎉 FOUND CORRECT SLOT! The _pools mapping is at slot ${slotNumber}`);
          return slotNumber;
        } else if (data !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
          console.log(`❓ Non-zero data found, but doesn't match expected`);
        } else {
          console.log(`❌ Empty slot`);
        }
      }
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log("\n❌ Could not find the correct slot in range 0-20");
    return null;
  }

  async testSpecificSlots() {
    console.log("\n=== TESTING SPECIFIC SLOTS BASED ON INHERITANCE ===");
    
    // Based on PoolManager inheritance structure, test likely slots
    const likelySlots = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    
    for (const slot of likelySlots) {
      console.log(`\nTesting specific slot ${slot}:`);
      
      const storageSlot = this.calculateStorageSlot(KNOWN_POOL_ID, slot);
      const data = await this.readStorageSlot(storageSlot);
      
      if (data && data !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
        console.log(`Slot ${slot}: ${data}`);
        
        // Try to decode the data to see if it makes sense
        try {
          const bigIntData = BigInt(data);
          const sqrtPriceX96 = bigIntData & ((1n << 160n) - 1n);
          const tick = (bigIntData >> 160n) & ((1n << 24n) - 1n);
          
          console.log(`  Decoded sqrtPriceX96: ${sqrtPriceX96.toString()}`);
          console.log(`  Decoded tick: ${tick.toString()}`);
          
          if (sqrtPriceX96 > 0n && tick > 0n) {
            console.log(`  ✅ This looks like valid pool data!`);
          }
        } catch (e) {
          console.log(`  ❌ Could not decode as pool data`);
        }
      } else {
        console.log(`Slot ${slot}: Empty`);
      }
    }
  }

  async readDirectStorageSlots() {
    console.log("\n=== READING DIRECT STORAGE SLOTS ===");
    
    // Read the first few storage slots directly to understand the contract layout
    for (let i = 0; i <= 10; i++) {
      const slot = ethers.zeroPadValue(ethers.toBeHex(i), 32);
      const data = await this.readStorageSlot(slot);
      console.log(`Direct slot ${i}: ${data}`);
    }
  }

  async testUsingExtsload() {
    console.log("\n=== TESTING USING EXTSLOAD FUNCTION ===");
    
    const poolManagerABI = [
      "function extsload(bytes32 slot) external view returns (bytes32)"
    ];
    
    const poolManager = new ethers.Contract(
      POOL_MANAGER_ADDRESS,
      poolManagerABI,
      this.provider
    );

    // Test the slot that worked in your original script
    const workingSlot = this.calculateStorageSlot(KNOWN_POOL_ID, 6);
    
    try {
      console.log(`Testing extsload with slot 6: ${workingSlot}`);
      const result = await poolManager.extsload(workingSlot);
      console.log(`Extsload result: ${result}`);
      
      if (result === EXPECTED_RAW_DATA) {
        console.log("✅ Extsload confirms slot 6 is correct!");
      }
    } catch (error) {
      console.error("Extsload error:", error.message);
    }
  }
}

async function main() {
  const finder = new StorageSlotFinder(RPC_URL, POOL_MANAGER_ADDRESS);
  
  try {
    // First, verify extsload is working
    await finder.testUsingExtsload();
    
    // Read direct storage slots to understand layout
    await finder.readDirectStorageSlots();
    
    // Test specific slots that are likely candidates
    await finder.testSpecificSlots();
    
    // Do comprehensive search
    const correctSlot = await finder.findCorrectPoolsSlot();
    
    if (correctSlot !== null) {
      console.log(`\n🎉 SUCCESS! The _pools mapping is at storage slot ${correctSlot}`);
      console.log(`Use this slot number in Alchemy: ${correctSlot}`);
      
      // Generate the correct storage slot for Alchemy
      const alchemySlot = finder.calculateStorageSlot(KNOWN_POOL_ID, correctSlot);
      console.log(`\nFor Alchemy, use this calculated storage slot:`);
      console.log(`With 0x: ${alchemySlot}`);
      console.log(`Without 0x: ${alchemySlot.slice(2)}`);
    } else {
      console.log("\n❌ Could not determine the correct storage slot");
      console.log("The _pools mapping might be at a slot > 20, or there might be a different issue");
    }
    
  } catch (error) {
    console.error("Script error:", error);
  }
}

// Run the finder
main();