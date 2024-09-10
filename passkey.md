# PassKey Authentication Process in Liquid SDK

## Overview

PassKey authentication, based on the WebAuthn standard, is primarily a client-side process. The Liquid SDK, using the `signWithPassKey` method, handles most of the authentication process on the client side. The server's role is to initiate the authentication challenge and verify the authentication result.

## Authentication Flow

1. **Initiate Authentication (Server)**

   - The server generates a challenge (a random string).
   - The server sends this challenge to the client along with any other necessary authentication options.

2. **Perform Authentication (Client/SDK)**

   - The SDK calls `signWithPassKey` with the challenge and options received from the server.
   - The user's device prompts for biometric verification (e.g., fingerprint, face ID).
   - Upon successful biometric verification, the device signs the challenge using the private key associated with the PassKey.

3. **Send Authentication Result (Client to Server)**

   - The SDK sends the signed challenge (assertion) back to the server.

4. **Verify Authentication (Server)**
   - The server verifies the signed challenge using the public key associated with the user's PassKey (stored during registration).
   - If the signature is valid, the server considers the authentication successful.

## Liquid SDK's Role

The Liquid SDK plays a crucial role in this process:

```typescript
class LiquidSDK {
  // ... other methods ...

  async authenticateUser(username: string, challenge: string): Promise<AuthenticationResult> {
    const credentialId = await this.getCredentialId(username);
    if (!credentialId) {
      throw new Error('No credential found for this user');
    }

    const authOptions = {
      challenge: Uint8Array.from(challenge, (c) => c.charCodeAt(0)),
      allowCredentials: [
        {
          id: Uint8Array.from(atob(credentialId), (c) => c.charCodeAt(0)),
          type: 'public-key',
        },
      ],
    };

    const assertion = await this.passKeyImpl.signWithPassKey(authOptions);

    return {
      credentialId,
      authenticatorData: assertion.authenticatorData,
      clientDataJSON: assertion.clientDataJSON,
      signature: assertion.signature,
    };
  }
}
```

## Server's Role

The server's role in authentication is more limited but still important:

1. **Generate and Send Challenge**

   ```typescript
   function generateAuthChallenge(username: string): string {
     const challenge = crypto.randomBytes(32).toString('base64');
     // Store the challenge temporarily (e.g., in Redis) associated with the username
     return challenge;
   }
   ```

2. **Verify Authentication Result**

   ```typescript
   async function verifyAuthentication(
     username: string,
     authResult: AuthenticationResult,
   ): Promise<boolean> {
     const user = await getUserByUsername(username);
     const challenge = await getStoredChallenge(username);

     // Verify the authentication result using the stored public key
     const verified = await verifyWebAuthnAssertion(authResult, user.publicKey, challenge);

     return verified;
   }
   ```

## Conclusion

In the PassKey authentication process:

- The SDK handles the core authentication logic on the client-side, including interacting with the user's device to sign the challenge.
- The server's role is to initiate the process by providing a challenge and to verify the result using the stored public key.
- This distribution of responsibilities ensures security (private keys never leave the user's device) while still allowing the server to control access to its resources.

This approach leverages the security benefits of PassKeys/WebAuthn while minimizing the server's involvement in the actual authentication process.

## BACKEND TODO

- Create User with username
- Generate registration options with username
  - verify registration response
  - extract public key and save in the user model db
  - return the public key to the sdk
- Generate authentication options with username
  - verify authentication respons
