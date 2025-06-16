# Secure Service Account Key Configuration

This document explains how to securely configure Yandex Cloud service account keys for the logging services.

## Security Improvements

The previous implementation had several security issues:

1. **Circular Dependencies**: ServiceAccountKey interface was defined in multiple places
2. **Bundle Security**: Service account keys were bundled directly in the application binary
3. **No Environment Support**: No way to load keys from secure environment variables

These issues have been resolved with the new implementation.

## Configuration Options

### Option 1: Environment Variables (Recommended for Production)

Set the following environment variables:

```bash
# Individual environment variables
YANDEX_SERVICE_ACCOUNT_ID=your-service-account-id
YANDEX_SERVICE_ACCOUNT_KEY_ID=your-key-id
YANDEX_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
YANDEX_SERVICE_ACCOUNT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
YANDEX_SERVICE_ACCOUNT_CREATED_AT=2023-01-01T00:00:00Z
YANDEX_SERVICE_ACCOUNT_KEY_ALGORITHM=RS256

# OR use a single base64-encoded key (preferred)
YANDEX_SERVICE_ACCOUNT_KEY_BASE64=<base64-encoded-json-key>
```

Usage:

```typescript
const logger = new YandexCloudLogger({
  folderId: 'your-folder-id',
  logGroupId: 'your-log-group-id',
  // No serviceAccountKey needed - will be loaded from environment
});
```

### Option 2: Custom Environment Prefix

```typescript
const logger = new YandexCloudLogger({
  folderId: 'your-folder-id',
  logGroupId: 'your-log-group-id',
  serviceAccountKeyConfig: {
    envPrefix: 'CUSTOM_PREFIX_', // Will look for CUSTOM_PREFIX_SERVICE_ACCOUNT_ID, etc.
  },
});
```

### Option 3: Base64 Encoded Key

Generate base64 encoded key:

```bash
# Encode your service account key file
cat service-account-key.json | base64 -w 0
```

Set environment variable:

```bash
export YANDEX_SERVICE_ACCOUNT_KEY_BASE64="<base64-encoded-content>"
```

### Option 4: Direct Key (Development Only)

```typescript
const logger = new YandexCloudLogger({
  folderId: 'your-folder-id',
  logGroupId: 'your-log-group-id',
  serviceAccountKeyConfig: {
    key: {
      id: 'key-id',
      service_account_id: 'service-account-id',
      private_key: 'private-key-pem',
      // ... other fields
    },
  },
});
```

**⚠️ Warning**: This method should only be used for development. Never commit service account keys to version control.

## Security Best Practices

### For Production

1. **Use Environment Variables**: Store keys as environment variables
2. **Use Base64 Encoding**: Encode the entire key as a single base64 string
3. **Validate Keys**: The loader automatically validates key format and required fields
4. **Never Log Keys**: The implementation prevents accidental logging of private keys

### For Development

1. **Use `.env` files**: Store environment variables in `.env` files (add to `.gitignore`)
2. **Use IAM Tokens**: If possible, use temporary IAM tokens instead of service account keys
3. **Rotate Keys Regularly**: Service account keys should be rotated periodically

### For CI/CD

1. **Use Secrets Management**: Store keys in your CI/CD platform's secrets management
2. **Base64 Encoding**: Use base64 encoded keys for easier secret management
3. **Environment Specific Keys**: Use different keys for different environments

## Example Configurations

### Docker

```dockerfile
# In your Dockerfile
ENV YANDEX_SERVICE_ACCOUNT_KEY_BASE64=""

# At runtime
docker run -e YANDEX_SERVICE_ACCOUNT_KEY_BASE64="<base64-key>" your-app
```

### Kubernetes

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: yandex-cloud-credentials
type: Opaque
data:
  service-account-key: <base64-encoded-key>
---
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: app
          env:
            - name: YANDEX_SERVICE_ACCOUNT_KEY_BASE64
              valueFrom:
                secretKeyRef:
                  name: yandex-cloud-credentials
                  key: service-account-key
```

### GitHub Actions

```yaml
steps:
  - name: Run application
    env:
      YANDEX_SERVICE_ACCOUNT_KEY_BASE64: ${{ secrets.YANDEX_SERVICE_ACCOUNT_KEY }}
    run: npm start
```

## Migration Guide

### From Direct Keys

```typescript
// Old (insecure)
const logger = new YandexCloudLogger({
  serviceAccountKey: {
    id: 'key-id',
    service_account_id: 'service-account-id',
    private_key: 'private-key',
    // ...
  },
  // ...
});

// New (secure)
// Set YANDEX_SERVICE_ACCOUNT_KEY_BASE64 environment variable
const logger = new YandexCloudLogger({
  folderId: 'your-folder-id',
  logGroupId: 'your-log-group-id',
  // Key will be loaded automatically from environment
});
```

### Error Handling

The service account key loader includes comprehensive error handling and validation:

```typescript
// The logger will automatically fall back gracefully if keys can't be loaded
const logger = new YandexCloudLogger({
  folderId: 'your-folder-id',
  logGroupId: 'your-log-group-id',
  // Fallback to IAM token if service account key loading fails
  iamToken: process.env.YANDEX_IAM_TOKEN,
});
```

## Troubleshooting

### Common Issues

1. **Key Validation Failed**: Check that your private key is in PEM format
2. **Environment Variables Not Found**: Verify environment variable names and values
3. **Base64 Decoding Failed**: Ensure the base64 string is properly encoded

### Debug Logging

The service account key loader provides detailed logging:

- Success messages when keys are loaded
- Warning messages for fallback behavior
- Error messages for validation failures

Check your application logs for detailed information about key loading status.
