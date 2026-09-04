'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

export default function PaymentSuccessPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/dashboard');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-4">
          <CheckCircleIcon className="h-20 w-20 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          🎉 Payment Successful!
        </h1>
        <p className="text-gray-600 mb-4">
          Your subscription is now active. Welcome to Medsathu.inn!
        </p>
        <div className="bg-green-50 p-4 rounded-lg mb-6">
          <p className="text-sm text-green-800">
            ✅ Your plan has been activated
          </p>
          <p className="text-sm text-green-800">
            📧 Receipt sent to your email
          </p>
        </div>
        <p className="text-sm text-gray-500">
          Redirecting to dashboard in {countdown}s...
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}