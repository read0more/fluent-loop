"""
ConfigManager - 설정 우선순위 관리 클래스

역할:
- Electron 설정과 .env 환경 변수 통합 관리
- 설정 우선순위: Electron > .env > 기본값
- camelCase → UPPER_SNAKE_CASE 변환

사용 예시:
    config = ConfigManager.get_instance()
    config.update({"ttsProvider": "supertonic"})
    provider_type = config.get("TTS_PROVIDER", "edge-tts")
"""

from typing import Any, Dict, Optional
import os
import re


class ConfigManager:
    """설정 우선순위 관리 클래스 (싱글톤)"""

    _instance: Optional['ConfigManager'] = None
    electron_config: Dict[str, Any]

    def __init__(self):
        """초기화 (싱글톤이므로 직접 호출 금지, get_instance() 사용)"""
        self.electron_config = {}

    @staticmethod
    def get_instance() -> 'ConfigManager':
        """
        싱글톤 인스턴스 반환

        Returns:
            ConfigManager 인스턴스
        """
        if ConfigManager._instance is None:
            ConfigManager._instance = ConfigManager()
        return ConfigManager._instance

    def get(self, key: str, default: Any = None) -> Any:
        """
        설정 값 조회 (우선순위: Electron > .env > default)

        Args:
            key: 설정 키 (예: "TTS_PROVIDER")
            default: 기본값

        Returns:
            설정 값 (타입 자동 변환)

        Examples:
            >>> config.get("TTS_PROVIDER", "supertonic")
            "edge-tts"
        """
        # 1순위: Electron 설정
        if key in self.electron_config:
            return self.electron_config[key]

        # 2순위: 환경 변수
        env_value = os.getenv(key)
        if env_value is not None:
            return self._convert_type(env_value)

        # 3순위: 기본값
        return default

    def update(self, new_config: Dict[str, Any]) -> None:
        """
        Electron 설정 업데이트

        Args:
            new_config: 새 설정 (camelCase 키를 UPPER_SNAKE_CASE로 변환)

        Examples:
            >>> config.update({"ttsProvider": "supertonic", "sttUseGpu": True})
            >>> config.electron_config
            {"TTS_PROVIDER": "supertonic", "STT_USE_GPU": True}
        """
        # camelCase → UPPER_SNAKE_CASE 변환
        for key, value in new_config.items():
            # None 값은 무시
            if value is not None:
                upper_key = self._camel_to_upper_snake(key)
                self.electron_config[upper_key] = value

    def get_all(self) -> Dict[str, Any]:
        """
        모든 설정 반환 (디버깅용)

        Returns:
            electron_config와 env_vars를 포함한 딕셔너리
        """
        return {
            "electron_config": self.electron_config,
            "env_vars": {
                "TTS_PROVIDER": os.getenv("TTS_PROVIDER"),
                "TTS_VOICE": os.getenv("TTS_VOICE"),
                "SUPERTONIC_VOICE": os.getenv("SUPERTONIC_VOICE"),
                "STT_USE_GPU": os.getenv("STT_USE_GPU"),
            }
        }

    def _convert_type(self, value: str) -> Any:
        """
        환경 변수 문자열을 적절한 타입으로 변환

        Args:
            value: 환경 변수 문자열

        Returns:
            변환된 값 (boolean 또는 원본 문자열)
        """
        if value.lower() == "true":
            return True
        elif value.lower() == "false":
            return False
        return value

    def _camel_to_upper_snake(self, camel: str) -> str:
        """
        camelCase → UPPER_SNAKE_CASE 변환

        Args:
            camel: camelCase 문자열

        Returns:
            UPPER_SNAKE_CASE 문자열

        Examples:
            >>> _camel_to_upper_snake("ttsProvider")
            "TTS_PROVIDER"
            >>> _camel_to_upper_snake("sttUseGpu")
            "STT_USE_GPU"
        """
        # 정규식으로 대문자 앞에 _ 삽입
        snake = re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', camel)
        return snake.upper()
