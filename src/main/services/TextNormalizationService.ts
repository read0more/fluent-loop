import { ClaudeSDKClient } from './ClaudeSDKClient';

/**
 * LLM 기반 텍스트 정규화 서비스
 * STT 결과물의 구두점/포맷팅을 교정합니다.
 */
export class TextNormalizationService {
  private client: ClaudeSDKClient;

  constructor(claudeClient?: ClaudeSDKClient) {
    this.client = claudeClient || new ClaudeSDKClient();
  }

  /**
   * LLM 기반 텍스트 정규화
   * - 구두점 삽입 (마침표, 콤마, 느낌표, 물음표)
   * - 대소문자 교정 (문장 시작은 대문자, 중간은 소문자)
   * - 연속 공백 제거
   *
   * @param text STT 결과 텍스트
   * @returns 정규화된 텍스트
   */
  async normalizeText(text: string): Promise<string> {
    // 1. 빈 텍스트 또는 짧은 텍스트는 그대로 반환
    if (!text || text.trim().length < 5) {
      return text;
    }

    // 2. 기본 정규화 (연속 공백 제거)
    const basicNormalized = text.replace(/\s{2,}/g, ' ').trim();

    // 3. LLM 기반 구두점/대소문자 교정
    const prompt = `You are a strict text normalizer. Fix ONLY punctuation and capitalization.

CRITICAL - NEVER VIOLATE:
- NEVER remove, add, or change ANY words
- NEVER rephrase or restructure sentences
- NEVER wrap output in quotes
- The word count must remain EXACTLY the same

Allowed changes ONLY:
1. Add period at end if missing
2. Add comma in lists (e.g., "one two and three" → "one, two, and three")
3. Capitalize first letter of sentences
4. Keep time expressions like "8 a.m." or "3:30 p.m." unchanged

Input text: ${basicNormalized}

Return ONLY the corrected text without any quotes or formatting.`;

    try {
      const response = await this.client.query(prompt);
      let normalized = response.trim();

      // LLM이 따옴표로 감싼 경우 제거
      if (normalized.startsWith('"') && normalized.endsWith('"')) {
        normalized = normalized.slice(1, -1);
      }
      // 작은따옴표 케이스도 처리
      if (normalized.startsWith("'") && normalized.endsWith("'")) {
        normalized = normalized.slice(1, -1);
      }

      // 응답이 비어있거나 너무 다르면 기본 정규화된 텍스트 반환
      if (!normalized || normalized.length < basicNormalized.length * 0.5) {
        console.log('[TextNormalization] LLM response too short, using basic normalization');
        return basicNormalized;
      }

      // 단어 수 비교 검증 (LLM이 단어를 삭제/추가했는지 확인)
      const inputWords = basicNormalized.split(/\s+/).length;
      const outputWords = normalized.split(/\s+/).length;

      if (outputWords !== inputWords) {
        console.log(
          `[TextNormalization] Word count mismatch (input: ${inputWords}, output: ${outputWords}), using basic normalization`
        );
        return basicNormalized;
      }

      return normalized;
    } catch (error) {
      console.error('[TextNormalization] LLM normalization failed:', error);
      // LLM 실패 시 기본 정규화된 텍스트 반환
      return basicNormalized;
    }
  }
}
