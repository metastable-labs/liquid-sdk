import { Address, Hex, encodeFunctionData, PublicClient, parseEther } from 'viem';
import { UserOperation } from '../types';
import { UserOperationError } from './errors';
import { CoinbaseSmartWalletABI, EntryPointABI } from '../abis';
import { ENTRY_POINT_ADDRESS } from './constants';

export async function createUserOperation(
  publicClient: PublicClient,
  account: Address,
  data: Hex,
  signature: string,
  initCode?: Hex,
): Promise<UserOperation> {
  try {
    const nonce = (await publicClient.readContract({
      address: account,
      abi: CoinbaseSmartWalletABI,
      functionName: 'getNonce',
    })) as bigint;

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
