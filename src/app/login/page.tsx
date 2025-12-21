'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signInWithEmailAndPassword } from 'firebase/auth';
import type { FormErrors } from '@/types';
import { auth } from "@/lib/firebase";
import { useAuth } from '@/contexts/AuthContext';

export const dynamic = 'force-dynamic';

// エラーメッセージのマッピング関数
const getErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/user-not-found':
      return 'そのメールアドレスのユーザーが見つかりません';
    case 'auth/wrong-password':
      return 'パスワードが正しくありません';
    case 'auth/invalid-email':
      return 'メールアドレスの形式が正しくありません';
    case 'auth/user-disabled':
      return 'このアカウントは無効化されています';
    case 'auth/too-many-requests':
      return '試行回数が多すぎます。しばらく待ってから再度お試しください';
    case 'auth/invalid-credential':
      return 'メールアドレスまたはパスワードが正しくありません';
    default:
      return 'ログインに失敗しました。再度お試しください';
  }
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // 既にログインしている場合はリダイレクト
  useEffect(() => {
    if (user) {
      const next = searchParams.get('next');
      router.push(next || '/room-select');
    }
  }, [user, router, searchParams]);

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
      await signInWithEmailAndPassword(auth, email, password);
      // ログイン成功時はnextパラメータがあればそこに、なければ /room-select に遷移
      const next = searchParams.get('next');
      router.push(next || '/room-select');
    } catch (error: any) {
      const errorMessage = getErrorMessage(error.code || '');
      setErrors({ general: errorMessage });
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

          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm">{errors.general}</p>
            </div>
          )}
          
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
        
        <div className="mt-6 space-y-2 text-center">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-4">
            <Link 
              href="/signup" 
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              新規登録はこちら
            </Link>
            <Link 
              href="/reset-password" 
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              パスワードを忘れた
            </Link>
          </div>
          <p className="text-gray-500 text-sm mt-4">
            ※管理者から発行されたアカウントをご利用ください
          </p>
        </div>
      </div>
    </div>
  );
}