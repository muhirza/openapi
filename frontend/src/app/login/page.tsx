'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from '../../components/LoginForm';
import { api } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [showRegister, setShowRegister] = useState(false);

  const handleLogin = async (username: string, password: string) => {
    await api.login(username, password);
    localStorage.setItem('username', username);
    router.push('/dashboard');
  };

  const handleRegister = async (username: string, password: string) => {
    try {
      await api.register(username, password);
      await api.login(username, password);
      localStorage.setItem('username', username);
      router.push('/dashboard');
    } catch (err) {
      throw err;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Transaction Dashboard
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to access your dashboard
          </p>
        </div>

        <div className="bg-white p-8 rounded-lg shadow">
          <LoginForm onLogin={showRegister ? handleRegister : handleLogin} />

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setShowRegister(!showRegister)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showRegister ? 'Back to Login' : 'New user? Register'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}