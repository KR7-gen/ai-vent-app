'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_DURATION_MS = 60 * 60 * 1000; // 60 minutes
type IntervalRef = ReturnType<typeof setInterval> | null;
type TimeoutRef = ReturnType<typeof setTimeout> | null;

interface UseRecorderResult {
  isRecording: boolean;
  recordingTime: number;
  error: string | null;
  startRecording: () => boolean;
  stopRecording: () => void;
}

export const useRecorder = (stream: MediaStream | null): UseRecorderResult => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<IntervalRef>(null);
  const autoStopTimerRef = useRef<TimeoutRef>(null);

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

  const startRecording = useCallback((): boolean => {
    if (isRecording) {
      return false;
    }

    if (!stream) {
      setError('カメラが起動していません。先にカメラを起動してください。');
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

      const mimeType = getSupportedMimeType();
      if (!mimeType) {
        setError('お使いのブラウザは録画に対応していません。');
        return false;
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });

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
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('録画中にエラーが発生しました。');
        setIsRecording(false);
        clearAutoStopTimer();
        clearRecordingTimer();
        mediaRecorderRef.current = null;
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
      return false;
    }
  }, [clearAutoStopTimer, clearRecordingTimer, downloadRecording, getSupportedMimeType, isRecording, stream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error('Error stopping recording:', err);
        setError('録画の停止に失敗しました。');
      }
    }

    setIsRecording(false);
    setRecordingTime(0);
    clearAutoStopTimer();
    clearRecordingTimer();
  }, [clearAutoStopTimer, clearRecordingTimer]);

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
    if (!stream) {
      stopRecording();
    }
  }, [stopRecording, stream]);

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

