import {
  Address,
  Hex,
  PublicClient,
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  http,
  parseEther,
} from 'viem';
import { base } from 'viem/chains';
import { AerodromeConnectorABI, CoinbaseSmartWalletABI, WrappedETHABI } from '../abis';
import { Action, ActionType, PassKeyImplementation, PoolDetails, TokenInfo } from '../types';
import { AerodromeResolver } from './aerodromeResolvers';
import { LiquidAPI } from './api';
import {
  AERODROME_CONNECTOR_ADDRESS,
  CONNECTOR_PLUGIN_ADDRESS,
  IS_BROWSER,
  IS_REACT_NATIVE,
  WETH_ADDRESS,
} from './constants';
import { AerodromeError, SDKError, UnsupportedEnvironmentError } from './errors';
import { createUserOperation, estimateUserOperationGas, sendUserOperation } from './userOperations';
import { calculateDeadline, calculateMinAmount, getTokenBalance, getTokenList } from './utils';

export class LiquidSDK {
  private publicClient: PublicClient;
  private aerodromeResolver: AerodromeResolver;
  private passKeyImpl: PassKeyImplementation;
  private api: LiquidAPI;
  /**
   * @notice Constructs a new instance of the LiquidSDK
   * @param rpcUrl The URL of the RPC endpoint to connect to
   * @param passKeyImpl The implementation of PassKey functionality
   * @throws {UnsupportedEnvironmentError} If the environment is not supported
   */
  constructor(
    rpcUrl: string,
    passKeyImpl: PassKeyImplementation,
    apiBaseUrl: string,
    apiKey: string,
  ) {
    if (!IS_BROWSER && !IS_REACT_NATIVE) {
      throw new UnsupportedEnvironmentError('LiquidSDK');
    }
    this.publicClient = createPublicClient({
      chain: base,
      transport: http(rpcUrl),
    }) as PublicClient;
    this.aerodromeResolver = new AerodromeResolver(this.publicClient);
    this.passKeyImpl = passKeyImpl;

    this.api = new LiquidAPI(apiBaseUrl, apiKey);
  }

  async createSmartAccount(username: string): Promise<{ address: Address }> {
    try {
      const options = await this.api.getRegistrationOptions(username);
      const registrationResponse = await this.passKeyImpl.createPassKeyCredential(options);
      const verificationResponse = await this.api.verifyRegistration(
        username,
        registrationResponse,
      );
      if (!verificationResponse.verified) {
        throw new Error('Attestation verification failed');
      }
      const rawPubKeyString = atob(verificationResponse.publicKey);
      const rawPubKeyLen = rawPubKeyString.length;
      const bytes = new Uint8Array(rawPubKeyLen);

      for (let i = 0; i < rawPubKeyLen; i++) {
        bytes[i] = rawPubKeyString.charCodeAt(i);
      }
      const address = await this.deploySmartAccount(bytes);
      await this.api.updateUserAddress(username, address);
      return { address };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create smart account: ${error.message}`);
      } else {
        throw new Error('Failed to create smart account: Unknown error');
      }
    }
  }

  async executeStrategy(username: string, account: Address, actions: Action[]): Promise<string> {
    try {
      const calls = actions.map((action) => this.encodeAction(action));

      const batchCalldata = encodeFunctionData({
        abi: CoinbaseSmartWalletABI,
        functionName: 'executeBatch',
        args: [calls],
      });

      const authOptions = await this.api.getAuthenticationOptions(username);
      const signature = await this.passKeyImpl.signWithPassKey(authOptions);
      const verificationResult = await this.api.verifyAuthentication(username, signature);

      if (!verificationResult.success) {
        throw new Error('Authentication failed');
      }

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
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to execute strategy: ${error.message}`);
      } else {
        throw new Error('Failed to execute strategy: Unknown error');
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

  /**
   * @notice Deploys a new smart account
   * @param publicKey The public key of the PassKey
   * @returns A promise that resolves to the address of the new smart account
   * @throws {SDKError} If the smart account deployment fails
   */
  private async deploySmartAccount(publicKey: Uint8Array): Promise<Address> {
    try {
      const salt = parseEther('1'); //TODO: will use a unique nonce here
      // const owners = [...publicKey];

      // Create UserOperation for account creation
      let userOp = await createUserOperation(
        this.publicClient,
        '0x', // 0x because we're creating a new account
        '0x', // The 'data' is not used for account creation
        '', // Empty signature for account creation
        publicKey,
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
    let target: Address;
    let functionName: string;
    let value: bigint = 0n;
    let args: any[];
    let abi: any;
    const deadline = calculateDeadline();

    switch (action.type) {
      case ActionType.WRAP:
        target = WETH_ADDRESS;
        abi = WrappedETHABI;
        functionName = 'deposit';
        args = [];
        value = action.amount;
        break;
      case ActionType.APPROVE:
        target = action.token!;
        abi = erc20Abi;
        functionName = 'approve';
        args = [action.spender, action.amount];
        break;
      case ActionType.SWAP:
        target = CONNECTOR_PLUGIN_ADDRESS;
        const minReturnAmount = calculateMinAmount(action.amountIn.toString(), action.tokenOut);
        functionName = 'swapExactTokensForTokens';
        abi = AerodromeConnectorABI;
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
        target = CONNECTOR_PLUGIN_ADDRESS;
        const amountAMin = calculateMinAmount(action.amountA.toString(), action.tokenA);
        const amountBMin = calculateMinAmount(action.amountB.toString(), action.tokenB);
        functionName = 'addLiquidity';
        abi = AerodromeConnectorABI;
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
        target = CONNECTOR_PLUGIN_ADDRESS;
        const amountAMinWithdraw = calculateMinAmount(action.amountAMin.toString(), action.tokenA);
        const amountBMinWithdraw = calculateMinAmount(action.amountBMin.toString(), action.tokenB);
        functionName = 'removeLiquidity';
        abi = AerodromeConnectorABI;
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
      abi,
      functionName,
      args,
    });
    // If the action is not an approval or wrap, wrap it in a call to the connector's execute function
    if (action.type !== ActionType.APPROVE && action.type !== ActionType.WRAP) {
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

    return {
      target,
      value,
      data,
    };
  }
}
