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
  PasskeyRegistrationResult,
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

  /**
   * @notice Constructs a new instance of the LiquidSDK
   * @param rpcUrl The URL of the RPC endpoint to connect to
   * @param passKeyImpl The implementation of PassKey functionality
   * @throws {UnsupportedEnvironmentError} If the environment is not supported
   */
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

  /**
   * @notice Executes a strategy consisting of multiple actions
   * @param account The address of the account executing the strategy
   * @param passKeyId The ID of the PassKey to use for signing
   * @param actions An array of actions to execute
   * @returns A promise that resolves to the transaction hash
   * @throws {UserOperationError} If the strategy execution fails
   */
  async executeStrategy(account: Address, passKeyId: string, actions: Action[]): Promise<string> {
    try {
      const calls = actions.map((action) => this.encodeAction(action));

      const batchCalldata = encodeFunctionData({
        abi: CoinbaseSmartWalletABI,
        functionName: 'executeBatch',
        args: [calls],
      });

      const authOptions = await this.getAuthenticationOptions(passKeyId);
      const signature = await this.passKeyImpl.signWithPassKey(authOptions);

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
  /**
   * @notice Creates a new smart account
   * @param username The username associated with the new account
   * @returns A promise that resolves to an object containing the address of the new account
   * @throws {PassKeyError} If the smart account creation fails
   */
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

  /**
   * @notice Retrieves the balance of a specific token for a user
   * @param tokenAddress The address of the token
   * @param userAddress The address of the user
   * @returns A promise that resolves to the token balance as a string
   * @throws {SDKError} If fetching the token balance fails
   */
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

  /**
   * @notice Gets a quote for adding or removing liquidity
   * @param tokenA The first token in the pair
   * @param tokenB The second token in the pair
   * @param isDeposit Whether this is a deposit (true) or withdrawal (false)
   * @param amount The amount of tokenA (for deposit) or LP tokens (for withdrawal)
   * @param isStable Whether this is a stable or volatile pool
   * @returns A promise that resolves to an object containing the amounts and liquidity
   * @throws {AerodromeError} If fetching the quote fails
   */
  async getQuote(
    tokenA: TokenInfo,
    tokenB: TokenInfo,
    isDeposit: boolean,
    amount: string,
    isStable: boolean,
  ): Promise<{ amountA: string; amountB: string; liquidity?: string }> {
    try {
      if (isDeposit) {
        return await this.aerodromeResolver.getAddLiquidityQuote(tokenA, tokenB, amount, isStable);
      } else {
        return await this.aerodromeResolver.getRemoveLiquidityQuote(
          tokenA,
          tokenB,
          amount,
          isStable,
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new AerodromeError(`Failed to get quote: ${error.message}`);
      } else {
        throw new AerodromeError('Failed to get quote: Unknown error');
      }
    }
  }
  // backend implementation to return
  private async verifyRegistration(result: PasskeyRegistrationResult): Promise<any> {
    return result;
  }

  // backend implemntation
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
  /**
   * @notice Deploys a new smart account
   * @param publicKey The public key of the PassKey
   * @returns A promise that resolves to the address of the new smart account
   * @throws {SDKError} If the smart account deployment fails
   */
  private async deploySmartAccount(publicKey: string): Promise<Address> {
    try {
      const salt = parseEther('1'); //TODO: will use a unique nonce here
      const owners = [publicKey];

      // Create UserOperation for account creation
      let userOp = await createUserOperation(
        this.publicClient,
        '0x', // 0x because we're creating a new account
        '0x', // The 'data' is not used for account creation
        '', // Empty signature for account creation
        owners,
        salt,
      );

      // Estimate gas for UserOperation
      userOp = await estimateUserOperationGas(this.publicClient, userOp);

      // Send UserOperation to EntryPoint
      const txHash = await sendUserOperation(this.publicClient, userOp);

      // Wait for the transaction to be mined and get the receipt
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });

      return userOp.sender as `0x${string}`;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new SDKError(`Failed to deploy smart account: ${error.message}`);
      } else {
        throw new SDKError('Failed to deploy smart account: Unknown error');
      }
    }
  }

  /**
   * @notice Encodes an action for execution
   * @param action The action to encode
   * @returns An object containing the target address, value, and encoded data
   * @throws {SDKError} If the action type is unknown
   */
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
