export class SDKError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SDKError";
  }
}

export class PassKeyError extends SDKError {
  constructor(message: string) {
    super(`PassKey error: ${message}`);
    this.name = "PassKeyError";
  }
}

export class UserOperationError extends SDKError {
  constructor(message: string) {
    super(`User operation error: ${message}`);
    this.name = "UserOperationError";
  }
}

export class AerodromeError extends SDKError {
  constructor(message: string) {
    super(`Aerodrome error: ${message}`);
    this.name = "AerodromeError";
  }
}

export class UnsupportedEnvironmentError extends SDKError {
  constructor(feature: string) {
    super(`${feature} is not supported in this environment`);
    this.name = "UnsupportedEnvironmentError";
  }
}
