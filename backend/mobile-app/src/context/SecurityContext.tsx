import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import SecureStorage from '../services/secureStorage';
import SecurityMiddleware from '../services/securityMiddleware';

interface SecurityContextType {
  isAuthenticated: boolean;
  isBiometricEnabled: boolean;
  isDeviceSecure: boolean;
  isLoading: boolean;
  authenticate: () => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  securityIssues: string[];
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within SecurityProvider');
  }
  return context;
};

interface SecurityProviderProps {
  children: ReactNode;
}

export const SecurityProvider: React.FC<SecurityProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isDeviceSecure, setIsDeviceSecure] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [securityIssues, setSecurityIssues] = useState<string[]>([]);

  useEffect(() => {
    initializeSecurity();
  }, []);

  const initializeSecurity = async () => {
    try {
      setIsLoading(true);
      
      // Initialize secure storage
      await SecureStorage.initialize();
      
      // Check device integrity
      const integrity = await SecurityMiddleware.checkAppIntegrity();
      setIsDeviceSecure(integrity.valid);
      setSecurityIssues(integrity.issues);
      
      // Check biometric availability
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setIsBiometricEnabled(hasHardware && isEnrolled);
      
      // Check existing session
      const session = await SecureStorage.getSession();
      setIsAuthenticated(!!session);
      
    } catch (error) {
      console.error('Security initialization error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const authenticate = async (): Promise<boolean> => {
    try {
      // Use biometrics if available
      if (isBiometricEnabled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to access Medsathu.inn',
          fallbackLabel: 'Use PIN',
        });
        if (result.success) {
          // Re-validate session after biometric auth
          const session = await SecureStorage.getSession();
          if (session) {
            setIsAuthenticated(true);
            return true;
          }
        }
        return false;
      }
      
      // Fallback to PIN/password
      // Implementation would show a PIN input modal
      return false;
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // Validate request
      const validation = await SecurityMiddleware.validateRequest(
        '/api/auth/login',
        'POST',
        {},
        { email, password }
      );
      
      if (!validation.valid) {
        throw new Error(validation.error);
      }
      
      // Send login request
      const response = await fetch(`${process.env.API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...SecurityMiddleware.generateSecureHeaders(),
        },
        body: JSON.stringify(validation.sanitizedBody),
      });
      
      if (!response.ok) {
        throw new Error('Login failed');
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Store session securely
        await SecureStorage.setSession(data.token, data.refreshToken, data.user);
        setIsAuthenticated(true);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Login error:', error);
      
      // Log security event
      await SecurityMiddleware.logSecurityEvent('failed_login', { email });
      
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    await SecureStorage.clearSession();
    setIsAuthenticated(false);
    
    // Log logout
    await SecurityMiddleware.logSecurityEvent('logout', {});
  };

  const value: SecurityContextType = {
    isAuthenticated,
    isBiometricEnabled,
    isDeviceSecure,
    isLoading,
    authenticate,
    login,
    logout,
    securityIssues,
  };

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
};