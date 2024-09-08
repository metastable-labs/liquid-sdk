import { createPublicClient, http, Address, Hex, encodeFunctionData, PublicClient, parseEther, keccak256 } from 'viem';
import { base } from 'viem/chains';
import { TokenInfo, UserOperation, PoolDetails, Action, ActionType, PassKeyImplementation } from '../types';
import { createUserOperation, estimateUserOperationGas, sendUserOperation } from './userOperations';
import { encodeDepositLiquidity, encodeRemoveLiquidity, encodeSwap } from './aerodromeConnector';
import { AerodromeResolver } from './aerodromeResolvers';
import { getTokenBalance, getTokenList } from './utils';
import { SDKError, PassKeyError, UserOperationError, AerodromeError, UnsupportedEnvironmentError } from './errors';
import {
  COINBASE_WALLET_FACTORY_ADDRESS,
  ENTRY_POINT_ADDRESS,
  CONNECTOR_PLUGIN_ADDRESS,
  AERODROME_CONNECTOR_ADDRESS,
  IS_BROWSER,
  IS_REACT_NATIVE
} from './constants';
import { CoinbaseSmartWalletABI, AerodromeFactoryABI, CoinbaseSmartWalletFactoryABI } from '../abis';

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
      transport: http(rpcUrl)
    }) as PublicClient;
    this.aerodromeResolver = new AerodromeResolver(this.publicClient);
    this.passKeyImpl = passKeyImpl;
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

  private async getRegistrationOptions(username: string): Promise<PublicKeyCredentialCreationOptions> {
    return {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: {
        name: "Liquid",
        id: "liquidapp.com",
      },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [{alg: -7, type: "public-key"}],
      timeout: 60000,
      attestation: "direct" as const,
    };
  }

  private async deploySmartAccount(credential: any): Promise<Address> {
    try {
      
      const salt = parseEther('1'); // Use a unique salt for each deployment
      const initCode = encodeFunctionData({
        abi: CoinbaseSmartWalletABI,
        functionName: 'initialize',
        args: [credential.id]
      });
        
            // Encode the entire function call
    const calldata = encodeFunctionData({
      abi: CoinbaseSmartWalletFactoryABI,
      functionName: 'createAccount',
      args: [initCode, salt],
    });

      const txHash = await this.publicClient.sendRawTransaction({
       serializedTransaction: calldata
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      
      const accountCreatedEvent = receipt.logs.find(log => 
        log.address.toLowerCase() === COINBASE_WALLET_FACTORY_ADDRESS.toLowerCase() &&
        log.topics[0] === keccak256('AccountCreated(address,address,bytes32)' as `0x${string}`)
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

  private async getAuthenticationOptions(passKeyId: string): Promise<PublicKeyCredentialRequestOptions> {
    return {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{
        id: Uint8Array.from(Buffer.from(passKeyId, 'base64')),
        type: 'public-key',
      }],
      timeout: 60000,
    };
  }

  private encodeAction(action: Action, account: Address): string {
    switch (action.type) {
      case ActionType.SWAP:
        return encodeSwap(action.tokenIn, action.tokenOut, action.amountIn, action.isStable, account);
      case ActionType.DEPOSIT:
        return encodeDepositLiquidity(action.tokenA, action.tokenB, action.amountA, action.amountB, action.isStable, account);
      case ActionType.WITHDRAW:
        return encodeRemoveLiquidity(action.tokenA, action.tokenB, action.liquidity, action.isStable, account);
      default:
        throw new SDKError(`Unknown action type`);
    }
  }

 async executeStrategy(
    account: Address,
    passKeyId: string,
    actions: Action[]
  ): Promise<string> {
    try {
      const encodedActions = actions.map(action => this.encodeAction(action, account));
      
      const batchCalldata = encodedActions.reduce((acc, curr) => acc + curr.slice(2), encodedActions[0]);

      const accountCalldata = encodeFunctionData({
        abi: CoinbaseSmartWalletABI,
        functionName: 'executeBatch',
        args: [[
          { target: CONNECTOR_PLUGIN_ADDRESS, value: 0, data: batchCalldata }
        ]]
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

      let userOp = await createUserOperation(this.publicClient, account, account, accountCalldata, signatureData);
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
}