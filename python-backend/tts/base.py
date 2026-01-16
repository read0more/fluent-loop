"""
ITTSProvider 추상 기반 클래스

모든 TTS Provider가 구현해야 할 공통 인터페이스 정의
- synthesize_async(): 텍스트를 음성으로 변환 (비동기)
- get_available_voices_async(): 사용 가능한 음성 목록 조회 (비동기)
- get_provider_info(): 프로바이더 정보 반환 (동기)

OCP 준수: 새로운 TTS 엔진 추가 시 기존 코드 수정 불필요
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any


class ITTSProvider(ABC):
    """TTS Provider 추상 인터페이스"""

    @abstractmethod
    async def synthesize_async(
        self, text: str, output_path: str, voice_id: str | None = None
    ) -> Dict[str, Any]:
        """
        텍스트를 음성으로 비동기 변환

        Args:
            text: 변환할 텍스트 (최대 10,000자)
            output_path: 저장할 파일 경로 (절대 경로)
            voice_id: 사용할 음성 ID (None이면 기본 음성 사용)

        Returns:
            성공 시:
            {
                "success": True,
                "file_path": str,       # 생성된 파일 경로
                "duration": float,      # 음성 길이 (초)
                "voice_id": str,        # 사용된 음성 ID
                "provider": str         # 프로바이더명
            }

            실패 시:
            {
                "success": False,
                "error": str,           # 에러 유형
                "detail": str           # 에러 상세 메시지
            }
        """
        pass

    @abstractmethod
    async def get_available_voices_async(self) -> List[Dict[str, str]]:
        """
        사용 가능한 음성 목록 조회 (비동기)

        Returns:
            [
                {
                    "id": str,          # 음성 고유 ID
                    "name": str,        # 친숙한 이름 (예: "Aria (Female, US)")
                    "language": str,    # 언어 코드 (예: "en-US")
                    "gender": str       # "male" | "female" | "neutral"
                },
                ...
            ]
        """
        pass

    @abstractmethod
    def get_provider_info(self) -> Dict[str, str]:
        """
        프로바이더 정보 반환 (동기 메서드)

        Returns:
            {
                "provider": str,        # "edge-tts" | "supertonic" | ...
                "version": str,         # 프로바이더 버전
                "default_voice": str    # 기본 음성 ID
            }
        """
        pass
