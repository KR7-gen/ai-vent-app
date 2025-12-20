'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

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

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const validateForm = (): boolean => {
    if (!email) {
      setError('メールアドレスを入力してください');
      return false;
    }
    if (!password) {
      setError('パスワードを入力してください');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // 成功時は自動ログインされるので /room-select に遷移
      router.push('/room-select');
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">新規登録</h1>
          <p className="text-sm sm:text-base text-gray-600">アカウントを作成して開始する</p>
        </div>
        
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
          
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              className={`w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent text-sm sm:text-base ${
                error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-gray-900'
              }`}
              placeholder="••••••••"
              required
              disabled={loading}
              aria-label="パスワードを入力"
              autoComplete="new-password"
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
                登録中...
              </div>
            ) : (
              '登録'
            )}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <Link 
            href="/login" 
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            ログインはこちら
          </Link>
        </div>
      </div>
    </div>
  );
}

