import { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/types';
import { Address } from 'viem';
import {
  CreatePassKeyCredentialOptions,
  PasskeyAuthResult,
  PasskeyRegistrationResult,
} from '../types';

export class LiquidAPI {
  private apiBaseUrl: string;
  private apiKey: string;

  constructor(apiBaseUrl: string, apiKey: string) {
    this.apiBaseUrl = apiBaseUrl;
    this.apiKey = apiKey;
  }

  private async fetchWithErrorHandling(url: string, options: RequestInit) {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async getRegistrationOptions(username: string): Promise<CreatePassKeyCredentialOptions> {
    return this.fetchWithErrorHandling(
      `${this.apiBaseUrl}/registration/options?user=${encodeURIComponent(username)}`,
      { method: 'GET' },
    );
  }

  async verifyRegistration(
    username: string,
    registrationResponse: PasskeyRegistrationResult,
  ): Promise<{ verified: boolean; publicKey: string }> {
    return this.fetchWithErrorHandling(`${this.apiBaseUrl}/registration/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userName: username, registrationResponse }),
    });
  }

  async getAuthenticationOptions(username: string): Promise<PublicKeyCredentialRequestOptionsJSON> {
    return this.fetchWithErrorHandling(
      `${this.apiBaseUrl}/authentication/options?user=${encodeURIComponent(username)}`,
      { method: 'GET' },
    );
  }

  async verifyAuthentication(
    username: string,
    authenticationResponse: PasskeyAuthResult,
  ): Promise<{ success: boolean }> {
    return this.fetchWithErrorHandling(`${this.apiBaseUrl}/authentication/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userName: username, authenticationResponse }),
    });
  }

  async updateUserAddress(username: string, userAddress: Address): Promise<{ success: boolean }> {
    return this.fetchWithErrorHandling(`${this.apiBaseUrl}/user/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({ userName: username, userAddress }),
    });
  }
}
