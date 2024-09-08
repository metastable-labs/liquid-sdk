# Liquid SDK Detailed Documentation

## Table of Contents

1. [LiquidSDK Class](#liquidsdk-class)
2. [createSmartAccount](#createsmartaccount)
3. [executeStrategy](#executestrategy)
4. [getUserPools](#getuserpools)
5. [getTokenBalance](#gettokenbalance)
6. [getTokenList](#gettokenlist)

## LiquidSDK Class

The `LiquidSDK` class is the main entry point for interacting with the Liquid protocol.

### Constructor

```typescript
constructor(rpcUrl: string, passKeyImpl: PassKeyImplementation)
```

- `rpcUrl`: The URL of the Ethereum RPC endpoint to connect to.
- `passKeyImpl`: An implementation of PassKey functions for either web or mobile environments.

#### Usage

```typescript
import { LiquidSDK, webPassKeys } from '@liquid/sdk';

const sdk = new LiquidSDK('https://mainnet.infura.io/v3/YOUR-PROJECT-ID', webPassKeys);
```

## createSmartAccount

Creates a new smart account using PassKey authentication.

```typescript
async createSmartAccount(username: string): Promise<{ address: Address; passKeyId: string }>
```

### Parameters

- `username`: A string representing the username for the account.

### Returns

A Promise that resolves to an object containing:
- `address`: The address of the newly created smart account.
- `passKeyId`: The ID of the PassKey associated with this account.

### Errors

- Throws `PassKeyError` if account creation fails.

### Usage Example

```typescript
try {
  const { address, passKeyId } = await sdk.createSmartAccount('alice@example.com');
  console.log(`Smart account created at ${address} with PassKey ID ${passKeyId}`);
} catch (error) {
  console.error('Failed to create smart account:', error);
}
```

## executeStrategy

Executes a series of actions (swap, deposit, withdraw) on behalf of the account.

```typescript
async executeStrategy(account: Address, passKeyId: string, actions: Action[]): Promise<string>
```

### Parameters

- `account`: The address of the smart account executing the strategy.
- `passKeyId`: The ID of the PassKey associated with the account.
- `actions`: An array of `Action` objects representing the strategy to execute.

### Returns

A Promise that resolves to the transaction hash of the executed strategy.

### Errors

- Throws `UserOperationError` if strategy execution fails.

### Usage Example

```typescript
const actions = [
  {
    type: 'SWAP',
    tokenIn: { address: '0x...', symbol: 'TOKEN_A', decimals: 18 },
    tokenOut: { address: '0x...', symbol: 'TOKEN_B', decimals: 18 },
    amountIn: 1000000000000000000n, // 1 TOKEN_A
    isStable: true
  },
  {
    type: 'DEPOSIT',
    tokenA: { address: '0x...', symbol: 'TOKEN_B', decimals: 18 },
    tokenB: { address: '0x...', symbol: 'TOKEN_C', decimals: 18 },
    amountA: 500000000000000000n, // 0.5 TOKEN_B
    amountB: 1000000000000000000n, // 1 TOKEN_C
    isStable: false
  }
];

try {
  const txHash = await sdk.executeStrategy(accountAddress, passKeyId, actions);
  console.log(`Strategy executed with transaction hash: ${txHash}`);
} catch (error) {
  console.error('Failed to execute strategy:', error);
}
```

## getUserPools

Retrieves all liquidity pools that the user has participated in.

```typescript
async getUserPools(userAddress: Address): Promise<PoolDetails[]>
```

### Parameters

- `userAddress`: The address of the user to get pools for.

### Returns

A Promise that resolves to an array of `PoolDetails` objects.

### Errors

- Throws `AerodromeError` if fetching user pools fails.

### Usage Example

```typescript
try {
  const pools = await sdk.getUserPools(accountAddress);
  console.log('User pools:', pools);
} catch (error) {
  console.error('Failed to get user pools:', error);
}
```

## getTokenBalance

Gets the balance of a specific token for a given user address.

```typescript
async getTokenBalance(tokenAddress: Address, userAddress: Address): Promise<string>
```

### Parameters

- `tokenAddress`: The address of the token to check the balance for.
- `userAddress`: The address of the user to check the balance of.

### Returns

A Promise that resolves to a string representing the token balance.

### Errors

- Throws `SDKError` if fetching token balance fails.

### Usage Example

```typescript
try {
  const balance = await sdk.getTokenBalance(tokenAddress, accountAddress);
  console.log(`Token balance: ${balance}`);
} catch (error) {
  console.error('Failed to get token balance:', error);
}
```

## getTokenList

Retrieves a list of supported tokens.

```typescript
async getTokenList(): Promise<TokenInfo[]>
```

### Returns

A Promise that resolves to an array of `TokenInfo` objects.

### Errors

- Throws `SDKError` if fetching token list fails.

### Usage Example

```typescript
try {
  const tokens = await sdk.getTokenList();
  console.log('Supported tokens:', tokens);
} catch (error) {
  console.error('Failed to get token list:', error);
}
```
