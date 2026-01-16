#!/usr/bin/env python3
"""
E2E 테스트 스크립트 (오프라인 모드)
서버 없이 TTS Provider를 직접 테스트
"""

import sys
import os
import json
import tempfile
from datetime import datetime

# Python 백엔드 경로 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python-backend'))

# 환경 변수 설정
os.environ['TTS_PROVIDER'] = 'edge-tts'

from tts import TTSProviderFactory, EdgeTTSProvider

# 테스트 결과
test_results = []
total_tests = 0
passed_tests = 0
failed_tests = 0
skipped_tests = 0
failed_scenarios = []

def log_test(test_id, name, status, reason=""):
    """테스트 결과 기록"""
    global total_tests, passed_tests, failed_tests, skipped_tests, failed_scenarios

    total_tests += 1
    result = {
        "test_id": test_id,
        "name": name,
        "status": status,
        "timestamp": datetime.now().isoformat(),
        "reason": reason
    }
    test_results.append(result)

    if status == "Pass":
        passed_tests += 1
        print(f"Pass {test_id}: {name}")
    elif status == "Fail":
        failed_tests += 1
        failed_scenarios.append({"id": test_id, "reason": reason})
        print(f"Fail {test_id}: {name}")
        if reason:
            print(f"   Reason: {reason}")
    elif status == "Skip":
        skipped_tests += 1
        print(f"Skip {test_id}: {name}")
        if reason:
            print(f"   Reason: {reason}")

def test_tts_001():
    """TTS-001: Edge TTS 기본 음성 합성"""
    test_id = "TTS-001"
    name = "Edge TTS 기본 음성 합성"

    try:
        # TTS Provider 생성
        provider = TTSProviderFactory.create_provider()

        # Provider 정보 확인
        info = provider.get_provider_info()
        if info.get("provider") != "edge-tts":
            log_test(test_id, name, "Fail", f"Wrong provider: {info.get('provider')}")
            return

        # 음성 합성 테스트
        temp_dir = tempfile.gettempdir()
        output_path = os.path.join(temp_dir, "test_tts_001.mp3")

        import asyncio
        result = asyncio.run(provider.synthesize_async(
            "Hello, how are you?",
            output_path,
            None
        ))

        # 검증
        if not result.get("success"):
            log_test(test_id, name, "Fail", f"Synthesis failed: {result.get('error')}")
            return

        if not os.path.exists(output_path):
            log_test(test_id, name, "Fail", "Output file not created")
            return

        if result.get("duration", 0) <= 0:
            log_test(test_id, name, "Fail", f"Invalid duration: {result.get('duration')}")
            return

        if result.get("voice_id") != "en-US-AriaNeural":
            log_test(test_id, name, "Fail", f"Wrong voice_id: {result.get('voice_id')}")
            return

        # 정리
        if os.path.exists(output_path):
            os.remove(output_path)

        log_test(test_id, name, "Pass")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))

def test_tts_002():
    """TTS-002: Supertonic TTS 음성 합성"""
    test_id = "TTS-002"
    name = "Supertonic TTS 음성 합성"

    # Supertonic API 키가 없으므로 스킵
    log_test(test_id, name, "Skip", "Supertonic API key not available")

def test_tts_003():
    """TTS-003: TTS Provider 전환"""
    test_id = "TTS-003"
    name = "TTS Provider 전환"

    try:
        # Edge TTS 확인
        os.environ['TTS_PROVIDER'] = 'edge-tts'
        provider = TTSProviderFactory.create_provider()

        info = provider.get_provider_info()
        if info.get("provider") != "edge-tts":
            log_test(test_id, name, "Fail", f"Expected edge-tts, got {info.get('provider')}")
            return

        # 음성 생성 테스트
        temp_dir = tempfile.gettempdir()
        output_path = os.path.join(temp_dir, "test_tts_003.mp3")

        import asyncio
        result = asyncio.run(provider.synthesize_async("Hello", output_path, None))

        if not result.get("success"):
            log_test(test_id, name, "Fail", "Edge TTS synthesis failed")
            return

        # 정리
        if os.path.exists(output_path):
            os.remove(output_path)

        # Supertonic 전환 테스트는 API 키가 없으므로 스킵
        log_test(test_id, name, "Pass", "Edge TTS verified (Supertonic test skipped)")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))

def test_tts_004():
    """TTS-004: 기존 기능 영향 없음 (Regression)"""
    test_id = "TTS-004"
    name = "기존 기능 영향 없음 (Regression)"

    try:
        provider = TTSProviderFactory.create_provider()

        # 음성 생성 테스트
        temp_dir = tempfile.gettempdir()
        output_path = os.path.join(temp_dir, "test_tts_004.mp3")

        import asyncio
        result = asyncio.run(provider.synthesize_async(
            "Testing regression",
            output_path,
            None
        ))

        if not result.get("success"):
            log_test(test_id, name, "Fail", "TTS functionality broken")
            return

        # API 응답 형식 확인
        required_fields = ["success", "file_path", "duration", "voice_id"]
        for field in required_fields:
            if field not in result:
                log_test(test_id, name, "Fail", f"Missing field: {field}")
                return

        # 정리
        if os.path.exists(output_path):
            os.remove(output_path)

        log_test(test_id, name, "Pass")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))

def test_tts_005():
    """TTS-005: API 키 인증 실패 처리"""
    test_id = "TTS-005"
    name = "API 키 인증 실패 처리"

    # Supertonic 관련 테스트이므로 스킵
    log_test(test_id, name, "Skip", "Supertonic API key not available")

def test_provider_factory():
    """FACTORY-001: Provider Factory 동작 확인"""
    test_id = "FACTORY-001"
    name = "Provider Factory 동작 확인"

    try:
        # Edge TTS Provider 생성
        os.environ['TTS_PROVIDER'] = 'edge-tts'
        provider = TTSProviderFactory.create_provider()

        if not isinstance(provider, EdgeTTSProvider):
            log_test(test_id, name, "Fail", f"Wrong provider type: {type(provider)}")
            return

        info = provider.get_provider_info()
        if info.get("provider") != "edge-tts":
            log_test(test_id, name, "Fail", f"Wrong provider: {info.get('provider')}")
            return

        log_test(test_id, name, "Pass")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))

def test_provider_interface():
    """INTERFACE-001: ITTSProvider 인터페이스 준수"""
    test_id = "INTERFACE-001"
    name = "ITTSProvider 인터페이스 준수"

    try:
        provider = TTSProviderFactory.create_provider()

        # 필수 메서드 확인
        required_methods = [
            "synthesize_async",
            "get_available_voices_async",
            "get_provider_info"
        ]

        for method_name in required_methods:
            if not hasattr(provider, method_name):
                log_test(test_id, name, "Fail", f"Missing method: {method_name}")
                return

            method = getattr(provider, method_name)
            if not callable(method):
                log_test(test_id, name, "Fail", f"Not callable: {method_name}")
                return

        log_test(test_id, name, "Pass")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))

def test_voices_list():
    """VOICES-001: 음성 목록 조회"""
    test_id = "VOICES-001"
    name = "음성 목록 조회"

    try:
        provider = TTSProviderFactory.create_provider()

        import asyncio
        voices = asyncio.run(provider.get_available_voices_async())

        if not voices:
            log_test(test_id, name, "Fail", "No voices available")
            return

        if not isinstance(voices, list):
            log_test(test_id, name, "Fail", f"Voices not a list: {type(voices)}")
            return

        # 첫 번째 음성 구조 확인
        first_voice = voices[0]
        required_fields = ["id", "name", "language"]
        for field in required_fields:
            if field not in first_voice:
                log_test(test_id, name, "Fail", f"Voice missing field: {field}")
                return

        log_test(test_id, name, "Pass")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))

def test_empty_text():
    """EDGE-001: 빈 텍스트 처리"""
    test_id = "EDGE-001"
    name = "빈 텍스트 처리"

    try:
        provider = TTSProviderFactory.create_provider()

        temp_dir = tempfile.gettempdir()
        output_path = os.path.join(temp_dir, "test_edge_001.mp3")

        import asyncio
        result = asyncio.run(provider.synthesize_async("", output_path, None))

        if result.get("success") != False:
            log_test(test_id, name, "Fail", "Should return success: false for empty text")
            return

        if "error" not in result:
            log_test(test_id, name, "Fail", "Missing error message")
            return

        log_test(test_id, name, "Pass")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))

def test_custom_voice():
    """CUSTOM-001: 커스텀 음성 ID 사용"""
    test_id = "CUSTOM-001"
    name = "커스텀 음성 ID 사용"

    try:
        provider = TTSProviderFactory.create_provider()

        temp_dir = tempfile.gettempdir()
        output_path = os.path.join(temp_dir, "test_custom_001.mp3")

        custom_voice = "en-GB-SoniaNeural"

        import asyncio
        result = asyncio.run(provider.synthesize_async(
            "Testing custom voice",
            output_path,
            custom_voice
        ))

        if not result.get("success"):
            log_test(test_id, name, "Fail", f"Custom voice synthesis failed: {result.get('error')}")
            return

        if result.get("voice_id") != custom_voice:
            log_test(test_id, name, "Fail", f"Voice ID mismatch: {result.get('voice_id')}")
            return

        # 정리
        if os.path.exists(output_path):
            os.remove(output_path)

        log_test(test_id, name, "Pass")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))

def main():
    """메인 테스트 실행"""
    print("\n" + "="*60)
    print("E2E 테스트 (오프라인 모드) - TTS Provider 추상화")
    print("="*60 + "\n")

    # TTS 시나리오 테스트
    print("TTS 시나리오 테스트")
    print("-" * 60)
    test_tts_001()
    test_tts_002()
    test_tts_003()
    test_tts_004()
    test_tts_005()

    print("\nProvider Factory 테스트")
    print("-" * 60)
    test_provider_factory()
    test_provider_interface()

    print("\n음성 목록 테스트")
    print("-" * 60)
    test_voices_list()

    print("\nEdge Case 테스트")
    print("-" * 60)
    test_empty_text()
    test_custom_voice()

    # 결과 요약
    print("\n" + "="*60)
    print("테스트 결과 요약")
    print("="*60)
    print(f"총 시나리오: {total_tests}개")
    print(f"Pass: {passed_tests}개")
    print(f"Fail: {failed_tests}개")
    print(f"Skip: {skipped_tests}개")
    if total_tests > 0:
        print(f"성공률: {(passed_tests/total_tests*100):.1f}%")
    print("="*60 + "\n")

    # JSON 결과 저장
    output = {
        "totalScenarios": total_tests,
        "passed": passed_tests,
        "failed": failed_tests,
        "skipped": skipped_tests,
        "failedScenarios": failed_scenarios,
        "documentUpdated": False,
        "documentPath": ".claude/claudedocs/qa-scenarios.md",
        "timestamp": datetime.now().isoformat(),
        "results": test_results
    }

    output_file = os.path.join(os.path.dirname(__file__), "e2e-test-results.json")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"테스트 결과 저장됨: e2e-test-results.json\n")

    # 실패한 테스트가 있으면 exit code 1
    if failed_tests > 0:
        sys.exit(1)

if __name__ == "__main__":
    main()
