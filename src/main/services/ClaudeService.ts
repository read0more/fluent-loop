import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TopicGenerationResult, CEFRLevel } from '../database/models';
import { AppError, ErrorCode } from '../errors/AppError';

export interface IClaudeService {
  generateEnglishScript(koreanText: string, cefrLevel: CEFRLevel): Promise<TopicGenerationResult>;
  extractKeywords(englishText: string): Promise<string[]>;
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
      const psCommand = `$prompt = Get-Content -Path '${tempFile}' -Raw -Encoding UTF8; claude -p $prompt --model haiku`;

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
}
