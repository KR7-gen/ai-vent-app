'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RoomMode } from '@/types';

export default function RoomSelectPage() {
  const [mode, setMode] = useState<RoomMode>('create');
  const [roomId, setRoomId] = useState('');
  const router = useRouter();

  const generateRoomId = () => {
    return `ROOM-${Math.random().toString(36).substr(2, 4).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  };

  const [generatedRoomId] = useState(() => generateRoomId());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push('/stream-config');
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-lg w-full max-w-md mx-auto">
        <div className="flex items-center mb-8">
          <button
            onClick={() => router.push('/login')}
            className="text-gray-600 hover:text-gray-900 transition mr-4"
          >
            ← 戻る
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">ルーム選択</h1>
            <p className="text-sm sm:text-base text-gray-600">新しい部屋を作るか、既存の部屋に参加</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row mb-6 gap-2 sm:gap-0">
          <button
            onClick={() => setMode('create')}
            className={`flex-1 py-2 sm:py-3 px-4 rounded-lg sm:rounded-l-lg sm:rounded-r-none font-medium transition text-sm sm:text-base ${
              mode === 'create'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            部屋を作る
          </button>
          <button
            onClick={() => setMode('join')}
            className={`flex-1 py-2 sm:py-3 px-4 rounded-lg sm:rounded-r-lg sm:rounded-l-none font-medium transition text-sm sm:text-base ${
              mode === 'join'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            部屋に参加
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {mode === 'create' ? (
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                ルームID（自動生成）
              </label>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-0">
                <input
                  type="text"
                  value={roomId || generatedRoomId}
                  readOnly
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-white border border-gray-300 rounded-lg sm:rounded-l-lg sm:rounded-r-none text-gray-900 text-sm sm:text-base"
                />
                <button
                  type="button"
                  onClick={() => setRoomId(generateRoomId())}
                  className="px-3 sm:px-4 py-2 sm:py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-lg sm:rounded-r-lg sm:rounded-l-none transition text-sm sm:text-base"
                >
                  再生成
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                ルームID
              </label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm sm:text-base"
                placeholder="ROOM-XXXX-XXXX"
                required
                aria-label="ルームIDを入力"
                autoComplete="off"
              />
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 sm:py-3 px-4 rounded-lg transition duration-200 text-sm sm:text-base"
          >
            {mode === 'create' ? '部屋を作成' : '部屋に参加'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            ※最大2人まで同じ部屋に参加できます
          </p>
        </div>
      </div>
    </div>
  );
}