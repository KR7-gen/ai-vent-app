'use client';

import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';

function WarningPage() {
  const router = useRouter();

  const handleNext = () => {
    router.push('/agreement');
  };

  const handleSkip = () => {
    router.push('/agreement');
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 shadow-lg">
          <div className="flex items-center mb-8">
            <button
              onClick={() => router.push('/stream-config')}
              className="text-gray-600 hover:text-gray-900 transition mr-4"
            >
              ← 戻る
            </button>
            <div className="flex-1 text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">配信前の確認</h1>
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <div className="text-center space-y-4">
              <p className="text-lg text-gray-800 font-medium">
                後ろに誰もいませんか？
              </p>
              <p className="text-lg text-gray-800 font-medium">
                おうちにはあなた一人ですか？
              </p>
              <p className="text-gray-700">
                誰にも聞かれていないことを確認して、
                <br />
                配信を開始してください。
              </p>
              
              <div className="mt-6 pt-4 border-t border-yellow-300">
                <p className="text-sm text-gray-600">
                  ※テスト利用のためAI API費用が発生します
                </p>
              </div>
              
              <p className="text-gray-700 font-medium">
                安全な環境での利用をお願いします
              </p>
            </div>
          </div>
          
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleNext}
              className="bg-gray-900 hover:bg-gray-800 text-white font-medium py-3 px-6 rounded-lg transition duration-200"
            >
              次へ進む
            </button>
            <button
              onClick={handleSkip}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-3 px-6 rounded-lg transition duration-200"
            >
              スキップ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WarningPageWrapper() {
  return (
    <ProtectedRoute>
      <WarningPage />
    </ProtectedRoute>
  );
}