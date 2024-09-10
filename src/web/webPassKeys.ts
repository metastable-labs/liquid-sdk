import {
  PassKeyImplementation,
  PublicKeyCredentialCreationOptions,
  PublicKeyCredentialRequestOptions,
} from '../types';

export const webPassKeys: PassKeyImplementation = {
  createPassKeyCredential: async (options: any): Promise<Credential> => {
    try {
      const credential = await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: new Uint8Array(Buffer.from(options.challenge, 'base64')),
          user: {
            ...options.user,
            id: new Uint8Array(Buffer.from(options.user.id, 'utf-8')),
          },
          pubKeyCredParams: options.pubKeyCredParams.map((param: any) => ({
            ...param,
            type: 'public-key' as const,
          })),
        },
      });

      if (credential instanceof PublicKeyCredential) {
        return credential;
      } else {
        throw new Error('Failed to create PublicKeyCredential');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to create PassKey: ${error.message}`);
      } else {
        throw new Error('Failed to create PassKey: Unknown error');
      }
    }
  },

  signWithPassKey: async (options: PublicKeyCredentialRequestOptions): Promise<Credential> => {
    try {
      const credential = (await navigator.credentials.get({
        publicKey: {
          ...options,
          challenge: new Uint8Array(Buffer.from(options.challenge, 'base64')),
          allowCredentials: options.allowCredentials?.map((cred) => ({
            ...cred,
            id: new Uint8Array(Buffer.from(cred.id, 'base64')),
            type: 'public-key' as const,
          })),
        },
      })) as Credential;
      return credential;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to sign with PassKey: ${error.message}`);
      } else {
        throw new Error('Failed to sign with PassKey: Unknown error');
      }
    }
  },
};
