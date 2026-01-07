import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TopicGenerationResult, CEFRLevel, CorrectionResult } from '../database/models';
import { AppError, ErrorCode } from '../errors/AppError';

export interface TopicContext {
  englishContent: string;
  cefrLevel: CEFRLevel;
  keywords: string[];
}

export interface ConversationMessage {
  speaker: 'user' | 'ai';
  content: string;
}

export interface IClaudeService {
  generateEnglishScript(koreanText: string, cefrLevel: CEFRLevel): Promise<TopicGenerationResult>;
  extractKeywords(englishText: string): Promise<string[]>;
  correctSentence(sentence: string, cefrLevel: CEFRLevel): Promise<CorrectionResult>;
  generateConversationResponse(
    topicContext: TopicContext,
    conversationHistory: ConversationMessage[],
    isFirstMessage?: boolean
  ): Promise<string>;
}

const CEFR_DESCRIPTIONS: Record<CEFRLevel, string> = {
  A1: '초급 - 간단한 일상 표현, 기본 단어 사용',
  A2: '초중급 - 기본 의사소통, 친숙한 주제',
  B1: '중급 - 일상적인 주제, 일반적인 어휘',
  B2: '중상급 - 복잡한 주제, 추상적 개념',
  C1: '고급 - 전문적인 주제, 다양한 표현',
  C2: '최상급 - 네이티브 수준, 미묘한 뉘앙스',
};

export class ClaudeService implements IClaudeService {
  async generateEnglishScript(
    koreanText: string,
    cefrLevel: CEFRLevel
  ): Promise<TopicGenerationResult> {
    if (!koreanText || koreanText.trim().length === 0) {
      throw new AppError(
        ErrorCode.CLAUDE_API_ERROR,
        'Korean text is empty',
        '텍스트를 입력해주세요.'
      );
    }

    const prompt = this.buildPrompt(koreanText, cefrLevel);

    try {
      const output = await this.executeClaude(prompt);
      return this.parseClaudeResponse(output);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        ErrorCode.CLAUDE_API_ERROR,
        'Failed to generate English script',
        'AI 서비스에 일시적인 문제가 발생했습니다. 다시 시도해주세요.',
        error as Error
      );
    }
  }

  async extractKeywords(englishText: string): Promise<string[]> {
    const prompt = `Extract 5-10 key learning vocabulary words from this English text.
Return ONLY a JSON array of words, no explanation.

Text: ${englishText}

Output format: ["word1", "word2", ...]`;

    try {
      const output = await this.executeClaude(prompt);
      const keywords = JSON.parse(output.trim());

      if (!Array.isArray(keywords)) {
        throw new Error('Invalid keywords format');
      }

      return keywords;
    } catch (error) {
      throw new AppError(
        ErrorCode.CLAUDE_PARSING_ERROR,
        'Failed to extract keywords',
        '키워드 추출에 실패했습니다.',
        error as Error
      );
    }
  }

  private buildPrompt(koreanText: string, cefrLevel: CEFRLevel): string {
    return `You are an English learning content creator for CEFR ${cefrLevel} level learners.

Convert the following Korean text into English suitable for a ${cefrLevel} learner.

Level Guide: ${CEFR_DESCRIPTIONS[cefrLevel]}

Requirements:
1. Use vocabulary and grammar appropriate for CEFR ${cefrLevel} level
2. Maintain the original meaning and intent
3. Use natural, conversational English
4. Keep the length similar to the original
5. Extract 5-10 key learning keywords from the English script

Korean Text:
---
${koreanText}
---

Output Format (JSON):
{
  "english_script": "...",
  "keywords": ["word1", "word2", ...]
}

Please provide ONLY the JSON output, no additional explanation.`;
  }

  private executeClaude(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';

      // 임시 파일에 prompt 저장 (인코딩 문제 방지)
      const tempFile = path.join(os.tmpdir(), `claude-prompt-${Date.now()}.txt`);
      fs.writeFileSync(tempFile, prompt, 'utf8');

      // PowerShell을 통해 파일 내용을 읽어서 Claude CLI에 전달
      // -p 플래그는 "print mode"를 의미하고, 프롬프트는 stdin으로 전달
      const psCommand = `Get-Content -Path '${tempFile}' -Raw -Encoding UTF8 | claude -p --output-format text`;

      const child = spawn('powershell', ['-Command', psCommand], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      child.stdout.on('data', (data: Buffer) => {
        output += data.toString('utf8');
      });

      child.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString('utf8');
      });

      child.on('close', (code: number | null) => {
        // 임시 파일 삭제
        try {
          fs.unlinkSync(tempFile);
        } catch {
          // ignore
        }

        if (code === 0) {
          resolve(output);
        } else {
          reject(
            new AppError(
              ErrorCode.CLAUDE_API_ERROR,
              `Claude CLI exited with code ${code}`,
              'Claude CLI 실행에 실패했습니다.',
              new Error(errorOutput)
            )
          );
        }
      });

      child.on('error', (err: Error) => {
        reject(
          new AppError(
            ErrorCode.CLAUDE_API_ERROR,
            'Failed to execute Claude CLI',
            'Claude CLI를 실행할 수 없습니다. 설치 여부를 확인해주세요.',
            err
          )
        );
      });

      // 30초 타임아웃
      setTimeout(() => {
        child.kill();
        reject(
          new AppError(
            ErrorCode.CLAUDE_TIMEOUT,
            'Claude CLI timeout',
            'AI 응답 시간이 초과되었습니다. 다시 시도해주세요.'
          )
        );
      }, 30000);
    });
  }

  private parseClaudeResponse(output: string): TopicGenerationResult {
    try {
      // JSON 블록 추출 (마크다운 코드 블록 제거)
      let jsonStr = output.trim();

      // ```json ... ``` 형식 제거
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr);

      if (!parsed.english_script || !parsed.keywords) {
        throw new Error('Missing required fields in Claude response');
      }

      return {
        englishText: parsed.english_script,
        keywords: parsed.keywords,
      };
    } catch (error) {
      throw new AppError(
        ErrorCode.CLAUDE_PARSING_ERROR,
        'Failed to parse Claude response',
        'AI 응답 파싱에 실패했습니다. 다시 시도해주세요.',
        error as Error
      );
    }
  }

  /**
   * Step 4: 문장 첨삭 기능
   */
  async correctSentence(sentence: string, cefrLevel: CEFRLevel): Promise<CorrectionResult> {
    // Validation
    if (!sentence || sentence.trim().length === 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Empty sentence', '문장을 입력해주세요.');
    }

    const trimmedSentence = sentence.trim();

    if (trimmedSentence.length > 500) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Sentence too long',
        '문장이 너무 깁니다. (최대 500자)'
      );
    }

    const prompt = this.buildCorrectionPrompt(trimmedSentence, cefrLevel);

    try {
      const output = await this.executeClaude(prompt);
      return this.parseCorrectionResponse(output);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        ErrorCode.CLAUDE_API_ERROR,
        'Failed to correct sentence',
        '첨삭 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
        error as Error
      );
    }
  }

  /**
   * 첨삭 전용 프롬프트 생성
   */
  private buildCorrectionPrompt(sentence: string, cefrLevel: CEFRLevel): string {
    return `You are an English teacher correcting a CEFR ${cefrLevel} student's sentence.

Original sentence:
"${sentence}"

**IMPORTANT - Section Markers**:
The text may contain section markers like "----3분 리텔링 시 내용----", "----2분 리텔링 시 내용----", or "----1분 리텔링 시 내용----".
These markers indicate different retelling attempts (3-minute, 2-minute, 1-minute).
- If the sentence is just a section marker (starts with "----" and ends with "----"), return it as-is without correction.
- DO NOT correct or modify these section markers.
- If a sentence contains only a section marker, set "corrected" to the same as "original" and "explanation" to "섹션 구분자입니다." with "categories": []

Analyze and correct this sentence based on:
1. **Grammar**: Fix grammatical errors (tense, subject-verb agreement, articles, prepositions, word order, etc.)
2. **Vocabulary**: Suggest better word choices appropriate for ${cefrLevel} level
3. **Naturalness**: Make the sentence sound more natural and fluent

Return ONLY a JSON object in this exact format:
{
  "original": "${sentence}",
  "corrected": "...",
  "explanation": "...",
  "categories": ["grammar", "vocabulary", "naturalness"]
}

Guidelines:
- If the sentence is already correct, set "corrected" to the same as "original" and "explanation" to "No correction needed." or "수정이 필요하지 않습니다."
- "categories" should include only relevant correction types (e.g., only ["grammar"] if no vocabulary/naturalness issues)
- "explanation" should be concise, educational, and in Korean (for ${cefrLevel} learners to understand easily)
- Focus on the most important errors first
- For ${cefrLevel} level:
  - A1/A2: Use very simple explanations, focus on basic grammar
  - B1/B2: Provide intermediate-level explanations, introduce synonyms
  - C1/C2: Offer advanced explanations, discuss nuances and idiomatic usage

Provide ONLY the JSON output, no additional text.`;
  }

  /**
   * 첨삭 응답 파싱
   */
  private parseCorrectionResponse(output: string): CorrectionResult {
    try {
      let jsonStr = output.trim();

      // ```json ... ``` 제거
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr);

      // 검증
      if (!parsed.original || !parsed.corrected || !parsed.explanation) {
        throw new Error('Missing required fields in correction response');
      }

      if (!Array.isArray(parsed.categories)) {
        throw new Error('Categories must be an array');
      }

      return {
        original: parsed.original,
        corrected: parsed.corrected,
        explanation: parsed.explanation,
        categories: parsed.categories,
      };
    } catch (error) {
      throw new AppError(
        ErrorCode.CLAUDE_PARSING_ERROR,
        'Failed to parse correction response',
        '첨삭 결과 파싱에 실패했습니다. 다시 시도해주세요.',
        error as Error
      );
    }
  }

  /**
   * Step 5: AI 대화 응답 생성
   */
  async generateConversationResponse(
    topicContext: TopicContext,
    conversationHistory: ConversationMessage[],
    isFirstMessage: boolean = false
  ): Promise<string> {
    // Validation
    if (!topicContext.englishContent || !topicContext.cefrLevel) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Missing topic context',
        '토픽 정보가 필요합니다.'
      );
    }

    const prompt = isFirstMessage
      ? this.buildFirstMessagePrompt(topicContext)
      : this.buildConversationPrompt(topicContext, conversationHistory);

    try {
      const output = await this.executeClaude(prompt);
      return output.trim();
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        ErrorCode.CLAUDE_API_ERROR,
        'Failed to generate conversation response',
        'AI 응답 생성에 실패했습니다. 다시 시도해주세요.',
        error as Error
      );
    }
  }

  /**
   * 첫 대화 메시지 프롬프트
   */
  private buildFirstMessagePrompt(topicContext: TopicContext): string {
    const { englishContent, cefrLevel, keywords } = topicContext;

    return `You are a friendly and supportive English conversation partner.

**Context**:
- Student CEFR Level: ${cefrLevel}
- Topic: ${englishContent}
- Key Vocabulary: ${keywords.join(', ')}

**Your Role**:
- Start the conversation naturally by asking an engaging question related to the topic
- Use vocabulary and grammar appropriate for ${cefrLevel} level
- Keep your first message brief (1-2 sentences)
- Be encouraging and friendly

**Important Rules**:
- DO NOT correct the student's mistakes during the conversation
- If the student struggles, help them with hints or rephrase your question
- Stay on the topic as much as possible
- Keep the conversation natural and flowing

**Level Guidelines**:
${CEFR_DESCRIPTIONS[cefrLevel]}

Now, start the conversation by introducing the topic and asking the student a question.
Provide ONLY your message, no additional text or formatting.`;
  }

  /**
   * 대화 계속 프롬프트
   */
  private buildConversationPrompt(
    topicContext: TopicContext,
    conversationHistory: ConversationMessage[]
  ): string {
    const { englishContent, cefrLevel, keywords } = topicContext;

    // 최근 10개 메시지만 사용 (컨텍스트 제한)
    const recentHistory = conversationHistory.slice(-10);

    const historyText = recentHistory
      .map((msg) => `${msg.speaker.toUpperCase()}: ${msg.content}`)
      .join('\n');

    return `You are a friendly and supportive English conversation partner.

**Context**:
- Student CEFR Level: ${cefrLevel}
- Topic: ${englishContent}
- Key Vocabulary: ${keywords.join(', ')}

**Conversation History**:
${historyText}

**Your Role**:
- Respond naturally to the student's last message
- Ask follow-up questions to keep the conversation going
- Use vocabulary and grammar appropriate for ${cefrLevel} level
- Keep your response brief (1-3 sentences)

**Important Rules**:
- DO NOT correct the student's mistakes
- If the student's message is unclear, gently rephrase or ask for clarification
- Stay on the topic
- Be encouraging and supportive

**Level Guidelines**:
${CEFR_DESCRIPTIONS[cefrLevel]}

Now, respond to the student's last message.
Provide ONLY your message, no additional text or formatting.`;
  }
}
