"""
TTSProviderFactory - TTS Provider 생성 팩토리

환경 변수를 읽어 적절한 TTS Provider 인스턴스 생성
Factory 패턴 적용으로 객체 생성 로직 중앙화

환경 변수:
- TTS_PROVIDER: "edge-tts" | "supertonic" (기본값: "supertonic")
- TTS_VOICE: Edge TTS 음성 ID (기본값: "en-US-AriaNeural")
- SUPERTONIC_VOICE: Supertonic 음성 이름 (기본값: "M4", 옵션: M1~M4, F1~F2)

사용 예시:
    provider = TTSProviderFactory.create_provider()
    result = await provider.synthesize_async(text, path)

에러 처리:
- TTS_PROVIDER가 지원되지 않는 값인 경우 ValueError 발생
"""

import os
from typing import Optional
from .base import ITTSProvider
from .edge_provider import EdgeTTSProvider
from .supertonic_provider import SupertonicTTSProvider


class TTSProviderFactory:
    """TTS Provider Factory"""

    @staticmethod
    def create_provider(
        provider_type: Optional[str] = None,
        voice_id: Optional[str] = None
    ) -> ITTSProvider:
        """
        TTS Provider 인스턴스 생성 (파라미터 또는 환경 변수 사용)

        우선순위: 파라미터 > ConfigManager > 환경 변수 > 기본값

        Args:
            provider_type: TTS Provider 타입 ("edge-tts" | "supertonic")
                          None이면 ConfigManager 또는 환경 변수 사용
            voice_id: 음성 ID (Edge TTS의 경우) 또는 음성 이름 (Supertonic의 경우)
                     None이면 ConfigManager 또는 환경 변수 사용

        Returns:
            ITTSProvider 인스턴스

        Raises:
            ValueError: 잘못된 TTS_PROVIDER 값 또는 필수 환경 변수 누락
        """
        # ConfigManager 임포트 (순환 참조 방지를 위해 함수 내부에서 import)
        from config import ConfigManager
        config = ConfigManager.get_instance()

        # provider_type이 파라미터로 주어지지 않으면 ConfigManager에서 조회
        if provider_type is None:
            provider_type = config.get("TTS_PROVIDER", "supertonic")

        provider_type = provider_type.lower()

        # Edge TTS Provider
        if provider_type == "edge-tts":
            # voice_id가 파라미터로 주어지지 않으면 ConfigManager에서 조회
            if voice_id is None:
                voice_id = config.get("TTS_VOICE", "en-US-AriaNeural")

            print(f"[Factory] Creating EdgeTTSProvider (voice: {voice_id})")
            return EdgeTTSProvider(voice_id=voice_id)

        # Supertonic TTS Provider (로컬 ONNX 추론, API 키 불필요)
        elif provider_type == "supertonic":
            # voice_id가 파라미터로 주어지지 않으면 ConfigManager에서 조회
            if voice_id is None:
                voice_id = config.get("SUPERTONIC_VOICE", "M4")

            print(f"[Factory] Creating SupertonicTTSProvider (voice: {voice_id})")
            return SupertonicTTSProvider(voice_name=voice_id)

        # 지원하지 않는 프로바이더
        else:
            raise ValueError(
                f"Unknown TTS_PROVIDER: {provider_type}. "
                f"Supported providers: edge-tts, supertonic"
            )
