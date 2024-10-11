export class SDKError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SDKError';
  }
}

export class UserOperationError extends SDKError {
  constructor(message: string) {
    super(`User operation error: ${message}`);
    this.name = 'UserOperationError';
  }
}

export class AerodromeError extends SDKError {
  constructor(message: string) {
    super(`Aerodrome error: ${message}`);
    this.name = 'AerodromeError';
  }
}
