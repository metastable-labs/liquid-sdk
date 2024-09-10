import { Address, PublicClient, erc20Abi } from 'viem';
import { TokenInfo } from '../types';

export async function getTokenBalance(
  publicClient: PublicClient,
  tokenAddress: Address,
  userAddress: Address,
): Promise<string> {
  const balance = (await publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [userAddress],
  })) as bigint;

  return balance.toString();
}

export async function getTokenList(): Promise<TokenInfo[]> {
  // This is a placeholder implementation. we'll replace this with an actual token list
  return [
    { address: '0x...' as Address, symbol: 'WETH', decimals: 18 },
    { address: '0x...' as Address, symbol: 'USDC', decimals: 6 },
  ];
}
