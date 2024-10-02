import { Address, Hex, PublicClient, encodeFunctionData, parseEther } from 'viem';
import { CoinbaseSmartWalletABI, CoinbaseSmartWalletFactoryABI, EntryPointABI } from '../abis';
import { UserOperation } from '../types';
import { COINBASE_WALLET_FACTORY_ADDRESS, ENTRY_POINT_ADDRESS } from './constants';
import { UserOperationError } from './errors';

export async function createUserOperation(
  publicClient: PublicClient,
  sender: Address,
  data: Hex,
  signature: string,
  owners?: Uint8Array, // For account creation
  salt?: bigint, // For account creation
): Promise<UserOperation> {
  try {
    let account: Address;
    let nonce: bigint;
    let initCode: Hex;
    if (sender !== '0x') {
      // Existing account
      account = sender;
      nonce = (await publicClient.readContract({
        address: account,
        abi: CoinbaseSmartWalletABI,
        functionName: 'nonce',
      })) as bigint;
      initCode = '0x';
    } else if (owners && salt !== undefined) {
      // New account creation
      account = (await publicClient.readContract({
        address: COINBASE_WALLET_FACTORY_ADDRESS,
        abi: CoinbaseSmartWalletFactoryABI,
        functionName: 'getAddress',
        args: [owners, salt],
      })) as Address;
      nonce = 0n;
      initCode = encodeFunctionData({
        abi: CoinbaseSmartWalletFactoryABI,
        functionName: 'createAccount',
        args: [owners, salt],
      }) as Hex;
    } else {
      throw new Error('Invalid parameters for user operation creation');
    }

    const userOp: UserOperation = {
      sender: account,
      nonce,
      initCode: initCode || '0x',
      callData: data,
      callGasLimit: 0n,
      verificationGasLimit: 0n,
      preVerificationGas: 0n,
      maxFeePerGas: 0n,
      maxPriorityFeePerGas: 0n,
      paymasterAndData: '0x',
      signature: signature as `0x${string}`,
    };

    return userOp;
  } catch (error) {
    if (error instanceof Error) {
      throw new UserOperationError(`Failed to create user operation: ${error.message}`);
    } else {
      throw new UserOperationError('Failed to create user operation: Unknown error');
    }
  }
}

export async function estimateUserOperationGas(
  publicClient: PublicClient,
  userOp: UserOperation,
): Promise<UserOperation> {
  try {
    const estimation = (await publicClient.readContract({
      address: ENTRY_POINT_ADDRESS,
      abi: EntryPointABI,
      functionName: 'estimateUserOperationGas',
      args: [userOp, ENTRY_POINT_ADDRESS, parseEther('0')],
    })) as {
      preVerificationGas: bigint;
      verificationGas: bigint;
      callGasLimit: bigint;
    };

    return {
      ...userOp,
      preVerificationGas: estimation.preVerificationGas,
      verificationGasLimit: estimation.verificationGas,
      callGasLimit: estimation.callGasLimit,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new UserOperationError(`Failed to estimate user operation gas: ${error.message}`);
    } else {
      throw new UserOperationError('Failed to estimate user operation gas: Unknown error');
    }
  }
}

export async function sendUserOperation(
  publicClient: PublicClient,
  userOp: UserOperation,
): Promise<`0x${string}`> {
  try {
    // Encode the entire function call
    const calldata = encodeFunctionData({
      abi: EntryPointABI,
      functionName: 'handleOps',
      args: [[userOp], userOp.sender],
    });

    // Send the raw transaction
    const txHash = await publicClient.sendRawTransaction({
      serializedTransaction: calldata,
    });

    return txHash;
  } catch (error) {
    if (error instanceof Error) {
      throw new UserOperationError(`Failed to send user operation: ${error.message}`);
    } else {
      throw new UserOperationError('Failed to send user operation: Unknown error');
    }
  }
}
