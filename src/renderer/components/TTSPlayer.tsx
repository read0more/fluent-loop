import React, { useState, useRef, useEffect } from 'react';
import styles from './TTSPlayer.module.scss';

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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // FR-004: autoPlay 중복 실행 방지
  const hasAutoPlayedRef = useRef<boolean>(false);

  // TTS 음성 생성 후 자동 재생
  const synthesizeSpeech = async () => {
    setState('loading');
    setError(null);

    try {
      const response = await window.electron.invoke('synthesize-tts', text, voiceId);

      if (response.success && response.data && response.data.filePath) {
        // file:// 프로토콜로 로컬 파일 경로 설정
        const fileUrl = `file://${response.data.filePath}`;
        setAudioSrc(fileUrl);
        // 음성 생성 완료 후 바로 재생
        setState('idle');
        return fileUrl;
      } else {
        setState('error');
        setError(response.error || '음성 생성에 실패했습니다.');
        return null;
      }
    } catch (err) {
      setState('error');
      setError('음성 생성 중 오류가 발생했습니다.');
      return null;
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
        .catch(() => {
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

  // 오디오 정지 (처음으로 되돌림)
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setState('idle');
      setCurrentTime(0);
    }
  };

  // 슬라이더로 시간 이동
  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // 재생 버튼 클릭 - 음성 생성 후 자동 재생
  const handlePlayClick = async () => {
    // FR-004: 중복 재생 방지 - 이미 로딩 중이거나 재생 중이면 무시
    if (state === 'loading' || state === 'playing') {
      return;
    }

    if (!audioSrc) {
      // 아직 TTS를 생성하지 않은 경우 - 생성 후 자동 재생
      const fileUrl = await synthesizeSpeech();
      if (fileUrl) {
        // audioSrc 설정 후 약간의 딜레이를 두고 재생
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.load();
            audioRef.current
              .play()
              .then(() => {
                setState('playing');
                if (onPlaybackStart) {
                  onPlaybackStart();
                }
              })
              .catch(() => {
                setState('error');
                setError('오디오 재생에 실패했습니다.');
              });
          }
        }, 100);
      }
    } else {
      // 이미 생성된 경우 바로 재생
      playAudio();
    }
  };

  // 오디오 이벤트 핸들러
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleAudioEnded = () => {
    setState('idle');
    setCurrentTime(0);
    if (onPlaybackEnd) {
      onPlaybackEnd();
    }
  };

  const handleAudioError = () => {
    setState('error');
    setError('오디오 파일을 재생할 수 없습니다.');
  };

  // 시간 포맷팅 (mm:ss)
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // FR-005: 컴포넌트 언마운트 시 정리 (페이지 이동 시 오디오 자동 정지)
  useEffect(() => {
    return () => {
      try {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
        }
      } catch (err) {
        console.error('Audio cleanup failed:', err);
      }
    };
  }, []);

  // FR-004: autoPlay가 true면 마운트 시 자동으로 TTS 생성 및 재생 (중복 방지)
  useEffect(() => {
    if (autoPlay && !audioSrc && !hasAutoPlayedRef.current) {
      hasAutoPlayedRef.current = true;
      handlePlayClick();
    }
  }, [autoPlay, audioSrc]);

  return (
    <div className={styles.player}>
      {/* Hidden audio element */}
      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleAudioEnded}
          onError={handleAudioError}
        />
      )}

      {/* Controls */}
      <div className={styles.controls}>
        {state === 'loading' ? (
          <div className={styles.loading}>음성 생성 중...</div>
        ) : state === 'error' ? (
          <div className={styles.error}>
            <p>{error}</p>
            <button onClick={() => setState('idle')} className={styles.btnRetry}>
              재시도
            </button>
          </div>
        ) : (
          <div className={styles.audioPlayer}>
            <div className={styles.audioControls}>
              {/* Play/Pause/Stop Buttons */}
              <div className={styles.controlButtons}>
                {state === 'playing' ? (
                  <button onClick={pauseAudio} className={styles.btnPause}>
                    ⏸
                  </button>
                ) : (
                  <button
                    onClick={handlePlayClick}
                    className={styles.btnPlay}
                  >
                    ▶
                  </button>
                )}
                <button onClick={stopAudio} className={styles.btnStop} disabled={!audioSrc}>
                  ⏹
                </button>
              </div>

              {/* Progress Slider */}
              <div className={styles.progressContainer}>
                <span className={styles.timeDisplay}>{formatTime(currentTime)}</span>
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={(e) => seekTo(parseFloat(e.target.value))}
                  className={styles.progressSlider}
                  disabled={!audioSrc}
                />
                <span className={styles.timeDisplay}>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Text display */}
      <div className={styles.text}>{text}</div>
    </div>
  );
};
