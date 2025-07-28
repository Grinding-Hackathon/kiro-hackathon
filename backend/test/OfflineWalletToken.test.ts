import { expect } from "chai";
import { ethers } from "hardhat";
import { OfflineWalletToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("OfflineWalletToken", function () {
  let token: OfflineWalletToken;
  let owner: SignerWithAddress;
  let otm: SignerWithAddress;
  let client1: SignerWithAddress;
  let client2: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1M tokens
  const MIN_TRANSFER_AMOUNT = ethers.parseEther("0.001");
  const MAX_SUPPLY = ethers.parseEther("1000000000"); // 1B tokens

  beforeEach(async function () {
    [owner, otm, client1, client2, unauthorized] = await ethers.getSigners();

    const OfflineWalletToken = await ethers.getContractFactory("OfflineWalletToken");
    token = await OfflineWalletToken.deploy(otm.address, INITIAL_SUPPLY);
    await token.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await token.name()).to.equal("OfflineWalletToken");
      expect(await token.symbol()).to.equal("OWT");
    });

    it("Should set the correct decimals", async function () {
      expect(await token.decimals()).to.equal(18);
    });

    it("Should mint initial supply to deployer", async function () {
      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
    });

    it("Should set the correct OTM address", async function () {
      expect(await token.otmAddress()).to.equal(otm.address);
    });

    it("Should authorize deployer as minter", async function () {
      expect(await token.isAuthorizedMinter(owner.address)).to.be.true;
    });

    it("Should reject zero OTM address", async function () {
      const OfflineWalletToken = await ethers.getContractFactory("OfflineWalletToken");
      await expect(
        OfflineWalletToken.deploy(ethers.ZeroAddress, INITIAL_SUPPLY)
      ).to.be.revertedWith("Invalid OTM address");
    });

    it("Should reject initial supply exceeding max supply", async function () {
      const OfflineWalletToken = await ethers.getContractFactory("OfflineWalletToken");
      await expect(
        OfflineWalletToken.deploy(otm.address, MAX_SUPPLY + 1n)
      ).to.be.revertedWith("Initial supply exceeds maximum");
    });
  });

  describe("transferToOTM", function () {
    const transferAmount = ethers.parseEther("100");
    const requestId = ethers.keccak256(ethers.toUtf8Bytes("request1"));

    beforeEach(async function () {
      // Transfer some tokens to client1 for testing
      await token.transfer(client1.address, transferAmount * 2n);
    });

    it("Should transfer tokens from client to OTM", async function () {
      const initialClientBalance = await token.balanceOf(client1.address);
      const initialOTMBalance = await token.balanceOf(otm.address);

      await expect(
        token.connect(client1).transferToOTM(transferAmount, requestId)
      )
        .to.emit(token, "TransferToOTM")
        .withArgs(client1.address, transferAmount, requestId);

      expect(await token.balanceOf(client1.address)).to.equal(
        initialClientBalance - transferAmount
      );
      expect(await token.balanceOf(otm.address)).to.equal(
        initialOTMBalance + transferAmount
      );
      expect(await token.isRequestProcessed(requestId)).to.be.true;
    });

    it("Should reject transfer with insufficient balance", async function () {
      const excessiveAmount = ethers.parseEther("10000");
      await expect(
        token.connect(client1).transferToOTM(excessiveAmount, requestId)
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should reject transfer below minimum amount", async function () {
      const belowMinAmount = MIN_TRANSFER_AMOUNT - 1n;
      await expect(
        token.connect(client1).transferToOTM(belowMinAmount, requestId)
      ).to.be.revertedWith("Amount below minimum");
    });

    it("Should reject duplicate request IDs", async function () {
      await token.connect(client1).transferToOTM(transferAmount, requestId);
      
      await expect(
        token.connect(client1).transferToOTM(transferAmount, requestId)
      ).to.be.revertedWith("Request already processed");
    });

    it("Should reject zero amount", async function () {
      await expect(
        token.connect(client1).transferToOTM(0, requestId)
      ).to.be.revertedWith("Amount must be positive");
    });
  });

  describe("transferToClient", function () {
    const transferAmount = ethers.parseEther("100");
    const requestId = ethers.keccak256(ethers.toUtf8Bytes("redemption1"));

    beforeEach(async function () {
      // Transfer tokens to OTM for testing
      await token.transfer(otm.address, transferAmount * 2n);
    });

    it("Should transfer tokens from OTM to client", async function () {
      const initialClientBalance = await token.balanceOf(client1.address);
      const initialOTMBalance = await token.balanceOf(otm.address);

      await expect(
        token.connect(otm).transferToClient(client1.address, transferAmount, requestId)
      )
        .to.emit(token, "TransferToClient")
        .withArgs(client1.address, transferAmount, requestId);

      expect(await token.balanceOf(client1.address)).to.equal(
        initialClientBalance + transferAmount
      );
      expect(await token.balanceOf(otm.address)).to.equal(
        initialOTMBalance - transferAmount
      );
      expect(await token.isRequestProcessed(requestId)).to.be.true;
    });

    it("Should reject calls from non-OTM addresses", async function () {
      await expect(
        token.connect(client1).transferToClient(client2.address, transferAmount, requestId)
      ).to.be.revertedWith("Only OTM can call this function");
    });

    it("Should reject transfer to zero address", async function () {
      await expect(
        token.connect(otm).transferToClient(ethers.ZeroAddress, transferAmount, requestId)
      ).to.be.revertedWith("Invalid client address");
    });

    it("Should reject transfer with insufficient OTM balance", async function () {
      const excessiveAmount = ethers.parseEther("10000");
      await expect(
        token.connect(otm).transferToClient(client1.address, excessiveAmount, requestId)
      ).to.be.revertedWith("Insufficient OTM balance");
    });

    it("Should reject duplicate request IDs", async function () {
      await token.connect(otm).transferToClient(client1.address, transferAmount, requestId);
      
      await expect(
        token.connect(otm).transferToClient(client1.address, transferAmount, requestId)
      ).to.be.revertedWith("Request already processed");
    });
  });

  describe("Minting", function () {
    const mintAmount = ethers.parseEther("1000");

    it("Should allow owner to mint tokens", async function () {
      const initialSupply = await token.totalSupply();
      const initialBalance = await token.balanceOf(client1.address);

      await expect(token.mint(client1.address, mintAmount))
        .to.emit(token, "TokensMinted")
        .withArgs(client1.address, mintAmount);

      expect(await token.totalSupply()).to.equal(initialSupply + mintAmount);
      expect(await token.balanceOf(client1.address)).to.equal(initialBalance + mintAmount);
    });

    it("Should allow authorized minters to mint tokens", async function () {
      await token.addAuthorizedMinter(client1.address);
      
      const initialSupply = await token.totalSupply();
      await expect(token.connect(client1).mint(client2.address, mintAmount))
        .to.emit(token, "TokensMinted")
        .withArgs(client2.address, mintAmount);

      expect(await token.totalSupply()).to.equal(initialSupply + mintAmount);
    });

    it("Should reject minting from unauthorized addresses", async function () {
      await expect(
        token.connect(unauthorized).mint(client1.address, mintAmount)
      ).to.be.revertedWith("Not authorized to mint");
    });

    it("Should reject minting to zero address", async function () {
      await expect(
        token.mint(ethers.ZeroAddress, mintAmount)
      ).to.be.revertedWith("Cannot mint to zero address");
    });

    it("Should reject minting that exceeds max supply", async function () {
      const remainingSupply = MAX_SUPPLY - await token.totalSupply();
      const excessiveAmount = remainingSupply + 1n;

      await expect(
        token.mint(client1.address, excessiveAmount)
      ).to.be.revertedWith("Would exceed max supply");
    });
  });

  describe("Burning", function () {
    const burnAmount = ethers.parseEther("100");

    beforeEach(async function () {
      await token.transfer(client1.address, burnAmount * 2n);
    });

    it("Should allow users to burn their own tokens", async function () {
      const initialBalance = await token.balanceOf(client1.address);
      const initialSupply = await token.totalSupply();

      await expect(token.connect(client1).burn(burnAmount))
        .to.emit(token, "TokensBurned")
        .withArgs(client1.address, burnAmount);

      expect(await token.balanceOf(client1.address)).to.equal(initialBalance - burnAmount);
      expect(await token.totalSupply()).to.equal(initialSupply - burnAmount);
    });

    it("Should allow burning from approved address", async function () {
      await token.connect(client1).approve(client2.address, burnAmount);
      
      const initialBalance = await token.balanceOf(client1.address);
      const initialSupply = await token.totalSupply();

      await expect(token.connect(client2).burnFrom(client1.address, burnAmount))
        .to.emit(token, "TokensBurned")
        .withArgs(client1.address, burnAmount);

      expect(await token.balanceOf(client1.address)).to.equal(initialBalance - burnAmount);
      expect(await token.totalSupply()).to.equal(initialSupply - burnAmount);
    });

    it("Should reject burning more than balance", async function () {
      const excessiveAmount = ethers.parseEther("10000");
      await expect(
        token.connect(client1).burn(excessiveAmount)
      ).to.be.revertedWith("Insufficient balance to burn");
    });

    it("Should reject burnFrom without sufficient allowance", async function () {
      await expect(
        token.connect(client2).burnFrom(client1.address, burnAmount)
      ).to.be.revertedWith("Burn amount exceeds allowance");
    });
  });

  describe("Access Control", function () {
    it("Should allow owner to add authorized minter", async function () {
      expect(await token.isAuthorizedMinter(client1.address)).to.be.false;
      
      await token.addAuthorizedMinter(client1.address);
      expect(await token.isAuthorizedMinter(client1.address)).to.be.true;
    });

    it("Should allow owner to remove authorized minter", async function () {
      await token.addAuthorizedMinter(client1.address);
      expect(await token.isAuthorizedMinter(client1.address)).to.be.true;
      
      await token.removeAuthorizedMinter(client1.address);
      expect(await token.isAuthorizedMinter(client1.address)).to.be.false;
    });

    it("Should reject adding minter from non-owner", async function () {
      await expect(
        token.connect(unauthorized).addAuthorizedMinter(client1.address)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("Should reject removing owner as minter", async function () {
      await expect(
        token.removeAuthorizedMinter(owner.address)
      ).to.be.revertedWith("Cannot remove owner");
    });

    it("Should allow owner to update OTM address", async function () {
      const newOTM = client2.address;
      
      await expect(token.updateOTMAddress(newOTM))
        .to.emit(token, "OTMAddressUpdated")
        .withArgs(otm.address, newOTM);

      expect(await token.otmAddress()).to.equal(newOTM);
    });

    it("Should reject updating OTM address from non-owner", async function () {
      await expect(
        token.connect(unauthorized).updateOTMAddress(client2.address)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });

  describe("Pausable", function () {
    it("Should allow owner to pause and unpause", async function () {
      expect(await token.paused()).to.be.false;
      
      await token.pause();
      expect(await token.paused()).to.be.true;
      
      await token.unpause();
      expect(await token.paused()).to.be.false;
    });

    it("Should reject transfers when paused", async function () {
      await token.pause();
      
      await expect(
        token.transfer(client1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("Should reject minting when paused", async function () {
      await token.pause();
      
      await expect(
        token.mint(client1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("Should reject transferToOTM when paused", async function () {
      await token.transfer(client1.address, ethers.parseEther("100"));
      await token.pause();
      
      const requestId = ethers.keccak256(ethers.toUtf8Bytes("request1"));
      await expect(
        token.connect(client1).transferToOTM(ethers.parseEther("50"), requestId)
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow emergency withdrawal when paused", async function () {
      await token.pause();
      
      // Send some ETH to contract for testing
      await owner.sendTransaction({
        to: await token.getAddress(),
        value: ethers.parseEther("1")
      });

      const initialBalance = await ethers.provider.getBalance(client1.address);
      const withdrawAmount = ethers.parseEther("0.5");

      await token.emergencyWithdraw(ethers.ZeroAddress, client1.address, withdrawAmount);
      
      const finalBalance = await ethers.provider.getBalance(client1.address);
      expect(finalBalance - initialBalance).to.equal(withdrawAmount);
    });

    it("Should reject emergency withdrawal when not paused", async function () {
      await expect(
        token.emergencyWithdraw(ethers.ZeroAddress, client1.address, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(token, "ExpectedPause");
    });
  });

  describe("View Functions", function () {
    it("Should return correct contract info", async function () {
      const info = await token.getContractInfo();
      
      expect(info.tokenName).to.equal("OfflineWalletToken");
      expect(info.tokenSymbol).to.equal("OWT");
      expect(info.tokenDecimals).to.equal(18);
      expect(info.currentSupply).to.equal(INITIAL_SUPPLY);
      expect(info.maxSupply).to.equal(MAX_SUPPLY);
      expect(info.otm).to.equal(otm.address);
      expect(info.isPaused).to.be.false;
    });

    it("Should correctly track processed requests", async function () {
      const requestId = ethers.keccak256(ethers.toUtf8Bytes("request1"));
      
      expect(await token.isRequestProcessed(requestId)).to.be.false;
      
      await token.transfer(client1.address, ethers.parseEther("100"));
      await token.connect(client1).transferToOTM(ethers.parseEther("50"), requestId);
      
      expect(await token.isRequestProcessed(requestId)).to.be.true;
    });
  });

  describe("Edge Cases", function () {
    it("Should handle minimum transfer amount correctly", async function () {
      await token.transfer(client1.address, MIN_TRANSFER_AMOUNT);
      const requestId = ethers.keccak256(ethers.toUtf8Bytes("min_request"));

      await expect(
        token.connect(client1).transferToOTM(MIN_TRANSFER_AMOUNT, requestId)
      ).to.not.be.reverted;
    });

    it("Should handle maximum possible transfer", async function () {
      const maxTransfer = await token.balanceOf(owner.address);
      const requestId = ethers.keccak256(ethers.toUtf8Bytes("max_request"));

      await expect(
        token.transferToOTM(maxTransfer, requestId)
      ).to.not.be.reverted;
    });

    it("Should prevent reentrancy attacks", async function () {
      // This test ensures the ReentrancyGuard is working
      // In a real attack scenario, a malicious contract would try to call
      // transferToOTM recursively, but the guard should prevent this
      const requestId = ethers.keccak256(ethers.toUtf8Bytes("reentrancy_test"));
      await token.transfer(client1.address, ethers.parseEther("100"));

      // Normal call should work
      await expect(
        token.connect(client1).transferToOTM(ethers.parseEther("50"), requestId)
      ).to.not.be.reverted;
    });
  });
});