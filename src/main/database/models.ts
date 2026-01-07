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

// Step5 STT 요청 (audioData 직접 전송)
export interface TranscribeStep5Args {
  audioData: Uint8Array;
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

// ==================== Step 2: TTS & 녹음 관련 타입 ====================

// TTS 요청
export interface TTSRequest {
  text: string;
  voiceId?: string;
}

// TTS 결과
export interface TTSResult {
  success: boolean;
  filePath?: string;
  duration?: number;
  voiceId?: string;
  error?: string;
}

// 음성 정보
export interface Voice {
  id: string;
  name: string;
  language: string;
  gender?: 'male' | 'female' | 'neutral';
}

// 앱 설정
export interface AppSettings {
  ttsVoiceId: string;
  recordingSavePath: string;
  [key: string]: string;
}

// 녹음 파일 정보
export interface RecordingFile {
  fileName: string;
  filePath: string;
  createdAt: Date;
  size: number;
}

// 학습 세션
export interface Session {
  id: number;
  topicId: number;
  step: 1 | 2 | 3 | 4 | 5 | 6;
  date: Date;
  duration: number | null;
  recordingPath: string | null;
  createdAt: Date;
}

export interface CreateSessionDTO {
  topicId: number;
  step: 1 | 2 | 3 | 4 | 5 | 6;
  date: Date;
  duration?: number;
  recordingPath?: string;
}

// 오디오 재생 상태
export interface AudioPlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
}

// ==================== Step 4: 첨삭 관련 타입 ====================

// 첨삭 카테고리
export type CorrectionCategory = 'grammar' | 'vocabulary' | 'naturalness';

// 첨삭 결과 (AI 응답)
export interface CorrectionResult {
  original: string;
  corrected: string;
  explanation: string;
  categories: CorrectionCategory[];
}

// 첨삭 엔티티 (DB 레코드)
export interface Correction {
  id: number;
  sessionId: number | null;
  topicId: number | null;
  originalSentence: string;
  correctedSentence: string;
  explanation: string;
  categories: CorrectionCategory[];
  createdAt: Date;
}

// 첨삭 생성 DTO
export interface CreateCorrectionDTO {
  sessionId?: number;
  topicId?: number;
  originalSentence: string;
  correctedSentence: string;
  explanation: string;
  categories: CorrectionCategory[];
}

// 첨삭 요청 (IPC)
export interface CorrectSentenceRequest {
  sentence: string;
  cefrLevel: CEFRLevel;
}

// 첨삭 저장 요청 (IPC)
export interface SaveCorrectionRequest {
  corrections: CorrectionResult[];
  sessionId: number;
  topicId: number;
}

// ==================== Step 3: 리텔링 관련 타입 ====================

// 리텔링 엔티티 (DB 레코드)
export interface Retelling {
  id: number;
  topicId: number;
  duration: 3 | 2 | 1;
  audioPath: string | null;
  transcribedText: string | null;
  createdAt: Date;
}

// 리텔링 생성 DTO
export interface CreateRetellingDTO {
  topicId: number;
  duration: 3 | 2 | 1;
  audioPath?: string;
  transcribedText?: string;
}

// 리텔링 녹음 및 STT 변환 요청 (IPC)
export interface TranscribeRetellingRequest {
  duration: 3 | 2 | 1;
  audioData: Uint8Array;
}

// 리텔링 녹음 및 STT 변환 결과 (IPC)
export interface TranscribeRetellingResult {
  filePath: string;
  duration: 3 | 2 | 1;
  actualDuration: number;
  transcribedText: string;
  retellingId: number;
}

// 토픽의 리텔링 텍스트 조회 결과 (IPC)
export interface RetellingTextsResult {
  threeMin: string | null;
  twoMin: string | null;
  oneMin: string | null;
  formattedText: string;
}

// ==================== Step 5: AI 롤플레잉 관련 타입 ====================

// 대화 세션 엔티티 (DB 레코드)
export interface Conversation {
  id: number;
  topicId: number;
  sessionId: number | null;
  startedAt: Date;
  endedAt: Date | null;
  duration: number | null; // 초
  messageCount: number;
  createdAt: Date;
}

// 대화 메시지 엔티티 (DB 레코드)
export interface Message {
  id: number;
  conversationId: number;
  speaker: 'user' | 'ai';
  content: string;
  audioPath: string | null;
  timestamp: number; // 대화 시작 후 경과 초
  createdAt: Date;
}

// 대화 생성 DTO
export interface CreateConversationDTO {
  topicId: number;
  sessionId?: number;
  startedAt: Date;
}

// 메시지 생성 DTO
export interface CreateMessageDTO {
  conversationId: number;
  speaker: 'user' | 'ai';
  content: string;
  audioPath?: string;
  timestamp: number;
}

// 대화 컨텍스트 (Claude API용)
export interface TopicContext {
  englishContent: string;
  cefrLevel: CEFRLevel;
  keywords: string[];
}

// 대화 메시지 (Claude API용 - 간소화 버전)
export interface ConversationMessage {
  speaker: 'user' | 'ai';
  content: string;
}

// 대화 시작 결과 (IPC)
export interface ConversationStartResult {
  conversationId: number;
  firstMessage: {
    id: number;
    content: string;
    timestamp: number;
    ttsPath: string;
  };
}

// 메시지 교환 결과 (IPC)
export interface MessageExchangeResult {
  userMessageId: number;
  aiMessage: {
    id: number;
    content: string;
    timestamp: number;
    ttsPath: string;
  };
}

// 대화 종료 결과 (IPC)
export interface ConversationEndResult {
  totalDuration: number; // 초
  messageCount: number;
}

// 대화 시작 요청 (IPC)
export interface StartConversationRequest {
  topicId: number;
}

// 사용자 메시지 전송 요청 (IPC)
export interface SendUserMessageRequest {
  conversationId: number;
  content: string;
  timestamp: number;
}

// 대화 종료 요청 (IPC)
export interface EndConversationRequest {
  conversationId: number;
}

// 대화 히스토리 조회 요청 (IPC)
export interface GetConversationHistoryRequest {
  conversationId: number;
}

// TTS 재생 요청 (IPC)
export interface ReplayTTSRequest {
  messageId: number;
}
