import { ethers } from "hardhat";
import { config } from "../src/config/config";

async function deployToMainnet() {
  console.log("🚀 Starting mainnet deployment...");
  
  // Verify we're on mainnet
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 1) {
    throw new Error(`Expected mainnet (chainId: 1), but got chainId: ${network.chainId}`);
  }
  
  console.log(`✅ Connected to mainnet (chainId: ${network.chainId})`);
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);
  
  console.log(`📝 Deployer address: ${deployerAddress}`);
  console.log(`💰 Deployer balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  // Check minimum balance for deployment
  const minBalance = ethers.utils.parseEther("0.1"); // 0.1 ETH minimum
  if (balance.lt(minBalance)) {
    throw new Error(`Insufficient balance. Need at least 0.1 ETH, have ${ethers.utils.formatEther(balance)} ETH`);
  }
  
  // Get current gas price
  const gasPrice = await ethers.provider.getGasPrice();
  console.log(`⛽ Current gas price: ${ethers.utils.formatUnits(gasPrice, "gwei")} gwei`);
  
  // Deploy OfflineWalletToken contract
  console.log("📦 Deploying OfflineWalletToken contract...");
  
  const OfflineWalletToken = await ethers.getContractFactory("OfflineWalletToken");
  
  // Estimate gas for deployment
  const deploymentData = OfflineWalletToken.getDeployTransaction();
  const estimatedGas = await ethers.provider.estimateGas(deploymentData);
  const estimatedCost = gasPrice.mul(estimatedGas);
  
  console.log(`📊 Estimated gas: ${estimatedGas.toString()}`);
  console.log(`💸 Estimated cost: ${ethers.utils.formatEther(estimatedCost)} ETH`);
  
  // Confirm deployment
  console.log("⚠️  This will deploy to MAINNET. Are you sure? (This script assumes confirmation)");
  
  // Deploy with optimized gas settings
  const contract = await OfflineWalletToken.deploy({
    gasPrice: gasPrice,
    gasLimit: estimatedGas.mul(120).div(100) // Add 20% buffer
  });
  
  console.log("⏳ Waiting for deployment transaction...");
  await contract.deployed();
  
  const deploymentTx = contract.deployTransaction;
  const receipt = await deploymentTx.wait();
  
  console.log("🎉 Contract deployed successfully!");
  console.log(`📍 Contract address: ${contract.address}`);
  console.log(`🔗 Transaction hash: ${deploymentTx.hash}`);
  console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
  console.log(`💰 Total cost: ${ethers.utils.formatEther(receipt.gasUsed.mul(gasPrice))} ETH`);
  
  // Verify contract deployment
  console.log("🔍 Verifying contract deployment...");
  const code = await ethers.provider.getCode(contract.address);
  if (code === "0x") {
    throw new Error("Contract deployment failed - no code at address");
  }
  
  // Test basic contract functionality
  console.log("🧪 Testing basic contract functionality...");
  const name = await contract.name();
  const symbol = await contract.symbol();
  const decimals = await contract.decimals();
  const owner = await contract.owner();
  
  console.log(`📛 Token name: ${name}`);
  console.log(`🏷️  Token symbol: ${symbol}`);
  console.log(`🔢 Decimals: ${decimals}`);
  console.log(`👑 Owner: ${owner}`);
  
  // Save deployment information
  const deploymentInfo = {
    network: "mainnet",
    chainId: network.chainId,
    contractAddress: contract.address,
    deployerAddress: deployerAddress,
    transactionHash: deploymentTx.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    gasPrice: gasPrice.toString(),
    totalCost: receipt.gasUsed.mul(gasPrice).toString(),
    timestamp: new Date().toISOString(),
    contractABI: OfflineWalletToken.interface.format(ethers.utils.FormatTypes.json)
  };
  
  // Write deployment info to file
  const fs = require('fs');
  const deploymentPath = `./deployments/mainnet-deployment-${Date.now()}.json`;
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log(`💾 Deployment info saved to: ${deploymentPath}`);
  
  // Update environment configuration
  console.log("🔧 Updating environment configuration...");
  console.log(`Add this to your production environment variables:`);
  console.log(`ETHEREUM_CONTRACT_ADDRESS=${contract.address}`);
  console.log(`ETHEREUM_NETWORK=mainnet`);
  console.log(`ETHEREUM_CHAIN_ID=1`);
  
  // Etherscan verification instructions
  console.log("\n📋 Next steps:");
  console.log("1. Verify contract on Etherscan:");
  console.log(`   npx hardhat verify --network mainnet ${contract.address}`);
  console.log("2. Update production environment variables");
  console.log("3. Test contract integration with backend services");
  console.log("4. Monitor contract on Etherscan and set up alerts");
  
  return {
    contractAddress: contract.address,
    transactionHash: deploymentTx.hash,
    deploymentInfo
  };
}

// Execute deployment
if (require.main === module) {
  deployToMainnet()
    .then((result) => {
      console.log("✅ Mainnet deployment completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Deployment failed:", error);
      process.exit(1);
    });
}

export { deployToMainnet };