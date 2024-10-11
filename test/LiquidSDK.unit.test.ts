import { LiquidSDK } from './LiquidSDK';
import { SmartAccount } from 'viem/account-abstraction';
import { Action, ActionType, TokenInfo } from '../types';
import { Address } from 'viem';

// Mock dependencies
jest.mock('viem');
jest.mock('viem/account-abstraction');
jest.mock('./aerodromeResolvers');
jest.mock('./utils');

describe('LiquidSDK', () => {
  let sdk: LiquidSDK;
  let mockSmartAccount: jest.Mocked<SmartAccount>;

  beforeEach(() => {
    sdk = new LiquidSDK('mock-rpc-url', 'mock-bundler-url');
    mockSmartAccount = {
      address: '0x1234567890123456789012345678901234567890' as Address,
      signUserOperation: jest.fn(),
    } as unknown as jest.Mocked<SmartAccount>;
  });

  describe('Unit Tests', () => {
    test('executeStrategy should create and send a user operation', async () => {
      const mockActions: Action[] = [
        {
          type: ActionType.SWAP,
          tokenIn: { address: '0x1' as Address, decimals: 18 } as TokenInfo,
          tokenOut: { address: '0x2' as Address, decimals: 18 } as TokenInfo,
          amountIn: BigInt(1000),
          to: '0x3' as Address,
          isStable: false,
        },
      ];

      const mockTxHash = '0x1234';
      (sdk as any).bundlerClient = {
        estimateUserOperationGas: jest.fn().mockResolvedValue({
          callGasLimit: BigInt(1000000),
          verificationGasLimit: BigInt(1000000),
          preVerificationGas: BigInt(1000000),
        }),
        sendUserOperation: jest.fn().mockResolvedValue('0xmockuserophash'),
        waitForUserOperationReceipt: jest.fn().mockResolvedValue({
          receipt: { transactionHash: mockTxHash },
        }),
      };

      const result = await sdk.executeStrategy(mockSmartAccount, mockActions);

      expect(result).toBe(mockTxHash);
      expect(mockSmartAccount.signUserOperation).toHaveBeenCalled();
      expect((sdk as any).bundlerClient.sendUserOperation).toHaveBeenCalled();
    });

    test('getUserPools should return pool details', async () => {
      const mockPools = [{ poolAddress: '0x123' as Address }];
      (sdk as any).aerodromeResolver.getUserPools = jest.fn().mockResolvedValue(mockPools);

      const result = await sdk.getUserPools('0x456' as Address);

      expect(result).toEqual(mockPools);
    });

    // Add more unit tests for other methods...
  });