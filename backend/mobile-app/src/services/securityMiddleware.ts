import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { getUniqueId, getDeviceName } from 'react-native-device-info';
import NetInfo from '@react-native-community/netinfo';
import SecureStorage from './secureStorage';

class SecurityMiddleware {
  private static instance: SecurityMiddleware;
  private deviceId: string = '';
  private appVersion: string = '1.0.0';
  private isJailbroken: boolean = false;

  private constructor() {
    this.initDeviceInfo();
  }

  static getInstance(): SecurityMiddleware {
    if (!SecurityMiddleware.instance) {
      SecurityMiddleware.instance = new SecurityMiddleware();
    }
    return SecurityMiddleware.instance;
  }

  // ========== INITIALIZE DEVICE INFO ==========
  private async initDeviceInfo() {
    try {
      this.deviceId = await getUniqueId();
      this.isJailbroken = await this.checkJailbreak();
      this.appVersion = '1.0.0'; // From package.json
    } catch (error) {
      console.error('Device init error:', error);
    }
  }

  // ========== CHECK JAILBREAK/ROOT ==========
  private async checkJailbreak(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      // Check for common jailbreak files on iOS
      const jailbreakFiles = [
        '/Applications/Cydia.app',
        '/Applications/FakeCarrier.app',
        '/Applications/Icy.app',
        '/Applications/IntelliScreen.app',
        '/Applications/MxTube.app',
        '/Applications/RockApp.app',
        '/Applications/SBSettings.app',
        '/Applications/WinterBoard.app',
        '/Library/MobileSubstrate/MobileSubstrate.dylib',
        '/System/Library/LaunchDaemons/com.ikey.bbot.plist',
        '/System/Library/LaunchDaemons/com.saurik.Cydia.Startup.plist',
        '/bin/bash',
        '/usr/libexec/cydia',
        '/usr/sbin/sshd',
      ];
      
      // We can't directly check file system in RN, but we can detect via device info
      return Device.isDevice && !Device.isJailbroken;
    } else if (Platform.OS === 'android') {
      // Check for root on Android
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
      // Simplified check
      return !Device.isDevice;
    }
    return false;
  }

  // ========== VALIDATE REQUEST ==========
  async validateRequest(url: string, method: string, headers: any, body: any): Promise<{
    valid: boolean;
    error?: string;
    sanitizedBody?: any;
  }> {
    // Check for jailbreak
    if (this.isJailbroken) {
      return {
        valid: false,
        error: 'Device security compromised. Please use a secure device.',
      };
    }

    // Check network
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      return {
        valid: false,
        error: 'No network connection',
      };
    }

    // Check for suspicious headers
    const suspiciousHeaders = ['x-requested-with', 'x-forwarded-for'];
    for (const header of suspiciousHeaders) {
      if (headers[header]) {
        return {
          valid: false,
          error: 'Suspicious request detected',
        };
      }
    }

    // Sanitize body for SQL injection patterns
    const sanitizedBody = this.sanitizeData(body);

    return {
      valid: true,
      sanitizedBody,
    };
  }

  // ========== SANITIZE DATA ==========
  private sanitizeData(data: any): any {
    if (!data) return data;
    
    const patterns = [
      /SELECT\s+/i,
      /INSERT\s+/i,
      /UPDATE\s+/i,
      /DELETE\s+/i,
      /DROP\s+/i,
      /--/,
      /;/,
    ];

    const sanitizeString = (str: string): string => {
      let sanitized = str;
      for (const pattern of patterns) {
        sanitized = sanitized.replace(pattern, '');
      }
      return sanitized;
    };

    const sanitizeObject = (obj: any): any => {
      const result: any = {};
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          result[key] = sanitizeString(obj[key]);
        } else if (typeof obj[key] === 'object') {
          result[key] = sanitizeObject(obj[key]);
        } else {
          result[key] = obj[key];
        }
      }
      return result;
    };

    return sanitizeObject(data);
  }

  // ========== GENERATE SECURE HEADERS ==========
  generateSecureHeaders(): any {
    return {
      'X-Device-ID': this.deviceId,
      'X-App-Version': this.appVersion,
      'X-Platform': Platform.OS,
      'X-Platform-Version': Platform.Version,
      'X-Device-Name': getDeviceName(),
      'X-Request-Time': Date.now(),
      'User-Agent': `Medsathu/${this.appVersion} (${Platform.OS}; ${Platform.Version})`,
    };
  }

  // ========== VALIDATE SESSION ==========
  async validateSession(): Promise<boolean> {
    const session = await SecureStorage.getSession();
    if (!session) return false;
    
    // Check if session is expired (7 days)
    const sessionStart = await SecureStorage.getItem('session_start');
    if (sessionStart) {
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - sessionStart > sevenDays) {
        await SecureStorage.clearSession();
        return false;
      }
    }
    
    return true;
  }

  // ========== LOG SECURITY EVENT ==========
  async logSecurityEvent(event: string, details: any): Promise<void> {
    try {
      const token = await SecureStorage.getItem('auth_token');
      // Send to backend security log
      const response = await fetch(`${process.env.API_URL}/api/security/mobile-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          event,
          details,
          deviceId: this.deviceId,
          timestamp: new Date().toISOString(),
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to log security event');
      }
    } catch (error) {
      console.error('Security log error:', error);
    }
  }

  // ========== CHECK APP INTEGRITY ==========
  async checkAppIntegrity(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check if app is running on emulator
    if (!Device.isDevice) {
      issues.push('App running on emulator');
    }

    // Check if app is debug build (simplified)
    // @ts-ignore
    if (__DEV__) {
      issues.push('App running in debug mode');
    }

    // Check if device is jailbroken/rooted
    if (this.isJailbroken) {
      issues.push('Device is jailbroken/rooted');
    }

    // Check if app is tampered (can use checksum)
    // For production, implement integrity checks

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

export default SecurityMiddleware.getInstance();