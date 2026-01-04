import React, { useState, useRef, useEffect } from 'react';

export interface TTSPlayerProps {
  text: string;
  voiceId?: string;
  autoPlay?: boolean;
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
}

type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export const TTSPlayer: React.FC<TTSPlayerProps> = ({
  text,
  voiceId,
  autoPlay = false,
  onPlaybackStart,
  onPlaybackEnd,
}) => {
  const [state, setState] = useState<PlaybackState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // TTS 음성 생성
  const synthesizeSpeech = async () => {
    setState('loading');
    setError(null);

    try {
      const response = await window.electron.invoke('synthesize-tts', text, voiceId);

      if (response.success && response.data && response.data.filePath) {
        // file:// 프로토콜로 로컬 파일 경로 설정
        const fileUrl = `file://${response.data.filePath}`;
        setAudioSrc(fileUrl);
        setState('idle');

        // 자동 재생이 활성화된 경우 바로 재생
        if (autoPlay) {
          setTimeout(() => playAudio(), 100);
        }
      } else {
        setState('error');
        setError(response.error || '음성 생성에 실패했습니다.');
      }
    } catch (err) {
      setState('error');
      setError('음성 생성 중 오류가 발생했습니다.');
    }
  };

  // 오디오 재생
  const playAudio = () => {
    if (audioRef.current && audioSrc) {
      audioRef.current
        .play()
        .then(() => {
          setState('playing');
          if (onPlaybackStart) {
            onPlaybackStart();
          }
        })
        .catch((err) => {
          setState('error');
          setError('오디오 재생에 실패했습니다.');
        });
    }
  };

  // 오디오 일시정지
  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setState('paused');
    }
  };

  // 오디오 재개
  const resumeAudio = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setState('playing');
    }
  };

  // 재생 버튼 클릭
  const handlePlayClick = async () => {
    if (!audioSrc) {
      // 아직 TTS를 생성하지 않은 경우
      await synthesizeSpeech();
    } else {
      // 이미 생성된 경우 바로 재생
      playAudio();
    }
  };

  // 오디오 이벤트 핸들러
  const handleAudioEnded = () => {
    setState('idle');
    if (onPlaybackEnd) {
      onPlaybackEnd();
    }
  };

  const handleAudioError = () => {
    setState('error');
    setError('오디오 파일을 재생할 수 없습니다.');
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // autoPlay가 true면 마운트 시 자동으로 TTS 생성 및 재생
  useEffect(() => {
    if (autoPlay && !audioSrc) {
      synthesizeSpeech();
    }
  }, [autoPlay]);

  return (
    <div className="tts-player">
      {/* Hidden audio element */}
      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          onEnded={handleAudioEnded}
          onError={handleAudioError}
        />
      )}

      {/* Controls */}
      <div className="tts-controls">
        {state === 'idle' && (
          <button onClick={handlePlayClick} className="btn-play-tts">
            재생
          </button>
        )}

        {state === 'loading' && (
          <div className="tts-loading">음성 생성 중...</div>
        )}

        {state === 'playing' && (
          <button onClick={pauseAudio} className="btn-pause-tts">
            일시정지
          </button>
        )}

        {state === 'paused' && (
          <button onClick={resumeAudio} className="btn-resume-tts">
            재개
          </button>
        )}

        {state === 'error' && (
          <div className="tts-error">
            <p>{error}</p>
            <button onClick={() => setState('idle')} className="btn-retry-tts">
              재시도
            </button>
          </div>
        )}
      </div>

      {/* Text display */}
      <div className="tts-text">{text}</div>
    </div>
  );
};
