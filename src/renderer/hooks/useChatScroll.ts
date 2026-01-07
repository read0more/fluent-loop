import { useRef, useEffect } from 'react';

/**
 * 채팅 컨테이너 자동 스크롤 훅
 * 새 메시지 추가 시 하단으로 자동 스크롤
 */
export interface UseChatScrollReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  scrollToBottom: () => void;
}

export const useChatScroll = (dependencies: unknown[]): UseChatScrollReturn => {
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, dependencies);

  return { containerRef, scrollToBottom };
};
