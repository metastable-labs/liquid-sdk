import {
  Address,
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  hashMessage,
  hashTypedData,
  Hex,
  http,
  parseEther,
  PublicClient,
  SignableMessage,
} from 'viem';
import { toCoinbaseSmartAccount, WebAuthnAccount } from 'viem/account-abstraction';
import { base } from 'viem/chains';
import { AerodromeConnectorABI, CoinbaseSmartWalletABI, WrappedETHABI } from '../abis';
import {
  Action,
  ActionType,
  PasskeyAuthResult,
  PassKeyImplementation,
  PasskeyRegistrationResult,
  PoolDetails,
  TokenInfo,
} from '../types';
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
      console.log('Registration options:', options);
      const registrationResponse = await this.passKeyImpl.createPassKeyCredential(options);
      console.log('Registration response:', registrationResponse);

      const verificationResponse = await this.api.verifyRegistration(
        username,
        registrationResponse,
      );
      console.log('Verification response:', verificationResponse);

      if (!verificationResponse.verified) {
        throw new Error('Attestation verification failed');
      }

      const publicKey = this.getPublicKeyFromRegistrationResponse(registrationResponse);
      console.log('Public key:', publicKey);

      const credentialId = this.getCredentialIdFromRegistrationResponse(registrationResponse);

      const webAuthnAccount: WebAuthnAccount = {
        type: 'webAuthn',
        publicKey: `0x${Array.from(publicKey).map((byte) => byte.toString(16).padStart(2, '0')).join('')}` as `0x${string}`,
        sign: async ({ hash }: { hash: Hex }) => {
          const signResult = await this.passKeyImpl.signWithPassKey({
            challenge: hash,
            allowCredentials: [{ id: credentialId, type: 'public-key' }],
          });
          return this.convertSignResultToSignReturnType(signResult, hash);
        },
        signMessage: async ({ message }: { message: SignableMessage }) => {
          const hash = hashMessage(message);
          return webAuthnAccount.sign({ hash });
        },
        signTypedData: async (typedData) => {
          const hash = hashTypedData(typedData);
          return webAuthnAccount.sign({ hash });
        },
      };

      const smartAccount = await toCoinbaseSmartAccount({
        client: this.publicClient,
        owners: [webAuthnAccount],
      });

      const address = await smartAccount.getAddress();
      await this.api.updateUserAddress(username, address);
      return { address };
    } catch (error) {
      console.error('Error in createSmartAccount:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to create smart account: ${error.message}`);
      } else {
        throw new Error('Failed to create smart account: Unknown error');
      }
    }
  }



  private getPublicKeyFromRegistrationResponse(response: PasskeyRegistrationResult): Uint8Array {
    let attestationObject: string;

    if ('response' in response) {
      attestationObject = response.response.attestationObject;
    } else {
      attestationObject = response.attestationObject;
    }

    console.log("Raw attestationObject:", attestationObject);
    attestationObject = this.base64UrlToBase64(attestationObject);
    console.log("Raw attestationObject After 1 :", attestationObject);
    attestationObject = this.ensureProperBase64(attestationObject);
    console.log("Raw attestationObject After 2:", attestationObject);
    try {
      return new Uint8Array(
        atob(attestationObject)
          .split('')
          .map((c) => c.charCodeAt(0))
      );
    } catch (error) {
      console.error('Error decoding attestationObject:', error);
      throw new Error('Failed to decode attestationObject');
    }
  }

  private getCredentialIdFromRegistrationResponse(response: PasskeyRegistrationResult): string {
    if ('id' in response) {
      // Web implementation
      return response.id;
    } else {
      // Native implementation
      return response.credentialId;
    }
  }


  private base64UrlToBase64(base64url: string): string {
    return base64url.replace(/-/g, '+').replace(/_/g, '/');
  }
  private ensureProperBase64(str: string): string {
    str = str.replace(/[^A-Za-z0-9+/=]/g, '');
    while (str.length % 4) {
      str += '=';
    }
    return str;
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

  private convertSignatureToHex(signResult: PasskeyAuthResult): `0x${string}` {
    let signature: string;

    if ('response' in signResult) {
      // Web authentication result
      signature = signResult.response.signature;
    } else {
      // Native authentication result
      signature = signResult.signature;
    }

    // Convert the base64 signature to a Uint8Array
    const signatureArray = new Uint8Array(
      atob(signature)
        .split('')
        .map((c) => c.charCodeAt(0)),
    );

    // Convert the Uint8Array to a hex string
    const signatureHex = Array.from(signatureArray)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return `0x${signatureHex}` as `0x${string}`;
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

  private convertSignResultToSignReturnType(signResult: PasskeyAuthResult, challenge: Hex) {
    let signature: string;
    let authenticatorData: string;
    let clientDataJSON: string;

    if ('response' in signResult) {
      // Web authentication result
      signature = signResult.response.signature;
      authenticatorData = signResult.response.authenticatorData;
      clientDataJSON = signResult.response.clientDataJSON;
    } else {
      // Native authentication result
      signature = signResult.signature;
      authenticatorData = signResult.authenticatorData;
      clientDataJSON = signResult.clientDataJSON;
    }

    signature = this.ensureProperBase64(signature);
    authenticatorData = this.ensureProperBase64(authenticatorData);


    const signatureHex = `0x${Buffer.from(atob(signature), 'binary').toString('hex')}` as Hex;
    const authenticatorDataHex = `0x${Buffer.from(atob(authenticatorData), 'binary').toString('hex')}` as Hex;

    const webAuthnData = {
      authenticatorData: authenticatorDataHex,
      challengeIndex: clientDataJSON.indexOf(challenge.slice(2)),
      clientDataJSON,
      typeIndex: clientDataJSON.indexOf('"type":"webauthn.get"'),
      userVerificationRequired: false,
    };

    return {
      signature: signatureHex,
      webauthn: webAuthnData,
    };
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
