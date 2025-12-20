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
    { id: 'tsubucafe1', name: 'つぶカフェ', preview: '☕' },
    { id: 'tsubucafe2', name: 'つぶカフェ２', preview: '☕' },
    { id: 'tsubucafe3', name: 'つぶカフェ３', preview: '☕' },
    { id: 'tsubucafe4', name: 'つぶカフェ４', preview: '☕' },
    { id: 'tsubucafe5', name: 'つぶカフェ５', preview: '☕' },
    { id: 'tsubucafe6', name: 'つぶカフェ６', preview: '☕' },
    { id: 'tsubucafe7', name: 'つぶカフェ７', preview: '☕' },
    { id: 'tsubucafe8', name: 'つぶカフェ８', preview: '☕' },
    { id: 'tsubucafe9', name: 'つぶカフェ９', preview: '☕' },
    { id: 'tsubucafe10', name: 'つぶカフェ１０', preview: '☕' },
    { id: 'tsubucafe11', name: 'つぶカフェ１１', preview: '☕' },
    { id: 'tsubucafe12', name: 'つぶカフェ１２', preview: '☕' }
  ];

  const handleNext = () => {
    // 選択した背景画像をlocalStorageに保存
    localStorage.setItem('selectedBackground', backgroundImage);
    router.push('/warning');
  };

  return (
    <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-lg">
          <div className="flex items-center mb-6 sm:mb-8">
            <button
              onClick={() => router.push('/room-select')}
              className="text-gray-600 hover:text-gray-900 transition mr-4"
            >
              ← 戻る
            </button>
            <div className="flex-1 text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">配信設定</h1>
              <p className="text-sm sm:text-base text-gray-600">お好みの設定を選択してください</p>
            </div>
          </div>

          <div className="space-y-6 sm:space-y-8">
            {/* 表示モード */}
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">表示モード</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <button
                  onClick={() => setDisplayMode('background')}
                  className={`p-3 sm:p-4 rounded-lg border-2 transition ${
                    displayMode === 'background'
                      ? 'border-gray-900 bg-gray-100'
                      : 'border-gray-300 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="text-3xl sm:text-4xl mb-2">🖼️</div>
                  <div className="text-gray-900 font-medium text-sm sm:text-base">背景画像</div>
                  <div className="text-gray-600 text-xs sm:text-sm">12種類から選択</div>
                </button>
                <button
                  onClick={() => setDisplayMode('camera')}
                  className={`p-3 sm:p-4 rounded-lg border-2 transition ${
                    displayMode === 'camera'
                      ? 'border-gray-900 bg-gray-100'
                      : 'border-gray-300 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="text-3xl sm:text-4xl mb-2">📹</div>
                  <div className="text-gray-900 font-medium text-sm sm:text-base">カメラ映像</div>
                  <div className="text-gray-600 text-xs sm:text-sm">Webカメラを使用</div>
                </button>
              </div>
            </div>

            {/* 背景画像選択 */}
            {displayMode === 'background' && (
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">背景画像</h3>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
                  {backgrounds.map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => setBackgroundImage(bg.id)}
                      className={`p-2 sm:p-3 rounded-lg border-2 transition ${
                        backgroundImage === bg.id
                          ? 'border-gray-900 bg-gray-100'
                          : 'border-gray-300 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-xl sm:text-2xl mb-1">{bg.preview}</div>
                      <div className="text-gray-900 text-xs">{bg.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}


            {/* 自動保存設定 */}
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">録画設定</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-900 text-sm sm:text-base">自動保存</span>
                  <button
                    onClick={() => setAutoSave(!autoSave)}
                    className={`w-12 h-6 rounded-full transition ${
                      autoSave ? 'bg-gray-900' : 'bg-gray-400'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full transition-transform ${
                        autoSave ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                
              </div>
            </div>
          </div>

          <div className="mt-6 sm:mt-8">
            <button
              onClick={handleNext}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 sm:py-3 px-4 rounded-lg transition duration-200 text-sm sm:text-base"
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