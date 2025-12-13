'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import io from 'socket.io-client';
import type { Comment, BackgroundOption, StampOption } from '@/types';
import { useMediaStream } from '@/hooks/useMediaStream';
import { useRecorder } from '@/hooks/useRecorder';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

export default function StreamPage() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamTime, setStreamTime] = useState(0);
  const [silenceTime, setSilenceTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [lastAudioTime, setLastAudioTime] = useState<number | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [backgroundImage, setBackgroundImage] = useState('tsubucafe1');
  const [error, setError] = useState<string | null>(null);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const [showStampPanel, setShowStampPanel] = useState(false);
  const [roomId, setRoomId] = useState<string>('');
  const [showJoinRequest, setShowJoinRequest] = useState(false);
  const [joinRequestData, setJoinRequestData] = useState<{ roomId: string; requesterSocketId: string } | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const [isWebRTCConnected, setIsWebRTCConnected] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectedUserCount, setConnectedUserCount] = useState(1); // 自分を含む
  const [showUserLeftNotification, setShowUserLeftNotification] = useState(false);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteSocketIdRef = useRef<string | null>(null);
  const streamStartTime = useRef<number | null>(null);
  const silenceTimer = useRef<number | null>(null);
  const commentsContainerRef = useRef<HTMLDivElement>(null);
  const {
    stream,
    isLoading: isCameraLoading,
    permissionGranted,
    error: mediaError,
    startCamera,
    stopCamera,
  } = useMediaStream();
  const {
    isRecording,
    recordingTime,
    error: recorderError,
    startRecording,
    stopRecording,
  } = useRecorder(stream);
  // ローカル相槌候補（音声認識の finalText をトリガーにのみ使用）
  const localAizuchi = useMemo(() => ([
    'うん', 'うんうん', 'そうなんだ', 'なるほど', 'わかる', 'それな', '確かに', 'へー',
    'ほんとに？', 'すごいね', '大変だね', 'つらいね', 'よかったね', 'えらいね', 'そっか', 'ええ〜',
    'わかります', 'そうですね', 'なんと', 'まじで', 'おつかれさま', 'がんばって', 'だよね',
    'いいね', 'すてき', 'かわいい', 'かっこいい', 'やばい', 'しんどい', 'たいへん',
    'おもしろい', 'びっくり', 'すばらしい', 'さすが', 'ありがとう', 'おかえり', 'いってらっしゃい',
    'おはよう', 'こんにちは', 'こんばんは', 'お疲れ様', 'がんばれ', 'ファイト', '応援してる',
    'そうそう', 'あるある', 'わかりみ', 'これこれ', 'ほんそれ', '激しく同意', '完全に理解',
    'めっちゃわかる', 'すごくわかる', 'わかりすぎる', '共感', '同感', 'その通り', 'まさに',
    'だよなー', 'そうなのよ', 'ほんまそれ', 'マジそれ', '超わかる', 'ガチわかる'
  ]), []);
  const lastAizuchiTimeRef = useRef(0);
  const isRecognitionActiveRef = useRef(false);
  const bufferRef = useRef<string>(''); // 音声認識テキストを蓄積
  const lastGptAt = useRef<number>(0); // 最後にGPTを呼んだ時刻
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null); // 無音検知用タイマー

  // stream-configで選択した背景画像を読み込む
  useEffect(() => {
    const savedBackground = localStorage.getItem('selectedBackground');
    if (savedBackground) {
      setBackgroundImage(savedBackground);
    }
  }, []);

  // ルームIDを読み込む
  useEffect(() => {
    const savedRoomId = localStorage.getItem('roomId');
    if (savedRoomId) {
      setRoomId(savedRoomId);
      // ページに到達した時点でルームIDをサーバーに登録（部屋を作成した時点で参加可能にする）
      console.log('[Stream] Registering room ID on mount:', savedRoomId);
      fetch('/api/rooms/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomId: savedRoomId }),
      })
      .then(response => {
        console.log('[Stream] Registration response status:', response.status);
        return response.json();
      })
      .then(data => {
        console.log('[Stream] Registration response data:', data);
      })
      .catch(err => {
        console.error('[Stream] Room registration error on mount:', err);
      });

      // Socket.IO接続を確立してルームホストとして登録
      const socket = io('http://localhost:3000', {
        transports: ['websocket', 'polling'],
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('[Stream] Socket connected:', socket.id);
        // ルームホストとして登録
        socket.emit('register-room-host', { roomId: savedRoomId });
        console.log('[Stream] Registered as room host for:', savedRoomId);
      });

      // 入室リクエストを受信
      socket.on('join-request', (data: { roomId: string; requesterSocketId: string }) => {
        console.log('[Stream] Join request received:', data);
        setJoinRequestData(data);
        setShowJoinRequest(true);
      });

      // WebRTCシグナリングイベント
      // 他のユーザーが参加したとき
      socket.on('user-joined', (data: { socketId: string }) => {
        console.log('[Stream] User joined:', data.socketId);
        setConnectedUserCount(prev => {
          const newCount = prev + 1;
          console.log('[Stream] Connected user count:', newCount);
          return newCount;
        });
      });

      // 既存のユーザーがいることを通知されたとき
      socket.on('existing-users', (data: { users: string[] }) => {
        console.log('[Stream] Existing users:', data.users);
        setConnectedUserCount(prev => {
          const newCount = prev + data.users.length;
          console.log('[Stream] Connected user count:', newCount);
          return newCount;
        });
      });

      // サーバーからoffer作成を促されたとき
      socket.on('create-offer', async (data: { targetSocketId: string }) => {
        console.log('[Stream] Server requested to create offer for:', data.targetSocketId);
        console.log('[Stream] Current stream:', stream);
        remoteSocketIdRef.current = data.targetSocketId;
        
        // 既存のPeerConnectionが閉じられている場合は新規作成
        if (peerConnectionRef.current && 
            (peerConnectionRef.current.connectionState === 'closed' || 
             peerConnectionRef.current.signalingState === 'closed')) {
          console.log('[Stream] Existing PeerConnection is closed, creating new one');
          peerConnectionRef.current = null;
        }
        
        if (!peerConnectionRef.current) {
          if (stream) {
            console.log('[Stream] Creating PeerConnection for offer');
            createPeerConnection(stream);
          } else {
            console.error('[Stream] Cannot create offer: stream is not available');
            return;
          }
        }

        if (peerConnectionRef.current) {
          // PeerConnectionの状態を確認
          if (peerConnectionRef.current.signalingState === 'closed') {
            console.error('[Stream] Cannot create offer: PeerConnection is closed');
            return;
          }
          
          try {
            console.log('[Stream] Creating offer');
            const offer = await peerConnectionRef.current.createOffer();
            await peerConnectionRef.current.setLocalDescription(offer);
            console.log('[Stream] Offer created, sending to:', data.targetSocketId);

            socket.emit('webrtc-offer', {
              offer: offer,
              socketId: socket.id,
              targetSocketId: data.targetSocketId,
            });
          } catch (err) {
            console.error('[Stream] Error creating offer:', err);
          }
        } else {
          console.error('[Stream] Cannot create offer: PeerConnection is null');
        }
      });

      // WebRTC offer を受信
      socket.on('webrtc-offer', async (data: { offer: RTCSessionDescriptionInit; socketId: string }) => {
        console.log('[Stream] Offer received from:', data.socketId);
        console.log('[Stream] Current stream:', stream);
        remoteSocketIdRef.current = data.socketId;
        if (!peerConnectionRef.current) {
          if (stream) {
            console.log('[Stream] Creating PeerConnection for answer');
            createPeerConnection(stream);
          } else {
            console.error('[Stream] Cannot handle offer: stream is not available');
            return;
          }
        }

        if (!peerConnectionRef.current) {
          console.error('[Stream] Cannot handle offer: PeerConnection is null');
          return;
        }

        try {
          console.log('[Stream] Setting remote description');
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
          console.log('[Stream] Creating answer');
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          console.log('[Stream] Answer created, sending to:', data.socketId);

          socket.emit('webrtc-answer', {
            answer: answer,
            socketId: socket.id,
            targetSocketId: data.socketId,
          });
        } catch (err) {
          console.error('[Stream] Error handling offer:', err);
        }
      });

      // WebRTC answer を受信
      socket.on('webrtc-answer', async (data: { answer: RTCSessionDescriptionInit; socketId: string }) => {
        console.log('[Stream] Answer received from:', data.socketId);
        if (peerConnectionRef.current) {
          try {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
            setIsWebRTCConnected(true);
          } catch (err) {
            console.error('[Stream] Error handling answer:', err);
          }
        }
      });

      // ICE candidate を受信
      socket.on('ice-candidate', async (data: { candidate: RTCIceCandidateInit; socketId: string }) => {
        console.log('[Stream] ICE candidate received from:', data.socketId);
        console.log('[Stream] ICE candidate:', data.candidate.candidate);
        if (peerConnectionRef.current && data.candidate) {
          try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
            console.log('[Stream] ICE candidate added successfully');
          } catch (err) {
            console.error('[Stream] Error adding ICE candidate:', err);
          }
        } else {
          console.warn('[Stream] Cannot add ICE candidate: PeerConnection or candidate not available');
        }
      });

      // ユーザーが退出したとき
      socket.on('user-left', (data: { socketId: string }) => {
        console.log('[Stream] User left:', data.socketId);
        // 退出前の接続状態を確認（remoteStreamRefとisWebRTCConnectedの両方を確認）
        const wasConnected = remoteStreamRef.current !== null || isWebRTCConnected;
        console.log('[Stream] Was connected before leaving:', wasConnected);
        console.log('[Stream] remoteStreamRef.current:', remoteStreamRef.current);
        console.log('[Stream] isWebRTCConnected:', isWebRTCConnected);
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }
        setIsWebRTCConnected(false);
        setRemoteStream(null);
        remoteStreamRef.current = null;
        setConnectedUserCount(prev => {
          const newCount = Math.max(1, prev - 1);
          console.log('[Stream] Connected user count:', newCount);
          return newCount;
        });
        // 退出通知を表示（WebRTC接続が確立されていた場合のみ）
        if (wasConnected) {
          console.log('[Stream] Showing user left notification');
          setShowUserLeftNotification(true);
          // 5秒後に自動的に非表示
          setTimeout(() => {
            setShowUserLeftNotification(false);
          }, 5000);
        } else {
          console.log('[Stream] Not showing notification - was not connected');
        }
      });

      return () => {
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
        }
        socket.disconnect();
      };
    }
  }, [stream]);

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

  // 旧仕様の「録画開始でランダム相槌を流す」タイマーは廃止し、
  // 相槌のトリガーは音声認識の finalText に一本化した。

  // Auto-scroll to bottom when new comments are added
  useEffect(() => {
    if (isAutoScroll && commentsContainerRef.current) {
      commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight;
    }
  }, [comments, isAutoScroll]);

  // リモートストリームをビデオ要素に設定
  useEffect(() => {
    remoteStreamRef.current = remoteStream; // refを更新
    if (remoteStream && remoteVideoRef.current) {
      console.log('[Stream] Setting remote stream to video element');
      // 既存のストリームをクリア
      if (remoteVideoRef.current.srcObject) {
        const oldStream = remoteVideoRef.current.srcObject as MediaStream;
        oldStream.getTracks().forEach(track => track.stop());
      }
      
      remoteVideoRef.current.srcObject = remoteStream;
      
      // ビデオ要素のイベントを監視
      remoteVideoRef.current.onloadedmetadata = () => {
        console.log('[Stream] Remote video metadata loaded');
        console.log('[Stream] Remote video dimensions:', remoteVideoRef.current?.videoWidth, 'x', remoteVideoRef.current?.videoHeight);
      };
      remoteVideoRef.current.oncanplay = () => {
        console.log('[Stream] Remote video can play');
      };
      remoteVideoRef.current.onplay = () => {
        console.log('[Stream] Remote video started playing');
      };
      remoteVideoRef.current.onerror = (e) => {
        console.error('[Stream] Remote video error:', e);
      };
      
      // ビデオを再生
      remoteVideoRef.current.play().then(() => {
        console.log('[Stream] Remote video play() succeeded');
      }).catch(err => {
        console.error('[Stream] Remote video play() failed:', err);
      });
    }
  }, [remoteStream]);

  // useMediaStream連携: record-testのvideoRef制御を本番UIにも流用し、streamの状態でプレビューを同期
  useEffect(() => {
    if (!videoRef.current) return;
    if (stream) {
      videoRef.current.srcObject = stream;
      console.log('[Stream] Stream updated, tracks:', stream.getTracks());
      // カメラが起動したら、既存のPeerConnectionがあればローカルストリームを更新
      if (peerConnectionRef.current) {
        console.log('[Stream] Updating PeerConnection with new stream');
        // 既存のトラックを新しいトラックで置き換える
        const senders = peerConnectionRef.current.getSenders();
        const tracks = stream.getTracks();
        
        senders.forEach((sender, index) => {
          if (sender.track && tracks[index]) {
            // 同じ種類のトラックを置き換え
            if (sender.track.kind === tracks[index].kind) {
              console.log('[Stream] Replacing track:', tracks[index].kind, tracks[index].id);
              sender.replaceTrack(tracks[index]).catch(err => {
                console.error('[Stream] Error replacing track:', err);
              });
            }
          } else if (tracks[index]) {
            // 新しいトラックを追加
            console.log('[Stream] Adding new track:', tracks[index].kind, tracks[index].id);
            peerConnectionRef.current?.addTrack(tracks[index], stream);
          }
        });
        
        // 新しいトラックが既存のsenderより多い場合、残りを追加
        if (tracks.length > senders.length) {
          tracks.slice(senders.length).forEach((track) => {
            console.log('[Stream] Adding additional track:', track.kind, track.id);
            peerConnectionRef.current?.addTrack(track, stream);
          });
        }
      }
    } else {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  const addComment = (
    text: string, 
    special: boolean = false, 
    isUserComment: boolean = false, 
    stampSrc?: string,
    role?: 'assistant' | 'user',
    type?: 'gpt' | 'aizuchi'
  ) => {
    const comment: Comment = {
      id: Date.now().toString() + Math.random(),
      text,
      special,
      timestamp: Date.now(),
      userName: isUserComment ? '視聴者' : 'Bot',
      isUserComment,
      stampSrc,
      role: role || (isUserComment ? 'user' : 'assistant'),
      type
    };
    
    setComments(prev => {
      // Keep only last 100 comments for performance
      const newComments = [...prev, comment].slice(-100);
      return newComments;
    });
  };

  // ローカル相槌を1つランダムに返す（GPT は現段階では未使用）
  const getRandomAizuchi = useCallback(() => {
    if (!localAizuchi.length) return 'うん';
    return localAizuchi[Math.floor(Math.random() * localAizuchi.length)];
  }, [localAizuchi]);

  // 無音検知でflushBuffer()を呼ぶ
  const flushBuffer = useCallback(async () => {
    const text = bufferRef.current.trim();
    if (!text) {
      return;
    }

    // バッファをクリア
    bufferRef.current = '';

    // 20文字未満の場合はGPTを使わず相槌にする
    if (text.length < 20) {
      const now = Date.now();
      const timeSinceLastAizuchi = now - lastAizuchiTimeRef.current;
      const cooldownTime = 3000 + Math.random() * 2000;

      if (timeSinceLastAizuchi >= cooldownTime) {
        lastAizuchiTimeRef.current = now;
        addComment(getRandomAizuchi(), false, false, undefined, 'assistant', 'aizuchi');
      }
      return;
    }

    // 相槌 85% / GPT 15% を抽選
    const shouldUseGpt = Math.random() < 0.15;

    // GPTは lastGptAt から30秒以内なら相槌にフォールバック
    const now = Date.now();
    const timeSinceLastGpt = now - lastGptAt.current;
    const gptCooldown = 30000; // 30秒

    if (shouldUseGpt && timeSinceLastGpt >= gptCooldown) {
      // GPT呼び出し
      try {
        lastGptAt.current = now;
        const response = await fetch('/api/ai-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roomId: roomId,
            userText: text,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.replyText) {
            addComment(data.replyText, false, false, undefined, 'assistant', 'gpt');
            return;
          }
        }
        // エラー時は相槌にフォールバック
        console.error('GPT API error:', response.status);
      } catch (error) {
        console.error('GPT API error:', error);
        // エラー時は相槌にフォールバック
      }
    }

    // 相槌を返す（GPTを使わない場合、またはGPTエラー時）
    const timeSinceLastAizuchi = now - lastAizuchiTimeRef.current;
    const cooldownTime = 3000 + Math.random() * 2000;

    if (timeSinceLastAizuchi >= cooldownTime) {
      lastAizuchiTimeRef.current = now;
      addComment(getRandomAizuchi(), false, false, undefined, 'assistant', 'aizuchi');
    }
  }, [roomId, addComment, getRandomAizuchi]);

  // 音声認識イベントを受けてtranscriptをbufferRefに蓄積
  const handleRecognitionEvent = useCallback((transcript: string) => {
    // transcriptをバッファに追加
    if (transcript.trim()) {
      bufferRef.current += (bufferRef.current ? ' ' : '') + transcript.trim();
    }

    // 無音タイマーをリセット
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    // 1000ms後にflushBuffer()を呼ぶ
    silenceTimerRef.current = setTimeout(() => {
      flushBuffer();
    }, 1000);
  }, [flushBuffer]);

  const {
    error: speechError,
    startRecognition,
    stopRecognition,
  } = useSpeechRecognition(handleRecognitionEvent);

  const ensureRecognitionStarted = useCallback(() => {
    if (isRecognitionActiveRef.current) return;
    startRecognition();
    isRecognitionActiveRef.current = true;
    lastAizuchiTimeRef.current = Date.now();
  }, [startRecognition]);

  const ensureRecognitionStopped = useCallback(() => {
    if (!isRecognitionActiveRef.current) return;
    stopRecognition();
    isRecognitionActiveRef.current = false;
  }, [stopRecognition]);

  useEffect(() => {
    if (mediaError) {
      setError(mediaError);
      return;
    }
    if (recorderError) {
      setError(recorderError);
      return;
    }
    if (speechError) {
      setError(speechError);
    }
  }, [mediaError, recorderError, speechError]);

  useEffect(() => {
    return () => {
      ensureRecognitionStopped();
      // 無音タイマーをクリア
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      // ページを離れる時にルームIDを削除
      if (roomId && isStreaming) {
        fetch('/api/rooms/unregister', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ roomId }),
        }).catch(err => {
          console.error('Room unregistration error on cleanup:', err);
        });
      }
    };
  }, [ensureRecognitionStopped, roomId, isStreaming]);

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


  const handleStartStream = async () => {
    try {
      setError(null);
      await startCamera();
      ensureRecognitionStarted();
      // 配信開始と同時に録画も開始する（useRecorder が WebM 保存と60分自動停止を担当）
      startRecording();
      
      // ルームIDは既にページマウント時に登録されているので、ここでは登録しない
      
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

  const confirmEndStream = async () => {
    try {
      setIsStreaming(false);
      setShowConfirmEnd(false);
      ensureRecognitionStopped();
       // 配信終了時に録画も確実に停止（停止時に WebM が自動ダウンロードされる）
      stopRecording();
      stopCamera();
      
      // ルームIDをサーバーから削除
      if (roomId) {
        try {
          const response = await fetch('/api/rooms/unregister', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ roomId }),
          });
          if (!response.ok) {
            console.error('Failed to unregister room ID');
          }
        } catch (err) {
          console.error('Room unregistration error:', err);
        }
      }
      
      router.push('/login');
    } catch (err) {
      setError('配信の終了に失敗しました。');
      console.error('Stream end error:', err);
    }
  };

  const handleToggleRecording = () => {
    try {
      setError(null);
      // フッターの「録画開始/停止」ボタンは useRecorder を直接トグル
      if (!isRecording) {
        const started = startRecording();
        if (started) {
          ensureRecognitionStarted();
        }
      } else {
        stopRecording();
        ensureRecognitionStopped();
      }
    } catch (err) {
      setError('録画の切り替えに失敗しました。');
      console.error('Recording toggle error:', err);
    }
  };

  const backgroundOptions: BackgroundOption[] = [
    { id: 'tsubucafe1', name: 'つぶカフェ', gradient: 'from-orange-800 to-amber-600' },
    { id: 'tsubucafe2', name: 'つぶカフェ２', gradient: 'from-orange-800 to-amber-600' },
    { id: 'tsubucafe3', name: 'つぶカフェ３', gradient: 'from-orange-800 to-amber-600' },
    { id: 'tsubucafe4', name: 'つぶカフェ４', gradient: 'from-orange-800 to-amber-600' },
    { id: 'tsubucafe5', name: 'つぶカフェ５', gradient: 'from-orange-800 to-amber-600' },
    { id: 'tsubucafe6', name: 'つぶカフェ６', gradient: 'from-orange-800 to-amber-600' },
    { id: 'tsubucafe7', name: 'つぶカフェ７', gradient: 'from-orange-800 to-amber-600' },
    { id: 'tsubucafe8', name: 'つぶカフェ８', gradient: 'from-orange-800 to-amber-600' },
    { id: 'tsubucafe9', name: 'つぶカフェ９', gradient: 'from-orange-800 to-amber-600' },
    { id: 'tsubucafe10', name: 'つぶカフェ１０', gradient: 'from-orange-800 to-amber-600' },
    { id: 'tsubucafe11', name: 'つぶカフェ１１', gradient: 'from-orange-800 to-amber-600' },
    { id: 'tsubucafe12', name: 'つぶカフェ１２', gradient: 'from-orange-800 to-amber-600' }
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

  // WebRTC PeerConnectionを作成
  const createPeerConnection = (localStream: MediaStream) => {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    const peerConnection = new RTCPeerConnection(configuration);
    peerConnectionRef.current = peerConnection;

    // ローカルストリームのトラックを追加
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    // リモートストリームの処理
    peerConnection.ontrack = (event) => {
      console.log('[Stream] ===== Remote track received =====');
      console.log('[Stream] Event:', event);
      console.log('[Stream] Remote streams:', event.streams);
      console.log('[Stream] Remote track:', event.track);
      console.log('[Stream] Track kind:', event.track.kind);
      console.log('[Stream] Track enabled:', event.track.enabled);
      console.log('[Stream] Track readyState:', event.track.readyState);
      
      if (event.streams && event.streams.length > 0) {
        const newRemoteStream = event.streams[0];
        console.log('[Stream] Remote stream ID:', newRemoteStream.id);
        console.log('[Stream] Remote stream tracks:', newRemoteStream.getTracks());
        console.log('[Stream] Remote stream active:', newRemoteStream.active);
        
        // 状態を更新して再レンダリングを促す
        setRemoteStream(newRemoteStream);
        setIsWebRTCConnected(true);
        console.log('[Stream] Remote stream state updated, will be set to video element in useEffect');
        console.log('[Stream] Remote stream state updated');
      } else {
        console.warn('[Stream] No streams in track event');
      }
    };

    // ICE candidate の処理
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[Stream] ICE candidate generated:', event.candidate.candidate);
        if (socketRef.current && remoteSocketIdRef.current) {
          socketRef.current.emit('ice-candidate', {
            candidate: event.candidate.toJSON(),
            socketId: socketRef.current.id,
            targetSocketId: remoteSocketIdRef.current,
          });
          console.log('[Stream] ICE candidate sent to:', remoteSocketIdRef.current);
        } else {
          console.warn('[Stream] Cannot send ICE candidate: socket or remoteSocketId not available');
        }
      } else {
        console.log('[Stream] ICE candidate gathering completed');
      }
    };

    // 接続状態の監視
    peerConnection.onconnectionstatechange = () => {
      console.log('[Stream] ===== Connection state changed =====');
      console.log('[Stream] Connection state:', peerConnection.connectionState);
      console.log('[Stream] Ice connection state:', peerConnection.iceConnectionState);
      console.log('[Stream] Ice gathering state:', peerConnection.iceGatheringState);
      console.log('[Stream] Signaling state:', peerConnection.signalingState);
      
      if (peerConnection.connectionState === 'connected') {
        setIsWebRTCConnected(true);
        console.log('[Stream] WebRTC connection established!');
      } else if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
        setIsWebRTCConnected(false);
        console.log('[Stream] WebRTC connection lost');
      }
    };

    // ICE接続状態の監視
    peerConnection.oniceconnectionstatechange = () => {
      console.log('[Stream] ICE connection state:', peerConnection.iceConnectionState);
      if (peerConnection.iceConnectionState === 'connected' || peerConnection.iceConnectionState === 'completed') {
        console.log('[Stream] ICE connection established!');
      } else if (peerConnection.iceConnectionState === 'failed') {
        console.error('[Stream] ICE connection failed');
      }
    };
  };

  // WebRTC接続を開始
  const handleStartWebRTC = () => {
    if (!socketRef.current) {
      setError('Socket接続が確立されていません');
      return;
    }

    if (!stream) {
      setError('カメラが起動されていません');
      return;
    }

    console.log('[Stream] Starting WebRTC connection, stream tracks:', stream.getTracks());

    // PeerConnection を作成（まだ作成されていない場合）
    if (!peerConnectionRef.current) {
      console.log('[Stream] Creating new PeerConnection');
      createPeerConnection(stream);
    } else {
      console.log('[Stream] PeerConnection already exists');
    }

    // シグナリングサーバーに参加を通知
    console.log('[Stream] Emitting join event');
    socketRef.current.emit('join');
  };

  const handleApproveJoinRequest = () => {
    if (socketRef.current && joinRequestData) {
      socketRef.current.emit('approve-join-request', {
        roomId: joinRequestData.roomId,
        requesterSocketId: joinRequestData.requesterSocketId,
      });
      setShowJoinRequest(false);
      setJoinRequestData(null);
    }
  };

  const handleDenyJoinRequest = () => {
    if (socketRef.current && joinRequestData) {
      socketRef.current.emit('deny-join-request', {
        roomId: joinRequestData.roomId,
        requesterSocketId: joinRequestData.requesterSocketId,
      });
      setShowJoinRequest(false);
      setJoinRequestData(null);
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
          {roomId && (
            <div className="text-gray-900">
              <span className="text-sm text-gray-600">ルームID: </span>
              <span className="font-mono text-lg font-semibold">{roomId}</span>
            </div>
          )}
          <div className="text-gray-900">
            <span className="text-sm text-gray-600">経過時間: </span>
            <span className="font-mono text-lg">{formatTime(streamTime)}</span>
          </div>
          <div className="text-gray-900">
            <span className="text-sm text-gray-600">沈黙: </span>
            <span className="font-mono">{silenceTime}秒</span>
          </div>
          <div className="text-gray-900">
            <span className="text-sm text-gray-600">録画: </span>
            <span className="font-mono text-sm">
              {isRecording ? (
                <span className="inline-flex items-center gap-1 text-red-600">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                  REC {formatTime(recordingTime)}
                </span>
              ) : (
                '停止中'
              )}
            </span>
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
          {backgroundImage.startsWith('tsubucafe') ? (() => {
            // IDから番号を抽出（例: tsubucafe2 → 2）
            const match = backgroundImage.match(/tsubucafe(\d+)/);
            const number = match ? parseInt(match[1], 10) : 1;
            // つぶカフェ１０は background (11).jpg になるように調整
            const imageNumber = number === 10 ? 11 : number;
            // URLエンコード: スペース %20, 括弧 ( %28, ) %29
            const encodedFilename = `background%20%28${imageNumber}%29.jpg`;
            return (
              <div 
                className="absolute inset-0 bg-center bg-no-repeat"
                style={{
                  backgroundImage: `url(/backgrounds/${encodedFilename})`,
                  backgroundSize: 'auto 100%',
                }}
              >
                <div className="absolute inset-0 bg-white/30" />
              </div>
            );
          })() : (
            <div className={`absolute inset-0 bg-gradient-to-br ${currentBg.gradient}`}>
              <div className="absolute inset-0 bg-white/50" />
            </div>
          )}
        </div>

        {/* Comments Panel - YouTube Live style (2人以上で非表示) */}
        {connectedUserCount < 2 && (
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
                      : comment.type === 'gpt'
                      ? 'bg-purple-600 bg-opacity-20 border-l-2 border-purple-400'
                      : 'bg-gray-600 bg-opacity-20'
                  }`}>
                    <div className="flex items-start gap-2">
                      <span className={`text-xs font-medium ${
                        comment.isUserComment ? 'text-blue-300' : comment.type === 'gpt' ? 'text-purple-300' : 'text-gray-300'
                      }`}>
                        {comment.userName}
                        {comment.type === 'gpt' && (
                          <span className="ml-1 text-[10px] bg-purple-500 px-1 rounded">GPT</span>
                        )}
                        {comment.type === 'aizuchi' && (
                          <span className="ml-1 text-[10px] bg-gray-500 px-1 rounded">相槌</span>
                        )}
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
                          : comment.type === 'gpt'
                          ? 'text-purple-200'
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
        )}

        {/* Center Message */}
        {!isStreaming && connectedUserCount < 2 && (
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

        {/* useMediaStreamプレビュー: カメラ起動時のみ表示 */}
        {permissionGranted && (
          <div className="absolute left-4 bottom-4 w-full max-w-md pointer-events-none">
            <div className="bg-black/70 rounded-xl p-4 shadow-xl border border-white/10 pointer-events-auto">
              <div className="flex items-center justify-between mb-3 text-white text-sm">
                <span>自分のカメラ</span>
                <span className="text-green-300">起動中</span>
              </div>
              <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        )}

        {/* リモートビデオ: WebRTC接続時のみ表示 */}
        {remoteStream && (
          <div className="absolute right-4 bottom-4 w-full max-w-md pointer-events-none">
            <div className="bg-black/70 rounded-xl p-4 shadow-xl border border-white/10 pointer-events-auto">
              <div className="flex items-center justify-between mb-3 text-white text-sm">
                <span>相手のカメラ</span>
                <span className="text-green-300">接続中</span>
              </div>
              <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  muted={false}
                  className="w-full h-full object-cover"
                  onLoadedMetadata={() => {
                    console.log('[Stream] Remote video metadata loaded in UI');
                  }}
                  onCanPlay={() => {
                    console.log('[Stream] Remote video can play in UI');
                  }}
                  onPlay={() => {
                    console.log('[Stream] Remote video playing in UI');
                  }}
                  onError={(e) => {
                    console.error('[Stream] Remote video error in UI:', e);
                  }}
                />
              </div>
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

          <button
            onClick={permissionGranted ? stopCamera : startCamera}
            disabled={isCameraLoading}
            className={`px-4 py-2 rounded-lg transition ${
              permissionGranted
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            } ${isCameraLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {permissionGranted ? '📷 カメラ停止' : isCameraLoading ? '起動中...' : '📷 カメラ起動'}
          </button>

          {permissionGranted && !isWebRTCConnected && (
            <button
              onClick={handleStartWebRTC}
              className="px-4 py-2 rounded-lg transition bg-purple-600 hover:bg-purple-700 text-white"
            >
              📹 ビデオ通話開始
            </button>
          )}
          
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

      {/* User Left Notification */}
      {showUserLeftNotification && (
        <div className="fixed top-4 right-4 bg-yellow-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span className="font-medium">相手のユーザーが退出しました</span>
          </div>
        </div>
      )}

      {/* Join Request Dialog */}
      {showJoinRequest && joinRequestData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">入室リクエスト</h3>
            <p className="text-gray-600 mb-4">
              ルームID: <span className="font-mono">{joinRequestData.roomId}</span>
              <br />
              ユーザーが入室を希望しています。入室を許可しますか？
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleDenyJoinRequest}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition"
              >
                拒否
              </button>
              <button
                onClick={handleApproveJoinRequest}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition"
              >
                許可
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