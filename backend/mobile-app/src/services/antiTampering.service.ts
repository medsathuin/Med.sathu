import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { Platform, NativeModules } from 'react-native';
import * as Device from 'expo-device';
import SecureStorage from './secureStorage';

const { AntiTamperingModule } = NativeModules;

interface IntegrityCheckResult {
  passed: boolean;
  failures: string[];
  signature?: string;
  timestamp: number;
}

class AntiTamperingService {
  private static instance: AntiTamperingService;
  private isEnabled: boolean = true;
  private lastCheckResult: IntegrityCheckResult | null = null;
  private checkInterval: number = 60000; // 1 minute
  private appSignature: string = '';

  private constructor() {
    this.generateAppSignature();
  }

  static getInstance(): AntiTamperingService {
    if (!AntiTamperingService.instance) {
      AntiTamperingService.instance = new AntiTamperingService();
    }
    return AntiTamperingService.instance;
  }

  // ========== GENERATE APP SIGNATURE ==========
  private async generateAppSignature(): Promise<void> {
    try {
      // Generate signature based on app code hash
      const appBundle = await this.getAppBundleHash();
      const deviceId = await Device.getDeviceTypeAsync();
      
      const signatureData = `${appBundle}-${deviceId}-${Platform.OS}`;
      this.appSignature = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        signatureData
      );
    } catch (error) {
      console.error('Generate app signature error:', error);
    }
  }

  // ========== GET APP BUNDLE HASH ==========
  private async getAppBundleHash(): Promise<string> {
    try {
      // In production, use native module to get app hash
      if (AntiTamperingModule?.getAppHash) {
        return await AntiTamperingModule.getAppHash();
      }
      return 'APP_HASH_PLACEHOLDER';
    } catch (error) {
      console.error('Get app bundle hash error:', error);
      return 'ERROR';
    }
  }

  // ========== PERFORM INTEGRITY CHECK ==========
  async performIntegrityCheck(): Promise<IntegrityCheckResult> {
    const result: IntegrityCheckResult = {
      passed: true,
      failures: [],
      timestamp: Date.now(),
    };

    try {
      // Check 1: App signature verification
      const isSignatureValid = await this.verifyAppSignature();
      if (!isSignatureValid) {
        result.passed = false;
        result.failures.push('App signature verification failed');
      }

      // Check 2: Code integrity
      const isCodeIntact = await this.verifyCodeIntegrity();
      if (!isCodeIntact) {
        result.passed = false;
        result.failures.push('Code integrity compromised');
      }

      // Check 3: Resource integrity
      const isResourceIntact = await this.verifyResourceIntegrity();
      if (!isResourceIntact) {
        result.passed = false;
        result.failures.push('Resource integrity compromised');
      }

      // Check 4: Native library integrity
      const isNativeIntact = await this.verifyNativeIntegrity();
      if (!isNativeIntact) {
        result.passed = false;
        result.failures.push('Native library integrity compromised');
      }

      // Check 5: Configuration integrity
      const isConfigIntact = await this.verifyConfigIntegrity();
      if (!isConfigIntact) {
        result.passed = false;
        result.failures.push('Configuration integrity compromised');
      }

      // Generate final signature
      result.signature = await this.generateIntegritySignature(result);

      // Log result
      await this.logIntegrityCheck(result);

    } catch (error) {
      console.error('Integrity check error:', error);
      result.passed = false;
      result.failures.push(`Integrity check error: ${String(error)}`);
    }

    this.lastCheckResult = result;
    return result;
  }

  // ========== VERIFY APP SIGNATURE ==========
  private async verifyAppSignature(): Promise<boolean> {
    try {
      // Get stored signature
      const storedSignature = await SecureStorage.getItem('app_signature');
      const currentSignature = this.appSignature;
      
      if (!storedSignature) {
        // First run - store signature
        await SecureStorage.setItem('app_signature', currentSignature);
        return true;
      }

      return storedSignature === currentSignature;
    } catch (error) {
      console.error('Verify app signature error:', error);
      return false;
    }
  }

  // ========== VERIFY CODE INTEGRITY ==========
  private async verifyCodeIntegrity(): Promise<boolean> {
    try {
      // In production, check code hashes
      if (AntiTamperingModule?.verifyCodeIntegrity) {
        return await AntiTamperingModule.verifyCodeIntegrity();
      }
      return true;
    } catch (error) {
      console.error('Verify code integrity error:', error);
      return false;
    }
  }

  // ========== VERIFY RESOURCE INTEGRITY ==========
  private async verifyResourceIntegrity(): Promise<boolean> {
    try {
      // Check resource files
      const assetPath = FileSystem.bundleDirectory || '';
      if (!assetPath) return true;

      // In production, check specific resource hashes
      const resources = ['assets/index.html', 'assets/fonts/', 'assets/images/'];
      
      for (const resource of resources) {
        const uri = `${assetPath}${resource}`;
        const exists = await FileSystem.getInfoAsync(uri);
        if (!exists.exists) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Verify resource integrity error:', error);
      return false;
    }
  }

  // ========== VERIFY NATIVE INTEGRITY ==========
  private async verifyNativeIntegrity(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        // Check Android native libraries
        if (AntiTamperingModule?.verifyNativeIntegrity) {
          return await AntiTamperingModule.verifyNativeIntegrity();
        }
      } else if (Platform.OS === 'ios') {
        // Check iOS frameworks
        if (AntiTamperingModule?.verifyNativeIntegrity) {
          return await AntiTamperingModule.verifyNativeIntegrity();
        }
      }
      return true;
    } catch (error) {
      console.error('Verify native integrity error:', error);
      return false;
    }
  }

  // ========== VERIFY CONFIG INTEGRITY ==========
  private async verifyConfigIntegrity(): Promise<boolean> {
    try {
      // Check config files
      const configs = ['app.json', 'package.json', 'tsconfig.json'];
      
      for (const config of configs) {
        const hash = await this.getFileHash(config);
        if (!hash) return false;
      }

      return true;
    } catch (error) {
      console.error('Verify config integrity error:', error);
      return false;
    }
  }

  // ========== GET FILE HASH ==========
  private async getFileHash(filePath: string): Promise<string | null> {
    try {
      // In production, read file and hash it
      return null;
    } catch (error) {
      console.error('Get file hash error:', error);
      return null;
    }
  }

  // ========== GENERATE INTEGRITY SIGNATURE ==========
  private async generateIntegritySignature(result: IntegrityCheckResult): Promise<string> {
    const data = JSON.stringify({
      passed: result.passed,
      failures: result.failures,
      timestamp: result.timestamp,
      appSignature: this.appSignature,
    });

    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      data
    );
  }

  // ========== LOG INTEGRITY CHECK ==========
  private async logIntegrityCheck(result: IntegrityCheckResult): Promise<void> {
    try {
      await SecureStorage.logSecurityEvent('integrity_check', {
        passed: result.passed,
        failures: result.failures,
        timestamp: result.timestamp,
        signature: result.signature,
      });

      if (!result.passed) {
        // Critical integrity failure
        await SecureStorage.logSecurityEvent('integrity_failure', {
          failures: result.failures,
          timestamp: result.timestamp,
        });
      }
    } catch (error) {
      console.error('Log integrity check error:', error);
    }
  }

  // ========== START PERIODIC CHECKS ==========
  startPeriodicChecks(interval: number = this.checkInterval): void {
    setInterval(async () => {
      const result = await this.performIntegrityCheck();
      
      if (!result.passed) {
        // Handle integrity failure
        await this.handleIntegrityFailure(result);
      }
    }, interval);
  }

  // ========== HANDLE INTEGRITY FAILURE ==========
  private async handleIntegrityFailure(result: IntegrityCheckResult): Promise<void> {
    try {
      // Log to backend
      await SecureStorage.logSecurityEvent('integrity_failure_critical', result);

      // Show alert to user
      // In production, use Alert.alert

      // Increment failure counter
      const failures = await SecureStorage.getItem('integrity_failures') || 0;
      await SecureStorage.setItem('integrity_failures', failures + 1);

      // If too many failures, restrict app
      if (failures > 5) {
        await this.restrictAppAccess();
      }
    } catch (error) {
      console.error('Handle integrity failure error:', error);
    }
  }

  // ========== RESTRICT APP ACCESS ==========
  private async restrictAppAccess(): Promise<void> {
    try {
      await SecureStorage.setItem('app_restricted', true);
      // Show restricted access message
      // In production, show fullscreen restriction
    } catch (error) {
      console.error('Restrict app access error:', error);
    }
  }

  // ========== GET LAST CHECK RESULT ==========
  getLastCheckResult(): IntegrityCheckResult | null {
    return this.lastCheckResult;
  }

  // ========== ENABLE/DISABLE ==========
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }
}

export default AntiTamperingService.getInstance();