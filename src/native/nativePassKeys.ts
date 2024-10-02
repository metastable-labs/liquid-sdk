import {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/types';

import { Passkey } from 'react-native-passkey';
import {
  NativeAuthenticationResult,
  NativePasskeyRegistrationResult,
  PassKeyImplementation,
} from '../types';

export class NativePassKeys implements PassKeyImplementation {
  private passkey: Passkey;

  constructor(domain: string, appName: string) {
    this.passkey = new Passkey(domain, appName);
  }

  async createPassKeyCredential(
    options: PublicKeyCredentialCreationOptionsJSON,
  ): Promise<NativePasskeyRegistrationResult> {
    try {
      // Convert the challenge to a string if it's not already
      const challenge =
        typeof options.challenge === 'string'
          ? options.challenge
          : bufferToBase64URLString(options.challenge);
      const { rawAttestationObject, credentialID, rawClientDataJSON } = await this.passkey.register(
        challenge,
        options.user.id as string,
      );
      return {
        clientDataJSON: rawClientDataJSON,
        attestationObject: rawAttestationObject,
        credentialId: credentialID,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to create PassKey: ${error.message}`);
      } else {
        throw new Error('Failed to create PassKey: Unknown error');
      }
    }
  }

  async signWithPassKey(
    options: PublicKeyCredentialRequestOptionsJSON,
  ): Promise<NativeAuthenticationResult> {
    try {
      // Convert the challenge to a string if it's not already
      const challenge =
        typeof options.challenge === 'string'
          ? options.challenge
          : bufferToBase64URLString(options.challenge);

      const { rawAuthenticatorData, rawClientDataJSON, credentialID, signature, userID } =
        await this.passkey.auth(challenge);
      return {
        credentialId: credentialID,
        authenticatorData: rawAuthenticatorData,
        clientDataJSON: rawClientDataJSON,
        signature,
        userHandle: userID,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to sign with PassKey: ${error.message}`);
      } else {
        throw new Error('Failed to sign with PassKey: Unknown error');
      }
    }
  }
}

// Helper function to convert ArrayBuffer to base64 string
function bufferToBase64URLString(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(buffer))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
