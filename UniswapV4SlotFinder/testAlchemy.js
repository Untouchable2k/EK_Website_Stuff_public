import { ethers } from 'ethers';

// Configuration
const ALCHEMY_URL = "https://base-sepolia.g.alchemy.com/v2/fTukefKxyH-72aDTEBUHqcad2_SK53CC"; // Replace with your Alchemy URL
const POOL_MANAGER_ADDRESS = "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408";
const POOL_ID = "0x2b12523c52f9376439968e70e1f10ccc106ac80781bf40b0c8eeb2c19a22382e";

// Expected result from your working script
const EXPECTED_DATA = "0x000000004e20000000fd435c000000000000000000085a6afa601db20218ff54";

async function testAlchemyStorageAt() {
  console.log("=== TESTING ALCHEMY getStorageAt ===");
  console.log(`Contract: ${POOL_MANAGER_ADDRESS}`);
  console.log(`Pool ID: ${POOL_ID}`);
  console.log(`Expected: ${EXPECTED_DATA}`);
  console.log("");

  // Create provider (works with any RPC, including Alchemy)
  const provider = new ethers.JsonRpcProvider(ALCHEMY_URL);

  // Test different slot numbers
  const slotsToTest = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  for (const slotNum of slotsToTest) {
    console.log(`--- Testing Slot ${slotNum} ---`);
    
    try {
      // Calculate storage slot for this slot number
      const encodedSlot = ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "uint256"],
        [POOL_ID, slotNum]
      );
      const storageSlot = ethers.keccak256(encodedSlot);
      
      console.log(`Calculated slot: ${storageSlot}`);
      
      // Test getStorageAt
      const result = await provider.getStorage(POOL_MANAGER_ADDRESS, storageSlot);
      console.log(`Result: ${result}`);
      
      // Check if it matches expected
      if (result === EXPECTED_DATA) {
        console.log(`🎉 MATCH FOUND! Slot ${slotNum} contains the expected data`);
        console.log(`\nFor Alchemy UI, use:`);
        console.log(`Storage Slot: ${storageSlot}`);
        console.log(`Without 0x: ${storageSlot.slice(2)}`);
        break;
      } else if (result !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
        console.log(`❓ Non-zero data found (different from expected)`);
      } else {
        console.log(`❌ Empty slot`);
      }
      
    } catch (error) {
      console.error(`Error reading slot ${slotNum}:`, error.message);
    }
    
    console.log("");
  }

  // Test basic storage slots directly
  console.log("=== TESTING BASIC STORAGE SLOTS ===");
  for (let i = 0; i <= 5; i++) {
    try {
      const basicSlot = ethers.zeroPadValue(ethers.toBeHex(i), 32);
      const result = await provider.getStorage(POOL_MANAGER_ADDRESS, basicSlot);
      console.log(`Direct slot ${i}: ${result}`);
    } catch (error) {
      console.error(`Error reading direct slot ${i}:`, error.message);
    }
  }
}

// Alternative: Test with direct fetch call (if ethers doesn't work)
async function testDirectRPCCall() {
  console.log("\n=== TESTING DIRECT RPC CALL ===");
  
  const slotNum = 6; // Test slot 6 specifically
  const encodedSlot = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "uint256"],
    [POOL_ID, slotNum]
  );
  const storageSlot = ethers.keccak256(encodedSlot);
  
  console.log(`Testing slot 6: ${storageSlot}`);
  
  try {
    const response = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "eth_getStorageAt",
        params: [
          POOL_MANAGER_ADDRESS,
          storageSlot,
          "latest"
        ]
      })
    });
    
    const data = await response.json();
    console.log("Direct RPC Response:", data);
    
    if (data.result === EXPECTED_DATA) {
      console.log("🎉 Direct RPC call confirms the data!");
    }
    
  } catch (error) {
    console.error("Direct RPC error:", error.message);
  }
}

// Test with public RPC (no API key needed)
async function testWithPublicRPC() {
  console.log("\n=== TESTING WITH PUBLIC BASE SEPOLIA RPC ===");
  
  const PUBLIC_RPC = "https://sepolia.base.org";
  const provider = new ethers.JsonRpcProvider(PUBLIC_RPC);
  
  const slotNum = 6;
  const encodedSlot = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "uint256"],
    [POOL_ID, slotNum]
  );
  const storageSlot = ethers.keccak256(encodedSlot);
  
  console.log(`Testing with public RPC...`);
  console.log(`Storage slot: ${storageSlot}`);
  
  try {
    const result = await provider.getStorage(POOL_MANAGER_ADDRESS, storageSlot);
    console.log(`Public RPC result: ${result}`);
    
    if (result === EXPECTED_DATA) {
      console.log("✅ Public RPC confirms the data!");
      console.log("\nThis proves the storage slot calculation is correct.");
      console.log("The issue might be with Alchemy's UI formatting.");
      console.log("\nTry these formats in Alchemy:");
      console.log(`1. ${storageSlot}`);
      console.log(`2. ${storageSlot.slice(2)}`);
      console.log(`3. ${storageSlot.toUpperCase()}`);
      console.log(`4. ${storageSlot.slice(2).toUpperCase()}`);
    }
    
  } catch (error) {
    console.error("Public RPC error:", error.message);
  }
}

async function main() {
  // Update this with your Alchemy URL
  if (ALCHEMY_URL === "YOUR_ALCHEMY_URL_HERE") {
    console.log("⚠️  Please update ALCHEMY_URL in the script with your actual Alchemy endpoint");
    console.log("For now, testing with public RPC...\n");
    await testWithPublicRPC();
  } else {
    await testAlchemyStorageAt();
    await testDirectRPCCall();
  }
  
  // Always test with public RPC as a reference
  await testWithPublicRPC();
}

main().catch(console.error);