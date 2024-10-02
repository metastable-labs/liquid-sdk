import { http, createPublicClient } from 'viem';
import {
  createBundlerClient,
  toCoinbaseSmartAccount,
  toWebAuthnAccount,
  createPaymasterClient,
} from 'viem/account-abstraction';
import { base } from 'viem/chains';

const paymasterClient = createPaymasterClient({
  transport: http('https://public.pimlico.io/v2/11155111/rpc'),
});

export const client = createPublicClient({
  chain: base,
  transport: http(),
});

// Create a WebAuthn owner account from the credential.
export const getOwner = (credential: any) => {
  return toWebAuthnAccount({ credential });
};

export const getAccount = async (owner: any) => {
  return await toCoinbaseSmartAccount({
    client,
    owners: [owner],
  });
};

export const bundlerClient = createBundlerClient({
  client,
  transport: http('https://public.pimlico.io/v2/1/rpc'),
  paymaster: true,
});
