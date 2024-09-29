// import { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/types';
// import {
//   PasskeyAuthResult as NativePasskeyAuthResult,
//   PasskeyRegistrationResult as NativePasskeyRegistrationResult,
// } from 'react-native-passkey/lib/typescript/Passkey';
import { Address } from 'viem';

import { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/types';

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
  APPROVE = 'APPROVE',
  WRAP = 'WRAP',
}
export interface SwapAction {
  type: ActionType.SWAP;
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  amountIn: bigint;
  isStable: boolean;
  to?: Address; // Optional, will use account address if not provided
}

export interface ApproveAction {
  type: ActionType.APPROVE;
  token?: Address;
  spender?: Address;
  amount?: bigint;
}

export interface DepositAction {
  type: ActionType.DEPOSIT;
  tokenA: TokenInfo;
  tokenB: TokenInfo;
  amountA: bigint;
  amountB: bigint;
  isStable: boolean;
  to?: Address;
}

export interface WithdrawAction {
  type: ActionType.WITHDRAW;
  tokenA: TokenInfo;
  tokenB: TokenInfo;
  liquidity: bigint;
  amountAMin: bigint;
  amountBMin: bigint;
  isStable: boolean;
  to?: Address;
}

export interface WithdrawAction {
  type: ActionType.WITHDRAW;
  tokenA: TokenInfo;
  tokenB: TokenInfo;
  liquidity: bigint;
  isStable: boolean;
}

export interface WrapETHAction {
  type: ActionType.WRAP;
  amount: bigint;
}

export type Action = SwapAction | DepositAction | WithdrawAction | ApproveAction | WrapETHAction;

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
  pubKeyCredParams: Array<{ alg: number; type: string }>;
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




/**
 * Result of web-based passkey authentication.
 */
export type WebAuthenticationResult = {
  id: string;
  rawId: string;
  type: 'public-key';
  response: {
    authenticatorData: string;
    clientDataJSON: string;
    signature: string;
    userHandle?: string;
  };
};

/**
 * Result of native passkey authentication.
 */
export type NativeAuthenticationResult = {
  credentialId: string;
  authenticatorData: string;
  clientDataJSON: string;
  signature: string;
  userHandle?: string;
};

/**
 * Result of web-based passkey registration.
 */
export type WebPassKeyRegistrationResult = {
  id: string;
  rawId: string;
  type: 'public-key';
  response: {
    attestationObject: string;
    clientDataJSON: string;
  };
};

/**
 * Result of native passkey registration.
 */
export type NativePasskeyRegistrationResult = {
  credentialId: string;
  attestationObject: string;
  clientDataJSON: string;
};

/**
 * Combined type for passkey registration results.
 */
export type PasskeyRegistrationResult = WebPassKeyRegistrationResult | NativePasskeyRegistrationResult;

/**
 * Combined type for passkey authentication results.
 */
export type PasskeyAuthResult = WebAuthenticationResult | NativeAuthenticationResult;

/**
 * Options for creating a passkey credential.
 */
export type CreatePassKeyCredentialOptions = PublicKeyCredentialCreationOptionsJSON

/**
 * Options for signing with a passkey.
 */
export type SignWithPassKeyOptions = PublicKeyCredentialRequestOptionsJSON

/**
 * Interface for passkey implementation.
 */
export interface PassKeyImplementation {
  /**
   * Create a new passkey credential.
   * @param options Options for creating the passkey.
   * @returns A promise that resolves to the registration result.
   */
  createPassKeyCredential: (options: CreatePassKeyCredentialOptions) => Promise<PasskeyRegistrationResult>;

  /**
   * Sign with an existing passkey.
   * @param options Options for signing with the passkey.
   * @returns A promise that resolves to the authentication result.
   */
  signWithPassKey: (options: SignWithPassKeyOptions) => Promise<PasskeyAuthResult>;
}