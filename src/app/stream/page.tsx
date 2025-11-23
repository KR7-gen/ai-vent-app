'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Comment, BackgroundOption, StampOption } from '@/types';

export default function StreamPage() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamTime, setStreamTime] = useState(0);
  const [silenceTime, setSilenceTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [lastAudioTime, setLastAudioTime] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [backgroundImage, setBackgroundImage] = useState('nature1');
  const [error, setError] = useState<string | null>(null);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const [showStampPanel, setShowStampPanel] = useState(false);
  
  const router = useRouter();
  const streamStartTime = useRef<number | null>(null);
  const silenceTimer = useRef<number | null>(null);
  const commentsContainerRef = useRef<HTMLDivElement>(null);

  // stream-configで選択した背景画像を読み込む
  useEffect(() => {
    const savedBackground = localStorage.getItem('selectedBackground');
    if (savedBackground) {
      setBackgroundImage(savedBackground);
    }
  }, []);

  // Mock audio level animation and silence detection
  useEffect(() => {
    if (isStreaming) {
      const interval = setInterval(() => {
        const newLevel = Math.random() * 100;
        setAudioLevel(newLevel);
        
        // If audio level is above threshold, reset silence timer
        if (newLevel > 30) {
          setLastAudioTime(Date.now());
          setSilenceTime(0);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isStreaming]);

  // Silence timer
  useEffect(() => {
    if (isStreaming && lastAudioTime) {
      const interval = setInterval(() => {
        const currentTime = Date.now();
        const timeSinceLastAudio = Math.floor((currentTime - lastAudioTime) / 1000);
        setSilenceTime(timeSinceLastAudio);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isStreaming, lastAudioTime]);

  // Stream timer
  useEffect(() => {
    if (isStreaming && streamStartTime.current) {
      const interval = setInterval(() => {
        setStreamTime(Math.floor((Date.now() - streamStartTime.current!) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isStreaming]);

  // Auto comments (mock) - Multiple timers for more frequent comments
  useEffect(() => {
    if (isStreaming) {
      const comments = [
        'うん', 'うんうん', 'そうなんだ', 'なるほど', 'わかる', 'それな', '確かに', 'へー', 
        'ほんとに？', 'すごいね', '大変だね', 'つらいね', 'よかったね', 'えらいね', 'そっか', 'ええ〜',
        'わかります', 'そうですね', 'なんと', 'まじで', 'おつかれさま', 'がんばって', 'だよね',
        'いいね', 'すてき', 'かわいい', 'かっこいい', 'やばい', 'しんどい', 'たいへん',
        'おもしろい', 'びっくり', 'すばらしい', 'さすが', 'ありがとう', 'おかえり', 'いってらっしゃい',
        'おはよう', 'こんにちは', 'こんばんは', 'お疲れ様', 'がんばれ', 'ファイト', '応援してる',
        'そうそう', 'あるある', 'わかりみ', 'これこれ', 'ほんそれ', '激しく同意', '完全に理解',
        'めっちゃわかる', 'すごくわかる', 'わかりすぎる', '共感', '同感', 'その通り', 'まさに',
        'だよなー', 'そうなのよ', 'ほんまそれ', 'マジそれ', '超わかる', 'ガチわかる'
      ];
      
      // Timer 1: Fast comments
      const interval1 = setInterval(() => {
        const randomComment = comments[Math.floor(Math.random() * comments.length)];
        addComment(randomComment, false);
      }, 300 + Math.random() * 200);
      
      // Timer 2: Medium speed comments
      const interval2 = setInterval(() => {
        const randomComment = comments[Math.floor(Math.random() * comments.length)];
        addComment(randomComment, false);
      }, 600 + Math.random() * 400);
      
      // Timer 3: Slower comments
      const interval3 = setInterval(() => {
        const randomComment = comments[Math.floor(Math.random() * comments.length)];
        addComment(randomComment, false);
      }, 800 + Math.random() * 600);
      
      return () => {
        clearInterval(interval1);
        clearInterval(interval2);
        clearInterval(interval3);
      };
    }
  }, [isStreaming]);

  // Auto-scroll to bottom when new comments are added
  useEffect(() => {
    if (isAutoScroll && commentsContainerRef.current) {
      commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight;
    }
  }, [comments, isAutoScroll]);

  const addComment = (text: string, special: boolean = false, isUserComment: boolean = false, stampSrc?: string) => {
    const comment: Comment = {
      id: Date.now().toString() + Math.random(),
      text,
      special,
      timestamp: Date.now(),
      userName: isUserComment ? '視聴者' : 'Bot',
      isUserComment,
      stampSrc
    };
    
    setComments(prev => {
      // Keep only last 100 comments for performance
      const newComments = [...prev, comment].slice(-100);
      return newComments;
    });
  };

  const handleScroll = () => {
    if (commentsContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = commentsContainerRef.current;
      // より厳密な判定（10px以内）
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
      setIsAutoScroll(isAtBottom);
    }
  };

  const scrollToBottom = () => {
    if (commentsContainerRef.current) {
      commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight;
      setIsAutoScroll(true);
    }
  };


  const handleStartStream = () => {
    try {
      setError(null);
      setIsStreaming(true);
      streamStartTime.current = Date.now();
      setLastAudioTime(Date.now());
      setSilenceTime(0);
    } catch (err) {
      setError('配信の開始に失敗しました。再度お試しください。');
      console.error('Stream start error:', err);
    }
  };

  const handleEndStream = () => {
    setShowConfirmEnd(true);
  };

  const confirmEndStream = () => {
    try {
      setIsStreaming(false);
      setShowConfirmEnd(false);
      router.push('/login');
    } catch (err) {
      setError('配信の終了に失敗しました。');
      console.error('Stream end error:', err);
    }
  };

  const handleToggleRecording = () => {
    try {
      setError(null);
      setIsRecording(!isRecording);
    } catch (err) {
      setError('録画の切り替えに失敗しました。');
      console.error('Recording toggle error:', err);
    }
  };

  const backgroundOptions: BackgroundOption[] = [
    { id: 'nature1', name: '森林', gradient: 'from-green-800 to-green-600' },
    { id: 'nature2', name: '海辺', gradient: 'from-blue-800 to-blue-600' },
    { id: 'nature3', name: '夜空', gradient: 'from-purple-900 to-indigo-800' },
    { id: 'nature4', name: '山岳', gradient: 'from-gray-700 to-gray-500' },
    { id: 'nature5', name: '桜', gradient: 'from-pink-400 to-pink-200' },
    { id: 'room1', name: '書斎', gradient: 'from-amber-900 to-amber-700' },
    { id: 'room2', name: 'カフェ', gradient: 'from-orange-800 to-amber-600' },
    { id: 'room3', name: 'オフィス', gradient: 'from-slate-700 to-slate-500' },
    { id: 'abstract1', name: 'グラデーション', gradient: 'from-pink-800 to-purple-600' },
    { id: 'abstract2', name: 'オーロラ', gradient: 'from-green-400 to-blue-500' },
    { id: 'abstract3', name: 'サンセット', gradient: 'from-orange-500 to-red-500' },
    { id: 'minimal1', name: 'ホワイト', gradient: 'from-gray-100 to-white' },
    { id: 'minimal2', name: 'ダーク', gradient: 'from-gray-900 to-black' },
    { id: 'warm1', name: 'ウォーム', gradient: 'from-red-400 to-yellow-400' },
    { id: 'cool1', name: 'クール', gradient: 'from-blue-400 to-cyan-400' },
    { id: 'tsubucafe', name: 'つぶカフェ', gradient: 'from-orange-800 to-amber-600' }
  ];

  const stampOptions: StampOption[] = [
    { id: 'wafuwafu1', name: 'わふわふ1', src: '/backgrounds/StumpWafuwafu1.gif', type: 'gif' },
    { id: 'wafuwafu2', name: 'わふわふ2', src: '/backgrounds/StumpWafuwafu2.png', type: 'image' },
    { id: 'wafuwafu3', name: 'わふわふ3', src: '/backgrounds/StumpWafuwafu3.png', type: 'image' }
  ];

  const currentBg = backgroundOptions.find(bg => bg.id === backgroundImage) || backgroundOptions[0];

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStampSelect = (stampId: string) => {
    const stampOption = stampOptions.find(s => s.id === stampId);
    if (stampOption) {
      addComment('', false, true, stampOption.src);
      setShowStampPanel(false);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-700 hover:text-red-900 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-100 border-b border-gray-200 p-4 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div className="text-gray-900">
            <span className="text-sm text-gray-600">経過時間: </span>
            <span className="font-mono text-lg">{formatTime(streamTime)}</span>
          </div>
          <div className="text-gray-900">
            <span className="text-sm text-gray-600">沈黙: </span>
            <span className="font-mono">{silenceTime}秒</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-900 text-sm">音声レベル:</span>
            <div className="w-32 h-2 bg-gray-300 rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-800 transition-all duration-100"
                style={{ width: `${audioLevel}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Stream Area */}
      <div className="relative flex-1" style={{ height: 'calc(100vh - 140px)' }}>
        {/* Background */}
        <div className="absolute inset-0 bg-gray-50">
          {backgroundImage === 'tsubucafe' ? (
            <div 
              className="absolute inset-0 bg-center bg-no-repeat"
              style={{
                backgroundImage: 'url(/backgrounds/TubuCafeBackground.jpg)',
                backgroundSize: 'auto 100%',
              }}
            >
              <div className="absolute inset-0 bg-white/30" />
            </div>
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br ${currentBg.gradient}`}>
              <div className="absolute inset-0 bg-white/50" />
            </div>
          )}
        </div>

        {/* Comments Panel - YouTube Live style */}
        <div className="absolute right-4 top-4 bottom-20 w-80 pointer-events-auto">
          <div className="h-full bg-black bg-opacity-80 rounded-lg flex flex-col">
            {/* Comment Header */}
            <div className="p-3 border-b border-gray-600 flex justify-between items-center">
              <h3 className="text-white text-sm font-medium">ライブチャット</h3>
              {!isAutoScroll && (
                <button
                  onClick={scrollToBottom}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors"
                >
                  最新へ
                </button>
              )}
            </div>
            
            {/* Comments List */}
            <div 
              ref={commentsContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-scroll p-2"
              style={{ maxHeight: 'calc(100% - 60px)' }}
            >
              {comments.map((comment, index) => (
                <div
                  key={comment.id}
                  className="animate-fadeIn mb-2"
                >
                  <div className={`p-2 rounded ${
                    comment.isUserComment 
                      ? 'bg-blue-600 bg-opacity-20 border-l-2 border-blue-400' 
                      : 'bg-gray-600 bg-opacity-20'
                  }`}>
                    <div className="flex items-start gap-2">
                      <span className={`text-xs font-medium ${
                        comment.isUserComment ? 'text-blue-300' : 'text-gray-300'
                      }`}>
                        {comment.userName}
                      </span>
                    </div>
                    {comment.stampSrc ? (
                      <div className="mt-1">
                        <img
                          src={comment.stampSrc}
                          alt="stamp"
                          className="w-16 h-16 object-contain"
                        />
                      </div>
                    ) : (
                      <p className={`text-sm mt-1 ${
                        comment.special 
                          ? 'text-yellow-300 font-bold text-base' 
                          : 'text-white'
                      }`}>
                        {comment.text}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {/* 最下部のスペーサー */}
              <div className="h-2"></div>
            </div>
          </div>
        </div>

        {/* Center Message */}
        {!isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={handleStartStream}
              className="bg-gray-900 hover:bg-gray-800 text-white font-bold py-4 px-8 rounded-full text-xl transition duration-200 shadow-lg"
            >
              🎤 配信開始
            </button>
          </div>
        )}

        {isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-gray-900 text-2xl mb-4">配信中...</div>
              <div className="w-16 h-16 border-4 border-gray-800 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-100 border-t border-gray-200 p-4 flex justify-between items-center">
        <div className="flex gap-3">
          <button
            onClick={handleEndStream}
            className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg transition"
          >
            配信終了
          </button>
          
          <div className="relative">
            <select
              value={backgroundImage}
              onChange={(e) => setBackgroundImage(e.target.value)}
              className="bg-white border border-gray-300 text-gray-900 px-4 py-2 rounded-lg"
            >
              {backgroundOptions.map((bg) => (
                <option key={bg.id} value={bg.id}>
                  {bg.name}
                </option>
              ))}
            </select>
          </div>
          
          <button
            onClick={handleToggleRecording}
            className={`px-4 py-2 rounded-lg transition ${
              isRecording
                ? 'bg-gray-900 hover:bg-gray-800 text-white'
                : 'bg-gray-300 hover:bg-gray-400 text-gray-800'
            }`}
          >
            {isRecording ? '🔴 録画停止' : '⚫ 録画開始'}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowStampPanel(!showStampPanel)}
              className="px-4 py-2 rounded-lg transition bg-gray-300 hover:bg-gray-400 text-gray-800"
            >
              🎨 スタンプ
            </button>
            
            {showStampPanel && (
              <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-50">
                <div className="text-sm font-semibold text-gray-900 mb-2">スタンプを選択</div>
                <div className="grid grid-cols-3 gap-2">
                  {stampOptions.map((stamp) => (
                    <button
                      key={stamp.id}
                      onClick={() => handleStampSelect(stamp.id)}
                      className="p-2 rounded border-2 border-gray-300 hover:border-gray-400 transition"
                    >
                      <img
                        src={stamp.src}
                        alt={stamp.name}
                        className="w-12 h-12 object-contain mx-auto"
                      />
                      <div className="text-xs text-gray-700 mt-1">{stamp.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="text-gray-600 text-sm">
          マイクに向かって話してください
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmEnd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">配信を終了しますか？</h3>
            <p className="text-gray-600 mb-4">配信を終了すると、ログイン画面に戻ります。</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmEnd(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
              >
                キャンセル
              </button>
              <button
                onClick={confirmEndStream}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition"
              >
                終了する
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { 
            opacity: 0; 
            transform: translateY(10px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-in;
        }
      `}</style>
    </div>
  );
}