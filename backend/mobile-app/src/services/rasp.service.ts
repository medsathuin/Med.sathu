import { Platform, AppState, NativeModules } from 'react-native';
import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';
import SecureStorage from './secureStorage';
import { getUniqueId } from 'react-native-device-info';

// Native bridge for advanced runtime checks
const { RASPModule } = NativeModules;

interface RASPAlert {
  type: 'suspicious' | 'critical' | 'info';
  message: string;
  timestamp: number;
  data?: any;
}

class RASPService {
  private static instance: RASPService;
  private isMonitoring: boolean = false;
  private alerts: RASPAlert[] = [];
  private appState: string = 'active';
  private suspiciousActivities: string[] = [];

  private constructor() {
    this.setupAppStateMonitoring();
  }

  static getInstance(): RASPService {
    if (!RASPService.instance) {
      RASPService.instance = new RASPService();
    }
    return RASPService.instance;
  }

  // ========== START RUNTIME PROTECTION ==========
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('🛡️ RASP monitoring started');

    // Run initial checks
    await this.performIntegrityChecks();

    // Start periodic checks
    setInterval(() => {
      this.performRuntimeChecks();
    }, 30000); // Every 30 seconds

    // Start memory protection
    this.enableMemoryProtection();
  }

  // ========== PERFORM INTEGRITY CHECKS ==========
  private async performIntegrityChecks(): Promise<void> {
    const checks = [
      this.checkDebuggerAttached(),
      this.checkEmulator(),
      this.checkRootedDevice(),
      this.checkAppIntegrity(),
    ];

    const results = await Promise.all(checks);
    const issues = results.filter(r => !r.passed);

    if (issues.length > 0) {
      for (const issue of issues) {
        await this.triggerAlert({
          type: 'critical',
          message: issue.message,
          timestamp: Date.now(),
          data: issue.data,
        });
      }
    }
  }

  // ========== CHECK DEBUGGER ==========
  private async checkDebuggerAttached(): Promise<{ passed: boolean; message: string; data?: any }> {
    try {
      // Check if app is being debugged
      // @ts-ignore - __DEV__ is injected by React Native
      if (__DEV__) {
        return {
          passed: false,
          message: 'App is running in debug mode. Remove for production.',
          data: { debugMode: true },
        };
      }

      // Additional debugger detection
      if (Platform.OS === 'android') {
        // Check for debugging connections
        // This is a simplified check
        const isDebugging = false; // In production, use native module
        if (isDebugging) {
          return {
            passed: false,
            message: 'Debugger detected. Possible reverse engineering attempt.',
            data: { debuggerAttached: true },
          };
        }
      }

      return { passed: true, message: 'No debugger detected' };
    } catch (error) {
      return {
        passed: false,
        message: 'Failed to check debugger status',
        data: { error: String(error) },
      };
    }
  }

  // ========== CHECK EMULATOR ==========
  private async checkEmulator(): Promise<{ passed: boolean; message: string; data?: any }> {
    try {
      const isEmulator = !Device.isDevice;
      
      if (isEmulator) {
        return {
          passed: false,
          message: 'App running on emulator/simulator. May indicate automated attack.',
          data: { isEmulator: true },
        };
      }

      return { passed: true, message: 'Running on real device' };
    } catch (error) {
      return {
        passed: false,
        message: 'Failed to check device type',
        data: { error: String(error) },
      };
    }
  }

  // ========== CHECK ROOTED/JAILBROKEN ==========
  private async checkRootedDevice(): Promise<{ passed: boolean; message: string; data?: any }> {
    try {
      // Check for root/jailbreak
      if (Platform.OS === 'android') {
        // Android root checks
        const rootFiles = [
          '/system/app/Superuser.apk',
          '/sbin/su',
          '/system/bin/su',
          '/system/xbin/su',
          '/data/local/xbin/su',
          '/data/local/bin/su',
          '/system/sd/xbin/su',
          '/system/bin/failsafe/su',
          '/data/local/su',
        ];
        // Simplified - in production use native module
        const isRooted = false; // Placeholder
        if (isRooted) {
          return {
            passed: false,
            message: 'Device is rooted. Security compromised.',
            data: { isRooted: true },
          };
        }
      } else if (Platform.OS === 'ios') {
        // iOS jailbreak checks
        const isJailbroken = false; // Placeholder
        if (isJailbroken) {
          return {
            passed: false,
            message: 'Device is jailbroken. Security compromised.',
            data: { isJailbroken: true },
          };
        }
      }

      return { passed: true, message: 'Device is secure' };
    } catch (error) {
      return {
        passed: false,
        message: 'Failed to check root status',
        data: { error: String(error) },
      };
    }
  }

  // ========== CHECK APP INTEGRITY ==========
  private async checkAppIntegrity(): Promise<{ passed: boolean; message: string; data?: any }> {
    try {
      // Check if app has been tampered with
      // Get app hash from native module
      const appHash = await this.getAppHash();
      const expectedHash = 'EXPECTED_APP_HASH_FROM_BUILD';
      
      if (appHash !== expectedHash) {
        return {
          passed: false,
          message: 'App integrity compromised. App may have been tampered with.',
          data: { appHash, expectedHash },
        };
      }

      return { passed: true, message: 'App integrity verified' };
    } catch (error) {
      return {
        passed: false,
        message: 'Failed to verify app integrity',
        data: { error: String(error) },
      };
    }
  }

  // ========== GET APP HASH ==========
  private async getAppHash(): Promise<string> {
    // In production, get from native module
    // For now, return a placeholder
    return 'APP_HASH_PLACEHOLDER';
  }

  // ========== RUNTIME CHECKS ==========
  private async performRuntimeChecks(): Promise<void> {
    try {
      // Monitor for suspicious activities
      this.detectSuspiciousAPIUsage();
      this.detectMemoryTampering();
      this.detectHookFrameworks();
    } catch (error) {
      console.error('Runtime check error:', error);
    }
  }

  // ========== DETECT SUSPICIOUS API USAGE ==========
  private detectSuspiciousAPIUsage(): void {
    // Monitor for unusual API calls
    // In production, use native hooks
    const suspiciousCalls = [
      // Add patterns for suspicious API calls
    ];

    if (suspiciousCalls.length > 0) {
      this.suspiciousActivities.push(...suspiciousCalls);
      this.triggerAlert({
        type: 'suspicious',
        message: `Detected ${suspiciousCalls.length} suspicious API calls`,
        timestamp: Date.now(),
        data: { calls: suspiciousCalls },
      });
    }
  }

  // ========== DETECT MEMORY TAMPERING ==========
  private detectMemoryTampering(): void {
    // Check for memory modifications
    // In production, use native memory protection
  }

  // ========== DETECT HOOK FRAMEWORKS ==========
  private detectHookFrameworks(): void {
    // Detect Frida, Xposed, etc.
    // In production, use native detection
  }

  // ========== ENABLE MEMORY PROTECTION ==========
  private enableMemoryProtection(): void {
    // Enable memory protection using native module
    if (RASPModule?.enableMemoryProtection) {
      RASPModule.enableMemoryProtection();
    }
  }

  // ========== SETUP APP STATE MONITORING ==========
  private setupAppStateMonitoring(): void {
    AppState.addEventListener('change', (nextAppState) => {
      const prevState = this.appState;
      this.appState = nextAppState;

      if (this.isMonitoring) {
        this.handleAppStateChange(prevState, nextAppState);
      }
    });
  }

  // ========== HANDLE APP STATE CHANGE ==========
  private handleAppStateChange(prevState: string, nextState: string): void {
    // Detect suspicious transitions
    if (prevState === 'background' && nextState === 'active') {
      // App came to foreground - check for tampering
      this.performRuntimeChecks();
    }

    if (prevState === 'active' && nextState === 'background') {
      // App went to background - clear sensitive data
      this.clearSensitiveData();
    }
  }

  // ========== CLEAR SENSITIVE DATA ==========
  private async clearSensitiveData(): Promise<void> {
    try {
      await SecureStorage.clearSensitiveData();
    } catch (error) {
      console.error('Failed to clear sensitive data:', error);
    }
  }

  // ========== TRIGGER ALERT ==========
  private async triggerAlert(alert: RASPAlert): Promise<void> {
    this.alerts.push(alert);
    
    // Log to backend
    await SecureStorage.logSecurityEvent('rasp_alert', alert);
    
    // Show notification for critical alerts
    if (alert.type === 'critical') {
      // Show user-facing alert
      this.showCriticalAlert(alert.message);
    }
  }

  // ========== SHOW CRITICAL ALERT ==========
  private showCriticalAlert(message: string): void {
    // Show alert dialog
    // In production, use Alert.alert
    console.warn('⚠️ CRITICAL ALERT:', message);
  }

  // ========== GET ALERTS ==========
  getAlerts(): RASPAlert[] {
    return this.alerts;
  }

  // ========== CLEAR ALERTS ==========
  clearAlerts(): void {
    this.alerts = [];
  }

  // ========== STOP MONITORING ==========
  stopMonitoring(): void {
    this.isMonitoring = false;
    console.log('🛑 RASP monitoring stopped');
  }

  // ========== RESPOND TO THREAT ==========
  async respondToThreat(alert: RASPAlert): Promise<void> {
    switch (alert.type) {
      case 'critical':
        await this.handleCriticalThreat(alert);
        break;
      case 'suspicious':
        await this.handleSuspiciousActivity(alert);
        break;
      default:
        break;
    }
  }

  private async handleCriticalThreat(alert: RASPAlert): Promise<void> {
    // Force logout
    await SecureStorage.clearSession();
    
    // Lock device (if possible)
    // Show security warning
  }

  private async handleSuspiciousActivity(alert: RASPAlert): Promise<void> {
    // Increase monitoring frequency
    // Log to backend
  }
}

export default RASPService.getInstance();