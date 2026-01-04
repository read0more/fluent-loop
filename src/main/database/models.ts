// TypeScript 타입 정의

// CEFR 레벨
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

// 토픽 상태
export type TopicStatus = 'active' | 'inactive' | 'archived';

// 토픽 엔티티
export interface Topic {
  id: number;
  title: string;
  koreanContent: string;
  englishContent: string;
  cefrLevel: CEFRLevel;
  keywords: string[];
  recordingPath: string | null;
  createdAt: Date;
  updatedAt: Date;
  status: TopicStatus;
  weekStartDate: Date | null;
}

// 토픽 생성 DTO
export interface CreateTopicDTO {
  title: string;
  koreanContent: string;
  englishContent: string;
  cefrLevel: CEFRLevel;
  keywords: string[];
  recordingPath: string | null;
  weekStartDate?: Date;
}

// 토픽 업데이트 DTO
export interface UpdateTopicDTO {
  title?: string;
  englishContent?: string;
  cefrLevel?: CEFRLevel;
  keywords?: string[];
  status?: TopicStatus;
}

// AI 생성 결과
export interface TopicGenerationResult {
  englishText: string;
  keywords: string[];
}

// STT 결과
export interface STTResult {
  success: boolean;
  text: string;
  language: string;
  duration: number;
  error?: string;
}

// IPC 응답 공통 타입
export interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

// 녹음 결과
export interface RecordingResult {
  filePath: string;
  duration: number;
}

// IPC 요청 타입들
export interface TranscribeArgs {
  filePath: string;
  language?: string;
}

export interface GenerateTopicArgs {
  koreanText: string;
  cefrLevel: CEFRLevel;
}

export interface SaveTopicArgs {
  title: string;
  koreanContent: string;
  englishContent: string;
  cefrLevel: CEFRLevel;
  keywords: string[];
  recordingPath: string | null;
}

export interface SaveTopicResult {
  topicId: number;
}
