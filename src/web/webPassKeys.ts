import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import { PassKeyImplementation } from '../types';

export class WebPassKeys implements PassKeyImplementation {
  async createPassKeyCredential(
    options: PublicKeyCredentialCreationOptionsJSON,
  ): Promise<RegistrationResponseJSON> {
    try {
      return await startRegistration(options);
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
  ): Promise<AuthenticationResponseJSON> {
    try {
      return await startAuthentication(options);
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to sign with PassKey: ${error.message}`);
      } else {
        throw new Error('Failed to sign with PassKey: Unknown error');
      }
    }
  }
}
