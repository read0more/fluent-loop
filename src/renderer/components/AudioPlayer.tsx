import React, { useState, useRef, useEffect } from 'react';

export interface AudioPlayerProps {
  src: string;
  autoPlay?: boolean;
  showControls?: boolean;
  showSpeedControl?: boolean;
  playbackRate?: number;
  onEnded?: () => void;
  onError?: (error: string) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  autoPlay = false,
  showControls = true,
  showSpeedControl = true,
  playbackRate = 1.0,
  onEnded,
  onError,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(playbackRate);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 재생
  const play = () => {
    if (audioRef.current) {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          if (onError) {
            onError('오디오 재생에 실패했습니다.');
          }
        });
    }
  };

  // 일시정지
  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  // 정지 (처음으로 되돌림)
  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  // 재생 속도 변경
  const changeSpeed = (newSpeed: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
      setSpeed(newSpeed);
    }
  };

  // 슬라이더로 시간 이동
  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
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

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (onEnded) {
      onEnded();
    }
  };

  const handleError = () => {
    if (onError) {
      onError('오디오 파일을 로드할 수 없습니다.');
    }
  };

  // 시간 포맷팅 (mm:ss)
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // autoPlay 처리
  useEffect(() => {
    if (autoPlay && audioRef.current) {
      play();
    }
  }, [autoPlay]);

  // playbackRate prop 변경 처리
  useEffect(() => {
    changeSpeed(playbackRate);
  }, [playbackRate]);

  // src 변경 시 초기화
  useEffect(() => {
    stop();
  }, [src]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  return (
    <div className="audio-player">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={handleError}
      />

      {showControls && (
        <div className="audio-controls">
          {/* Play/Pause Button */}
          <div className="control-buttons">
            {!isPlaying ? (
              <button onClick={play} className="btn-audio-play">
                ▶
              </button>
            ) : (
              <button onClick={pause} className="btn-audio-pause">
                ⏸
              </button>
            )}
            <button onClick={stop} className="btn-audio-stop">
              ⏹
            </button>
          </div>

          {/* Progress Slider */}
          <div className="progress-container">
            <span className="time-display">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={(e) => seekTo(parseFloat(e.target.value))}
              className="progress-slider"
            />
            <span className="time-display">{formatTime(duration)}</span>
          </div>

          {/* Speed Control */}
          {showSpeedControl && (
            <div className="speed-control">
              <label>속도:</label>
              <select
                value={speed}
                onChange={(e) => changeSpeed(parseFloat(e.target.value))}
                className="speed-selector"
              >
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1.0">1.0x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
