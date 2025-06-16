/**
 * Example usage of secure Yandex Cloud Logger configuration
 * This file demonstrates the new secure service account key loading
 */

import { YandexCloudLogger, YandexCloudLoggerSDK } from './index';

// Example 1: Automatic environment loading (recommended for production)
export function createSecureLogger() {
  return new YandexCloudLogger({
    folderId: process.env.YANDEX_FOLDER_ID!,
    logGroupId: process.env.YANDEX_LOG_GROUP_ID!,
    // Service account key will be automatically loaded from:
    // YANDEX_SERVICE_ACCOUNT_KEY_BASE64 (preferred) or
    // YANDEX_SERVICE_ACCOUNT_ID, YANDEX_SERVICE_ACCOUNT_KEY_ID, etc.
  });
}

// Example 2: Custom environment prefix
export function createLoggerWithCustomPrefix() {
  return new YandexCloudLogger({
    folderId: process.env.YANDEX_FOLDER_ID!,
    logGroupId: process.env.YANDEX_LOG_GROUP_ID!,
    serviceAccountKeyConfig: {
      envPrefix: 'PROD_YANDEX_', // Will look for PROD_YANDEX_SERVICE_ACCOUNT_ID, etc.
    },
  });
}

// Example 3: Fallback to IAM token if service account key loading fails
export function createLoggerWithFallback() {
  return new YandexCloudLogger({
    folderId: process.env.YANDEX_FOLDER_ID!,
    logGroupId: process.env.YANDEX_LOG_GROUP_ID!,
    // Will try to load service account key from environment first
    // If that fails, will use the provided IAM token
    iamToken: process.env.YANDEX_IAM_TOKEN,
  });
}

// Example 4: SDK version with secure loading
export function createSecureSDKLogger() {
  return new YandexCloudLoggerSDK({
    folderId: process.env.YANDEX_FOLDER_ID!,
    logGroupId: process.env.YANDEX_LOG_GROUP_ID!,
    environment: process.env.NODE_ENV || 'production',
    // Same secure loading applies to SDK version
  });
}

// Example 5: Development configuration (should not be used in production)
export function createDevelopmentLogger() {
  // Only for local development - service account key should never be committed
  const devServiceAccountKey =
    process.env.NODE_ENV === 'development'
      ? {
          id: process.env.DEV_SA_KEY_ID!,
          service_account_id: process.env.DEV_SA_ID!,
          private_key: process.env.DEV_SA_PRIVATE_KEY!,
          public_key: process.env.DEV_SA_PUBLIC_KEY || '',
          created_at: new Date().toISOString(),
          key_algorithm: 'RS256',
        }
      : undefined;

  return new YandexCloudLogger({
    folderId: process.env.YANDEX_FOLDER_ID!,
    logGroupId: process.env.YANDEX_LOG_GROUP_ID!,
    serviceAccountKeyConfig: {
      key: devServiceAccountKey,
    },
  });
}

// Example usage
async function exampleUsage() {
  const logger = createSecureLogger();

  try {
    await logger.info('Application started', {
      version: process.env.npm_package_version,
      environment: process.env.NODE_ENV,
    });

    await logger.debug('Debug information', {
      timestamp: new Date().toISOString(),
      userId: 'example-user',
    });
  } catch (error) {
    console.error('Logging failed, but application continues:', error);
    // Application should continue even if logging fails
  }
}

// Environment setup example for .env file:
/*
# Required for all configurations
YANDEX_FOLDER_ID=your-folder-id
YANDEX_LOG_GROUP_ID=your-log-group-id

# Option 1: Base64 encoded service account key (recommended)
YANDEX_SERVICE_ACCOUNT_KEY_BASE64=<base64-encoded-json-key>

# Option 2: Individual environment variables
YANDEX_SERVICE_ACCOUNT_ID=your-service-account-id
YANDEX_SERVICE_ACCOUNT_KEY_ID=your-key-id
YANDEX_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Option 3: Fallback IAM token
YANDEX_IAM_TOKEN=your-iam-token

# Optional: Environment for SDK
NODE_ENV=production
*/

export { exampleUsage };
