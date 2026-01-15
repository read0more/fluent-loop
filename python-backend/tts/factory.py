"""
TTSProviderFactory - TTS Provider 생성 팩토리

환경 변수를 읽어 적절한 TTS Provider 인스턴스 생성
Factory 패턴 적용으로 객체 생성 로직 중앙화

환경 변수:
- TTS_PROVIDER: "edge-tts" | "supertonic" (기본값: "supertonic")
- TTS_VOICE: Edge TTS 음성 ID (기본값: "en-US-AriaNeural")
- SUPERTONIC_API_KEY: Supertonic API 키 (필수, provider=supertonic일 때)
- SUPERTONIC_VOICE: Supertonic 음성 ID (기본값: "en-us-1")
- SUPERTONIC_BASE_URL: Supertonic API 엔드포인트 (기본값: "https://api.supertonic.ai/v1")

사용 예시:
    provider = TTSProviderFactory.create_provider()
    result = await provider.synthesize_async(text, path)

에러 처리:
- TTS_PROVIDER가 지원되지 않는 값인 경우 ValueError 발생
- Supertonic 선택 시 SUPERTONIC_API_KEY 누락 시 ValueError 발생
"""

import os
from .base import ITTSProvider
from .edge_provider import EdgeTTSProvider
from .supertonic_provider import SupertonicTTSProvider


class TTSProviderFactory:
    """TTS Provider Factory"""

    @staticmethod
    def create_provider() -> ITTSProvider:
        """
        환경 변수를 읽어 적절한 TTS Provider 인스턴스 생성

        Returns:
            ITTSProvider 인스턴스

        Raises:
            ValueError: 잘못된 TTS_PROVIDER 값 또는 필수 환경 변수 누락
        """
        provider_type = os.getenv("TTS_PROVIDER", "supertonic").lower()

        # Edge TTS Provider
        if provider_type == "edge-tts":
            voice_id = os.getenv("TTS_VOICE", "en-US-AriaNeural")
            print(f"[Factory] Creating EdgeTTSProvider (voice: {voice_id})")
            return EdgeTTSProvider(voice_id=voice_id)

        # Supertonic TTS Provider
        elif provider_type == "supertonic":
            api_key = os.getenv("SUPERTONIC_API_KEY")
            if not api_key:
                raise ValueError(
                    "SUPERTONIC_API_KEY environment variable is required when TTS_PROVIDER=supertonic. "
                    "Please set it in your .env file."
                )

            voice_id = os.getenv("SUPERTONIC_VOICE", "en-us-1")
            base_url = os.getenv(
                "SUPERTONIC_BASE_URL", "https://api.supertonic.ai/v1"
            )

            print(
                f"[Factory] Creating SupertonicTTSProvider (voice: {voice_id}, base_url: {base_url})"
            )
            return SupertonicTTSProvider(
                api_key=api_key, voice_id=voice_id, base_url=base_url
            )

        # 지원하지 않는 프로바이더
        else:
            raise ValueError(
                f"Unknown TTS_PROVIDER: {provider_type}. "
                f"Supported providers: edge-tts, supertonic"
            )
