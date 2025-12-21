'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_DURATION_MS = 60 * 60 * 1000; // 60 minutes
type IntervalRef = ReturnType<typeof setInterval> | null;
type TimeoutRef = ReturnType<typeof setTimeout> | null;

interface UseRecorderResult {
  isRecording: boolean;
  recordingTime: number;
  error: string | null;
  startRecording: () => Promise<boolean>;
  stopRecording: () => void;
}

export const useRecorder = (): UseRecorderResult => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<IntervalRef>(null);
  const autoStopTimerRef = useRef<TimeoutRef>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const combinedStreamRef = useRef<MediaStream | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const stopRecordingRef = useRef<(() => void) | null>(null);

  const clearRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const clearAutoStopTimer = useCallback(() => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  }, []);

  const downloadRecording = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `recording_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }, []);

  const getSupportedMimeType = useCallback((): string => {
    if (typeof MediaRecorder === 'undefined') {
      return '';
    }

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
  }, []);

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (isRecording) {
      return false;
    }

    if (typeof MediaRecorder === 'undefined') {
      setError('お使いのブラウザは録画に対応していません。');
      return false;
    }

    try {
      setError(null);
      chunksRef.current = [];
      setRecordingTime(0);

      // 1. タブの画面録画を取得
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true, // タブ音声も取得を試みる
      });
      displayStreamRef.current = displayStream;

      // 2. マイク音声を取得（必須）
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = micStream;

      // 3. 映像トラックを取得
      const videoTrack = displayStream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('画面共有の映像トラックが取得できませんでした。');
      }
      videoTrackRef.current = videoTrack;

      // 4. WebAudio APIで音声をミックス
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const destination = audioContext.createMediaStreamDestination();
      destinationRef.current = destination;

      // マイク音声（必須）を追加
      const micSource = audioContext.createMediaStreamSource(micStream);
      micSource.connect(destination);

      // タブ音声（あれば追加）
      const hasTabAudio = displayStream.getAudioTracks().length > 0;
      if (hasTabAudio) {
        const tabAudioStream = new MediaStream(displayStream.getAudioTracks());
        const tabSource = audioContext.createMediaStreamSource(tabAudioStream);
        tabSource.connect(destination);
      }

      // 5. ミックス後の音声トラックを取得
      const mixedAudioTrack = destination.stream.getAudioTracks()[0];
      if (!mixedAudioTrack) {
        throw new Error('マイク音声が取得できませんでした。');
      }

      // 6. 映像とミックス音声を組み合わせたストリームを作成
      const combinedStream = new MediaStream([videoTrack, mixedAudioTrack]);
      combinedStreamRef.current = combinedStream;

      // 7. 共有停止時のイベント処理
      videoTrack.addEventListener('ended', () => {
        console.log('[Recorder] Display stream ended, stopping recording');
        if (stopRecordingRef.current) {
          stopRecordingRef.current();
        }
      });

      // 8. MediaRecorderで録画開始
      const mimeType = getSupportedMimeType();
      if (!mimeType) {
        throw new Error('お使いのブラウザは録画に対応していません。');
      }

      const mediaRecorder = new MediaRecorder(combinedStream, { mimeType });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          downloadRecording(blob);
        }
        chunksRef.current = [];
        clearAutoStopTimer();
        clearRecordingTimer();
        setRecordingTime(0);
        setIsRecording(false);
        mediaRecorderRef.current = null;
        
        // 後始末
        cleanup();
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('録画中にエラーが発生しました。');
        setIsRecording(false);
        clearAutoStopTimer();
        clearRecordingTimer();
        mediaRecorderRef.current = null;
        cleanup();
      };

      mediaRecorder.start(5000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      autoStopTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      }, MAX_DURATION_MS);

      return true;
    } catch (err) {
      console.error('Error starting recording:', err);
      setError(`録画の開始に失敗しました。${err instanceof Error ? err.message : ''}`);
      cleanup();
      return false;
    }
  }, [clearAutoStopTimer, clearRecordingTimer, downloadRecording, getSupportedMimeType, isRecording]);

  const cleanup = useCallback(() => {
    // ストリームの停止
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach(track => track.stop());
      displayStreamRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (combinedStreamRef.current) {
      combinedStreamRef.current.getTracks().forEach(track => track.stop());
      combinedStreamRef.current = null;
    }
    
    // AudioContextのクローズ
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(err => {
        console.error('Error closing AudioContext:', err);
      });
      audioContextRef.current = null;
    }
    
    destinationRef.current = null;
    videoTrackRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error('Error stopping recording:', err);
        setError('録画の停止に失敗しました。');
        cleanup();
      }
    } else {
      // MediaRecorderが既に停止している場合もクリーンアップ
      cleanup();
    }

    setIsRecording(false);
    setRecordingTime(0);
    clearAutoStopTimer();
    clearRecordingTimer();
  }, [clearAutoStopTimer, clearRecordingTimer, cleanup]);

  // stopRecordingの最新版をrefで保持
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        event.preventDefault();
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isRecording]);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  return {
    isRecording,
    recordingTime,
    error,
    startRecording,
    stopRecording,
  };
};

export type UseRecorderHook = ReturnType<typeof useRecorder>;

