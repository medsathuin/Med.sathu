import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Clipboard,
} from 'react-native';
import axios from 'axios';
import SecureStorage from '../services/secureStorage';

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration: number;
  features: string[];
}

interface PaymentConfig {
  plans: {
    monthly: Plan;
    yearly: Plan;
    premium: Plan;
  };
  bankDetails: {
    upiId: string;
    accountHolder: string;
    bankName: string;
  };
}

const PaymentScreen = ({ navigation }: any) => {
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly' | 'premium'>('monthly');
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const token = await SecureStorage.getItem('auth_token');
      const response = await axios.get(
        `${process.env.API_URL}/api/payment/config`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setConfig(response.data.data);
    } catch (error) {
      console.error('Config error:', error);
      Alert.alert('Error', 'Failed to load payment configuration');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    try {
      setProcessing(true);
      const token = await SecureStorage.getItem('auth_token');

      // Create order
      const orderResponse = await axios.post(
        `${process.env.API_URL}/api/payment/create-order`,
        {
          plan: selectedPlan,
          gateway: 'razorpay',
          paymentMethod: selectedMethod,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { transaction, upiId, bankDetails } = orderResponse.data.data;

      // Show payment details based on method
      if (selectedMethod === 'upi') {
        Alert.alert(
          'Pay via UPI',
          `UPI ID: ${upiId}\n\nAmount: ₹${transaction.amount}\n\nPlease pay using any UPI app (Google Pay, PhonePe, Paytm)`,
          [
            { text: 'Copy UPI ID', onPress: () => Clipboard.setString(upiId) },
            { text: 'I have paid', onPress: () => verifyPayment(transaction._id) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      } else if (selectedMethod === 'netbanking') {
        Alert.alert(
          'Transfer to Bank',
          `Account Holder: ${bankDetails.accountHolder}\nBank: ${bankDetails.bankName}\nAccount: ${bankDetails.accountNumber}\nIFSC: ${bankDetails.ifsc}\n\nAmount: ₹${transaction.amount}`,
          [
            { text: 'Copy Details', onPress: () => Clipboard.setString(JSON.stringify(bankDetails)) },
            { text: 'I have paid', onPress: () => verifyPayment(transaction._id) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  const verifyPayment = async (transactionId: string) => {
    try {
      const token = await SecureStorage.getItem('auth_token');
      await axios.post(
        `${process.env.API_URL}/api/payment/verify`,
        { transactionId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Success', 'Payment verified! Your subscription is active.');
      navigation.navigate('Dashboard');
    } catch (error) {
      Alert.alert('Error', 'Payment verification failed. Please contact support.');
    }
  };

  const getPlanDetails = (): Plan | null => {
    if (!config) return null;
    return config.plans[selectedPlan];
  };

  const plan = getPlanDetails();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text style={styles.loadingText}>Loading payment options...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💳 Choose Your Plan</Text>
        <Text style={styles.headerSubtitle}>Start with 10 free lectures</Text>
      </View>

      {/* Plans */}
      <View style={styles.plansContainer}>
        {config && ['monthly', 'yearly', 'premium'].map((key) => {
          const planData = config.plans[key as keyof typeof config.plans];
          const isSelected = selectedPlan === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.planCard, isSelected && styles.selectedPlan]}
              onPress={() => setSelectedPlan(key as any)}
            >
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{planData.name}</Text>
                {key === 'yearly' && (
                  <View style={styles.bestValueBadge}>
                    <Text style={styles.bestValueText}>Best Value</Text>
                  </View>
                )}
              </View>
              <Text style={styles.planPrice}>₹{planData.price}</Text>
              <Text style={styles.planDuration}>
                {key === 'monthly' ? 'per month' : 'per year'}
              </Text>
              {planData.features.slice(0, 3).map((feature, i) => (
                <Text key={i} style={styles.feature}>✅ {feature}</Text>
              ))}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Payment Method */}
      <View style={styles.paymentSection}>
        <Text style={styles.sectionTitle}>Payment Method</Text>
        <View style={styles.methodContainer}>
          <TouchableOpacity
            style={[styles.methodBtn, selectedMethod === 'upi' && styles.selectedMethod]}
            onPress={() => setSelectedMethod('upi')}
          >
            <Text style={[styles.methodText, selectedMethod === 'upi' && styles.selectedMethodText]}>
              📱 UPI
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.methodBtn, selectedMethod === 'card' && styles.selectedMethod]}
            onPress={() => setSelectedMethod('card')}
          >
            <Text style={[styles.methodText, selectedMethod === 'card' && styles.selectedMethodText]}>
              💳 Card
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.methodBtn, selectedMethod === 'netbanking' && styles.selectedMethod]}
            onPress={() => setSelectedMethod('netbanking')}
          >
            <Text style={[styles.methodText, selectedMethod === 'netbanking' && styles.selectedMethodText]}>
              🏦 Netbanking
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Pay Button */}
      <TouchableOpacity
        style={[styles.payButton, processing && styles.disabledButton]}
        onPress={handlePayment}
        disabled={processing}
      >
        <Text style={styles.payButtonText}>
          {processing ? 'Processing...' : `Pay ₹${plan?.price || 0}`}
        </Text>
      </TouchableOpacity>

      {/* Security Notice */}
      <Text style={styles.securityText}>
        🔒 Secured • All transactions are encrypted
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#1e3a8a',
  },
  header: {
    backgroundColor: '#1e3a8a',
    padding: 20,
    paddingTop: 40,
    paddingBottom: 30,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#93c5fd',
    marginTop: 4,
  },
  plansContainer: {
    padding: 16,
    gap: 12,
  },
  planCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedPlan: {
    borderColor: '#1e3a8a',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  bestValueBadge: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bestValueText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  planPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginTop: 4,
  },
  planDuration: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  feature: {
    fontSize: 13,
    color: '#374151',
    marginVertical: 2,
  },
  paymentSection: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 12,
  },
  methodContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  methodBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  selectedMethod: {
    backgroundColor: '#1e3a8a',
  },
  methodText: {
    fontSize: 12,
    color: '#374151',
  },
  selectedMethodText: {
    color: 'white',
  },
  payButton: {
    backgroundColor: '#1e3a8a',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  payButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  securityText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 20,
  },
});

export default PaymentScreen;