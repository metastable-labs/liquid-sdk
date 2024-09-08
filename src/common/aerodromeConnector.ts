import { Address, encodeFunctionData } from "viem";
import { TokenInfo } from "../types";
import { AerodromeConnectorABI } from "../abis";
import { AerodromeError } from "./errors";

export function encodeSwap(
  tokenIn: TokenInfo,
  tokenOut: TokenInfo,
  amountIn: bigint,
  isStable: boolean,
  recipient: Address,
): string {
  try {
    return encodeFunctionData({
      abi: AerodromeConnectorABI,
      functionName: "swap",
      args: [tokenIn.address, tokenOut.address, amountIn, isStable, recipient],
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new AerodromeError(`Failed to encode swap: ${error.message}`);
    } else {
      throw new AerodromeError("Failed to encode swap: Unknown error");
    }
  }
}

export function encodeDepositLiquidity(
  tokenA: TokenInfo,
  tokenB: TokenInfo,
  amountA: bigint,
  amountB: bigint,
  isStable: boolean,
  recipient: Address,
): string {
  try {
    return encodeFunctionData({
      abi: AerodromeConnectorABI,
      functionName: "depositLiquidity",
      args: [
        tokenA.address,
        tokenB.address,
        amountA,
        amountB,
        isStable,
        recipient,
      ],
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new AerodromeError(
        `Failed to encode deposit liquidity: ${error.message}`,
      );
    } else {
      throw new AerodromeError(
        "Failed to encode deposit liquidity: Unknown error",
      );
    }
  }
}

export function encodeRemoveLiquidity(
  tokenA: TokenInfo,
  tokenB: TokenInfo,
  liquidity: bigint,
  isStable: boolean,
  recipient: Address,
): string {
  try {
    return encodeFunctionData({
      abi: AerodromeConnectorABI,
      functionName: "removeLiquidity",
      args: [tokenA.address, tokenB.address, liquidity, isStable, recipient],
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new AerodromeError(
        `Failed to encode remove liquidity: ${error.message}`,
      );
    } else {
      throw new AerodromeError(
        "Failed to encode remove liquidity: Unknown error",
      );
    }
  }
}
