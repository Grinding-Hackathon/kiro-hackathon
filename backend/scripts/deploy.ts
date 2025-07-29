import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Starting deployment of OfflineWalletToken...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // Deployment parameters
  const otmAddress = process.env.OTM_ADDRESS || deployer.address; // Use deployer as OTM for testing
  const initialSupply = ethers.parseEther(process.env.INITIAL_SUPPLY || "1000000"); // 1M tokens default

  console.log("Deployment parameters:");
  console.log("- OTM Address:", otmAddress);
  console.log("- Initial Supply:", ethers.formatEther(initialSupply), "OWT");

  // Deploy the contract
  const OfflineWalletToken = await ethers.getContractFactory("OfflineWalletToken");
  const token = await OfflineWalletToken.deploy(otmAddress, initialSupply);

  console.log("Waiting for deployment transaction...");
  await token.waitForDeployment();

  const contractAddress = await token.getAddress();
  console.log("OfflineWalletToken deployed to:", contractAddress);

  // Verify deployment
  console.log("\nVerifying deployment...");
  const name = await token.name();
  const symbol = await token.symbol();
  const decimals = await token.decimals();
  const totalSupply = await token.totalSupply();
  const otm = await token.otmAddress();

  console.log("Contract verification:");
  console.log("- Name:", name);
  console.log("- Symbol:", symbol);
  console.log("- Decimals:", decimals.toString());
  console.log("- Total Supply:", ethers.formatEther(totalSupply), symbol);
  console.log("- OTM Address:", otm);

  // Save deployment info
  const network = await ethers.provider.getNetwork();
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    contractAddress: contractAddress,
    deployerAddress: deployer.address,
    otmAddress: otmAddress,
    initialSupply: ethers.formatEther(initialSupply),
    deploymentTime: new Date().toISOString(),
    transactionHash: token.deploymentTransaction()?.hash,
    blockNumber: (await ethers.provider.getBlockNumber()).toString()
  };

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save deployment info to file
  const deploymentFile = path.join(deploymentsDir, `deployment-${Date.now()}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("\nDeployment info saved to:", deploymentFile);

  // Update .env file with contract address
  const envPath = path.join(__dirname, "..", ".env");
  let envContent = "";
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
  }

  // Update or add CONTRACT_ADDRESS
  const contractAddressLine = `CONTRACT_ADDRESS=${contractAddress}`;
  if (envContent.includes("CONTRACT_ADDRESS=")) {
    envContent = envContent.replace(/CONTRACT_ADDRESS=.*/, contractAddressLine);
  } else {
    envContent += `\n${contractAddressLine}\n`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log("Updated .env file with contract address");

  console.log("\n✅ Deployment completed successfully!");
  
  // Display next steps
  console.log("\nNext steps:");
  console.log("1. Verify the contract on Etherscan (if on mainnet/testnet):");
  console.log(`   npx hardhat verify --network <network> ${contractAddress} "${otmAddress}" "${initialSupply}"`);
  console.log("2. Update your backend configuration with the contract address");
  console.log("3. Test the contract functionality with the provided test suite");
}

// Handle errors
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });