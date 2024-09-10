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
import { encodeDepositLiquidity, encodeRemoveLiquidity, encodeSwap } from './aerodromeConnector';
import { AerodromeResolver } from './aerodromeResolvers';
import { getTokenBalance, getTokenList } from './utils';
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

  async createSmartAccount(username: string): Promise<{ address: Address; passKeyId: string }> {
    try {
      const options = await this.getRegistrationOptions(username);
      const credential = await this.passKeyImpl.createPassKeyCredential(options as any);

      let credentialId: string;
      if ('id' in credential) {
        // Web credential
        credentialId = credential.id;
      } else {
        // Native credential
        credentialId = credential.credentialID;
      }

      const address = await this.deploySmartAccount(credential);

      return { address, passKeyId: credentialId };
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

  private async deploySmartAccount(credential: any): Promise<Address> {
    try {
      const salt = parseEther('1'); // Use a unique salt for each deployment
      const initCode = encodeFunctionData({
        abi: CoinbaseSmartWalletABI,
        functionName: 'initialize',
        args: [credential.id],
      });

      // Encode the entire function call
      const calldata = encodeFunctionData({
        abi: CoinbaseSmartWalletFactoryABI,
        functionName: 'createAccount',
        args: [initCode, salt],
      });

      const txHash = await this.publicClient.sendRawTransaction({
        serializedTransaction: calldata,
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      const accountCreatedEvent = receipt.logs.find(
        (log) =>
          log.address.toLowerCase() === COINBASE_WALLET_FACTORY_ADDRESS.toLowerCase() &&
          log.topics[0] === keccak256('AccountCreated(address,address,bytes32)' as `0x${string}`),
      );
      let deployedAddress;
      if (accountCreatedEvent && accountCreatedEvent.topics[1]) {
        // The deployed address is the second topic (index 1) in the AccountCreated event
        deployedAddress = accountCreatedEvent.topics[1] as Address;
      }
      if (!deployedAddress) {
        throw new Error('Failed to extract deployed address from transaction receipt');
      }

      return deployedAddress as Address;
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

    switch (action.type) {
      case ActionType.SWAP:
        functionName = 'swap';
        args = [action.tokenIn.address, action.tokenOut.address, action.amountIn, action.isStable];
        break;
      case ActionType.DEPOSIT:
        functionName = 'depositLiquidity';
        args = [
          action.tokenA.address,
          action.tokenB.address,
          action.amountA,
          action.amountB,
          action.isStable,
        ];
        break;
      case ActionType.WITHDRAW:
        functionName = 'removeLiquidity';
        args = [action.tokenA.address, action.tokenB.address, action.liquidity, action.isStable];
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
