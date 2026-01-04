import React, { useState, useEffect } from 'react';
import { TTSPlayer } from '../components/TTSPlayer';
import { RecordingList } from '../components/RecordingList';
import { AudioPlayer } from '../components/AudioPlayer';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Topic } from '../../main/database/models';

type Step = 'loading' | 'no-topic' | 'ready' | 'recording' | 'playing-recording';

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
    } catch (err) {
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
      const response = await window.electron.invoke('start-recording-step2');

      if (response.success) {
        setIsRecording(true);
        setRecordingTime(0);

        // 60초 타이머 시작
        const interval = setInterval(() => {
          setRecordingTime((prev) => {
            const newTime = prev + 1;
            if (newTime >= 60) {
              stopRecording();
              clearInterval(interval);
              return 60;
            }
            return newTime;
          });
        }, 1000);
      } else {
        alert(response.error || '녹음 시작에 실패했습니다.');
      }
    } catch (err) {
      alert('녹음 시작 중 오류가 발생했습니다.');
    }
  };

  // 녹음 중지
  const stopRecording = async () => {
    try {
      // MediaRecorder로부터 오디오 데이터 가져오기
      // 실제로는 VoiceRecorder 컴포넌트처럼 MediaRecorder를 사용해야 하지만
      // 여기서는 단순화를 위해 IPC만 호출
      const response = await window.electron.invoke('stop-recording-step2');

      if (response.success) {
        setIsRecording(false);
        setRecordingTime(0);
        // 녹음 목록 새로고침은 RecordingList 컴포넌트에서 처리
      } else {
        alert(response.error || '녹음 저장에 실패했습니다.');
      }
    } catch (err) {
      alert('녹음 저장 중 오류가 발생했습니다.');
    } finally {
      setIsRecording(false);
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

  return (
    <div className="listening-page">
      <h1>단계 2: 듣기 연습</h1>

      {/* 로딩 중 */}
      {state.step === 'loading' && (
        <LoadingSpinner message="토픽을 불러오는 중..." fullScreen={false} />
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
              <h2>{state.topic.title}</h2>
              <div className="topic-level">CEFR Level: {state.topic.cefrLevel}</div>
            </div>

            {/* TTS 플레이어 */}
            <div className="tts-section">
              <h3>영어 텍스트 듣기</h3>
              <TTSPlayer text={state.topic.englishContent} autoPlay={false} />
            </div>

            {/* 녹음 섹션 */}
            <div className="recording-section">
              <h3>듣고 따라 말하기 (60초)</h3>

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
                  playbackRate={1.0}
                />
              </div>
            )}
          </div>
        )}
    </div>
  );
};
