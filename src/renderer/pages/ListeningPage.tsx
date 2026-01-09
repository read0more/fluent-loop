import React, { useState, useEffect, useRef } from 'react';
import { TTSPlayer } from '../components/TTSPlayer';
import { RecordingList } from '../components/RecordingList';
import { AudioPlayer } from '../components/AudioPlayer';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Topic } from '../../main/database/models';

type Step = 'loading' | 'no-topic' | 'ready' | 'recording' | 'processing' | 'playing-recording';

interface ListeningPageState {
  step: Step;
  topic: Topic | null;
  selectedRecording: string | null;
  error: string | null;
}

export const ListeningPage: React.FC = () => {
  const [state, setState] = useState<ListeningPageState>({
    step: 'loading',
    topic: null,
    selectedRecording: null,
    error: null,
  });

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingListKey, setRecordingListKey] = useState(0);

  // 제목 편집 상태
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 활성 토픽 로드
  const loadActiveTopic = async () => {
    setState((prev) => ({ ...prev, step: 'loading', error: null }));

    try {
      const response = await window.electron.invoke('get-active-topic');

      if (response.success && response.data) {
        setState({
          step: 'ready',
          topic: response.data,
          selectedRecording: null,
          error: null,
        });
      } else {
        setState({
          step: 'no-topic',
          topic: null,
          selectedRecording: null,
          error: '활성 토픽이 없습니다. 먼저 토픽을 생성해주세요.',
        });
      }
    } catch {
      setState((prev) => ({
        ...prev,
        step: 'no-topic',
        error: '토픽을 불러오는 중 오류가 발생했습니다.',
      }));
    }
  };

  // 녹음 시작
  const startRecording = async () => {
    try {
      // 마이크 권한 요청
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setState((prev) => ({ ...prev, step: 'processing' }));

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp4' });
          const buffer = await audioBlob.arrayBuffer();

          // IPC를 통해 Main Process에 전송
          const response = await window.electron.invoke('stop-recording-step2', new Uint8Array(buffer));

          if (response.success && response.data) {
            setIsRecording(false);
            setRecordingTime(0);
            // 녹음 목록 새로고침
            setRecordingListKey((prev) => prev + 1);
            setState((prev) => ({ ...prev, step: 'ready' }));
          } else {
            setState((prev) => ({
              ...prev,
              step: 'ready',
              error: response.error || '녹음 저장에 실패했습니다.',
            }));
          }
        } catch {
          setState((prev) => ({
            ...prev,
            step: 'ready',
            error: '녹음 처리 중 오류가 발생했습니다.',
          }));
        } finally {
          setIsRecording(false);
          // 스트림 정리
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
        }
      };

      // IPC에 녹음 시작 알림
      const response = await window.electron.invoke('start-recording-step2');

      if (!response.success) {
        stream.getTracks().forEach((track) => track.stop());
        setState((prev) => ({
          ...prev,
          error: response.error || '녹음 시작에 실패했습니다.',
        }));
        return;
      }

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      setState((prev) => ({ ...prev, step: 'recording', error: null }));

      // 타이머 시작
      const intervalId = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (newTime >= 60) {
            stopRecording();
            return 60;
          }
          return newTime;
        });
      }, 1000);

      timerRef.current = intervalId;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setState((prev) => ({
            ...prev,
            error: '마이크 권한이 필요합니다. 설정에서 권한을 허용해주세요.',
          }));
        } else if (error.name === 'NotFoundError') {
          setState((prev) => ({
            ...prev,
            error: '마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.',
          }));
        } else {
          setState((prev) => ({
            ...prev,
            error: '녹음 시작에 실패했습니다.',
          }));
        }
      }
    }
  };

  // 녹음 중지
  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // 녹음 파일 선택
  const handleRecordingSelect = (filePath: string) => {
    setState((prev) => ({
      ...prev,
      selectedRecording: filePath,
      step: 'playing-recording',
    }));
  };

  // 녹음 파일 삭제 후 처리
  const handleRecordingDelete = (filePath: string) => {
    if (state.selectedRecording === filePath) {
      setState((prev) => ({
        ...prev,
        selectedRecording: null,
        step: 'ready',
      }));
    }
  };

  // 시간 포맷팅
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 컴포넌트 마운트 시 활성 토픽 로드
  useEffect(() => {
    loadActiveTopic();
  }, []);

  // topic이 변경되면 editedTitle 동기화
  useEffect(() => {
    if (state.topic) {
      setEditedTitle(state.topic.title);
    }
  }, [state.topic]);

  // 제목 저장
  const handleTitleSave = async () => {
    if (!state.topic || editedTitle === state.topic.title) {
      setIsTitleEditing(false);
      return;
    }

    setIsSavingTitle(true);
    try {
      const response = await window.electron.invoke('update-topic-title', {
        topicId: state.topic.id,
        title: editedTitle,
      });

      if (response.success) {
        // 로컬 상태 업데이트
        setState((prev) => ({
          ...prev,
          topic: prev.topic ? { ...prev.topic, title: editedTitle } : null,
        }));
      } else {
        // 실패 시 원래 제목으로 복원
        setEditedTitle(state.topic.title);
        setState((prev) => ({
          ...prev,
          error: response.error || '제목 저장에 실패했습니다.',
        }));
      }
    } catch {
      setEditedTitle(state.topic.title);
      setState((prev) => ({
        ...prev,
        error: '제목 저장 중 오류가 발생했습니다.',
      }));
    } finally {
      setIsSavingTitle(false);
      setIsTitleEditing(false);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    }
    if (e.key === 'Escape') {
      setEditedTitle(state.topic?.title || '');
      setIsTitleEditing(false);
    }
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="listening-page">
      <h1>단계 2: 듣기 연습</h1>

      {/* 에러 메시지 */}
      {state.error && state.step !== 'no-topic' && (
        <div className="error-message">
          <p>{state.error}</p>
          <button onClick={() => setState((prev) => ({ ...prev, error: null }))} className="btn-dismiss">
            닫기
          </button>
        </div>
      )}

      {/* 로딩 중 */}
      {state.step === 'loading' && (
        <LoadingSpinner message="토픽을 불러오는 중..." fullScreen={false} />
      )}

      {/* 처리 중 */}
      {state.step === 'processing' && (
        <LoadingSpinner message="녹음 저장 중..." fullScreen={false} />
      )}

      {/* 토픽 없음 */}
      {state.step === 'no-topic' && (
        <div className="no-topic-message">
          <p>{state.error}</p>
          <button onClick={loadActiveTopic} className="btn-retry">
            다시 시도
          </button>
        </div>
      )}

      {/* 메인 콘텐츠 */}
      {(state.step === 'ready' || state.step === 'recording' || state.step === 'playing-recording') &&
        state.topic && (
          <div className="listening-content">
            {/* 토픽 정보 */}
            <div className="topic-info">
              {isTitleEditing ? (
                <div className="title-edit-container">
                  <input
                    type="text"
                    className="title-input"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={handleTitleKeyDown}
                    autoFocus
                    maxLength={100}
                    disabled={isSavingTitle}
                  />
                  {isSavingTitle && <span className="saving-indicator">저장 중...</span>}
                </div>
              ) : (
                <div className="title-display">
                  <h2>{state.topic.title}</h2>
                  <button
                    className="btn-edit-title"
                    onClick={() => setIsTitleEditing(true)}
                    title="제목 편집"
                  >
                    ✏️
                  </button>
                </div>
              )}
              <div className="topic-level">CEFR Level: {state.topic.cefrLevel}</div>
            </div>

            {/* TTS 플레이어 */}
            <div className="tts-section">
              <h3>영어 텍스트 듣기</h3>
              <TTSPlayer text={state.topic.englishContent} autoPlay={false} />
            </div>

            {/* 녹음 섹션 */}
            <div className="recording-section">
              <h3>듣고 따라 말하기</h3>

              {!isRecording ? (
                <button onClick={startRecording} className="btn-record-start">
                  녹음 시작
                </button>
              ) : (
                <div className="recording-active">
                  <div className="recording-timer">{formatTime(recordingTime)} / 1:00</div>
                  <button onClick={stopRecording} className="btn-record-stop">
                    녹음 중지
                  </button>
                  <div className="recording-indicator">
                    <span className="pulse"></span>
                    녹음 중
                  </div>
                </div>
              )}
            </div>

            {/* 녹음 목록 */}
            <RecordingList
              key={recordingListKey}
              step={2}
              onRecordingSelect={handleRecordingSelect}
              onRecordingDelete={handleRecordingDelete}
            />

            {/* 선택된 녹음 재생 */}
            {state.selectedRecording && (
              <div className="playback-section">
                <h3>내 녹음 듣기</h3>
                <AudioPlayer
                  src={`file://${state.selectedRecording}`}
                  showControls={true}
                  showSpeedControl={false}
                />
              </div>
            )}
          </div>
        )}
    </div>
  );
};
