'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FormErrors } from '@/types';
import { auth } from "@/lib/firebase";



export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const router = useRouter();

  const validateForm = () => {
    const newErrors: FormErrors = {};
    
    if (!email) {
      newErrors.email = 'メールアドレスを入力してください';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = '正しいメールアドレスを入力してください';
    }
    
    if (!password) {
      newErrors.password = 'パスワードを入力してください';
    } else if (password.length < 6) {
      newErrors.password = 'パスワードは6文字以上で入力してください';
    }
    
    return newErrors;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }
    
    setErrors({});
    setIsLoading(true);
    
    try {
      // モックログインディレイ
      await new Promise(resolve => setTimeout(resolve, 1000));
      router.push('/room-select');
    } catch (error) {
      setErrors({ email: 'ログインに失敗しました。再度お試しください。' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-lg w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">ログインして開始する</h1>
          <p className="text-sm sm:text-base text-gray-600">誰にも聞かれない、安全な配信部屋</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4 sm:space-y-6">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {setEmail(e.target.value); if (errors.email) setErrors(prev => ({...prev, email: undefined}));}}
              className={`w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent text-sm sm:text-base ${
                errors.email ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-gray-900'
              }`}
              placeholder="test@example.com"
              required
              disabled={isLoading}
              aria-label="メールアドレスを入力"
              autoComplete="email"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>
          
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {setPassword(e.target.value); if (errors.password) setErrors(prev => ({...prev, password: undefined}));}}
              className={`w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent text-sm sm:text-base ${
                errors.password ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-gray-900'
              }`}
              placeholder="••••••••"
              required
              disabled={isLoading}
              aria-label="パスワードを入力"
              autoComplete="current-password"
            />
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full font-medium py-2 sm:py-3 px-4 rounded-lg transition duration-200 text-sm sm:text-base ${
              isLoading 
                ? 'bg-gray-400 cursor-not-allowed text-white' 
                : 'bg-gray-900 hover:bg-gray-800 text-white'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ログイン中...
              </div>
            ) : (
              'ログイン'
            )}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            ※管理者から発行されたアカウントをご利用ください
          </p>
        </div>
      </div>
    </div>
  );
}