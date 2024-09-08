import { PasskeyRegistrationResult } from 'react-native-passkey/lib/typescript/Passkey';
import { Address } from 'viem';

export interface TokenInfo {
  address: Address;
  symbol: string;
  decimals: number;
}

export interface UserOperation {
  sender: Address;
  nonce: bigint;
  initCode: `0x${string}`;
  callData: `0x${string}`;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: `0x${string}`;
  signature: `0x${string}`;
}

export interface PoolDetails {
  poolAddress: Address;
  token0: Address;
  token1: Address;
  isStable: boolean;
  userLpBalance: string;
  reserveToken0: string;
  reserveToken1: string;
  totalSupply: string;
}

export enum ActionType {
  SWAP = 'SWAP',
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
}

export interface SwapAction {
  type: ActionType.SWAP;
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  amountIn: bigint;
  isStable: boolean;
}

export interface DepositAction {
  type: ActionType.DEPOSIT;
  tokenA: TokenInfo;
  tokenB: TokenInfo;
  amountA: bigint;
  amountB: bigint;
  isStable: boolean;
}

export interface WithdrawAction {
  type: ActionType.WITHDRAW;
  tokenA: TokenInfo;
  tokenB: TokenInfo;
  liquidity: bigint;
  isStable: boolean;
}

export type Action = SwapAction | DepositAction | WithdrawAction;

export interface PublicKeyCredentialCreationOptions {
  challenge: string;
  rp: {
    name: string;
    id: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{alg: number; type: string}>;
  timeout?: number;
  attestation?: string;
}

export interface PublicKeyCredentialRequestOptions {
  challenge: string;
  allowCredentials?: Array<{
    id: string;
    type: string;
  }>;
  timeout?: number;
  rpId?: string;
}

export interface PassKeyImplementation {
  createPassKeyCredential: (options: PublicKeyCredentialCreationOptions) => Promise<PasskeyRegistrationResult | Credential>;
  signWithPassKey: (options: PublicKeyCredentialRequestOptions) => Promise<Credential | any>;
}