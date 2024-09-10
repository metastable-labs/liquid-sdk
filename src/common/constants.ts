import { Address } from 'viem';

export const COINBASE_WALLET_FACTORY_ADDRESS: Address =
  '0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a' as Address;
export const ENTRY_POINT_ADDRESS: Address = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as Address;
export const CONNECTOR_PLUGIN_ADDRESS: Address =
  '0xCC09a96891026c2a50e783094E411dA566B260a3' as Address;
export const AERODROME_CONNECTOR_ADDRESS: Address =
  '0xb5bAA3aEA179e12D9D51b5b51191e3dA18D16B5b' as Address;
export const AERODROME_FACTORY_ADDRESS: Address =
  '0x420DD381b31aEf6683db6B902084cB0FFECe40Da' as Address;

export const EVENT_ACCOUNT_CREATED = 'AccountCreated';
export const EVENT_LIQUIDITY_ADDED = 'LiquidityAdded';
export const EVENT_LIQUIDITY_REMOVED = 'LiquidityRemoved';
export const EVENT_SWAP_EXECUTED = 'SwapExecuted';

export const IS_BROWSER = typeof window !== 'undefined' && typeof window.document !== 'undefined';
export const IS_REACT_NATIVE =
  typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
