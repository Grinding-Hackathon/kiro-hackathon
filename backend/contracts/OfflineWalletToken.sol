// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title OfflineWalletToken
 * @dev ERC20 token contract for offline blockchain wallet system
 * Manages token transfers between clients and Offline Token Manager (OTM)
 */
contract OfflineWalletToken is ERC20, Ownable, ReentrancyGuard, Pausable {
    
    // Events
    event TransferToClient(address indexed client, uint256 amount, bytes32 indexed requestId);
    event TransferToOTM(address indexed client, uint256 amount, bytes32 indexed redemptionId);
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    event OTMAddressUpdated(address indexed oldOTM, address indexed newOTM);
    
    // State variables
    address public otmAddress;
    mapping(address => bool) public authorizedMinters;
    mapping(bytes32 => bool) public processedRequests;
    
    // Constants
    uint256 public constant MAX_SUPPLY = 1000000000 * 10**18; // 1 billion tokens
    uint256 public constant MIN_TRANSFER_AMOUNT = 1 * 10**15; // 0.001 tokens
    
    // Modifiers
    modifier onlyOTM() {
        require(msg.sender == otmAddress, "Only OTM can call this function");
        _;
    }
    
    modifier onlyAuthorizedMinter() {
        require(authorizedMinters[msg.sender] || msg.sender == owner(), "Not authorized to mint");
        _;
    }
    
    modifier validAmount(uint256 amount) {
        require(amount > 0, "Amount must be positive");
        require(amount >= MIN_TRANSFER_AMOUNT, "Amount below minimum");
        _;
    }
    
    modifier uniqueRequest(bytes32 requestId) {
        require(!processedRequests[requestId], "Request already processed");
        _;
    }
    
    /**
     * @dev Constructor
     * @param _otmAddress Address of the Offline Token Manager
     * @param _initialSupply Initial token supply to mint to deployer
     */
    constructor(
        address _otmAddress,
        uint256 _initialSupply
    ) ERC20("OfflineWalletToken", "OWT") Ownable(msg.sender) {
        require(_otmAddress != address(0), "Invalid OTM address");
        require(_initialSupply <= MAX_SUPPLY, "Initial supply exceeds maximum");
        
        otmAddress = _otmAddress;
        authorizedMinters[msg.sender] = true;
        
        if (_initialSupply > 0) {
            _mint(msg.sender, _initialSupply);
            emit TokensMinted(msg.sender, _initialSupply);
        }
    }
    
    /**
     * @dev Transfer tokens from client to OTM for offline token purchase
     * @param amount Amount of tokens to transfer
     * @param requestId Unique identifier for this request
     */
    function transferToOTM(
        uint256 amount,
        bytes32 requestId
    ) external nonReentrant whenNotPaused validAmount(amount) uniqueRequest(requestId) {
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        // Mark request as processed
        processedRequests[requestId] = true;
        
        // Transfer tokens to OTM
        _update(msg.sender, otmAddress, amount);
        
        emit TransferToOTM(msg.sender, amount, requestId);
    }
    
    /**
     * @dev Transfer tokens from OTM to client for offline token redemption
     * @param client Address of the client receiving tokens
     * @param amount Amount of tokens to transfer
     * @param requestId Unique identifier for this redemption
     */
    function transferToClient(
        address client,
        uint256 amount,
        bytes32 requestId
    ) external onlyOTM nonReentrant whenNotPaused validAmount(amount) uniqueRequest(requestId) {
        require(client != address(0), "Invalid client address");
        require(balanceOf(otmAddress) >= amount, "Insufficient OTM balance");
        
        // Mark request as processed
        processedRequests[requestId] = true;
        
        // Transfer tokens from OTM to client
        _update(otmAddress, client, amount);
        
        emit TransferToClient(client, amount, requestId);
    }
    
    /**
     * @dev Internal transfer function with additional security checks
     * @param from Address sending tokens
     * @param to Address receiving tokens
     * @param value Amount of tokens to transfer
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override validAmount(value) {
        require(from != address(0) || to != address(0), "Invalid transfer");
        if (from != address(0)) {
            require(balanceOf(from) >= value, "Transfer amount exceeds balance");
        }
        
        super._update(from, to, value);
    }
    
    /**
     * @dev Mint new tokens (only authorized minters)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(
        address to,
        uint256 amount
    ) external onlyAuthorizedMinter whenNotPaused validAmount(amount) {
        require(to != address(0), "Cannot mint to zero address");
        require(totalSupply() + amount <= MAX_SUPPLY, "Would exceed max supply");
        
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }
    
    /**
     * @dev Burn tokens from caller's balance
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) external whenNotPaused validAmount(amount) {
        require(balanceOf(msg.sender) >= amount, "Insufficient balance to burn");
        
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount);
    }
    
    /**
     * @dev Burn tokens from specified address (requires allowance)
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burnFrom(
        address from,
        uint256 amount
    ) external whenNotPaused validAmount(amount) {
        require(from != address(0), "Cannot burn from zero address");
        require(balanceOf(from) >= amount, "Insufficient balance to burn");
        
        uint256 currentAllowance = allowance(from, msg.sender);
        require(currentAllowance >= amount, "Burn amount exceeds allowance");
        
        _approve(from, msg.sender, currentAllowance - amount);
        _burn(from, amount);
        emit TokensBurned(from, amount);
    }
    
    /**
     * @dev Update OTM address (only owner)
     * @param newOTMAddress New OTM address
     */
    function updateOTMAddress(address newOTMAddress) external onlyOwner {
        require(newOTMAddress != address(0), "Invalid OTM address");
        require(newOTMAddress != otmAddress, "Same as current OTM address");
        
        address oldOTM = otmAddress;
        otmAddress = newOTMAddress;
        
        emit OTMAddressUpdated(oldOTM, newOTMAddress);
    }
    
    /**
     * @dev Add authorized minter (only owner)
     * @param minter Address to authorize for minting
     */
    function addAuthorizedMinter(address minter) external onlyOwner {
        require(minter != address(0), "Invalid minter address");
        require(!authorizedMinters[minter], "Already authorized");
        
        authorizedMinters[minter] = true;
    }
    
    /**
     * @dev Remove authorized minter (only owner)
     * @param minter Address to remove from authorized minters
     */
    function removeAuthorizedMinter(address minter) external onlyOwner {
        require(minter != address(0), "Invalid minter address");
        require(authorizedMinters[minter], "Not authorized");
        require(minter != owner(), "Cannot remove owner");
        
        authorizedMinters[minter] = false;
    }
    
    /**
     * @dev Pause contract (only owner)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract (only owner)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Emergency withdrawal function (only owner, when paused)
     * @param token Address of token to withdraw (use address(0) for ETH)
     * @param to Address to send tokens/ETH to
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner whenPaused {
        require(to != address(0), "Invalid recipient address");
        
        if (token == address(0)) {
            // Withdraw ETH
            require(address(this).balance >= amount, "Insufficient ETH balance");
            payable(to).transfer(amount);
        } else {
            // Withdraw ERC20 tokens
            IERC20(token).transfer(to, amount);
        }
    }
    
    /**
     * @dev Get contract information
     * @return tokenName Token name
     * @return tokenSymbol Token symbol
     * @return tokenDecimals Token decimals
     * @return currentSupply Current total supply
     * @return maxSupply Maximum supply
     * @return otm OTM address
     * @return isPaused Whether contract is paused
     */
    function getContractInfo() external view returns (
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals,
        uint256 currentSupply,
        uint256 maxSupply,
        address otm,
        bool isPaused
    ) {
        return (
            name(),
            symbol(),
            decimals(),
            totalSupply(),
            MAX_SUPPLY,
            otmAddress,
            paused()
        );
    }
    
    /**
     * @dev Check if a request has been processed
     * @param requestId Request ID to check
     * @return processed Whether the request has been processed
     */
    function isRequestProcessed(bytes32 requestId) external view returns (bool processed) {
        return processedRequests[requestId];
    }
    
    /**
     * @dev Check if an address is an authorized minter
     * @param minter Address to check
     * @return authorized Whether the address is authorized to mint
     */
    function isAuthorizedMinter(address minter) external view returns (bool authorized) {
        return authorizedMinters[minter] || minter == owner();
    }
    
    /**
     * @dev Receive function to accept ETH
     */
    receive() external payable {
        // Allow contract to receive ETH for emergency withdrawal testing
    }
    
    /**
     * @dev Override transfer to add pause functionality
     */
    function transfer(address to, uint256 amount) public override whenNotPaused returns (bool) {
        return super.transfer(to, amount);
    }
    
    /**
     * @dev Override transferFrom to add pause functionality
     */
    function transferFrom(address from, address to, uint256 amount) public override whenNotPaused returns (bool) {
        return super.transferFrom(from, to, amount);
    }
    
    /**
     * @dev Override approve to add pause functionality
     */
    function approve(address spender, uint256 amount) public override whenNotPaused returns (bool) {
        return super.approve(spender, amount);
    }
}