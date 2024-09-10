import {
  createPublicClient,
  http,
  Address,
  Hex,
  encodeFunctionData,
  PublicClient,
  parseEther,
  keccak256,
} from 'viem';
import { base } from 'viem/chains';
import {
  TokenInfo,
  UserOperation,
  PoolDetails,
  Action,
  ActionType,
  PassKeyImplementation,
} from '../types';
import { createUserOperation, estimateUserOperationGas, sendUserOperation } from './userOperations';
import { AerodromeResolver } from './aerodromeResolvers';
import {
  getTokenBalance,
  getTokenList,
  calculateMinAmount,
  calculateDeadline,
  formatAmount,
} from './utils';
import {
  SDKError,
  PassKeyError,
  UserOperationError,
  AerodromeError,
  UnsupportedEnvironmentError,
} from './errors';
import {
  COINBASE_WALLET_FACTORY_ADDRESS,
  ENTRY_POINT_ADDRESS,
  CONNECTOR_PLUGIN_ADDRESS,
  AERODROME_CONNECTOR_ADDRESS,
  IS_BROWSER,
  IS_REACT_NATIVE,
} from './constants';
import {
  CoinbaseSmartWalletABI,
  AerodromeFactoryABI,
  CoinbaseSmartWalletFactoryABI,
  AerodromeConnectorABI,
} from '../abis';

export class LiquidSDK {
  private publicClient: PublicClient;
  private aerodromeResolver: AerodromeResolver;
  private passKeyImpl: PassKeyImplementation;

  constructor(rpcUrl: string, passKeyImpl: PassKeyImplementation) {
    if (!IS_BROWSER && !IS_REACT_NATIVE) {
      throw new UnsupportedEnvironmentError('LiquidSDK');
    }
    this.publicClient = createPublicClient({
      chain: base,
      transport: http(rpcUrl),
    }) as PublicClient;
    this.aerodromeResolver = new AerodromeResolver(this.publicClient);
    this.passKeyImpl = passKeyImpl;
  }
  async executeStrategy(account: Address, passKeyId: string, actions: Action[]): Promise<string> {
    try {
      const calls = actions.map((action) => this.encodeAction(action));

      const batchCalldata = encodeFunctionData({
        abi: CoinbaseSmartWalletABI,
        functionName: 'executeBatch',
        args: [calls],
      });

      const authOptions = await this.getAuthenticationOptions(passKeyId);
      const signature = await this.passKeyImpl.signWithPassKey(authOptions as any);

      let signatureData: string;
      if ('signature' in signature) {
        // Native signature
        signatureData = signature.signature;
      } else {
        // Web signature
        signatureData = signature.response.signature;
      }

      let userOp = await createUserOperation(
        this.publicClient,
        account,
        account,
        batchCalldata,
        signatureData,
      );
      userOp = await estimateUserOperationGas(this.publicClient, userOp);
      const txHash = await sendUserOperation(this.publicClient, userOp);

      return txHash;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new UserOperationError(`Failed to execute strategy: ${error.message}`);
      } else {
        throw new UserOperationError('Failed to execute strategy: Unknown error');
      }
    }
  }

  async createSmartAccount(username: string): Promise<{ address: Address }> {
    try {
      // Fetch registration options from the backend
      const options = await this.getRegistrationOptions(username);

      const passKeyCreationResponse = await this.passKeyImpl.createPassKeyCredential(options);

      // Send attestation data to backend for verification
      const verificationResponse = await this.verifyRegistration(passKeyCreationResponse);

      if (!verificationResponse.verified) {
        throw new Error('Attestation verification failed');
      }

      const address = await this.deploySmartAccount(verificationResponse.publicKey);

      return {
        address,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new PassKeyError(`Failed to create smart account: ${error.message}`);
      } else {
        throw new PassKeyError('Failed to create smart account: Unknown error');
      }
    }
  }

  async getUserPools(userAddress: Address): Promise<PoolDetails[]> {
    try {
      return await this.aerodromeResolver.getUserPools(userAddress);
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new AerodromeError(`Failed to get user pools: ${error.message}`);
      } else {
        throw new AerodromeError('Failed to get user pools: Unknown error');
      }
    }
  }

  async getTokenBalance(tokenAddress: Address, userAddress: Address): Promise<string> {
    try {
      return await getTokenBalance(this.publicClient, tokenAddress, userAddress);
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new SDKError(`Failed to get token balance: ${error.message}`);
      } else {
        throw new SDKError('Failed to get token balance: Unknown error');
      }
    }
  }

  async getTokenList(): Promise<TokenInfo[]> {
    try {
      return await getTokenList();
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new SDKError(`Failed to get token list: ${error.message}`);
      } else {
        throw new SDKError('Failed to get token list: Unknown error');
      }
    }
  }

  // ideally this should be from the backend
  private async getRegistrationOptions(
    username: string,
  ): Promise<PublicKeyCredentialCreationOptions> {
    return {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: {
        name: 'Liquid',
        id: 'liquidapp.com',
      },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
      timeout: 60000,
      attestation: 'direct' as const,
    };
  }

  private async deploySmartAccount(publicKey: string): Promise<Address> {
    try {
      const salt = parseEther('1'); //TODO: will use a unique nonce here
      const owners = [publicKey];

      const predictedAddress = (await this.publicClient.readContract({
        address: COINBASE_WALLET_FACTORY_ADDRESS,
        abi: CoinbaseSmartWalletFactoryABI,
        functionName: 'getAddress',
        args: [owners, salt],
      })) as Address;

      const initCode = encodeFunctionData({
        abi: CoinbaseSmartWalletFactoryABI,
        functionName: 'createAccount',
        args: [owners, salt],
      });

      const txHash = await this.publicClient.sendRawTransaction({
        serializedTransaction: initCode,
      });

      await this.publicClient.waitForTransactionReceipt({ hash: txHash });

      return predictedAddress;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new SDKError(`Failed to deploy smart account: ${error.message}`);
      } else {
        throw new SDKError('Failed to deploy smart account: Unknown error');
      }
    }
  }

  private async getAuthenticationOptions(
    passKeyId: string,
  ): Promise<PublicKeyCredentialRequestOptions> {
    return {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [
        {
          id: Uint8Array.from(Buffer.from(passKeyId, 'base64')),
          type: 'public-key',
        },
      ],
      timeout: 60000,
    };
  }

  private encodeAction(action: Action): { target: Address; value: bigint; data: Hex } {
    let functionName: string;
    let args: any[];
    const deadline = calculateDeadline();

    switch (action.type) {
      case ActionType.SWAP:
        const minReturnAmount = calculateMinAmount(action.amountIn.toString(), action.tokenOut);
        functionName = 'swapExactTokensForTokens';
        args = [
          action.amountIn,
          minReturnAmount,
          [
            {
              from: action.tokenIn.address,
              to: action.tokenOut.address,
              stable: action.isStable,
            },
          ],
          action.to,
          deadline,
        ];
        break;
      case ActionType.DEPOSIT:
        const amountAMin = calculateMinAmount(action.amountA.toString(), action.tokenA);
        const amountBMin = calculateMinAmount(action.amountB.toString(), action.tokenB);
        functionName = 'addLiquidity';
        args = [
          action.tokenA.address,
          action.tokenB.address,
          action.isStable,
          action.amountA,
          action.amountB,
          amountAMin,
          amountBMin,
          action.to,
          deadline,
        ];
        break;
      case ActionType.WITHDRAW:
        const amountAMinWithdraw = calculateMinAmount(action.amountAMin.toString(), action.tokenA);
        const amountBMinWithdraw = calculateMinAmount(action.amountBMin.toString(), action.tokenB);
        functionName = 'removeLiquidity';
        args = [
          action.tokenA.address,
          action.tokenB.address,
          action.isStable,
          action.liquidity,
          amountAMinWithdraw,
          amountBMinWithdraw,
          action.to,
          deadline,
        ];
        break;
      default:
        throw new SDKError(`Unknown action type`);
    }

    const data = encodeFunctionData({
      abi: AerodromeConnectorABI,
      functionName,
      args,
    });

    return {
      target: CONNECTOR_PLUGIN_ADDRESS,
      value: 0n,
      data: encodeFunctionData({
        abi: [
          {
            type: 'function',
            name: 'execute',
            inputs: [
              { type: 'address', name: 'connector' },
              { type: 'bytes', name: 'data' },
            ],
            outputs: [{ type: 'bytes' }],
          },
        ],
        functionName: 'execute',
        args: [AERODROME_CONNECTOR_ADDRESS, data],
      }),
    };
  }
}
