// Debug script to check storage slot format
import { ethers } from 'ethers';

const poolId = "0x2b12523c52f9376439968e70e1f10ccc106ac80781bf40b0c8eeb2c19a22382e";
const POOL_STATE_SLOT = 6;

console.log("=== DEBUGGING STORAGE SLOT FORMAT ===");

// Method 1: Manual calculation
const encodedSlot = ethers.AbiCoder.defaultAbiCoder().encode(
  ["bytes32", "uint256"],
  [poolId, POOL_STATE_SLOT]
);

const calculatedSlot = ethers.keccak256(encodedSlot);

console.log("\n1. Pool Information:");
console.log("Pool ID:", poolId);
console.log("Pool ID length:", poolId.length);
console.log("Pool State Slot:", POOL_STATE_SLOT);

console.log("\n2. Encoded Slot:");
console.log("Encoded:", encodedSlot);
console.log("Encoded length:", encodedSlot.length);

console.log("\n3. Calculated Storage Slot:");
console.log("With 0x:", calculatedSlot);
console.log("Without 0x:", calculatedSlot.slice(2));
console.log("Total length:", calculatedSlot.length);
console.log("Hex part length:", calculatedSlot.slice(2).length);

// Check if it's valid hex
const isValidHex = /^0x[0-9a-fA-F]{64}$/.test(calculatedSlot);
console.log("Is valid hex format?", isValidHex);

console.log("\n4. Different Format Options:");
console.log("Option A (with 0x):", calculatedSlot);
console.log("Option B (without 0x):", calculatedSlot.slice(2));
console.log("Option C (uppercase):", calculatedSlot.toUpperCase());
console.log("Option D (lowercase no 0x):", calculatedSlot.slice(2).toLowerCase());

// Convert to decimal
const decimalValue = BigInt(calculatedSlot).toString();
console.log("Option E (decimal):", decimalValue);

// Zero-padded versions (just in case)
const hexPart = calculatedSlot.slice(2);
console.log("Option F (zero-padded):", "0x" + hexPart.padStart(64, '0'));

console.log("\n5. Manual Verification:");
// Let's manually verify the calculation
const manualEncoded = ethers.solidityPacked(
  ["bytes32", "uint256"],
  [poolId, POOL_STATE_SLOT]
);
const manualHash = ethers.keccak256(manualEncoded);
console.log("Manual calculation result:", manualHash);
console.log("Results match?", calculatedSlot === manualHash);

// Try different slot numbers just in case
console.log("\n6. Testing Different Slot Numbers:");
for (let slot = 0; slot <= 10; slot++) {
  const testEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "uint256"],
    [poolId, slot]
  );
  const testResult = ethers.keccak256(testEncoded);
  console.log(`Slot ${slot}: ${testResult}`);
}

console.log("\n=== COPY THESE VALUES TO TRY IN ALCHEMY ===");
console.log("Format 1:", calculatedSlot);
console.log("Format 2:", calculatedSlot.slice(2));
console.log("Format 3:", calculatedSlot.toLowerCase());
console.log("Format 4:", calculatedSlot.slice(2).toLowerCase());
console.log("Format 5:", decimalValue);