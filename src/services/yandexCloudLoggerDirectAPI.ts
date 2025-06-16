/**
 * Direct HTTP API implementation for Yandex Cloud Logging
 * This bypasses the problematic SDK completely and prevents metadata service access
 */

import { ServiceAccountKey } from './types';

interface LogEntry {
  timestamp: string;
  level: 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  message: string;
  jsonPayload?: Record<string, unknown>;
  streamName?: string;
}

interface DirectAPIConfig {
  iamToken?: string;
  serviceAccountKey?: ServiceAccountKey;
  folderId: string;
  logGroupId: string;
  resource?: {
    type: string;
    id: string;
  };
}

/**
 * Generate IAM token from Service Account Key using JWT
 */
async function generateIamTokenFromServiceAccountKey(
  serviceAccountKey: ServiceAccountKey
): Promise<string> {
  const crypto = await import('crypto');
  const https = await import('https');

  // Prepare JWT header
  const header = {
    alg: 'PS256',
    typ: 'JWT',
    kid: serviceAccountKey.id,
  };

  // Prepare JWT payload
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccountKey.service_account_id,
    aud: 'https://iam.api.cloud.yandex.net/iam/v1/tokens',
    iat: now,
    exp: now + 3600, // 1 hour
  };

  // Encode header and payload
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Prepare private key (ensure proper PEM format)
  let privateKey = serviceAccountKey.private_key;
  if (!privateKey.includes('-----BEGIN') && !privateKey.includes('-----END')) {
    privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
  }

  // Sign the token
  const sign = crypto.createSign('RSA-PSS');
  sign.update(unsignedToken);
  const signature = sign.sign(privateKey, 'base64url');

  const jwt = `${unsignedToken}.${signature}`;

  // Exchange JWT for IAM token
  const requestData = JSON.stringify({ jwt });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'iam.api.cloud.yandex.net',
      port: 443,
      path: '/iam/v1/tokens',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData),
      },
    };

    const req = https.request(options, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.iamToken) {
            resolve(response.iamToken);
          } else {
            reject(new Error(`Failed to get IAM token: ${data}`));
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse IAM token response: ${parseError}`));
        }
      });
    });

    req.on('error', error => {
      reject(new Error(`HTTP request failed: ${error.message}`));
    });

    req.write(requestData);
    req.end();
  });
}

/**
 * Direct HTTP API client for Yandex Cloud Logging
 * Completely bypasses the SDK to prevent metadata service issues
 */
export class YandexCloudLoggerDirectAPI {
  private config: DirectAPIConfig;
  private iamToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: DirectAPIConfig) {
    this.config = config;
  }

  /**
   * Ensure we have a valid IAM token
   */
  private async ensureValidToken(): Promise<string> {
    const now = Date.now();

    // If we have an IAM token directly, use it
    if (this.config.iamToken) {
      return this.config.iamToken;
    }

    // Check if we need to refresh the token
    if (this.iamToken && now < this.tokenExpiresAt) {
      return this.iamToken;
    }

    // Generate new token from Service Account Key
    if (this.config.serviceAccountKey) {
      console.log('🔄 Generating IAM token from Service Account Key...');

      try {
        this.iamToken = await generateIamTokenFromServiceAccountKey(this.config.serviceAccountKey);
        this.tokenExpiresAt = now + 55 * 60 * 1000; // 55 minutes (5 min buffer)

        console.log('✅ IAM token generated successfully');
        return this.iamToken;
      } catch (error) {
        throw new Error(`Failed to generate IAM token: ${error}`);
      }
    }

    throw new Error('No authentication method available (iamToken or serviceAccountKey required)');
  }

  /**
   * Send log entries directly via HTTP API
   */
  async writeLogEntries(entries: LogEntry[]): Promise<void> {
    const https = await import('https');

    const iamToken = await this.ensureValidToken();

    // Convert entries to Yandex Cloud format
    const logEntries = entries.map(entry => ({
      timestamp: entry.timestamp,
      level: this.mapLogLevel(entry.level),
      message: entry.message,
      jsonPayload: entry.jsonPayload || {},
      streamName: entry.streamName || 'default',
    }));

    const requestBody = {
      destination: {
        logGroupId: this.config.logGroupId,
      },
      resource: this.config.resource || {
        type: 'bottle-code-app',
        id: 'electron-app',
      },
      entries: logEntries,
    };

    const requestData = JSON.stringify(requestBody);

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'logging.api.cloud.yandex.net',
        port: 443,
        path: '/logging/v1/write',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${iamToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestData),
          'x-folder-id': this.config.folderId,
        },
      };

      const req = https.request(options, res => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ Logs sent successfully via Direct API');
            resolve();
          } else {
            console.error(`❌ Direct API request failed: ${res.statusCode} ${res.statusMessage}`);
            console.error('Response:', data);
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', error => {
        console.error('❌ Direct API HTTP request error:', error);
        reject(new Error(`Direct API request failed: ${error.message}`));
      });

      req.write(requestData);
      req.end();
    });
  }

  /**
   * Map log levels to Yandex Cloud format
   */
  private mapLogLevel(level: string): number {
    const levelMap: Record<string, number> = {
      TRACE: 1,
      DEBUG: 2,
      INFO: 3,
      WARN: 4,
      ERROR: 5,
      FATAL: 6,
    };
    return levelMap[level] || 3; // Default to INFO
  }

  /**
   * Send a single log entry
   */
  async log(entry: LogEntry): Promise<void> {
    await this.writeLogEntries([entry]);
  }
}
