import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

class SecureStorageService {
  private static instance: SecureStorageService;
  private encryptionKey: string | null = null;
  private isBiometricEnabled: boolean = false;

  private constructor() {}

  static getInstance(): SecureStorageService {
    if (!SecureStorageService.instance) {
      SecureStorageService.instance = new SecureStorageService();
    }
    return SecureStorageService.instance;
  }

  // ========== INITIALIZE WITH BIOMETRICS ==========
  async initialize(): Promise<void> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    
    if (hasHardware && isEnrolled) {
      this.isBiometricEnabled = true;
    }

    // Check if encryption key exists
    const storedKey = await SecureStore.getItemAsync('encryption_key');
    if (!storedKey) {
      // Generate new encryption key
      const newKey = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        Math.random().toString(36).substring(2, 15)
      );
      await SecureStore.setItemAsync('encryption_key', newKey);
      this.encryptionKey = newKey;
    } else {
      this.encryptionKey = storedKey;
    }
  }

  // ========== BIOMETRIC AUTHENTICATION ==========
  async authenticateWithBiometrics(): Promise<boolean> {
    if (!this.isBiometricEnabled) {
      return false;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access Medsathu.inn',
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      return result.success;
    } catch (error) {
      console.error('Biometric auth failed:', error);
      return false;
    }
  }

  // ========== STORE ENCRYPTED DATA ==========
  async setItem(key: string, value: any): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      
      // Encrypt the data
      const encrypted = await this.encryptData(jsonValue);
      
      // Store in SecureStore for sensitive data, AsyncStorage for large data
      if (key.includes('token') || key.includes('password') || key.includes('key')) {
        await SecureStore.setItemAsync(key, encrypted);
      } else {
        await AsyncStorage.setItem(key, encrypted);
      }
    } catch (error) {
      console.error('Secure storage set error:', error);
      throw new Error('Failed to store data securely');
    }
  }

  // ========== GET DECRYPTED DATA ==========
  async getItem(key: string): Promise<any | null> {
    try {
      let encrypted: string | null = null;
      
      // Check both storage types
      encrypted = await SecureStore.getItemAsync(key);
      if (!encrypted) {
        encrypted = await AsyncStorage.getItem(key);
      }
      
      if (!encrypted) return null;
      
      // Decrypt and parse
      const decrypted = await this.decryptData(encrypted);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Secure storage get error:', error);
      return null;
    }
  }

  // ========== REMOVE DATA ==========
  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
    await AsyncStorage.removeItem(key);
  }

  // ========== CLEAR ALL SECURE DATA ==========
  async clearAll(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys);
    // SecureStore doesn't have a clear all, we'll clear known keys
    const secureKeys = ['encryption_key', 'auth_token', 'refresh_token', 'user_data'];
    for (const key of secureKeys) {
      await SecureStore.deleteItemAsync(key);
    }
  }

  // ========== ENCRYPTION ==========
  private async encryptData(data: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }
    
    // Simple encryption for mobile (AES would require native modules)
    // For production, use expo-crypto for proper encryption
    const encoded = Buffer.from(data).toString('base64');
    const key = this.encryptionKey;
    const mixed = encoded.split('').map((char, i) => {
      const keyChar = key[i % key.length];
      return String.fromCharCode(char.charCodeAt(0) ^ keyChar.charCodeAt(0));
    }).join('');
    
    return Buffer.from(mixed).toString('base64');
  }

  private async decryptData(encrypted: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const mixed = Buffer.from(encrypted, 'base64').toString();
    const key = this.encryptionKey;
    const decoded = mixed.split('').map((char, i) => {
      const keyChar = key[i % key.length];
      return String.fromCharCode(char.charCodeAt(0) ^ keyChar.charCodeAt(0));
    }).join('');
    
    return Buffer.from(decoded, 'base64').toString();
  }

  // ========== CHECK IF DATA EXISTS ==========
  async hasItem(key: string): Promise<boolean> {
    const secure = await SecureStore.getItemAsync(key);
    if (secure) return true;
    const async = await AsyncStorage.getItem(key);
    return async !== null;
  }

  // ========== GET ALL KEYS ==========
  async getAllKeys(): Promise<string[]> {
    const asyncKeys = await AsyncStorage.getAllKeys();
    // SecureStore doesn't have get all keys
    return asyncKeys;
  }

  // ========== SECURE SESSION ==========
  async setSession(token: string, refreshToken: string, user: any): Promise<void> {
    await this.setItem('auth_token', token);
    await this.setItem('refresh_token', refreshToken);
    await this.setItem('user_data', user);
    await this.setItem('session_start', Date.now());
  }

  async getSession(): Promise<{ token: string; user: any } | null> {
    const token = await this.getItem('auth_token');
    const user = await this.getItem('user_data');
    if (token && user) {
      return { token, user };
    }
    return null;
  }

  async clearSession(): Promise<void> {
    await this.removeItem('auth_token');
    await this.removeItem('refresh_token');
    await this.removeItem('user_data');
    await this.removeItem('session_start');
  }
}

export default SecureStorageService.getInstance();