import { getDatabase } from '../database/db';
import { ConversationRepository } from '../database/repositories/ConversationRepository';
import { MessageRepository } from '../database/repositories/MessageRepository';
import { TopicRepository } from '../database/repositories/TopicRepository';
import { ClaudeService, TopicContext, ConversationMessage } from './ClaudeService';
import { TTSService } from './TTSService';
import { AppError, ErrorCode } from '../errors/AppError';
import {
  Message,
  ConversationStartResult,
  MessageExchangeResult,
  ConversationEndResult,
} from '../database/models';

export interface IConversationService {
  startConversation(topicId: number): Promise<ConversationStartResult>;
  sendMessage(
    conversationId: number,
    userContent: string,
    timestamp: number
  ): Promise<MessageExchangeResult>;
  endConversation(conversationId: number): Promise<ConversationEndResult>;
  getConversationHistory(conversationId: number): Promise<Message[]>;
  replayTTS(messageId: number): Promise<string>;
}

export class ConversationService implements IConversationService {
  private conversationRepo: ConversationRepository;
  private messageRepo: MessageRepository;
  private topicRepo: TopicRepository;
  private claudeService: ClaudeService;
  private ttsService: TTSService;

  constructor() {
    const db = getDatabase();
    this.conversationRepo = new ConversationRepository(db);
    this.messageRepo = new MessageRepository(db);
    this.topicRepo = new TopicRepository(db);
    this.claudeService = new ClaudeService();
    this.ttsService = new TTSService();
  }

  /**
   * 대화 시작
   */
  async startConversation(topicId: number): Promise<ConversationStartResult> {
    // 1. Topic 조회
    const topic = await this.topicRepo.findById(topicId);
    if (!topic) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Topic not found', '토픽을 찾을 수 없습니다.');
    }

    // 2. Conversation 레코드 생성
    const conversationId = this.conversationRepo.create({
      topicId,
      startedAt: new Date(),
    });

    try {
      // 3. TopicContext 준비
      const topicContext: TopicContext = {
        englishContent: topic.englishContent,
        cefrLevel: topic.cefrLevel,
        keywords: topic.keywords,
      };

      // 4. AI 첫 메시지 생성
      const aiContent = await this.claudeService.generateConversationResponse(
        topicContext,
        [],
        true
      );

      // 5. TTS 생성
      let ttsPath = '';
      try {
        const ttsResult = await this.ttsService.synthesizeSpeech(aiContent);
        ttsPath = ttsResult.filePath || '';
      } catch (ttsError) {
        // TTS 실패 시에도 텍스트는 반환 (음성 없이 진행)
        console.error('[TTS Error] Failed to generate TTS for first message:', ttsError);
      }

      // 6. AI 메시지 저장
      const messageId = this.messageRepo.create({
        conversationId,
        speaker: 'ai',
        content: aiContent,
        audioPath: ttsPath,
        timestamp: 0,
      });

      return {
        conversationId,
        firstMessage: {
          id: messageId,
          content: aiContent,
          timestamp: 0,
          ttsPath,
        },
      };
    } catch (error) {
      // 실패 시 conversation 삭제 (롤백)
      this.conversationRepo.delete(conversationId);
      throw error;
    }
  }

  /**
   * 사용자 메시지 전송 및 AI 응답 생성
   */
  async sendMessage(
    conversationId: number,
    userContent: string,
    timestamp: number
  ): Promise<MessageExchangeResult> {
    // 1. Validation
    if (!userContent || userContent.trim().length === 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Empty message', '메시지를 입력해주세요.');
    }

    if (userContent.length > 1000) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Message too long',
        '메시지가 너무 깁니다. (최대 1000자)'
      );
    }

    if (timestamp < 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Invalid timestamp',
        '타임스탬프가 올바르지 않습니다.'
      );
    }

    // 2. Conversation 조회
    const conversation = this.conversationRepo.findById(conversationId);
    if (!conversation) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        'Conversation not found',
        '대화 세션을 찾을 수 없습니다.'
      );
    }

    // 3. 종료된 대화 체크
    if (conversation.endedAt) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Conversation already ended',
        '이미 종료된 대화입니다.'
      );
    }

    // 4. 사용자 메시지 저장
    const userMessageId = this.messageRepo.create({
      conversationId,
      speaker: 'user',
      content: userContent.trim(),
      timestamp,
    });

    // 5. 대화 히스토리 조회 (최근 10개)
    const allMessages = this.messageRepo.findByConversationId(conversationId);
    const conversationHistory: ConversationMessage[] = allMessages.map((msg) => ({
      speaker: msg.speaker,
      content: msg.content,
    }));

    // 6. Topic 조회
    const topic = await this.topicRepo.findById(conversation.topicId);
    if (!topic) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Topic not found', '토픽을 찾을 수 없습니다.');
    }

    // 7. TopicContext 준비
    const topicContext: TopicContext = {
      englishContent: topic.englishContent,
      cefrLevel: topic.cefrLevel,
      keywords: topic.keywords,
    };

    // 8. AI 응답 생성
    const aiContent = await this.claudeService.generateConversationResponse(
      topicContext,
      conversationHistory,
      false
    );

    // 9. TTS 생성
    let ttsPath = '';
    try {
      const ttsResult = await this.ttsService.synthesizeSpeech(aiContent);
      ttsPath = ttsResult.filePath || '';
    } catch (ttsError) {
      console.error('[TTS Error] Failed to generate TTS for AI response:', ttsError);
    }

    // 10. AI 메시지 저장 (timestamp는 현재 시간 + 약간의 딜레이)
    const aiTimestamp = timestamp + 2; // 사용자 메시지 후 2초 뒤
    const aiMessageId = this.messageRepo.create({
      conversationId,
      speaker: 'ai',
      content: aiContent,
      audioPath: ttsPath,
      timestamp: aiTimestamp,
    });

    return {
      userMessageId,
      aiMessage: {
        id: aiMessageId,
        content: aiContent,
        timestamp: aiTimestamp,
        ttsPath,
      },
    };
  }

  /**
   * 대화 종료
   */
  async endConversation(conversationId: number): Promise<ConversationEndResult> {
    // 1. Conversation 조회
    const conversation = this.conversationRepo.findById(conversationId);
    if (!conversation) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        'Conversation not found',
        '대화 세션을 찾을 수 없습니다.'
      );
    }

    // 2. 메시지 수 계산
    const messageCount = this.messageRepo.countByConversationId(conversationId);

    // 3. 총 대화 시간 계산 (started_at ~ 현재)
    const startedAt = conversation.startedAt.getTime();
    const endedAt = new Date().getTime();
    const duration = Math.floor((endedAt - startedAt) / 1000); // 초 단위

    // 4. Conversation 업데이트
    this.conversationRepo.update(conversationId, {
      endedAt: new Date(),
      duration,
      messageCount,
    });

    return {
      totalDuration: duration,
      messageCount,
    };
  }

  /**
   * 대화 히스토리 조회
   */
  async getConversationHistory(conversationId: number): Promise<Message[]> {
    const conversation = this.conversationRepo.findById(conversationId);
    if (!conversation) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        'Conversation not found',
        '대화 세션을 찾을 수 없습니다.'
      );
    }

    return this.messageRepo.findByConversationId(conversationId);
  }

  /**
   * TTS 재생 (캐시된 파일 경로 반환)
   */
  async replayTTS(messageId: number): Promise<string> {
    const message = this.messageRepo.findById(messageId);
    if (!message) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Message not found', '메시지를 찾을 수 없습니다.');
    }

    if (message.speaker !== 'ai') {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Not an AI message',
        'AI 메시지만 재생할 수 있습니다.'
      );
    }

    if (!message.audioPath) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        'TTS file not found',
        '음성 파일이 존재하지 않습니다.'
      );
    }

    // TODO: 파일 존재 여부 확인 및 재생성 로직 (선택사항)
    return message.audioPath;
  }
}
