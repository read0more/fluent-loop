"""
TTSProviderFactory 단위 테스트

테스트 케이스:
- TC-006: 파라미터로 Provider 생성
- TC-007: ConfigManager로 Provider 생성
- TC-008: 잘못된 Provider 타입
"""

import pytest
import os
from tts.factory import TTSProviderFactory
from tts.edge_provider import EdgeTTSProvider
from tts.supertonic_provider import SupertonicTTSProvider
from config import ConfigManager


class TestTTSProviderFactory:
    """TTSProviderFactory 테스트 클래스"""

    def setup_method(self):
        """각 테스트 전 초기화"""
        # ConfigManager 싱글톤 초기화
        ConfigManager._instance = None
        # 환경 변수 정리
        env_keys = ["TTS_PROVIDER", "TTS_VOICE", "SUPERTONIC_VOICE"]
        for key in env_keys:
            if key in os.environ:
                del os.environ[key]

    def test_tc006_create_provider_with_parameter(self):
        """TC-006: 파라미터로 Provider 생성"""
        # Act
        provider = TTSProviderFactory.create_provider(
            provider_type="edge-tts",
            voice_id="en-US-GuyNeural"
        )

        # Assert
        assert isinstance(provider, EdgeTTSProvider)
        assert provider.voice_id == "en-US-GuyNeural"

    def test_tc007_create_provider_from_config_manager(self):
        """TC-007: ConfigManager 설정으로 Provider 생성"""
        # Arrange
        config_manager = ConfigManager.get_instance()
        config_manager.update({"ttsProvider": "supertonic", "supertonicVoice": "M4"})

        # Act
        provider = TTSProviderFactory.create_provider()

        # Assert
        assert isinstance(provider, SupertonicTTSProvider)
        assert provider.voice_name == "M4"

    def test_tc008_invalid_provider_type(self):
        """TC-008: 잘못된 Provider 타입 → ValueError 발생"""
        # Act & Assert
        with pytest.raises(ValueError, match="Unknown TTS_PROVIDER"):
            TTSProviderFactory.create_provider(provider_type="invalid-provider")
