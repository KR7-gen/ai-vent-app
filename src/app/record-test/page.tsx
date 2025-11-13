'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// Web Speech API type definitions
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export default function RecordTestPage() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recognizedText, setRecognizedText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [aiResponses, setAiResponses] = useState<Array<{ text: string; timestamp: number; isGpt: boolean }>>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoStopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldRestartRecognitionRef = useRef(false);
  const lastAizuchiTimeRef = useRef<number>(0);
  const isGptProcessingRef = useRef(false);
  const accumulatedTextRef = useRef<string>('');

  // Local aizuchi list
  const localAizuchi = [
    'うん', 'うんうん', 'なるほど', 'そうなんだ', 'へー', 'ほー',
    'わかる', 'それな', '確かに', 'そっか', 'そうだね', 'いいね',
    'すごいね', 'なんと', 'マジで', 'ほんとに', 'わかるわかる',
    'そうそう', 'あるある', 'だよね', 'ですよね', 'おお',
    'ふむふむ', 'なーるほど', 'せやな', 'そうね', 'うむ',
  ];

  // Get random local aizuchi
  const getRandomAizuchi = () => {
    return localAizuchi[Math.floor(Math.random() * localAizuchi.length)];
  };

  // Check if should trigger GPT response
  const shouldTriggerGptResponse = (text: string): boolean => {
    // 10-20% chance
    if (Math.random() > 0.15) return false;

    // Trigger if contains question mark or emotional keywords
    const hasQuestionMark = text.includes('？') || text.includes('?');
    const emotionalKeywords = ['辛い', 'つらい', '悲しい', '嬉しい', '困って', '悩んで', '心配', '不安', '怖い', '楽しい', '幸せ', '最悪', '最高'];
    const hasEmotionalWord = emotionalKeywords.some(keyword => text.includes(keyword));

    return hasQuestionMark || hasEmotionalWord;
  };

  // Add AI response
  const addAiResponse = (text: string, isGpt: boolean = false) => {
    const response = {
      text,
      timestamp: Date.now(),
      isGpt,
    };
    setAiResponses(prev => [...prev.slice(-50), response]); // Keep last 50 responses
    console.log(`AI Response (${isGpt ? 'GPT' : 'Local'}):`, text);
  };

  // Call GPT API
  const callGptApi = async (text: string) => {
    if (isGptProcessingRef.current) {
      console.log('GPT request already in progress, skipping');
      return;
    }

    isGptProcessingRef.current = true;

    try {
      const response = await fetch('/api/ai-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('GPT API request failed');
      }

      const data = await response.json();
      if (data.response) {
        addAiResponse(data.response, true);
      } else {
        throw new Error('No response from GPT');
      }
    } catch (error) {
      console.error('GPT API error:', error);
      // Fallback to local aizuchi
      addAiResponse(getRandomAizuchi(), false);
    } finally {
      isGptProcessingRef.current = false;
    }
  };

  // Handle recognized text and trigger responses
  const handleRecognizedText = useCallback((finalText: string) => {
    console.log('=== handleRecognizedText called ===');
    console.log('Final text:', finalText);

    const now = Date.now();
    const timeSinceLastAizuchi = now - lastAizuchiTimeRef.current;

    console.log('Time since last aizuchi:', timeSinceLastAizuchi, 'ms');

    // Cooldown: 3-5 seconds
    const cooldownTime = 3000 + Math.random() * 2000;
    console.log('Cooldown time:', cooldownTime, 'ms');

    if (timeSinceLastAizuchi < cooldownTime) {
      console.log('❌ Cooldown active, skipping aizuchi');
      return;
    }

    console.log('✅ Cooldown passed, generating response');

    // Update last aizuchi time
    lastAizuchiTimeRef.current = now;

    // Accumulate text for GPT context
    accumulatedTextRef.current += finalText + ' ';

    // Decide whether to use GPT or local aizuchi
    const shouldUseGpt = shouldTriggerGptResponse(finalText);
    console.log('Should use GPT:', shouldUseGpt);

    if (shouldUseGpt) {
      console.log('🤖 Triggering GPT response');
      callGptApi(accumulatedTextRef.current.slice(-500)); // Use last 500 chars for context
    } else {
      // Local aizuchi (80-90%)
      const aizuchi = getRandomAizuchi();
      console.log('💬 Using local aizuchi:', aizuchi);
      addAiResponse(aizuchi, false);
    }
  }, [shouldTriggerGptResponse, callGptApi, getRandomAizuchi, addAiResponse]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'ja-JP';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let interim = '';
          let final = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              final += transcript;
            } else {
              interim += transcript;
            }
          }

          if (final) {
            console.log('Final recognition:', final);
            setRecognizedText(prev => prev + final + ' ');
            setInterimText('');
            // Trigger AI response
            handleRecognizedText(final);
          } else {
            setInterimText(interim);
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          if (event.error !== 'no-speech' && event.error !== 'aborted') {
            setError(`音声認識エラー: ${event.error}`);
          }
        };

        recognition.onend = () => {
          console.log('Speech recognition ended');
          // Auto-restart if recording is still active
          if (shouldRestartRecognitionRef.current) {
            console.log('Auto-restarting speech recognition');
            try {
              recognition.start();
            } catch (err) {
              console.error('Error restarting recognition:', err);
            }
          }
        };

        recognitionRef.current = recognition;
        console.log('Speech recognition initialized');
      } else {
        console.warn('Speech recognition not supported');
        setError('お使いのブラウザは音声認識に対応していません。Chromeをご利用ください。');
      }
    }
  }, [handleRecognizedText]);

  // Clean up stream and recording on unmount ONLY
  useEffect(() => {
    return () => {
      // Stop speech recognition
      if (recognitionRef.current) {
        shouldRestartRecognitionRef.current = false;
        try {
          recognitionRef.current.stop();
        } catch (err) {
          console.error('Error stopping recognition on unmount:', err);
        }
      }

      // Stop recording if active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        console.log('Cleanup: Stopping recording on unmount');
        mediaRecorderRef.current.stop();
      }

      // Clear timers
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
      }

      // Stop stream
      const currentStream = stream;
      if (currentStream) {
        console.log('Cleanup: Stopping stream on unmount');
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run on mount/unmount

  // Set video element source when stream is available
  useEffect(() => {
    if (videoRef.current && stream) {
      console.log('Setting video srcObject:', stream.id);
      videoRef.current.srcObject = stream;
    } else if (videoRef.current && !stream) {
      console.log('Clearing video srcObject');
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  // Debug: Monitor video element
  useEffect(() => {
    if (videoRef.current) {
      const video = videoRef.current;
      console.log('Video element state:', {
        srcObject: video.srcObject ? 'set' : 'null',
        readyState: video.readyState,
        paused: video.paused,
      });
    }
  }, [stream, isRecording]);

  // Handle beforeunload to save recording
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRecording && mediaRecorderRef.current) {
        // Stop recording to trigger save
        mediaRecorderRef.current.stop();

        // Show warning to user
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isRecording]);

  // Recording time counter
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setRecordingTime(0);
    }

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);

  const handleStartCamera = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Request camera and microphone access
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setStream(mediaStream);
      setPermissionGranted(true);
    } catch (err) {
      console.error('Error accessing media devices:', err);

      if (err instanceof DOMException) {
        switch (err.name) {
          case 'NotAllowedError':
            setError('カメラとマイクへのアクセスが拒否されました。ブラウザの設定を確認してください。');
            break;
          case 'NotFoundError':
            setError('カメラまたはマイクが見つかりませんでした。デバイスが接続されているか確認してください。');
            break;
          case 'NotReadableError':
            setError('カメラまたはマイクが別のアプリケーションで使用中の可能性があります。');
            break;
          default:
            setError(`エラーが発生しました: ${err.message}`);
        }
      } else {
        setError('予期しないエラーが発生しました。');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopCamera = () => {
    // Stop recording first if active
    if (mediaRecorderRef.current && isRecording) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          console.log('Stopping recording before camera shutdown');
          mediaRecorderRef.current.stop();
        }
      } catch (err) {
        console.error('Error stopping recording in handleStopCamera:', err);
      }
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setPermissionGranted(false);

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }

    setIsRecording(false);
  };

  const getSupportedMimeType = (): string => {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return '';
  };

  const downloadRecording = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `recording_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();

    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const handleStartRecording = () => {
    if (!stream) {
      setError('カメラが起動していません。先にカメラを起動してください。');
      return;
    }

    try {
      setError(null);
      chunksRef.current = [];

      const mimeType = getSupportedMimeType();
      if (!mimeType) {
        setError('お使いのブラウザは録画に対応していません。');
        return;
      }

      console.log('Starting recording with mimeType:', mimeType);
      console.log('Stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
      });

      // Handle data available event (called every 5 seconds)
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log('Recording chunk received, size:', event.data.size);
          chunksRef.current.push(event.data);
        }
      };

      // Handle stop event
      mediaRecorder.onstop = () => {
        console.log('Recording stopped, total chunks:', chunksRef.current.length);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        downloadRecording(blob);
        chunksRef.current = [];

        // Clear auto-stop timer
        if (autoStopTimerRef.current) {
          clearTimeout(autoStopTimerRef.current);
          autoStopTimerRef.current = null;
        }
      };

      // Handle errors
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('録画中にエラーが発生しました。');
        setIsRecording(false);
      };

      // Start recording with 5-second chunks
      mediaRecorder.start(5000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      console.log('Recording started successfully');

      // Start speech recognition
      if (recognitionRef.current) {
        try {
          shouldRestartRecognitionRef.current = true;
          setRecognizedText('');
          setInterimText('');
          setAiResponses([]);
          accumulatedTextRef.current = '';
          lastAizuchiTimeRef.current = Date.now();
          recognitionRef.current.start();
          console.log('Speech recognition started');
        } catch (err) {
          console.error('Error starting speech recognition:', err);
        }
      }

      // Set 60-minute auto-stop timer
      autoStopTimerRef.current = setTimeout(() => {
        console.log('Auto-stop: 60 minutes reached');
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
        }
        // Stop speech recognition
        if (recognitionRef.current) {
          shouldRestartRecognitionRef.current = false;
          recognitionRef.current.stop();
        }
      }, 60 * 60 * 1000);

    } catch (err) {
      console.error('Error starting recording:', err);
      setError(`録画の開始に失敗しました。${err instanceof Error ? err.message : ''}`);
    }
  };

  const handleStopRecording = () => {
    console.log('handleStopRecording called, isRecording:', isRecording, 'recorder state:', mediaRecorderRef.current?.state);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        console.log('Recording stopped by user');
      } catch (err) {
        console.error('Error stopping recording:', err);
        setError('録画の停止に失敗しました。');
      }
    }

    // Stop speech recognition
    if (recognitionRef.current) {
      try {
        shouldRestartRecognitionRef.current = false;
        recognitionRef.current.stop();
        console.log('Speech recognition stopped');
      } catch (err) {
        console.error('Error stopping speech recognition:', err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            録画機能テストページ
          </h1>
          <p className="text-gray-400">
            フェーズ1-4: カメラとマイクの取得・プレビュー表示・録画機能・音声認識・AI相槌
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-500 bg-opacity-10 border border-red-500 rounded-lg p-4">
            <div className="flex items-start">
              <span className="text-2xl mr-3">⚠️</span>
              <div>
                <h3 className="text-red-400 font-semibold mb-1">エラー</h3>
                <p className="text-red-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Video Preview Section */}
          <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
            <div className="bg-gray-700 px-4 py-3 border-b border-gray-600">
              <h2 className="text-white font-semibold">カメラプレビュー</h2>
            </div>
            <div className="p-4">
              <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                {!stream && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-6xl mb-4">📹</div>
                      <p className="text-gray-400">カメラが起動していません</p>
                    </div>
                  </div>
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Recording Indicator */}
                {isRecording && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-full animate-pulse">
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                    <span className="font-semibold">REC</span>
                    <span className="font-mono">
                      {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:
                      {(recordingTime % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                )}
              </div>

              {/* Speech Recognition Display */}
              {isRecording && (
                <div className="mt-4 bg-gray-900 bg-opacity-50 rounded-lg p-4 min-h-[100px] max-h-[200px] overflow-y-auto">
                  <h3 className="text-white text-sm font-semibold mb-2 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    音声認識
                  </h3>
                  <div className="space-y-2">
                    {recognizedText && (
                      <p className="text-white text-sm leading-relaxed">
                        {recognizedText}
                      </p>
                    )}
                    {interimText && (
                      <p className="text-gray-400 text-sm italic">
                        {interimText}
                      </p>
                    )}
                    {!recognizedText && !interimText && (
                      <p className="text-gray-500 text-sm">
                        音声を認識中...
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Controls Section */}
          <div className="bg-gray-800 rounded-lg shadow-xl">
            <div className="bg-gray-700 px-4 py-3 border-b border-gray-600">
              <h2 className="text-white font-semibold">コントロール</h2>
            </div>
            <div className="p-6 space-y-6">
              {/* Status */}
              <div className="bg-gray-700 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 font-medium">カメラ</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    permissionGranted
                      ? 'bg-green-500 bg-opacity-20 text-green-400'
                      : 'bg-gray-600 text-gray-300'
                  }`}>
                    {permissionGranted ? '✓ 起動中' : '● 停止中'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 font-medium">録画</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    isRecording
                      ? 'bg-red-500 bg-opacity-20 text-red-400'
                      : 'bg-gray-600 text-gray-300'
                  }`}>
                    {isRecording ? '🔴 録画中' : '● 停止中'}
                  </span>
                </div>
                {isRecording && (
                  <div className="pt-2 border-t border-gray-600">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">録画時間</span>
                      <span className="text-white font-mono">
                        {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:
                        {(recordingTime % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-gray-400">残り時間</span>
                      <span className="text-gray-300 font-mono">
                        {Math.floor((3600 - recordingTime) / 60).toString().padStart(2, '0')}:
                        {((3600 - recordingTime) % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="space-y-3">
                {!permissionGranted ? (
                  <button
                    onClick={handleStartCamera}
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition duration-200 flex items-center justify-center"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        起動中...
                      </>
                    ) : (
                      <>
                        📹 カメラを起動
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleStopCamera}
                      disabled={isRecording}
                      className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                    >
                      ⏹ カメラを停止
                    </button>

                    <div className="border-t border-gray-600 pt-3"></div>

                    {!isRecording ? (
                      <button
                        onClick={handleStartRecording}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 flex items-center justify-center gap-2"
                      >
                        <div className="w-3 h-3 bg-white rounded-full"></div>
                        録画開始
                      </button>
                    ) : (
                      <button
                        onClick={handleStopRecording}
                        className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                      >
                        ⏹ 録画停止
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Stream Info */}
              {stream && (
                <div className="bg-gray-700 rounded-lg p-4 space-y-2">
                  <h3 className="text-white font-semibold mb-3">ストリーム情報</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">ビデオトラック:</span>
                      <span className="text-green-400 font-mono">
                        {stream.getVideoTracks().length} 個
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">オーディオトラック:</span>
                      <span className="text-green-400 font-mono">
                        {stream.getAudioTracks().length} 個
                      </span>
                    </div>
                    {stream.getVideoTracks()[0] && (
                      <div className="mt-3 pt-3 border-t border-gray-600">
                        <div className="text-gray-400 mb-2">ビデオ設定:</div>
                        <div className="text-xs text-gray-500 space-y-1">
                          <div>Label: {stream.getVideoTracks()[0].label}</div>
                          <div>Enabled: {stream.getVideoTracks()[0].enabled ? 'Yes' : 'No'}</div>
                        </div>
                      </div>
                    )}
                    {stream.getAudioTracks()[0] && (
                      <div className="mt-3 pt-3 border-t border-gray-600">
                        <div className="text-gray-400 mb-2">オーディオ設定:</div>
                        <div className="text-xs text-gray-500 space-y-1">
                          <div>Label: {stream.getAudioTracks()[0].label}</div>
                          <div>Enabled: {stream.getAudioTracks()[0].enabled ? 'Yes' : 'No'}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="bg-blue-500 bg-opacity-10 border border-blue-500 rounded-lg p-4">
                <h3 className="text-blue-400 font-semibold mb-2">使い方</h3>
                <ol className="text-blue-300 text-sm space-y-1 list-decimal list-inside">
                  <li>「カメラを起動」ボタンをクリック</li>
                  <li>ブラウザの許可ダイアログで「許可」を選択</li>
                  <li>カメラプレビューに自分の映像が表示されます</li>
                  <li>「録画開始」ボタンで録画を開始</li>
                  <li>「録画停止」ボタンで録画を停止し、自動ダウンロード</li>
                </ol>
              </div>

              {/* Recording Info */}
              {permissionGranted && (
                <div className="bg-yellow-500 bg-opacity-10 border border-yellow-500 rounded-lg p-4">
                  <h3 className="text-yellow-400 font-semibold mb-2">録画について</h3>
                  <ul className="text-yellow-300 text-sm space-y-1">
                    <li>• 最大録画時間: 60分</li>
                    <li>• 60分経過で自動停止・保存</li>
                    <li>• ページ離脱時も自動保存</li>
                    <li>• 形式: WebM (VP9/VP8 + Opus)</li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* AI Responses Section */}
          {isRecording && aiResponses.length > 0 && (
            <div className="bg-gray-800 rounded-lg shadow-xl mt-6">
              <div className="bg-gray-700 px-4 py-3 border-b border-gray-600">
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                  AI相槌・応答
                </h2>
              </div>
              <div className="p-4 max-h-[300px] overflow-y-auto">
                <div className="space-y-3">
                  {aiResponses.map((response, index) => (
                    <div
                      key={`${response.timestamp}-${index}`}
                      className={`p-3 rounded-lg ${
                        response.isGpt
                          ? 'bg-blue-600 bg-opacity-20 border-l-4 border-blue-400'
                          : 'bg-gray-700 bg-opacity-50'
                      } animate-fadeIn`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-gray-400 mt-1">
                          {response.isGpt ? '🤖 GPT' : '💬 相槌'}
                        </span>
                        <p className={`text-sm flex-1 ${
                          response.isGpt ? 'text-white' : 'text-gray-300'
                        }`}>
                          {response.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Technical Details */}
        <div className="mt-8 bg-gray-800 rounded-lg shadow-xl p-6">
          <h2 className="text-white font-semibold mb-4">技術詳細</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
            <div className="bg-gray-700 rounded p-3">
              <h3 className="text-gray-300 font-semibold mb-2">ビデオ設定</h3>
              <code className="text-green-400 text-xs">video: true</code>
            </div>
            <div className="bg-gray-700 rounded p-3">
              <h3 className="text-gray-300 font-semibold mb-2">オーディオ設定</h3>
              <pre className="text-green-400 text-xs overflow-x-auto">
{`audio: {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true
}`}
              </pre>
            </div>
            <div className="bg-gray-700 rounded p-3">
              <h3 className="text-gray-300 font-semibold mb-2">録画設定</h3>
              <pre className="text-green-400 text-xs overflow-x-auto">
{`mimeType:
  vp9,opus (優先)
  vp8,opus (フォールバック)
timeslice: 5000ms
maxDuration: 3600s`}
              </pre>
            </div>
            <div className="bg-gray-700 rounded p-3">
              <h3 className="text-gray-300 font-semibold mb-2">音声認識設定</h3>
              <pre className="text-green-400 text-xs overflow-x-auto">
{`API: Web Speech API
continuous: true
interimResults: true
lang: ja-JP
auto-restart: enabled`}
              </pre>
            </div>
            <div className="bg-gray-700 rounded p-3">
              <h3 className="text-gray-300 font-semibold mb-2">AI相槌設定</h3>
              <pre className="text-green-400 text-xs overflow-x-auto">
{`Local: 80-85%
GPT: 15-20%
Cooldown: 3-5秒
Timeout: 8秒
Model: GPT-3.5 Turbo`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
