'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

// エラーメッセージのマッピング関数
const getErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'このメールアドレスは既に登録されています';
    case 'auth/invalid-email':
      return 'メールアドレスの形式が正しくありません';
    case 'auth/weak-password':
      return 'パスワードが弱すぎます（6文字以上にしてください）';
    case 'auth/user-not-found':
      return 'そのメールアドレスのユーザーが見つかりません';
    case 'auth/too-many-requests':
      return '試行回数が多すぎます。しばらく待ってから再度お試しください';
    default:
      return 'エラーが発生しました。もう一度お試しください';
  }
};

function ResetPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
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

  const validateForm = (): boolean => {
    if (!email) {
      setError('メールアドレスを入力してください');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(true);
    } catch (err: any) {
      const errorMessage = getErrorMessage(err.code || '');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-lg w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">パスワード再設定</h1>
          <p className="text-sm sm:text-base text-gray-600">メールアドレスを入力してください</p>
        </div>
        
        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-600 text-sm text-center">
                送信しました。メールを確認してください
              </p>
            </div>
            <Link 
              href="/login" 
              className="block w-full text-center font-medium py-2 sm:py-3 px-4 rounded-lg bg-gray-900 hover:bg-gray-800 text-white transition duration-200 text-sm sm:text-base"
            >
              ログインに戻る
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                className={`w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent text-sm sm:text-base ${
                  error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-gray-900'
                }`}
                placeholder="test@example.com"
                required
                disabled={loading}
                aria-label="メールアドレスを入力"
                autoComplete="email"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className={`w-full font-medium py-2 sm:py-3 px-4 rounded-lg transition duration-200 text-sm sm:text-base ${
                loading 
                  ? 'bg-gray-400 cursor-not-allowed text-white' 
                  : 'bg-gray-900 hover:bg-gray-800 text-white'
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  送信中...
                </div>
              ) : (
                '送信'
              )}
            </button>
          </form>
        )}
        
        <div className="mt-6 text-center">
          <Link 
            href="/login" 
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            ログインに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-800 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800 mx-auto mb-4"></div>
          <p>読み込み中...</p>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
