import { Address, PublicClient } from "viem";
import { PoolDetails } from "../types";
import { AerodromeFactoryABI, AerodromePoolABI } from "../abis";

import { AERODROME_FACTORY_ADDRESS } from "./constants";
import { AerodromeError } from "./errors";

export class AerodromeResolver {
  constructor(private publicClient: PublicClient) {}

  async getUserPools(userAddress: Address): Promise<PoolDetails[]> {
    try {
      const pools: PoolDetails[] = [];

      const allPools = (await this.publicClient.readContract({
        address: AERODROME_FACTORY_ADDRESS,
        abi: AerodromeFactoryABI,
        functionName: "allPools",
      })) as Address[];

      for (const poolAddress of allPools) {
        const [token0, token1, isStable] =
          (await this.publicClient.readContract({
            address: poolAddress,
            abi: AerodromePoolABI,
            functionName: "getPoolInfo",
          })) as [Address, Address, boolean];

        const [userLpBalance, reserves, totalSupply] = await Promise.all([
          this.publicClient.readContract({
            address: poolAddress,
            abi: AerodromePoolABI,
            functionName: "balanceOf",
            args: [userAddress],
          }) as Promise<bigint>,
          this.publicClient.readContract({
            address: poolAddress,
            abi: AerodromePoolABI,
            functionName: "getReserves",
          }) as Promise<[bigint, bigint]>,
          this.publicClient.readContract({
            address: poolAddress,
            abi: AerodromePoolABI,
            functionName: "totalSupply",
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
        throw new AerodromeError("Failed to get user pools: Unknown error");
      }
    }
  }
}
