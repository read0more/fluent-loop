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
  ttsVoiceId: string; // 화자A: AI 음성 + 기본 TTS
  ttsVoiceIdUser: string; // 화자B: User 음성
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

// 배치 첨삭 요청 (IPC) - 여러 문장을 한 번에 처리
export interface CorrectSentencesBatchRequest {
  sentences: string[];
  cefrLevel: CEFRLevel;
}

// 첨삭 저장 요청 (IPC)
export interface SaveCorrectionRequest {
  corrections: CorrectionResult[];
  sessionId: number | null;
  topicId: number;
}

// ==================== Step 3: 리텔링 관련 타입 ====================

// 리텔링 타이머 스텝 (UI용) - 1=3분, 2=2분, 3=1분
export type RetellingTimerStep = 1 | 2 | 3;

// 리텔링 duration (DB용) - 3=3분, 2=2분, 1=1분
export type RetellingDuration = 3 | 2 | 1;

/**
 * UI의 타이머 스텝을 DB의 duration으로 변환
 * @param step UI 타이머 스텝 (1=3분, 2=2분, 3=1분)
 * @returns DB duration (3=3분, 2=2분, 1=1분)
 */
export function stepToDuration(step: RetellingTimerStep): RetellingDuration {
  const mapping: Record<RetellingTimerStep, RetellingDuration> = {
    1: 3, // 첫 번째 스텝 = 3분
    2: 2, // 두 번째 스텝 = 2분
    3: 1, // 세 번째 스텝 = 1분
  };
  return mapping[step];
}

/**
 * DB의 duration을 UI의 타이머 스텝으로 변환
 * @param duration DB duration (3=3분, 2=2분, 1=1분)
 * @returns UI 타이머 스텝 (1=3분, 2=2분, 3=1분)
 */
export function durationToStep(duration: RetellingDuration): RetellingTimerStep {
  const mapping: Record<RetellingDuration, RetellingTimerStep> = {
    3: 1, // 3분 = 첫 번째 스텝
    2: 2, // 2분 = 두 번째 스텝
    1: 3, // 1분 = 세 번째 스텝
  };
  return mapping[duration];
}

// 리텔링 엔티티 (DB 레코드)
export interface Retelling {
  id: number;
  topicId: number;
  duration: 3 | 2 | 1;
  audioPath: string | null;
  transcribedText: string | null;
  actualDuration: number | null;
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
  topicId: number;
  duration: 3 | 2 | 1;
  audioData: Uint8Array;
  actualDuration?: number;
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

// 리텔링 히스토리 조회 요청 (IPC)
export interface GetRetellingHistoryArgs {
  topicId: number;
  duration?: 3 | 2 | 1;
}

// 리텔링 히스토리 아이템 (IPC 응답용)
export interface RetellingHistoryItem {
  id: number;
  duration: 3 | 2 | 1;
  createdAt: Date;
  actualDuration: number | null;
  transcribedText: string | null;
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

// ==================== Step 6: 대화 첨삭 관련 타입 ====================

// 대화 첨삭 결과 (AI 응답 - 화자 정보 포함)
export interface ConversationCorrectionResult {
  messageId: number; // conversation_messages.id
  speaker: 'user' | 'ai';
  original: string;
  corrected: string; // AI 메시지는 original과 동일
  explanation: string; // AI 메시지는 빈 문자열
  categories: CorrectionCategory[]; // AI 메시지는 빈 배열
  timestamp: number; // 대화 내 시간 (초)
}

// 대화 첨삭 요청 (IPC)
export interface CorrectConversationRequest {
  conversationId: number;
}

// 대화 첨삭 응답 (IPC)
export interface CorrectConversationResponse extends IPCResponse<ConversationCorrectionResult[]> {
  success: boolean;
  data?: ConversationCorrectionResult[];
  error?: string;
  errorCode?: string;
}

// 대화 첨삭 저장 요청 (IPC)
export interface SaveConversationCorrectionsRequest {
  conversationId: number;
  corrections: ConversationCorrectionResult[]; // user 메시지만 저장
  sessionId?: number;
  topicId: number;
}

// 대화 정보 조회 응답 (선택적)
export interface ConversationInfo {
  conversation: Conversation;
  messages: Message[];
  topic: Topic;
}
