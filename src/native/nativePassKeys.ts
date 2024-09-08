import { Passkey } from "react-native-passkey";
import { PasskeyRegistrationResult } from "react-native-passkey/lib/typescript/Passkey";
import {
  PassKeyImplementation,
  PublicKeyCredentialCreationOptions,
  PublicKeyCredentialRequestOptions,
} from "../types";

// Initialize Passkey with your domain and app name
const passkey = new Passkey("liquidsdkapp.com", "Liquid SDK");

export const nativePassKeys: PassKeyImplementation = {
  createPassKeyCredential: async (
    options: PublicKeyCredentialCreationOptions,
  ): Promise<PasskeyRegistrationResult> => {
    try {
      const challenge = options.challenge;
      const userId = options.user.id;

      if (typeof challenge !== "string" || typeof userId !== "string") {
        throw new Error("Invalid challenge or user ID format");
      }

      const result = await passkey.register(challenge, userId);
      return result;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to create PassKey: ${error.message}`);
      } else {
        throw new Error("Failed to create PassKey: Unknown error");
      }
    }
  },

  signWithPassKey: async (options: PublicKeyCredentialRequestOptions) => {
    try {
      const challenge = options.challenge;

      if (typeof challenge !== "string") {
        throw new Error("Invalid challenge format");
      }

      const result = await passkey.auth(challenge);
      return result;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to sign with PassKey: ${error.message}`);
      } else {
        throw new Error("Failed to sign with PassKey: Unknown error");
      }
    }
  },
};
