import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  TopicGenerationResult,
  CEFRLevel,
  CorrectionResult,
  ConversationCorrectionResult,
  Message,
} from '../database/models';
import { AppError, ErrorCode } from '../errors/AppError';
import { ConversationRepository } from '../database/repositories/ConversationRepository';
import { MessageRepository } from '../database/repositories/MessageRepository';
import { TopicRepository } from '../database/repositories/TopicRepository';
import { getDatabase } from '../database/db';

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
  correctConversation(conversationId: number): Promise<ConversationCorrectionResult[]>;
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
    return `
<response_format>
You MUST respond with ONLY a JSON object. No explanatory text, no markdown code blocks, no additional commentary.
Respond with ONLY the pure JSON object, nothing else.
</response_format>

**CRITICAL INSTRUCTION**: You MUST translate the Korean text below into English.
DO NOT create new content. DO NOT change the topic or meaning.
The English output MUST convey the SAME message, ideas, and emotions as the Korean original.

Your task:
1. Translate the Korean text to English accurately
2. Adjust ONLY the vocabulary and grammar complexity to match CEFR ${cefrLevel} level
3. Preserve the original meaning, intent, and emotional tone

CEFR ${cefrLevel} Level Guide: ${CEFR_DESCRIPTIONS[cefrLevel]}

Korean Text to Translate:
---
${koreanText}
---

Translation Requirements:
1. The English MUST be a faithful translation of the Korean text above
2. Use vocabulary appropriate for CEFR ${cefrLevel} level
3. Maintain natural, conversational English
4. Keep similar length to the original
5. Extract 5-10 key vocabulary words from your English translation

<output_format>
CRITICAL - Output ONLY this JSON structure, nothing else:
{
  "english_script": "Your English translation here",
  "keywords": ["word1", "word2", "word3"]
}

Do NOT include:
- Markdown code blocks (\`\`\`json...\`\`\`)
- Explanatory text before or after the JSON
- Comments or notes
- Any text that is not the JSON object itself
- Any text outside the JSON braces
</output_format>`;
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
      // --output-format json으로 구조화된 JSON 출력 강제
      // PowerShell의 출력 인코딩을 UTF-8로 명시적으로 설정하여 한글 처리
      const psCommand = `$OutputEncoding = [System.Text.Encoding]::UTF8; Get-Content -Path '${tempFile}' -Raw -Encoding UTF8 | claude -p --output-format json`;

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
          console.log(`[ClaudeService] Claude CLI successful. Output length: ${output.length}`);
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

  private logClaudeInteraction(context: string, response: string, error?: Error): void {
    // Save logs to project directory instead of temp folder
    const logDir = path.join(process.cwd(), '.claude', 'logs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(logDir, `claude-${context}-${timestamp}.log`);

    const logContent = {
      timestamp: new Date().toISOString(),
      context,
      responseLength: response?.length || 0,
      response: response,
      error: error
        ? {
            message: error.message,
            stack: error.stack,
          }
        : null,
    };

    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      fs.writeFileSync(logFile, JSON.stringify(logContent, null, 2), 'utf8');
      console.log(`[ClaudeService] Log saved: ${logFile}`);
    } catch (err) {
      console.error('[ClaudeService] Failed to save log:', err);
    }
  }

  private parseClaudeResponse(output: string): TopicGenerationResult {
    const originalOutput = output; // Keep for logging

    try {
      let jsonStr = output.trim();

      // Strategy 0: Handle Claude CLI JSON wrapper format
      // When using --output-format json, Claude CLI wraps the response
      if (jsonStr.includes('"result"') && jsonStr.includes('"type"')) {
        try {
          console.log('[ClaudeService] Detecting Claude CLI wrapper format...');
          const cliResponse = JSON.parse(jsonStr);
          if (cliResponse.result && typeof cliResponse.result === 'string') {
            console.log('[ClaudeService] Extracting result from CLI wrapper...');
            jsonStr = cliResponse.result;
          }
        } catch {
          console.log(
            '[ClaudeService] Failed to parse CLI wrapper, continuing with other strategies...'
          );
        }
      }

      // Strategy 1: Try direct JSON parse if starts and ends with braces
      if (jsonStr.startsWith('{') && jsonStr.endsWith('}')) {
        try {
          console.log('[ClaudeService] Trying direct JSON parse...');
          return this.validateAndExtractResult(JSON.parse(jsonStr));
        } catch {
          console.log('[ClaudeService] Direct parse failed, trying extraction strategies...');
        }
      }

      // Strategy 2: Extract from markdown code block
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        try {
          console.log('[ClaudeService] Trying code block extraction...');
          return this.validateAndExtractResult(JSON.parse(codeBlockMatch[1]));
        } catch {
          console.log('[ClaudeService] Code block parse failed');
        }
      }

      // Strategy 3: Find JSON object pattern with required fields
      const jsonObjectMatch = jsonStr.match(/\{[^{}]*"english_script"[^{}]*"keywords"[^{}]*\}/s);
      if (jsonObjectMatch) {
        try {
          console.log('[ClaudeService] Trying pattern match extraction...');
          return this.validateAndExtractResult(JSON.parse(jsonObjectMatch[0]));
        } catch {
          console.log('[ClaudeService] Pattern match parse failed');
        }
      }

      // Strategy 4: Aggressive extraction - find any valid JSON object
      const allBraceMatches = this.extractJsonObjects(jsonStr);
      for (const match of allBraceMatches) {
        try {
          console.log('[ClaudeService] Trying aggressive JSON extraction...');
          const result = this.validateAndExtractResult(JSON.parse(match));
          console.log('[ClaudeService] Successfully extracted JSON from mixed content');
          return result;
        } catch {
          // Try next match
          continue;
        }
      }

      // All strategies failed
      throw new Error(
        `No valid JSON found in response (length: ${output.length}). All extraction strategies failed.`
      );
    } catch (error) {
      console.log('[ClaudeService] Parsing error:', error);

      // Log the Claude response for debugging
      this.logClaudeInteraction('generateScript-FAILED', originalOutput, error as Error);

      throw new AppError(
        ErrorCode.CLAUDE_PARSING_ERROR,
        'Failed to parse Claude response',
        `AI 응답 파싱 실패. 로그: .claude/logs/ 폴더 확인하세요. 에러: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  private validateAndExtractResult(parsed: any): TopicGenerationResult {
    if (!parsed.english_script || !parsed.keywords) {
      throw new Error('Missing required fields: english_script or keywords');
    }

    if (!Array.isArray(parsed.keywords)) {
      throw new Error('keywords must be an array');
    }

    return {
      englishText: parsed.english_script,
      keywords: parsed.keywords,
    };
  }

  private extractJsonObjects(text: string): string[] {
    const results: string[] = [];
    let braceCount = 0;
    let startIndex = -1;

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (braceCount === 0) {
          startIndex = i;
        }
        braceCount++;
      } else if (text[i] === '}') {
        braceCount--;
        if (braceCount === 0 && startIndex !== -1) {
          results.push(text.substring(startIndex, i + 1));
          startIndex = -1;
        }
      }
    }

    return results;
  }

  /**
   * 첨삭 결과 검증 및 추출
   */
  private validateAndExtractCorrectionResult(parsed: any): CorrectionResult {
    if (!parsed.original || !parsed.corrected || parsed.explanation === undefined) {
      throw new Error('Missing required fields: original, corrected, or explanation');
    }

    if (!Array.isArray(parsed.categories)) {
      throw new Error('categories must be an array');
    }

    return {
      original: parsed.original,
      corrected: parsed.corrected,
      explanation: parsed.explanation,
      categories: parsed.categories,
    };
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
    return `
<response_format>
You MUST respond with ONLY a JSON object. No explanatory text, no markdown code blocks, no additional commentary.
Respond with ONLY the pure JSON object, nothing else.
</response_format>

**CRITICAL INSTRUCTION**: You MUST respond with ONLY a JSON object.
DO NOT include markdown code blocks (\`\`\`json...\`\`\`).
DO NOT include any text before or after the JSON.

You are an English teacher correcting a CEFR ${cefrLevel} student's sentence.

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

<output_format>
CRITICAL - Output ONLY this JSON structure, nothing else:
{
  "original": "${sentence}",
  "corrected": "...",
  "explanation": "...",
  "categories": ["grammar", "vocabulary", "naturalness"]
}

Do NOT include:
- Markdown code blocks (\`\`\`json...\`\`\`)
- Explanatory text before or after the JSON
- Comments or notes
- Any text that is not the JSON object itself
- Any text outside the JSON braces
</output_format>

Guidelines:
- If the sentence is already correct, set "corrected" to the same as "original" and "explanation" to "No correction needed." or "수정이 필요하지 않습니다."
- "categories" should include only relevant correction types (e.g., only ["grammar"] if no vocabulary/naturalness issues)
- "explanation" should be concise, educational, and in Korean (for ${cefrLevel} learners to understand easily)
- Focus on the most important errors first
- For ${cefrLevel} level:
  - A1/A2: Use very simple explanations, focus on basic grammar
  - B1/B2: Provide intermediate-level explanations, introduce synonyms
  - C1/C2: Offer advanced explanations, discuss nuances and idiomatic usage`;
  }

  /**
   * 첨삭 응답 파싱 (다중 전략)
   */
  private parseCorrectionResponse(output: string): CorrectionResult {
    const originalOutput = output; // Keep for logging

    try {
      let jsonStr = output.trim();

      // Strategy 0: Handle Claude CLI JSON wrapper format
      // When using --output-format json, Claude CLI wraps the response
      if (jsonStr.includes('"result"') && jsonStr.includes('"type"')) {
        try {
          console.log('[ClaudeService] Correction: Detecting Claude CLI wrapper format...');
          const cliResponse = JSON.parse(jsonStr);
          if (cliResponse.result && typeof cliResponse.result === 'string') {
            console.log('[ClaudeService] Correction: Extracting result from CLI wrapper...');
            jsonStr = cliResponse.result;
          }
        } catch {
          console.log(
            '[ClaudeService] Correction: Failed to parse CLI wrapper, continuing with other strategies...'
          );
        }
      }

      // Strategy 1: Try direct JSON parse if starts and ends with braces
      if (jsonStr.startsWith('{') && jsonStr.endsWith('}')) {
        try {
          console.log('[ClaudeService] Correction: Trying direct JSON parse...');
          return this.validateAndExtractCorrectionResult(JSON.parse(jsonStr));
        } catch {
          console.log(
            '[ClaudeService] Correction: Direct parse failed, trying extraction strategies...'
          );
        }
      }

      // Strategy 2: Extract from markdown code block
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        try {
          console.log('[ClaudeService] Correction: Trying code block extraction...');
          return this.validateAndExtractCorrectionResult(JSON.parse(codeBlockMatch[1]));
        } catch {
          console.log('[ClaudeService] Correction: Code block parse failed');
        }
      }

      // Strategy 3: Find JSON object pattern with required fields
      const jsonObjectMatch = jsonStr.match(
        /\{[^{}]*"original"[^{}]*"corrected"[^{}]*"explanation"[^{}]*\}/s
      );
      if (jsonObjectMatch) {
        try {
          console.log('[ClaudeService] Correction: Trying pattern match extraction...');
          return this.validateAndExtractCorrectionResult(JSON.parse(jsonObjectMatch[0]));
        } catch {
          console.log('[ClaudeService] Correction: Pattern match parse failed');
        }
      }

      // Strategy 4: Aggressive extraction - find any valid JSON object
      const allBraceMatches = this.extractJsonObjects(jsonStr);
      for (const match of allBraceMatches) {
        try {
          console.log('[ClaudeService] Correction: Trying aggressive JSON extraction...');
          const result = this.validateAndExtractCorrectionResult(JSON.parse(match));
          console.log('[ClaudeService] Correction: Successfully extracted JSON from mixed content');
          return result;
        } catch {
          // Try next match
          continue;
        }
      }

      // All strategies failed
      throw new Error(
        `No valid JSON found in correction response (length: ${output.length}). All extraction strategies failed.`
      );
    } catch (error) {
      console.log('[ClaudeService] Correction parsing error:', error);

      // Log the Claude response for debugging
      this.logClaudeInteraction('correctSentence-FAILED', originalOutput, error as Error);

      throw new AppError(
        ErrorCode.CLAUDE_PARSING_ERROR,
        'Failed to parse correction response',
        `첨삭 결과 파싱 실패. 로그: .claude/logs/ 폴더 확인하세요. 에러: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Step 4: 여러 문장 배치 첨삭 (성능 최적화)
   */
  async correctSentencesBatch(
    sentences: string[],
    cefrLevel: CEFRLevel
  ): Promise<CorrectionResult[]> {
    // Validation
    if (!sentences || sentences.length === 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Empty sentences array',
        '첨삭할 문장이 없습니다.'
      );
    }

    // 빈 문장 필터링
    const validSentences = sentences.filter((s) => s && s.trim().length > 0);
    if (validSentences.length === 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'No valid sentences',
        '유효한 문장이 없습니다.'
      );
    }

    const prompt = this.buildBatchCorrectionPrompt(validSentences, cefrLevel);

    try {
      const output = await this.executeClaude(prompt);
      return this.parseBatchCorrectionResponse(output, validSentences);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        ErrorCode.CLAUDE_API_ERROR,
        'Failed to correct sentences batch',
        '배치 첨삭 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
        error as Error
      );
    }
  }

  /**
   * 배치 첨삭 프롬프트 생성
   */
  private buildBatchCorrectionPrompt(sentences: string[], cefrLevel: CEFRLevel): string {
    const sentencesList = sentences.map((s, i) => `${i + 1}. "${s}"`).join('\n');

    return `
<response_format>
You MUST respond with ONLY a JSON array. No explanatory text, no markdown code blocks, no additional commentary.
Respond with ONLY the pure JSON array, nothing else.
</response_format>

**CRITICAL INSTRUCTION**: You MUST respond with ONLY a JSON array.
DO NOT include markdown code blocks (\`\`\`json...\`\`\`).
DO NOT include any text before or after the JSON array.

You are an English teacher correcting a CEFR ${cefrLevel} student's sentences.

Below are ${sentences.length} sentences to correct. Analyze and correct each one.

**IMPORTANT - Section Markers**:
Some sentences may be section markers like "----3분 리텔링 시 내용----".
- If a sentence is just a section marker (starts with "----" and ends with "----"), return it as-is without correction.
- Set "corrected" to the same as "original" and "explanation" to "섹션 구분자입니다." with "categories": []

Sentences to correct:
${sentencesList}

Analyze each sentence based on:
1. **Grammar**: Fix grammatical errors (tense, subject-verb agreement, articles, prepositions, word order, etc.)
2. **Vocabulary**: Suggest better word choices appropriate for ${cefrLevel} level
3. **Naturalness**: Make the sentence sound more natural and fluent

<output_format>
CRITICAL - Output ONLY this JSON array structure, nothing else:
[
  {
    "index": 0,
    "original": "first sentence",
    "corrected": "corrected first sentence",
    "explanation": "설명...",
    "categories": ["grammar", "vocabulary", "naturalness"]
  },
  {
    "index": 1,
    "original": "second sentence",
    "corrected": "corrected second sentence",
    "explanation": "설명...",
    "categories": ["grammar"]
  }
]

Do NOT include:
- Markdown code blocks (\`\`\`json...\`\`\`)
- Explanatory text before or after the JSON
- Any text outside the JSON array brackets
</output_format>

Guidelines:
- Return exactly ${sentences.length} items in the array (one for each sentence)
- "index" must match the sentence number (0-based)
- If a sentence is already correct, set "corrected" = "original" and "explanation" = "수정이 필요하지 않습니다."
- "categories" should include only relevant correction types
- "explanation" should be concise and in Korean
- For ${cefrLevel} level:
  - A1/A2: Use very simple explanations, focus on basic grammar
  - B1/B2: Provide intermediate-level explanations, introduce synonyms
  - C1/C2: Offer advanced explanations, discuss nuances and idiomatic usage`;
  }

  /**
   * 배치 첨삭 응답 파싱 (다중 전략)
   */
  private parseBatchCorrectionResponse(output: string, sentences: string[]): CorrectionResult[] {
    const originalOutput = output;

    try {
      let jsonStr = output.trim();

      // Strategy 0: Handle Claude CLI JSON wrapper format
      if (jsonStr.includes('"result"') && jsonStr.includes('"type"')) {
        try {
          console.log('[ClaudeService] BatchCorrection: Detecting Claude CLI wrapper format...');
          const cliResponse = JSON.parse(jsonStr);
          if (cliResponse.result && typeof cliResponse.result === 'string') {
            console.log('[ClaudeService] BatchCorrection: Extracting result from CLI wrapper...');
            jsonStr = cliResponse.result;
          }
        } catch {
          console.log(
            '[ClaudeService] BatchCorrection: Failed to parse CLI wrapper, continuing...'
          );
        }
      }

      // Strategy 1: Try direct JSON array parse
      if (jsonStr.startsWith('[') && jsonStr.endsWith(']')) {
        try {
          console.log('[ClaudeService] BatchCorrection: Trying direct JSON array parse...');
          return this.validateAndExtractBatchCorrectionResult(JSON.parse(jsonStr), sentences);
        } catch {
          console.log('[ClaudeService] BatchCorrection: Direct parse failed, trying extraction...');
        }
      }

      // Strategy 2: Extract from markdown code block
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        try {
          console.log('[ClaudeService] BatchCorrection: Trying code block extraction...');
          return this.validateAndExtractBatchCorrectionResult(
            JSON.parse(codeBlockMatch[1]),
            sentences
          );
        } catch {
          console.log('[ClaudeService] BatchCorrection: Code block parse failed');
        }
      }

      // Strategy 3: Find JSON array pattern
      const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        try {
          console.log('[ClaudeService] BatchCorrection: Trying array pattern extraction...');
          return this.validateAndExtractBatchCorrectionResult(JSON.parse(arrayMatch[0]), sentences);
        } catch {
          console.log('[ClaudeService] BatchCorrection: Array pattern parse failed');
        }
      }

      throw new Error(
        `No valid JSON array found in batch correction response (length: ${output.length})`
      );
    } catch (error) {
      console.log('[ClaudeService] BatchCorrection parsing error:', error);
      this.logClaudeInteraction('correctSentencesBatch-FAILED', originalOutput, error as Error);

      throw new AppError(
        ErrorCode.CLAUDE_PARSING_ERROR,
        'Failed to parse batch correction response',
        `배치 첨삭 결과 파싱 실패. 로그: .claude/logs/ 폴더 확인. 에러: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * 배치 첨삭 결과 검증 및 추출
   */
  private validateAndExtractBatchCorrectionResult(
    parsed: any,
    sentences: string[]
  ): CorrectionResult[] {
    if (!Array.isArray(parsed)) {
      throw new Error('Response must be an array');
    }

    const results: CorrectionResult[] = [];

    for (let i = 0; i < sentences.length; i++) {
      // index로 매칭하거나, 순서대로 매칭
      const item = parsed.find((p: any) => p.index === i) || parsed[i];

      if (!item) {
        // 해당 문장에 대한 결과가 없으면 원본 그대로 반환
        results.push({
          original: sentences[i],
          corrected: sentences[i],
          explanation: '첨삭 결과 없음',
          categories: [],
        });
        continue;
      }

      if (!item.original || !item.corrected || item.explanation === undefined) {
        throw new Error(`Missing required fields in correction item at index ${i}`);
      }

      if (!Array.isArray(item.categories)) {
        throw new Error(`categories must be an array at index ${i}`);
      }

      results.push({
        original: item.original,
        corrected: item.corrected,
        explanation: item.explanation,
        categories: item.categories,
      });
    }

    return results;
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

  /**
   * Step 6: 대화 전체 첨삭 (배치 처리)
   */
  async correctConversation(conversationId: number): Promise<ConversationCorrectionResult[]> {
    // Repositories 초기화
    const db = getDatabase();
    const conversationRepo = new ConversationRepository(db);
    const messageRepo = new MessageRepository(db);
    const topicRepo = new TopicRepository(db);

    // 1. 대화 데이터 조회
    const conversation = conversationRepo.findById(conversationId);
    if (!conversation) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Conversation not found', '대화를 찾을 수 없습니다.');
    }

    const messages = messageRepo.findByConversationId(conversationId);
    if (!messages || messages.length === 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'No messages in conversation',
        '대화 내용이 없습니다.'
      );
    }

    const topic = await topicRepo.findById(conversation.topicId);
    if (!topic) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Topic not found', '토픽을 찾을 수 없습니다.');
    }

    // 2. 배치 첨삭 프롬프트 생성
    const prompt = this.buildConversationCorrectionPrompt(
      messages,
      topic.cefrLevel,
      topic.englishContent
    );

    // 3. Claude CLI 호출
    try {
      const output = await this.executeClaude(prompt);

      // 4. JSON 배열 응답 파싱
      return this.parseConversationCorrectionResponse(output, messages);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        ErrorCode.CLAUDE_API_ERROR,
        'Failed to correct conversation',
        '대화 첨삭 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
        error as Error
      );
    }
  }

  /**
   * 대화 첨삭 전용 프롬프트 생성
   */
  private buildConversationCorrectionPrompt(
    messages: Message[],
    cefrLevel: CEFRLevel,
    topicContent: string
  ): string {
    // 대화 히스토리 포맷팅
    const conversationHistory = messages
      .map((msg, i) => {
        const speaker = msg.speaker === 'user' ? 'Student' : 'AI';
        return `${i + 1}. [${speaker}] (${msg.timestamp}s): ${msg.content}`;
      })
      .join('\n');

    // user 메시지만 추출
    const userMessages = messages.filter((msg) => msg.speaker === 'user');

    return `You are an English teacher reviewing a CEFR ${cefrLevel} student's conversation practice.

**Topic**: ${topicContent}

**Full Conversation**:
${conversationHistory}

Analyze and correct ONLY the student's messages (marked as [Student]) based on:
1. **Grammar**: Fix grammatical errors (tense, subject-verb agreement, articles, prepositions, etc.)
2. **Vocabulary**: Suggest better word choices appropriate for ${cefrLevel} level
3. **Naturalness**: Make the sentences sound more natural in the conversation context
4. **Conversation Flow**: Consider the context of the AI's questions when correcting

Return ONLY a JSON array with corrections for each student message:
[
  {
    "messageId": <message_id>,
    "speaker": "user",
    "original": "...",
    "corrected": "...",
    "explanation": "...",
    "categories": ["grammar", "vocabulary", "naturalness"],
    "timestamp": <timestamp>
  },
  ...
]

**Guidelines**:
- If a sentence is already correct, set "corrected" = "original" and "explanation" = "수정이 필요하지 않습니다."
- "categories" should include only relevant correction types (e.g., only ["grammar"] if no vocabulary/naturalness issues)
- "explanation" should be concise and in Korean (for ${cefrLevel} learners)
- Consider the conversation context: responses should make sense in the flow of the dialogue
- Focus on helping the student improve conversational skills
- For ${cefrLevel} level:
  - A1/A2: Use very simple explanations, focus on basic grammar
  - B1/B2: Provide intermediate-level explanations, introduce better phrases
  - C1/C2: Offer advanced explanations, discuss nuances and idiomatic usage

**Important**: Provide ONLY the JSON array, no additional text or markdown formatting.

Student Messages to Correct:
${userMessages.map((msg, i) => `${i + 1}. (messageId: ${msg.id}, timestamp: ${msg.timestamp}s) "${msg.content}"`).join('\n')}

JSON Array Output:`;
  }

  /**
   * 대화 첨삭 응답 파싱
   */
  private parseConversationCorrectionResponse(
    output: string,
    allMessages: Message[]
  ): ConversationCorrectionResult[] {
    try {
      let jsonStr = output.trim();

      // ```json ... ``` 제거
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      // JSON 배열 파싱
      const parsed = JSON.parse(jsonStr);

      if (!Array.isArray(parsed)) {
        throw new Error('Response must be an array');
      }

      // 검증
      for (const item of parsed) {
        if (
          !item.messageId ||
          !item.original ||
          !item.corrected ||
          item.explanation === undefined
        ) {
          throw new AppError(
            ErrorCode.CLAUDE_PARSING_ERROR,
            'Missing required fields in correction item',
            'Missing required fields'
          );
        }
        if (!Array.isArray(item.categories)) {
          throw new AppError(
            ErrorCode.CLAUDE_PARSING_ERROR,
            'Categories must be an array',
            'Categories must be an array'
          );
        }
      }

      // user 메시지 첨삭 결과 + ai 메시지 원문 결합
      const results: ConversationCorrectionResult[] = [];

      for (const message of allMessages) {
        if (message.speaker === 'ai') {
          // AI 메시지는 첨삭 없이 원문만
          results.push({
            messageId: message.id,
            speaker: 'ai',
            original: message.content,
            corrected: message.content,
            explanation: '',
            categories: [],
            timestamp: message.timestamp,
          });
        } else {
          // user 메시지는 첨삭 결과 사용
          const correction = parsed.find(
            (c: ConversationCorrectionResult) => c.messageId === message.id
          );
          if (correction) {
            results.push({
              messageId: message.id,
              speaker: 'user',
              original: correction.original,
              corrected: correction.corrected,
              explanation: correction.explanation,
              categories: correction.categories,
              timestamp: correction.timestamp,
            });
          }
        }
      }

      return results;
    } catch (error) {
      // AppError는 그대로 재throw
      if (error instanceof AppError) {
        throw error;
      }

      // 기타 에러는 AppError로 감싸서 throw
      throw new AppError(
        ErrorCode.CLAUDE_PARSING_ERROR,
        'Failed to parse conversation correction response',
        '대화 첨삭 결과 파싱에 실패했습니다. 다시 시도해주세요.',
        error as Error
      );
    }
  }
}
