"""
TTS Provider 추상화 패키지

Strategy 패턴을 사용한 TTS 엔진 추상화
- ITTSProvider: 공통 인터페이스
- EdgeTTSProvider: Microsoft Edge TTS 구현
- SupertonicTTSProvider: Supertonic TTS 구현
- TTSProviderFactory: 환경 변수 기반 Provider 생성

사용 예시:
    from tts import TTSProviderFactory

    provider = TTSProviderFactory.create_provider()
    result = await provider.synthesize_async(text, path)
"""

from .base import ITTSProvider
from .edge_provider import EdgeTTSProvider
from .supertonic_provider import SupertonicTTSProvider
from .factory import TTSProviderFactory

__all__ = [
    "ITTSProvider",
    "EdgeTTSProvider",
    "SupertonicTTSProvider",
    "TTSProviderFactory",
]

__version__ = "1.0.0"
