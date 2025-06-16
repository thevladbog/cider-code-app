/**
 * Shared types for Yandex Cloud Logger services
 * This file contains common interfaces to avoid circular dependencies
 */

export interface ServiceAccountKey {
  id: string;
  service_account_id: string;
  created_at: string;
  key_algorithm: string;
  public_key: string;
  private_key: string;
}

/**
 * Configuration for loading service account key from various sources
 */
export interface ServiceAccountKeyConfig {
  // Option 1: Direct key object (for development/testing only)
  key?: ServiceAccountKey;

  // Option 2: Environment variables
  envPrefix?: string; // Prefix for environment variables (default: 'YANDEX_')

  // Option 3: Encrypted storage path (for production)
  encryptedKeyPath?: string;
  encryptionPassword?: string;
}

/**
 * Utility functions for loading service account keys securely
 */
export class ServiceAccountKeyLoader {
  /**
   * Loads service account key from environment variables
   * Expected variables:
   * - {prefix}SERVICE_ACCOUNT_ID
   * - {prefix}SERVICE_ACCOUNT_KEY_ID
   * - {prefix}SERVICE_ACCOUNT_PRIVATE_KEY
   * - {prefix}SERVICE_ACCOUNT_PUBLIC_KEY (optional)
   * - {prefix}SERVICE_ACCOUNT_CREATED_AT (optional)
   * - {prefix}SERVICE_ACCOUNT_KEY_ALGORITHM (optional)
   */
  static loadFromEnv(prefix: string = 'YANDEX_'): ServiceAccountKey | null {
    const serviceAccountId = process.env[`${prefix}SERVICE_ACCOUNT_ID`];
    const keyId = process.env[`${prefix}SERVICE_ACCOUNT_KEY_ID`];
    const privateKey = process.env[`${prefix}SERVICE_ACCOUNT_PRIVATE_KEY`];

    if (!serviceAccountId || !keyId || !privateKey) {
      console.warn(
        `Service account key not found in environment variables with prefix "${prefix}"`
      );
      return null;
    }

    return {
      id: keyId,
      service_account_id: serviceAccountId,
      private_key: privateKey,
      public_key: process.env[`${prefix}SERVICE_ACCOUNT_PUBLIC_KEY`] || '',
      created_at: process.env[`${prefix}SERVICE_ACCOUNT_CREATED_AT`] || new Date().toISOString(),
      key_algorithm: process.env[`${prefix}SERVICE_ACCOUNT_KEY_ALGORITHM`] || 'RS256',
    };
  }

  /**
   * Loads service account key from base64 encoded environment variable
   * This is useful for storing the entire key as a single environment variable
   */
  static loadFromBase64Env(
    envVarName: string = 'YANDEX_SERVICE_ACCOUNT_KEY_BASE64'
  ): ServiceAccountKey | null {
    const base64Key = process.env[envVarName];

    if (!base64Key) {
      console.warn(`Service account key not found in environment variable "${envVarName}"`);
      return null;
    }

    try {
      const decoded = Buffer.from(base64Key, 'base64').toString('utf-8');
      const keyObject = JSON.parse(decoded);

      // Validate required fields
      if (!keyObject.id || !keyObject.service_account_id || !keyObject.private_key) {
        throw new Error('Invalid service account key format: missing required fields');
      }

      return keyObject as ServiceAccountKey;
    } catch (error) {
      console.error('Error decoding service account key from base64:', error);
      return null;
    }
  }

  /**
   * Safely loads service account key with fallback options
   * Tries multiple loading strategies in order of preference
   */
  static loadSafely(config: ServiceAccountKeyConfig): ServiceAccountKey | null {
    // Strategy 1: Try loading from base64 environment variable (most secure for production)
    const base64Key = this.loadFromBase64Env();
    if (base64Key) {
      console.log('Service account key loaded from base64 environment variable');
      return base64Key;
    }

    // Strategy 2: Try loading from individual environment variables
    const envKey = this.loadFromEnv(config.envPrefix);
    if (envKey) {
      console.log('Service account key loaded from environment variables');
      return envKey;
    }

    // Strategy 3: Use directly provided key (development only)
    if (config.key) {
      console.warn('Using directly provided service account key (not recommended for production)');
      return config.key;
    }

    console.error('No service account key could be loaded from any source');
    return null;
  }

  /**
   * Validates that a service account key has all required fields
   */
  static validate(key: ServiceAccountKey): boolean {
    const requiredFields = ['id', 'service_account_id', 'private_key'];
    const missingFields = requiredFields.filter(field => !key[field as keyof ServiceAccountKey]);

    if (missingFields.length > 0) {
      console.error('Service account key validation failed. Missing fields:', missingFields);
      return false;
    }

    // Validate private key format (should be PEM)
    if (!key.private_key.includes('-----BEGIN') || !key.private_key.includes('-----END')) {
      console.error(
        'Service account key validation failed: private_key does not appear to be in PEM format'
      );
      return false;
    }

    return true;
  }
}
