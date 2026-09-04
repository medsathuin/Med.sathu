'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { loadScript } from '@/utils/loadScript';

// Types
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
  paymentMethods: {
    upi: { enabled: boolean; providers: string[] };
    cards: { enabled: boolean; types: string[] };
    netbanking: { enabled: boolean };
    wallets: { enabled: boolean; providers: string[] };
    paypal: { enabled: boolean };
  };
  bankDetails: {
    upiId: string;
    accountHolder: string;
    bankName: string;
  };
  freeTrial: { enabled: boolean; lectures: number; duration: number };
}

export default function PaymentPage() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly' | 'premium'>('monthly');
  const [selectedGateway, setSelectedGateway] = useState<'razorpay' | 'stripe' | 'payu' | 'phonepay'>('razorpay');
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card' | 'netbanking' | 'wallet' | 'paypal'>('upi');
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ========== Load config ==========
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/payment/config`);
      setConfig(response.data.data);
    } catch (err) {
      console.error('Config error:', err);
      setError('Failed to load payment configuration');
    }
  };

  // ========== Load Razorpay script ==========
  const loadRazorpay = async () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // ========== Handle payment ==========
  const handlePayment = async () => {
    try {
      setProcessing(true);
      setError(null);

      // Step 1: Create order
      const orderResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/payment/create-order`,
        {
          plan: selectedPlan,
          gateway: selectedGateway,
          paymentMethod: selectedMethod,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          },
        }
      );

      const { transaction, gatewayResponse, upiId, bankDetails } = orderResponse.data.data;

      // Step 2: Process payment based on gateway
      if (selectedGateway === 'razorpay') {
        await handleRazorpayPayment(transaction, gatewayResponse);
      } else if (selectedGateway === 'stripe') {
        await handleStripePayment(transaction, gatewayResponse);
      } else if (selectedGateway === 'payu') {
        await handlePayUPayment(transaction, gatewayResponse);
      } else if (selectedGateway === 'phonepay') {
        await handlePhonePePayment(transaction, gatewayResponse);
      }

    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.response?.data?.message || 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // ========== Razorpay ==========
  const handleRazorpayPayment = async (transaction: any, order: any) => {
    const razorpayLoaded = await loadRazorpay();
    if (!razorpayLoaded) {
      setError('Failed to load Razorpay. Please refresh.');
      return;
    }

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      name: 'Medsathu.inn',
      description: `${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} Subscription`,
      image: '/logo.png',
      order_id: order.id,
      prefill: {
        name: 'Student',
        email: 'student@example.com',
        contact: '9876543210',
      },
      theme: {
        color: '#1e3a8a',
      },
      handler: async (response: any) => {
        // Verify payment
        try {
          const verifyResponse = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/api/payment/verify`,
            {
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            },
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('authToken')}`,
              },
            }
          );

          if (verifyResponse.data.success) {
            router.push('/payment/success');
          }
        } catch (err) {
          setError('Payment verification failed. Please contact support.');
        }
      },
      modal: {
        ondismiss: () => {
          setProcessing(false);
        },
      },
    };

    const razorpay = new (window as any).Razorpay(options);
    razorpay.open();
  };

  // ========== Stripe ==========
  const handleStripePayment = async (transaction: any, paymentIntent: any) => {
    // Load Stripe.js
    const stripe = require('@stripe/stripe-js');
    const stripeInstance = await stripe.loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

    const result = await stripeInstance?.confirmPayment({
      paymentIntent,
      elements: {
        // Stripe Elements will be rendered here
      },
    });

    if (result?.error) {
      setError(result.error.message || 'Stripe payment failed');
    } else if (result?.paymentIntent?.status === 'succeeded') {
      router.push('/payment/success');
    }
  };

  // ========== PayU ==========
  const handlePayUPayment = (transaction: any, order: any) => {
    // Create a form and submit to PayU
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = order.paymentUrl;

    const fields = {
      key: process.env.NEXT_PUBLIC_PAYU_MERCHANT_KEY,
      txnid: order.txnid,
      amount: transaction.amount,
      productinfo: `${selectedPlan} Subscription`,
      firstname: 'Student',
      email: 'student@example.com',
      phone: '9876543210',
      surl: `${process.env.NEXT_PUBLIC_API_URL}/api/payment/payu/success`,
      furl: `${process.env.NEXT_PUBLIC_API_URL}/api/payment/payu/failure`,
      hash: order.hash,
    };

    Object.entries(fields).forEach(([key, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = String(value);
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
  };

  // ========== PhonePe ==========
  const handlePhonePePayment = (transaction: any, order: any) => {
    // PhonePe redirects to their payment page
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = order.paymentUrl;

    const fields = {
      merchantId: process.env.NEXT_PUBLIC_PHONEPAY_MERCHANT_ID,
      merchantTransactionId: order.merchantTransactionId,
      merchantUserId: `USER-${transaction.user}`,
      amount: transaction.amount * 100,
      redirectUrl: `${process.env.NEXT_PUBLIC_API_URL}/api/payment/phonepay/redirect`,
      redirectMode: 'POST',
      callbackUrl: `${process.env.NEXT_PUBLIC_API_URL}/api/payment/phonepay/webhook`,
      payload: order.payload,
      signature: order.signature,
      saltIndex: order.saltIndex,
    };

    Object.entries(fields).forEach(([key, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = String(value);
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
  };

  // ========== Get plan details ==========
  const getPlanDetails = (): Plan | null => {
    if (!config) return null;
    return config.plans[selectedPlan];
  };

  const plan = getPlanDetails();

  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading payment options...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-blue-900">
            💳 Choose Your Plan
          </h1>
          <p className="text-gray-600 mt-2">
            Start with 10 free lectures, upgrade anytime
          </p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Monthly */}
          <div
            className={`bg-white rounded-xl shadow-lg p-6 border-2 cursor-pointer transition-all ${
              selectedPlan === 'monthly' ? 'border-blue-600 shadow-xl' : 'border-transparent'
            }`}
            onClick={() => setSelectedPlan('monthly')}
          >
            <h3 className="text-xl font-bold text-gray-800">Monthly</h3>
            <p className="text-3xl font-bold text-blue-600 my-3">₹{config.plans.monthly.price}</p>
            <ul className="space-y-2 text-sm text-gray-600">
              {config.plans.monthly.features.map((feature, i) => (
                <li key={i}>✅ {feature}</li>
              ))}
            </ul>
          </div>

          {/* Yearly */}
          <div
            className={`bg-white rounded-xl shadow-lg p-6 border-2 cursor-pointer transition-all relative ${
              selectedPlan === 'yearly' ? 'border-blue-600 shadow-xl' : 'border-transparent'
            }`}
            onClick={() => setSelectedPlan('yearly')}
          >
            <span className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-3 py-1 rounded-full text-xs">
              Best Value
            </span>
            <h3 className="text-xl font-bold text-gray-800">Yearly</h3>
            <p className="text-3xl font-bold text-blue-600 my-3">₹{config.plans.yearly.price}</p>
            <p className="text-xs text-green-600 -mt-2 mb-2">Save ₹989/year</p>
            <ul className="space-y-2 text-sm text-gray-600">
              {config.plans.yearly.features.map((feature, i) => (
                <li key={i}>✅ {feature}</li>
              ))}
            </ul>
          </div>

          {/* Premium */}
          <div
            className={`bg-white rounded-xl shadow-lg p-6 border-2 cursor-pointer transition-all ${
              selectedPlan === 'premium' ? 'border-blue-600 shadow-xl' : 'border-transparent'
            }`}
            onClick={() => setSelectedPlan('premium')}
          >
            <h3 className="text-xl font-bold text-gray-800">Premium</h3>
            <p className="text-3xl font-bold text-blue-600 my-3">₹{config.plans.premium.price}</p>
            <ul className="space-y-2 text-sm text-gray-600">
              {config.plans.premium.features.map((feature, i) => (
                <li key={i}>✅ {feature}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Payment Details */}
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Payment Details</h2>

          {/* Plan summary */}
          {plan && (
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <p className="text-sm text-gray-600">Selected Plan</p>
              <p className="text-lg font-bold text-blue-900">
                {plan.name} • ₹{plan.price}
              </p>
            </div>
          )}

          {/* Payment Gateway */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Gateway
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['razorpay', 'stripe', 'payu', 'phonepay'].map((gateway) => (
                <button
                  key={gateway}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    selectedGateway === gateway
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => setSelectedGateway(gateway as any)}
                >
                  {gateway.charAt(0).toUpperCase() + gateway.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {config.paymentMethods.upi.enabled && (
                <button
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    selectedMethod === 'upi'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => setSelectedMethod('upi')}
                >
                  📱 UPI
                </button>
              )}
              {config.paymentMethods.cards.enabled && (
                <button
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    selectedMethod === 'card'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => setSelectedMethod('card')}
                >
                  💳 Card
                </button>
              )}
              {config.paymentMethods.netbanking.enabled && (
                <button
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    selectedMethod === 'netbanking'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => setSelectedMethod('netbanking')}
                >
                  🏦 Netbanking
                </button>
              )}
              {config.paymentMethods.wallets.enabled && (
                <button
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    selectedMethod === 'wallet'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => setSelectedMethod('wallet')}
                >
                  👛 Wallet
                </button>
              )}
              {config.paymentMethods.paypal.enabled && (
                <button
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    selectedMethod === 'paypal'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => setSelectedMethod('paypal')}
                >
                  🌐 PayPal
                </button>
              )}
            </div>
          </div>

          {/* UPI Details */}
          {selectedMethod === 'upi' && (
            <div className="bg-green-50 p-4 rounded-lg mb-4">
              <p className="text-sm text-green-800 font-medium">Pay via UPI</p>
              <p className="text-lg font-bold text-green-900">
                UPI ID: {config.bankDetails.upiId}
              </p>
              <p className="text-xs text-green-600 mt-1">
                Or scan QR code in your UPI app
              </p>
              {/* QR Code would go here */}
            </div>
          )}

          {/* Bank Details */}
          {selectedMethod === 'netbanking' && (
            <div className="bg-yellow-50 p-4 rounded-lg mb-4">
              <p className="text-sm text-yellow-800 font-medium">Transfer to Bank Account</p>
              <p className="text-sm"><strong>Account Holder:</strong> {config.bankDetails.accountHolder}</p>
              <p className="text-sm"><strong>Bank:</strong> {config.bankDetails.bankName}</p>
              <p className="text-sm"><strong>Account:</strong> {config.bankDetails.accountNumber}</p>
              <p className="text-sm"><strong>IFSC:</strong> {config.bankDetails.ifsc}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* Pay Button */}
          <button
            onClick={handlePayment}
            disabled={processing}
            className={`w-full py-3 rounded-lg text-white font-semibold text-lg transition ${
              processing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {processing ? (
              <span className="flex items-center justify-center">
                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
                Processing...
              </span>
            ) : (
              `Pay ₹${plan?.price || 0}`
            )}
          </button>

          {/* Security notice */}
          <p className="text-xs text-gray-500 text-center mt-4">
            🔒 Secured by {selectedGateway.charAt(0).toUpperCase() + selectedGateway.slice(1)}
            {' '}• All transactions are encrypted
          </p>
        </div>
      </div>
    </div>
  );
}