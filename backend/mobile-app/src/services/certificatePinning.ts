import * as Crypto from 'expo-crypto';
import axios from 'axios';
import { Platform } from 'react-native';

// Pre-computed SHA-256 hashes of your server certificates
// You get these from your backend team
const PINNED_CERTIFICATES = {
  // Production certificate hash
  production: 'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  // Staging certificate hash
  staging: 'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
  // Backup certificate (in case of rotation)
  backup: 'sha256/CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=',
};

// Public key hashes for pinning
const PINNED_PUBLIC_KEYS = {
  production: 'sha256/DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD=',
  staging: 'sha256/EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE=',
};

class CertificatePinningService {
  private static instance: CertificatePinningService;
  private isPinningEnabled: boolean = true;
  private pinnedHashes: string[] = [];
  private environment: string = 'production';

  private constructor() {
    this.loadPinnedCertificates();
  }

  static getInstance(): CertificatePinningService {
    if (!CertificatePinningService.instance) {
      CertificatePinningService.instance = new CertificatePinningService();
    }
    return CertificatePinningService.instance;
  }

  // ========== LOAD PINNED CERTIFICATES ==========
  private loadPinnedCertificates(): void {
    const env = this.environment;
    this.pinnedHashes = [
      PINNED_CERTIFICATES[env as keyof typeof PINNED_CERTIFICATES],
      PINNED_PUBLIC_KEYS[env as keyof typeof PINNED_PUBLIC_KEYS],
      PINNED_CERTIFICATES.backup,
    ].filter(Boolean);
  }

  // ========== VALIDATE CERTIFICATE ==========
  async validateCertificate(
    certificateHash: string,
    publicKeyHash: string
  ): Promise<{ valid: boolean; reason?: string }> {
    if (!this.isPinningEnabled) {
      return { valid: true };
    }

    // Check if hash matches any pinned certificate
    const isValid = this.pinnedHashes.some(
      pinnedHash => 
        pinnedHash === certificateHash || 
        pinnedHash === publicKeyHash
    );

    if (!isValid) {
      // Log security event
      await this.logPinningFailure(certificateHash, publicKeyHash);
      return {
        valid: false,
        reason: 'Certificate pinning validation failed. Possible MITM attack detected.',
      };
    }

    return { valid: true };
  }

  // ========== LOG PINNING FAILURE ==========
  private async logPinningFailure(certHash: string, pubKeyHash: string): Promise<void> {
    try {
      const SecureStorage = (await import('./secureStorage')).default;
      await SecureStorage.logSecurityEvent('certificate_pinning_failed', {
        certHash,
        pubKeyHash,
        environment: this.environment,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to log pinning failure:', error);
    }
  }

  // ========== ENABLE/DISABLE PINNING ==========
  setPinningEnabled(enabled: boolean): void {
    this.isPinningEnabled = enabled;
  }

  // ========== SET ENVIRONMENT ==========
  setEnvironment(env: 'production' | 'staging' | 'development'): void {
    this.environment = env;
    this.loadPinnedCertificates();
  }

  // ========== GET PINNING STATUS ==========
  getPinningStatus(): {
    enabled: boolean;
    pinnedHashes: string[];
    environment: string;
  } {
    return {
      enabled: this.isPinningEnabled,
      pinnedHashes: this.pinnedHashes,
      environment: this.environment,
    };
  }

  // ========== VALIDATE SSL PINNING ==========
  async validateSSLConnection(url: string): Promise<boolean> {
    try {
      // This is a simplified check - in production, you'd use
      // react-native-ssl-pinning or similar library
      const response = await axios.head(url, {
        timeout: 5000,
        // In production, use actual SSL pinning library
      });
      
      // Get certificate info from response
      const certInfo = response.headers['x-ssl-cert-info'];
      if (certInfo) {
        const hash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          certInfo
        );
        const validation = await this.validateCertificate(hash, hash);
        return validation.valid;
      }
      
      return true; // Fallback if no cert info available
    } catch (error) {
      console.error('SSL validation error:', error);
      return false;
    }
  }

  // ========== PREPARE AXIOS INSTANCE WITH PINNING ==========
  createPinnedAxiosInstance(): typeof axios {
    const instance = axios.create();
    
    // Add interceptor to validate SSL
    instance.interceptors.request.use(async (config) => {
      // Only validate for HTTPS requests
      if (config.url?.startsWith('https://')) {
        const isValid = await this.validateSSLConnection(config.url);
        if (!isValid && this.isPinningEnabled) {
          throw new Error('SSL certificate validation failed');
        }
      }
      return config;
    });

    return instance;
  }
}

export default CertificatePinningService.getInstance();