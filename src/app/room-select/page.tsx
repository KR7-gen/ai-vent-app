'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import io from 'socket.io-client';
import type { RoomMode } from '@/types';

export default function RoomSelectPage() {
  const [mode, setMode] = useState<RoomMode>('create');
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState<string>('');
  const [isChecking, setIsChecking] = useState(false);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const router = useRouter();

  const generateRoomId = () => {
    return `ROOM-${Math.random().toString(36).substr(2, 4).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  };

  const [generatedRoomId] = useState(() => generateRoomId());

  // コンポーネントのクリーンアップ時にSocket接続を切断
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const finalRoomId = mode === 'create' ? (roomId || generatedRoomId) : roomId;
    
    if (!finalRoomId) {
      setError('ルームIDを入力してください');
      return;
    }

    // 「部屋に参加」の場合はルームIDの存在確認
    if (mode === 'join') {
      setIsChecking(true);
      try {
        console.log('[RoomSelect] Checking room ID:', finalRoomId);
        const response = await fetch('/api/rooms/check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ roomId: finalRoomId }),
        });

        console.log('[RoomSelect] Response status:', response.status);
        const data = await response.json();
        console.log('[RoomSelect] Response data:', data);
        console.log('[RoomSelect] Room exists?', data.exists);

        if (!response.ok) {
          setError('ルームIDの確認に失敗しました。再度お試しください。');
          setIsChecking(false);
          return;
        }

        if (!data.exists) {
          setError('このルームIDは存在しないか、配信が終了しています。');
          setIsChecking(false);
          return;
        }

        // ルームIDが存在する場合、入室リクエストを送信
        setIsChecking(false);
        setIsWaitingForApproval(true);
        
        // Socket.IO接続を確立
        const socket = io('http://localhost:3000', {
          transports: ['websocket', 'polling'],
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          console.log('[RoomSelect] Socket connected:', socket.id);
          // 入室リクエストを送信
          socket.emit('request-join-room', { roomId: finalRoomId });
        });

        // 入室承認を受信
        socket.on('join-request-approved', (data: { roomId: string }) => {
          console.log('[RoomSelect] Join request approved:', data);
          setIsWaitingForApproval(false);
          socket.disconnect();
          
          // ルームIDをlocalStorageに保存
          if (finalRoomId) {
            localStorage.setItem('roomId', finalRoomId);
          }
          router.push('/warning');
        });

        // 入室拒否を受信
        socket.on('join-request-denied', (data: { roomId: string; reason: string }) => {
          console.log('[RoomSelect] Join request denied:', data);
          setIsWaitingForApproval(false);
          setError(data.reason || '入室が拒否されました');
          socket.disconnect();
        });

        return; // 入室リクエスト送信後はここで終了
      } catch (err) {
        console.error('[RoomSelect] Room check error:', err);
        setError('ルームIDの確認に失敗しました。再度お試しください。');
        setIsChecking(false);
        return;
      }
    }

    // 「部屋を作る」の場合は通常のフロー
    // ルームIDをlocalStorageに保存
    if (finalRoomId) {
      localStorage.setItem('roomId', finalRoomId);
    }
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

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          {isWaitingForApproval && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-blue-700 text-sm">入室リクエストを送信しました。承認をお待ちください...</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isChecking || isWaitingForApproval}
            className={`w-full font-medium py-2 sm:py-3 px-4 rounded-lg transition duration-200 text-sm sm:text-base ${
              isChecking || isWaitingForApproval
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-gray-900 hover:bg-gray-800 text-white'
            }`}
          >
            {isChecking ? '確認中...' : isWaitingForApproval ? '承認待ち...' : mode === 'create' ? '部屋を作成' : '部屋に参加'}
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