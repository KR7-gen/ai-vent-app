'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DisplayMode, BackgroundPreview } from '@/types';
import ProtectedRoute from '@/components/ProtectedRoute';

function StreamConfigPage() {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('background');
  const [backgroundImage, setBackgroundImage] = useState('tsubucafe1');
  const [autoSave, setAutoSave] = useState(true);
  const router = useRouter();

  const backgrounds: BackgroundPreview[] = [
    { id: 'tsubucafe1', name: '', preview: '/backgrounds/background (1).jpg' },
    { id: 'tsubucafe2', name: '', preview: '/backgrounds/background (2).jpg' },
    { id: 'tsubucafe3', name: '', preview: '/backgrounds/background (3).jpg' },
    { id: 'tsubucafe4', name: '', preview: '/backgrounds/background (4).jpg' },
    { id: 'tsubucafe5', name: '', preview: '/backgrounds/background (5).jpg' },
    { id: 'tsubucafe6', name: '', preview: '/backgrounds/background (6).jpg' },
    { id: 'tsubucafe7', name: '', preview: '/backgrounds/background (7).jpg' },
    { id: 'tsubucafe8', name: '', preview: '/backgrounds/background (8).jpg' },
    { id: 'tsubucafe9', name: '', preview: '/backgrounds/background (9).jpg' },
    { id: 'tsubucafe10', name: '', preview: '/backgrounds/background (10).jpg' }
  ];

  const handleNext = () => {
    // 選択した背景画像をlocalStorageに保存
    localStorage.setItem('selectedBackground', backgroundImage);
    router.push('/warning');
  };

  return (
    <div className="min-h-screen bg-white p-3 sm:p-4">
      <div className="max-w-2xl mx-auto flex flex-col">
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col">
          <div className="flex items-center mb-3 sm:mb-4 flex-shrink-0">
            <button
              onClick={() => router.push('/room-select')}
              className="text-gray-600 hover:text-gray-900 transition mr-3 text-sm sm:text-base"
            >
              ← 戻る
            </button>
            <div className="flex-1 text-center">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">配信設定</h1>
              <p className="text-xs sm:text-sm text-gray-600">お好みの設定を選択してください</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col space-y-3 sm:space-y-4 min-h-0 overflow-hidden">
            {/* 表示モード */}
            <div className="flex-shrink-0">
              <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">表示モード</h3>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <button
                  onClick={() => setDisplayMode('background')}
                  className={`p-2 rounded-lg border-2 transition ${
                    displayMode === 'background'
                      ? 'border-gray-900 bg-gray-100'
                      : 'border-gray-300 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="text-2xl sm:text-3xl mb-1">🖼️</div>
                  <div className="text-gray-900 font-medium text-xs sm:text-sm">背景画像</div>
                  <div className="text-gray-600 text-xs">10種類から選択</div>
                </button>
                <button
                  onClick={() => setDisplayMode('camera')}
                  className={`p-2 rounded-lg border-2 transition ${
                    displayMode === 'camera'
                      ? 'border-gray-900 bg-gray-100'
                      : 'border-gray-300 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="text-2xl sm:text-3xl mb-1">📹</div>
                  <div className="text-gray-900 font-medium text-xs sm:text-sm">カメラ映像</div>
                  <div className="text-gray-600 text-xs">Webカメラを使用</div>
                </button>
              </div>
            </div>

            {/* 背景画像選択 */}
            {displayMode === 'background' && (
              <div className="flex-shrink-0">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">背景画像</h3>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {backgrounds.map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => setBackgroundImage(bg.id)}
                      className={`rounded-lg border-2 transition aspect-square overflow-hidden ${
                        backgroundImage === bg.id
                          ? 'border-gray-900'
                          : 'border-gray-300'
                      }`}
                    >
                      <img 
                        src={bg.preview} 
                        alt={bg.id}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 自動保存設定 */}
            <div className="flex-shrink-0">
              <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">録画設定</h3>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-900 text-xs sm:text-sm">自動保存</span>
                  <button
                    onClick={() => setAutoSave(!autoSave)}
                    className={`w-11 h-6 rounded-full transition ${
                      autoSave ? 'bg-gray-900' : 'bg-gray-400'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full transition-transform ${
                        autoSave ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 sm:mt-4 flex-shrink-0">
            <button
              onClick={handleNext}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 px-4 rounded-lg transition duration-200 text-sm sm:text-base"
            >
              次へ進む
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StreamConfigPageWrapper() {
  return (
    <ProtectedRoute>
      <StreamConfigPage />
    </ProtectedRoute>
  );
}