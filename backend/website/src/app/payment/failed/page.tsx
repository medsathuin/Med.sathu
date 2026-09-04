'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { XCircleIcon } from '@heroicons/react/24/solid';

export default function PaymentFailedPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-4">
          <XCircleIcon className="h-20 w-20 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Payment Failed
        </h1>
        <p className="text-gray-600 mb-4">
          We couldn't process your payment. Please try again.
        </p>
        <div className="bg-red-50 p-4 rounded-lg mb-6">
          <p className="text-sm text-red-800">
            Possible reasons: Insufficient balance, incorrect details, or network issue
          </p>
        </div>
        <button
          onClick={() => router.push('/payment')}
          className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
        >
          Try Again
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-2 w-full bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}