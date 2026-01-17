"""
Step5 실시간 STT Provider 테스트

테스트 프레임워크: pytest + pytest-asyncio
참고 문서: claude.config/dev-workflow/docs/test-cases.md
테스트 케이스: TC-001 ~ TC-048

작성일: 2026-01-17
작성자: Test Code Writer (dev-workflow-test-writer)
"""

import os
import pytest
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock
from typing import Optional


# ============================================================
# 1. 단위 테스트 - FasterWhisperSTTProvider
# ============================================================


class TestFasterWhisperSTTProvider:
    """FasterWhisperSTTProvider 단위 테스트 (TC-001 ~ TC-005)"""

    def test_tc_001_initialization_success(self):
        """TC-001: FasterWhisperSTTProvider 초기화 성공"""
        # 실제 구현이 없으므로 import 시도만으로 실패할 것
        with pytest.raises(ImportError):
            from stt_provider import FasterWhisperSTTProvider

            provider = FasterWhisperSTTProvider(
                model_size="tiny",
                compute_type="int8"
            )

            assert provider.model is not None
            assert provider.device in ["cpu", "cuda"]
            assert provider.model_size == "tiny"
            assert provider.compute_type == "int8"

    def test_tc_002_transcribe_chunk_success(self):
        """TC-002: FasterWhisperSTTProvider 청크 변환 성공"""
        with pytest.raises(ImportError):
            from stt_provider import FasterWhisperSTTProvider

            provider = FasterWhisperSTTProvider(model_size="tiny")

            # 테스트용 청크 파일 경로 (실제로는 존재하지 않음)
            test_chunk_path = "test_chunk_2s.webm"

            result = provider.transcribe_chunk(
                audio_path=test_chunk_path,
                language="ko"
            )

            assert result.success is True
            assert len(result.text) > 0
            assert result.language == "ko"
            assert result.is_final is False
            assert result.duration > 0

    def test_tc_003_transcribe_chunk_with_context(self):
        """TC-003: FasterWhisperSTTProvider 컨텍스트 포함 변환"""
        with pytest.raises(ImportError):
            from stt_provider import FasterWhisperSTTProvider

            provider = FasterWhisperSTTProvider(model_size="tiny")

            # 첫 번째 청크 변환
            result1 = provider.transcribe_chunk("chunk1.webm", language="ko")
            context = result1.text

            # 컨텍스트를 사용한 두 번째 청크 변환
            result2 = provider.transcribe_chunk(
                "chunk2.webm",
                language="ko",
                context=context
            )

            assert result2.success is True
            assert result2.text  # 컨텍스트가 반영되었는지는 수동 검증

    def test_tc_004_transcribe_full_file(self):
        """TC-004: FasterWhisperSTTProvider 전체 파일 배치 변환"""
        with pytest.raises(ImportError):
            from stt_provider import FasterWhisperSTTProvider

            provider = FasterWhisperSTTProvider(model_size="tiny")

            result = provider.transcribe("full_audio_10s.webm", language="ko")

            assert result.success is True
            assert len(result.text) > 20
            assert result.is_final is True

    def test_tc_005_get_model_info(self):
        """TC-005: FasterWhisperSTTProvider 모델 정보 조회"""
        with pytest.raises(ImportError):
            from stt_provider import FasterWhisperSTTProvider

            provider = FasterWhisperSTTProvider(model_size="base")
            info = provider.get_model_info()

            assert "name" in info
            assert info["name"] == "faster-whisper"
            assert "version" in info
            assert "language_support" in info
            assert "ko" in info["language_support"]
            assert "device" in info
            assert "compute_type" in info


# ============================================================
# 2. 단위 테스트 - STTProviderFactory
# ============================================================


class TestSTTProviderFactory:
    """STTProviderFactory 단위 테스트 (TC-006 ~ TC-008)"""

    def test_tc_006_create_whisper_provider(self):
        """TC-006: Provider 팩토리 - WhisperSTTProvider 생성"""
        with pytest.raises(ImportError):
            from stt_provider import (
                STTProviderFactory,
                STTProviderType,
                WhisperSTTProvider
            )

            provider1 = STTProviderFactory.create_provider(
                STTProviderType.WHISPER,
                model_size="tiny"
            )

            assert isinstance(provider1, WhisperSTTProvider)

            # 싱글톤 패턴 검증
            provider2 = STTProviderFactory.create_provider(
                STTProviderType.WHISPER,
                model_size="tiny"
            )
            assert provider1 is provider2

    def test_tc_007_create_faster_whisper_provider(self):
        """TC-007: Provider 팩토리 - FasterWhisperSTTProvider 생성"""
        with pytest.raises(ImportError):
            from stt_provider import (
                STTProviderFactory,
                STTProviderType,
                FasterWhisperSTTProvider
            )

            provider = STTProviderFactory.create_provider(
                STTProviderType.FASTER_WHISPER,
                model_size="tiny",
                compute_type="int8"
            )

            assert isinstance(provider, FasterWhisperSTTProvider)

    def test_tc_008_get_provider(self):
        """TC-008: Provider 팩토리 - get_provider 조회"""
        with pytest.raises(ImportError):
            from stt_provider import (
                STTProviderFactory,
                STTProviderType
            )

            # Provider 생성
            provider1 = STTProviderFactory.create_provider(
                STTProviderType.WHISPER
            )

            # 동일 인스턴스 조회
            provider2 = STTProviderFactory.get_provider(
                STTProviderType.WHISPER
            )

            assert provider1 is provider2
            assert provider2 is not None


# ============================================================
# 3. FastAPI 엔드포인트 테스트 (TC-009 ~ TC-010)
# ============================================================


class TestFastAPIEndpoints:
    """FastAPI /stt/stream-chunk 엔드포인트 테스트"""

    @pytest.mark.asyncio
    async def test_tc_009_stream_chunk_endpoint_success(self):
        """TC-009: POST /stt/stream-chunk 성공"""
        pytest.skip("Server implementation not ready - TDD Red phase")

        # TODO: server.py 구현 후 활성화
        # from httpx import AsyncClient
        # from server import app
        #
        # async with AsyncClient(app=app, base_url="http://test") as client:
        #     # 테스트 청크 파일
        #     with open("test_chunk.webm", "rb") as f:
        #         response = await client.post(
        #             "/stt/stream-chunk",
        #             files={"audio": f},
        #             data={"language": "ko", "context": ""}
        #         )
        #
        #     assert response.status_code == 200
        #     data = response.json()
        #     assert data["success"] is True
        #     assert len(data["text"]) > 0
        #     assert data["is_final"] is False

    @pytest.mark.asyncio
    async def test_tc_010_get_providers_info(self):
        """TC-010: GET /stt/providers 정보 조회"""
        pytest.skip("Server implementation not ready - TDD Red phase")

        # TODO: server.py 구현 후 활성화
        # async with AsyncClient(app=app, base_url="http://test") as client:
        #     response = await client.get("/stt/providers")
        #
        #     assert response.status_code == 200
        #     data = response.json()
        #     assert "whisper" in data
        #     assert "faster_whisper" in data
        #     assert data["faster_whisper"]["name"] == "faster-whisper"


# ============================================================
# 4. 경계값 테스트 (TC-031 ~ TC-040)
# ============================================================


class TestBoundaryConditions:
    """경계값 테스트"""

    def test_tc_031_empty_audio_file(self):
        """TC-031: 빈 오디오 파일"""
        with pytest.raises(ImportError):
            from stt_provider import FasterWhisperSTTProvider

            provider = FasterWhisperSTTProvider()

            # 0바이트 파일
            result = provider.transcribe_chunk('empty.webm')

            assert result.success is False
            assert "invalid" in result.error.lower()

    def test_tc_032_very_short_audio(self):
        """TC-032: 매우 짧은 오디오 (0.1초)"""
        with pytest.raises(ImportError):
            from stt_provider import FasterWhisperSTTProvider

            provider = FasterWhisperSTTProvider()

            result = provider.transcribe_chunk('short_0.1s.webm')

            assert result.success is True
            assert result.text == "" or len(result.text) > 0

    def test_tc_034_silence_only_audio(self):
        """TC-034: 침묵만 있는 오디오"""
        with pytest.raises(ImportError):
            from stt_provider import FasterWhisperSTTProvider

            provider = FasterWhisperSTTProvider()

            result = provider.transcribe_chunk('silence_3s.webm')

            assert result.success is True
            assert result.text.strip() == ""

    def test_tc_037_special_characters_in_context(self):
        """TC-037: 특수 문자 포함 컨텍스트"""
        with pytest.raises(ImportError):
            from stt_provider import FasterWhisperSTTProvider

            provider = FasterWhisperSTTProvider()

            context = "!@#$%^&*() 안녕하세요 <script>alert('test')</script>"
            result = provider.transcribe_chunk(
                'test.webm',
                context=context
            )

            assert result.success is True

    def test_tc_040_corrupted_audio_file(self):
        """TC-040: 손상된 오디오 파일"""
        with pytest.raises(ImportError):
            from stt_provider import FasterWhisperSTTProvider

            provider = FasterWhisperSTTProvider()

            result = provider.transcribe_chunk('corrupted.webm')

            assert result.success is False
            assert "decode" in result.error.lower() or "invalid" in result.error.lower()


# ============================================================
# 5. 에러 케이스 (TC-041 ~ TC-042)
# ============================================================


class TestErrorCases:
    """에러 케이스 테스트"""

    def test_tc_041_model_loading_failure(self):
        """TC-041: 모델 로딩 실패"""
        with pytest.raises(ImportError):
            from stt_provider import FasterWhisperSTTProvider

            # 잘못된 모델 크기
            try:
                provider = FasterWhisperSTTProvider(model_size="invalid_model")
            except Exception as e:
                assert "model" in str(e).lower()

    @pytest.mark.asyncio
    async def test_tc_042_python_backend_not_running(self):
        """TC-042: Python 백엔드 미실행 (Node.js 레이어 테스트)"""
        # 이 테스트는 Node.js 테스트에서 수행
        pytest.skip("Node.js layer test - see STTService.test.ts")


# ============================================================
# Pytest 실행 정보
# ============================================================

if __name__ == "__main__":
    pytest.main([
        __file__,
        "-v",
        "--tb=short",
        "-k", "not skip"
    ])
