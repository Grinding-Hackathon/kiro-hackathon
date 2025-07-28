# OfflineWalletToken Smart Contract

## Overview

The OfflineWalletToken (OWT) is an ERC20 token contract designed for the offline blockchain wallet system. It manages token transfers between clients and the Offline Token Manager (OTM) to enable secure offline transactions.

## Features

### Core Functionality
- **ERC20 Compliance**: Standard token functionality with transfer, approve, and allowance
- **transferToOTM**: Allows clients to transfer tokens to OTM for offline token purchase
- **transferToClient**: Allows OTM to transfer tokens back to clients for offline token redemption
- **Token Minting**: Controlled minting with authorized minter system
- **Token Burning**: Users can burn their own tokens or approved tokens

### Security Features
- **Access Control**: Owner-based permissions with authorized minter system
- **Reentrancy Protection**: ReentrancyGuard prevents reentrancy attacks
- **Pausable**: Emergency pause functionality for security incidents
- **Request Deduplication**: Prevents duplicate request processing
- **Minimum Transfer Amount**: Prevents dust attacks and ensures meaningful transfers

### Administrative Features
- **OTM Address Management**: Owner can update the OTM address
- **Authorized Minters**: Owner can add/remove authorized minters
- **Emergency Withdrawal**: Owner can withdraw tokens/ETH when contract is paused
- **Comprehensive Logging**: Events for all major operations

## Contract Details

- **Name**: OfflineWalletToken
- **Symbol**: OWT
- **Decimals**: 18
- **Max Supply**: 1,000,000,000 OWT
- **Min Transfer Amount**: 0.001 OWT

## Key Functions

### User Functions
```solidity
function transferToOTM(uint256 amount, bytes32 requestId) external
function transfer(address to, uint256 amount) public override
function approve(address spender, uint256 amount) public override
function burn(uint256 amount) external
function burnFrom(address from, uint256 amount) external
```

### OTM Functions
```solidity
function transferToClient(address client, uint256 amount, bytes32 requestId) external
```

### Owner Functions
```solidity
function mint(address to, uint256 amount) external
function updateOTMAddress(address newOTMAddress) external
function addAuthorizedMinter(address minter) external
function removeAuthorizedMinter(address minter) external
function pause() external
function unpause() external
function emergencyWithdraw(address token, address to, uint256 amount) external
```

### View Functions
```solidity
function getContractInfo() external view returns (...)
function isRequestProcessed(bytes32 requestId) external view returns (bool)
function isAuthorizedMinter(address minter) external view returns (bool)
```

## Events

```solidity
event TransferToClient(address indexed client, uint256 amount, bytes32 indexed requestId);
event TransferToOTM(address indexed client, uint256 amount, bytes32 indexed redemptionId);
event TokensMinted(address indexed to, uint256 amount);
event TokensBurned(address indexed from, uint256 amount);
event OTMAddressUpdated(address indexed oldOTM, address indexed newOTM);
```

## Security Considerations

1. **Request IDs**: All OTM operations require unique request IDs to prevent replay attacks
2. **Access Control**: Critical functions are protected by owner or OTM-only modifiers
3. **Reentrancy**: All state-changing functions are protected against reentrancy
4. **Pausable**: Contract can be paused in emergency situations
5. **Minimum Amounts**: Prevents dust attacks and ensures meaningful transfers
6. **Balance Checks**: All transfers verify sufficient balance before execution

## Deployment

### Local Development
```bash
npm run deploy:local
```

### Testnet Deployment
```bash
# Sepolia
npm run deploy:sepolia

# Goerli
npm run deploy:goerli
```

### Environment Variables Required
```bash
SEPOLIA_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
GOERLI_URL=https://goerli.infura.io/v3/YOUR_PROJECT_ID
PRIVATE_KEY=your_private_key_here
OTM_ADDRESS=otm_address_here
INITIAL_SUPPLY=1000000
ETHERSCAN_API_KEY=your_etherscan_api_key
```

## Testing

Run the comprehensive test suite:
```bash
npm run test:contracts
```

The test suite covers:
- Deployment scenarios
- Transfer operations (transferToOTM, transferToClient)
- Minting and burning functionality
- Access control mechanisms
- Pausable functionality
- Emergency functions
- Edge cases and security scenarios

## Integration

The contract is designed to integrate with:
1. **Backend API**: For managing user accounts and transaction history
2. **OTM Service**: For offline token issuance and redemption
3. **Mobile App**: For user interactions and balance queries
4. **Blockchain Network**: For on-chain token operations

## Gas Optimization

The contract includes several gas optimizations:
- Efficient storage layout
- Minimal external calls
- Optimized loops and conditionals
- Proper use of view/pure functions
- Event emission for off-chain indexing

## Upgrade Path

The contract is not upgradeable by design for security reasons. Any major changes would require:
1. Deploy new contract version
2. Migrate user balances (if needed)
3. Update OTM and backend configurations
4. Coordinate with mobile app updates

## Audit Recommendations

Before mainnet deployment:
1. Professional security audit
2. Formal verification of critical functions
3. Stress testing with high transaction volumes
4. Integration testing with full system
5. Bug bounty program consideration