import { Address, formatUnits, parseUnits, PublicClient } from 'viem';
import { PoolDetails, TokenInfo } from '../types';
import { AerodromeFactoryABI, AerodromePoolABI, AerodromeRouterABI } from '../abis';

import { AERODROME_FACTORY_ADDRESS, AERODROME_ROUTER_ADDRESS } from './constants';
import { AerodromeError } from './errors';

export class AerodromeResolver {
  constructor(private publicClient: PublicClient) {}

  async getUserPools(userAddress: Address): Promise<PoolDetails[]> {
    try {
      const pools: PoolDetails[] = [];

      const allPools = (await this.publicClient.readContract({
        address: AERODROME_FACTORY_ADDRESS,
        abi: AerodromeFactoryABI,
        functionName: 'allPools',
      })) as Address[];

      for (const poolAddress of allPools) {
        const [token0, token1, isStable] = (await this.publicClient.readContract({
          address: poolAddress,
          abi: AerodromePoolABI,
          functionName: 'getPoolInfo',
        })) as [Address, Address, boolean];

        const [userLpBalance, reserves, totalSupply] = await Promise.all([
          this.publicClient.readContract({
            address: poolAddress,
            abi: AerodromePoolABI,
            functionName: 'balanceOf',
            args: [userAddress],
          }) as Promise<bigint>,
          this.publicClient.readContract({
            address: poolAddress,
            abi: AerodromePoolABI,
            functionName: 'getReserves',
          }) as Promise<[bigint, bigint]>,
          this.publicClient.readContract({
            address: poolAddress,
            abi: AerodromePoolABI,
            functionName: 'totalSupply',
          }) as Promise<bigint>,
        ]);

        if (userLpBalance > 0n) {
          pools.push({
            poolAddress,
            token0,
            token1,
            isStable,
            userLpBalance: userLpBalance.toString(),
            reserveToken0: reserves[0].toString(),
            reserveToken1: reserves[1].toString(),
            totalSupply: totalSupply.toString(),
          });
        }
      }

      return pools;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new AerodromeError(`Failed to get user pools: ${error.message}`);
      } else {
        throw new AerodromeError('Failed to get user pools: Unknown error');
      }
    }
  }

  async getAddLiquidityQuote(
    tokenA: TokenInfo,
    tokenB: TokenInfo,
    amountADesired: string,
    isStable: boolean,
  ): Promise<{ amountA: string; amountB: string; liquidity: string }> {
    try {
      const amountADesiredBigInt = parseUnits(amountADesired, tokenA.decimals);

      // Use getAmountsOut to get the market rate for tokenB
      const amountsBigInt = (await this.publicClient.readContract({
        address: AERODROME_ROUTER_ADDRESS,
        abi: AerodromeRouterABI,
        functionName: 'getAmountsOut',
        args: [
          amountADesiredBigInt,
          [
            {
              from: tokenA.address,
              to: tokenB.address,
              stable: isStable,
              factory: '0x0000000000000000000000000000000000000000', // Use zero address for factory to use the default factory
            },
          ],
        ],
      })) as bigint[];

      const amountBOptimal = amountsBigInt[1];

      // Now, get the final quote with the optimal amounts
      const [amountA, amountB, liquidity] = (await this.publicClient.readContract({
        address: AERODROME_ROUTER_ADDRESS,
        abi: AerodromeRouterABI,
        functionName: 'quoteAddLiquidity',
        args: [
          tokenA.address,
          tokenB.address,
          isStable,
          '0x0000000000000000000000000000000000000000', // Use zero address for factory to use the default factory
          amountADesiredBigInt,
          amountBOptimal,
        ],
      })) as [bigint, bigint, bigint];

      return {
        amountA: formatUnits(amountA, tokenA.decimals),
        amountB: formatUnits(amountB, tokenB.decimals),
        liquidity: liquidity.toString(),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new AerodromeError(`Failed to get add liquidity quote: ${error.message}`);
      } else {
        throw new AerodromeError('Failed to get add liquidity quote: Unknown error');
      }
    }
  }

  async getRemoveLiquidityQuote(
    tokenA: TokenInfo,
    tokenB: TokenInfo,
    liquidity: string,
    isStable: boolean,
  ): Promise<{ amountA: string; amountB: string }> {
    try {
      const [amountA, amountB] = (await this.publicClient.readContract({
        address: AERODROME_ROUTER_ADDRESS,
        abi: AerodromeRouterABI,
        functionName: 'quoteRemoveLiquidity',
        args: [
          tokenA.address,
          tokenB.address,
          isStable,
          '0x0000000000000000000000000000000000000000', // Use zero address for factory to use the default factory
          BigInt(liquidity),
        ],
      })) as [bigint, bigint];

      return {
        amountA: formatUnits(amountA, tokenA.decimals),
        amountB: formatUnits(amountB, tokenB.decimals),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new AerodromeError(`Failed to get remove liquidity quote: ${error.message}`);
      } else {
        throw new AerodromeError('Failed to get remove liquidity quote: Unknown error');
      }
    }
  }
}
