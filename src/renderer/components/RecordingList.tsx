import React, { useState, useEffect } from 'react';
import { RecordingFile } from '../../main/database/models';

export interface RecordingListProps {
  step: 1 | 2;
  customPath?: string;
  onRecordingSelect?: (filePath: string) => void;
  onRecordingDelete?: (filePath: string) => void;
}

type LoadingState = 'loading' | 'loaded' | 'error';

export const RecordingList: React.FC<RecordingListProps> = ({
  step,
  customPath,
  onRecordingSelect,
  onRecordingDelete,
}) => {
  const [recordings, setRecordings] = useState<RecordingFile[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [error, setError] = useState<string | null>(null);

  // 녹음 목록 로드
  const loadRecordings = async () => {
    setLoadingState('loading');
    setError(null);

    try {
      const channel = step === 2 ? 'list-recordings-step2' : 'get-step1-recordings';
      const response = await window.electron.invoke(channel, customPath);

      if (response.success && response.data) {
        // m4a 파일만 필터링 후 날짜 역순 정렬 (최신순)
        const sortedRecordings = (response.data as RecordingFile[])
          .filter((rec) => rec.fileName.toLowerCase().endsWith('.m4a'))
          .sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        setRecordings(sortedRecordings);
        setLoadingState('loaded');
      } else {
        setLoadingState('error');
        setError(response.error || '녹음 목록을 불러올 수 없습니다.');
      }
    } catch (err) {
      setLoadingState('error');
      setError('녹음 목록 조회 중 오류가 발생했습니다.');
    }
  };

  // 녹음 파일 삭제
  const handleDelete = async (filePath: string) => {
    if (!confirm('정말로 이 녹음 파일을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await window.electron.invoke('delete-recording', filePath);

      if (response.success) {
        // 목록에서 제거
        setRecordings((prev) => prev.filter((rec) => rec.filePath !== filePath));

        // 콜백 호출
        if (onRecordingDelete) {
          onRecordingDelete(filePath);
        }
      } else {
        alert(response.error || '녹음 파일 삭제에 실패했습니다.');
      }
    } catch (err) {
      alert('녹음 파일 삭제 중 오류가 발생했습니다.');
    }
  };

  // 파일 크기 포맷팅
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // 날짜 포맷팅
  const formatDate = (date: Date): string => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  };

  // 컴포넌트 마운트 시 녹음 목록 로드
  useEffect(() => {
    loadRecordings();
  }, [step, customPath]);

  return (
    <div className="recording-list">
      <div className="recording-list-header">
        <h3>녹음 목록</h3>
        <button onClick={loadRecordings} className="btn-refresh">
          새로고침
        </button>
      </div>

      {loadingState === 'loading' && (
        <div className="recording-loading">녹음 목록을 불러오는 중...</div>
      )}

      {loadingState === 'error' && (
        <div className="recording-error">
          <p>{error}</p>
          <button onClick={loadRecordings} className="btn-retry">
            재시도
          </button>
        </div>
      )}

      {loadingState === 'loaded' && recordings.length === 0 && (
        <div className="recording-empty">녹음된 파일이 없습니다.</div>
      )}

      {loadingState === 'loaded' && recordings.length > 0 && (
        <div className="recording-items">
          {recordings.map((recording) => (
            <div key={recording.filePath} className="recording-item">
              <div className="recording-info">
                <div className="recording-name">{recording.fileName}</div>
                <div className="recording-meta">
                  {formatDate(recording.createdAt)} · {formatSize(recording.size)}
                </div>
              </div>

              <div className="recording-actions">
                {onRecordingSelect && (
                  <button
                    onClick={() => onRecordingSelect(recording.filePath)}
                    className="btn-recording-play"
                  >
                    재생
                  </button>
                )}

                <button
                  onClick={() => handleDelete(recording.filePath)}
                  className="btn-recording-delete"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
