/**
 * 내장 알고리즘 기반 텍스트 정규화 서비스
 * STT 결과물의 기본적인 포맷팅을 수행합니다.
 * LLM 호출 없이 빠른 응답 (<50ms)을 제공합니다.
 */
export class TextNormalizationService {
  /**
   * STT 텍스트 정규화 (내장 알고리즘)
   *
   * 정규화 규칙:
   * 1. 연속 공백 → 단일 공백
   * 2. 문장 맨 앞 대문자화
   * 3. 마침표/물음표/느낌표 다음 첫 글자 대문자화
   * 4. 단독 i → I 변환
   *
   * @param text STT 결과 텍스트 (예: "hello my name is john")
   * @returns 정규화된 텍스트 (예: "Hello my name is john")
   *
   * @performance <50ms (일반적으로 <10ms)
   * @dependencies 없음 (네트워크 호출 없음)
   */
  async normalizeText(text: string): Promise<string> {
    try {
      // 빈 텍스트 처리
      if (!text || text.trim().length === 0) {
        return text;
      }

      let normalized = text;

      // 1. 연속 공백 → 단일 공백
      normalized = normalized.replace(/\s{2,}/g, ' ').trim();

      // 2. 문장 맨 앞 대문자화
      if (normalized.length > 0) {
        normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
      }

      // 3. 마침표/물음표/느낌표 다음 첫 글자 대문자화
      normalized = normalized.replace(
        /([.!?])\s+([a-z])/g,
        (_, punct, letter) => `${punct} ${letter.toUpperCase()}`
      );

      // 4. 단독 i → I 변환 (I am, I think 등)
      normalized = normalized.replace(/\bi\b/g, 'I');

      return normalized;
    } catch (error) {
      // 예상치 못한 에러 발생 시 원본 반환 (graceful degradation)
      console.error('[TextNormalization] Unexpected error, returning original:', error);
      return text;
    }
  }
}
