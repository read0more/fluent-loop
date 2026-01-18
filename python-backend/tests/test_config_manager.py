"""
ConfigManager 단위 테스트

테스트 케이스:
- TC-001: Electron 설정 우선순위 (Electron > .env)
- TC-002: .env fallback (Electron 설정 없을 때)
- TC-003: 기본값 fallback (Electron, .env 모두 없을 때)
- TC-004: camelCase → UPPER_SNAKE_CASE 변환
- TC-005: 타입 자동 변환 (boolean)
- TC-009: get_all() 디버깅 정보
- TC-010: 싱글톤 패턴
- TC-014: update() 부분 업데이트
- TC-025: 빈 문자열 설정
- TC-026: None 값 처리
"""

import pytest
import os
from config import ConfigManager


class TestConfigManager:
    """ConfigManager 테스트 클래스"""

    def setup_method(self):
        """각 테스트 전 ConfigManager 싱글톤 초기화"""
        # 싱글톤 초기화
        ConfigManager._instance = None
        # 환경 변수 정리
        env_keys = ["TTS_PROVIDER", "TTS_VOICE", "SUPERTONIC_VOICE", "STT_USE_GPU"]
        for key in env_keys:
            if key in os.environ:
                del os.environ[key]

    def test_tc001_electron_priority_over_env(self):
        """TC-001: Electron 설정이 .env보다 우선 적용됨"""
        # Arrange
        os.environ["TTS_PROVIDER"] = "edge-tts"
        manager = ConfigManager.get_instance()

        # Act
        manager.update({"ttsProvider": "supertonic"})

        # Assert
        assert manager.get("TTS_PROVIDER") == "supertonic"

    def test_tc002_env_fallback(self):
        """TC-002: Electron 설정이 없으면 .env 사용"""
        # Arrange
        os.environ["TTS_PROVIDER"] = "edge-tts"
        manager = ConfigManager.get_instance()

        # Act
        result = manager.get("TTS_PROVIDER")

        # Assert
        assert result == "edge-tts"

    def test_tc003_default_fallback(self):
        """TC-003: Electron 설정도 .env도 없으면 기본값 사용"""
        # Arrange
        manager = ConfigManager.get_instance()

        # Act
        result = manager.get("TTS_PROVIDER", "supertonic")

        # Assert
        assert result == "supertonic"

    def test_tc004_camel_to_upper_snake_conversion(self):
        """TC-004: camelCase → UPPER_SNAKE_CASE 변환"""
        # Arrange
        manager = ConfigManager.get_instance()

        # Act
        manager.update({"ttsProvider": "supertonic", "sttUseGpu": True})

        # Assert
        assert "TTS_PROVIDER" in manager.electron_config
        assert "STT_USE_GPU" in manager.electron_config
        assert manager.electron_config["STT_USE_GPU"] is True

    def test_tc005_type_auto_conversion_boolean(self):
        """TC-005: 환경 변수 문자열 → boolean 자동 변환"""
        # Arrange
        os.environ["STT_USE_GPU"] = "true"
        manager = ConfigManager.get_instance()

        # Act
        result = manager.get("STT_USE_GPU")

        # Assert
        assert result is True
        assert type(result) is bool

    def test_tc009_get_all_debug_info(self):
        """TC-009: get_all() 디버깅 정보 반환"""
        # Arrange
        os.environ["TTS_PROVIDER"] = "edge-tts"
        manager = ConfigManager.get_instance()
        manager.update({"ttsProvider": "supertonic"})

        # Act
        result = manager.get_all()

        # Assert
        assert "electron_config" in result
        assert "env_vars" in result
        assert result["electron_config"]["TTS_PROVIDER"] == "supertonic"

    def test_tc010_singleton_pattern(self):
        """TC-010: 싱글톤 패턴 - 동일한 인스턴스 반환"""
        # Act
        instance1 = ConfigManager.get_instance()
        instance2 = ConfigManager.get_instance()

        # Assert
        assert instance1 is instance2

    def test_tc014_partial_update(self):
        """TC-014: update() 부분 업데이트 - 기존 값 유지"""
        # Arrange
        manager = ConfigManager.get_instance()
        manager.update({"ttsProvider": "edge-tts", "sttUseGpu": False})

        # Act
        manager.update({"ttsProvider": "supertonic"})

        # Assert
        assert manager.get("TTS_PROVIDER") == "supertonic"
        assert manager.get("STT_USE_GPU") is False

    def test_tc025_empty_string_config(self):
        """TC-025: 빈 문자열 설정 처리"""
        # Arrange
        manager = ConfigManager.get_instance()

        # Act
        manager.update({"ttsProvider": ""})
        result = manager.get("TTS_PROVIDER")

        # Assert - 빈 문자열 유지 또는 .env fallback (구현 정책에 따라)
        assert result == "" or result is None

    def test_tc026_none_value_handling(self):
        """TC-026: None 값 처리 - 무시하고 fallback"""
        # Arrange
        os.environ["TTS_PROVIDER"] = "edge-tts"
        manager = ConfigManager.get_instance()

        # Act
        manager.update({"ttsProvider": None})
        result = manager.get("TTS_PROVIDER", "default")

        # Assert - None 값 무시, .env 또는 기본값 사용
        assert result in ["default", "edge-tts"]
