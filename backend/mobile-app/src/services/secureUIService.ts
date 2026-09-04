import { Platform, NativeModules } from 'react-native';
import { useEffect, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import RASPService from './rasp.service';

const { SecureUIModule } = NativeModules;

class SecureUIService {
  private static instance: SecureUIService;
  private isSecureKeyboardEnabled: boolean = true;
  private isScreenProtectionEnabled: boolean = true;
  private activeScreens: Set<string> = new Set();

  private constructor() {
    this.initializeNativeModules();
  }

  static getInstance(): SecureUIService {
    if (!SecureUIService.instance) {
      SecureUIService.instance = new SecureUIService();
    }
    return SecureUIService.instance;
  }

  // ========== INITIALIZE NATIVE MODULES ==========
  private initializeNativeModules(): void {
    if (Platform.OS === 'android' && SecureUIModule) {
      SecureUIModule.initialize();
    } else if (Platform.OS === 'ios' && SecureUIModule) {
      SecureUIModule.initialize();
    }
  }

  // ========== ENABLE SECURE KEYBOARD ==========
  async enableSecureKeyboard(inputRef: any): Promise<void> {
    if (!this.isSecureKeyboardEnabled) return;

    try {
      if (Platform.OS === 'android') {
        // Android: Use custom secure keyboard
        // We'll set secure text entry
        if (inputRef?.current) {
          inputRef.current.setNativeProps({
            secureTextEntry: true,
            autoCorrect: false,
            spellCheck: false,
            textContentType: 'none',
          });
        }
      } else if (Platform.OS === 'ios') {
        // iOS: Use secure text entry
        if (inputRef?.current) {
          inputRef.current.setNativeProps({
            secureTextEntry: true,
            textContentType: 'oneTimeCode',
          });
        }
      }
    } catch (error) {
      console.error('Enable secure keyboard error:', error);
    }
  }

  // ========== DISABLE SECURE KEYBOARD ==========
  disableSecureKeyboard(inputRef: any): void {
    if (inputRef?.current) {
      inputRef.current.setNativeProps({
        secureTextEntry: false,
      });
    }
  }

  // ========== PREVENT SCREEN CAPTURE ==========
  async preventScreenCapture(screenName: string): Promise<void> {
    if (!this.isScreenProtectionEnabled) return;

    try {
      this.activeScreens.add(screenName);
      
      if (Platform.OS === 'android') {
        // Android: Use FLAG_SECURE to prevent screenshots
        if (SecureUIModule?.preventScreenCapture) {
          await SecureUIModule.preventScreenCapture();
        }
      } else if (Platform.OS === 'ios') {
        // iOS: Use UITextField secure content for sensitive fields
        // Note: iOS has limited screen capture prevention
        if (SecureUIModule?.preventScreenCapture) {
          await SecureUIModule.preventScreenCapture();
        }
      }
    } catch (error) {
      console.error('Prevent screen capture error:', error);
    }
  }

  // ========== ALLOW SCREEN CAPTURE ==========
  async allowScreenCapture(screenName: string): Promise<void> {
    try {
      this.activeScreens.delete(screenName);
      
      if (this.activeScreens.size === 0) {
        if (Platform.OS === 'android') {
          if (SecureUIModule?.allowScreenCapture) {
            await SecureUIModule.allowScreenCapture();
          }
        }
      }
    } catch (error) {
      console.error('Allow screen capture error:', error);
    }
  }

  // ========== DETECT SCREEN RECORDING ==========
  async detectScreenRecording(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        // iOS: Check for screen recording
        if (SecureUIModule?.isScreenRecording) {
          return await SecureUIModule.isScreenRecording();
        }
      }
      return false;
    } catch (error) {
      console.error('Detect screen recording error:', error);
      return false;
    }
  }

  // ========== DETECT SCREENSHOT ==========
  async detectScreenshot(): Promise<boolean> {
    try {
      if (SecureUIModule?.isScreenshotTaken) {
        return await SecureUIModule.isScreenshotTaken();
      }
      return false;
    } catch (error) {
      console.error('Detect screenshot error:', error);
      return false;
    }
  }

  // ========== PROTECT SENSITIVE FIELD ==========
  async protectSensitiveField(
    inputRef: any,
    options: {
      secureTextEntry: boolean;
      autoCorrect: boolean;
      spellCheck: boolean;
      textContentType?: string;
    } = { secureTextEntry: true, autoCorrect: false, spellCheck: false }
  ): Promise<void> {
    try {
      if (inputRef?.current) {
        inputRef.current.setNativeProps({
          secureTextEntry: options.secureTextEntry,
          autoCorrect: options.autoCorrect,
          spellCheck: options.spellCheck,
          textContentType: options.textContentType || 'none',
        });
      }

      // Log security event
      await SecureStore.setItemAsync(
        'security_keyboard_event',
        JSON.stringify({
          timestamp: Date.now(),
          action: 'secure_field_enabled',
        })
      );
    } catch (error) {
      console.error('Protect sensitive field error:', error);
    }
  }

  // ========== CLEAR SENSITIVE FIELDS ==========
  async clearSensitiveFields(): Promise<void> {
    try {
      // Clear any sensitive input fields
      // This would be implemented with refs
      if (SecureUIModule?.clearSecureFields) {
        await SecureUIModule.clearSecureFields();
      }
    } catch (error) {
      console.error('Clear sensitive fields error:', error);
    }
  }

  // ========== SET SECURITY FOR SCREEN ==========
  useScreenSecurity(screenName: string, isSecure: boolean = true) {
    useEffect(() => {
      if (isSecure && this.isScreenProtectionEnabled) {
        this.preventScreenCapture(screenName);
      } else {
        this.allowScreenCapture(screenName);
      }

      // Detect screen recording
      const checkRecording = async () => {
        const isRecording = await this.detectScreenRecording();
        if (isRecording) {
          await RASPService.triggerAlert({
            type: 'critical',
            message: '⚠️ Screen recording detected. Security breach possible.',
            timestamp: Date.now(),
            data: { screenName },
          });
        }
      };

      const interval = setInterval(checkRecording, 5000);

      return () => {
        clearInterval(interval);
        this.allowScreenCapture(screenName);
      };
    }, [screenName, isSecure]);
  }

  // ========== SECURE INPUT HOOK ==========
  useSecureInput() {
    const inputRef = useRef<any>(null);
    const secureUIService = SecureUIService.getInstance();

    return {
      ref: inputRef,
      secureProps: {
        secureTextEntry: true,
        autoCorrect: false,
        spellCheck: false,
        textContentType: 'none' as any,
      },
      onFocus: () => {
        secureUIService.enableSecureKeyboard(inputRef);
      },
      onBlur: () => {
        secureUIService.disableSecureKeyboard(inputRef);
      },
    };
  }
}

export default SecureUIService.getInstance();