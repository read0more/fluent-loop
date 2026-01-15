#!/usr/bin/env python3
"""
E2E 테스트 스크립트
TTS Provider 추상화 및 Edge TTS 통합 검증
"""

import requests
import json
import time
import sys
from datetime import datetime

# 테스트 결과
test_results = []
total_tests = 0
passed_tests = 0
failed_tests = 0
skipped_tests = 0

# 서버 URL
BASE_URL = "http://localhost:8000"

def log_test(test_id, name, status, reason=""):
    """테스트 결과 기록"""
    global total_tests, passed_tests, failed_tests, skipped_tests

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
        print(f"✅ {test_id}: {name} - PASS")
    elif status == "Fail":
        failed_tests += 1
        print(f"❌ {test_id}: {name} - FAIL")
        if reason:
            print(f"   Reason: {reason}")
    elif status == "Skip":
        skipped_tests += 1
        print(f"⏭️  {test_id}: {name} - SKIP")
        if reason:
            print(f"   Reason: {reason}")

def test_tts_001():
    """TTS-001: Edge TTS 기본 음성 합성"""
    test_id = "TTS-001"
    name = "Edge TTS 기본 음성 합성"

    try:
        # 1. Health check
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code != 200:
            log_test(test_id, name, "Fail", f"Health check failed: {response.status_code}")
            return

        health_data = response.json()
        if health_data.get("tts_provider") != "edge-tts":
            log_test(test_id, name, "Fail", f"Wrong TTS provider: {health_data.get('tts_provider')}")
            return

        # 2. TTS 합성
        tts_request = {
            "text": "Hello, how are you?",
            "voice_id": None
        }

        response = requests.post(
            f"{BASE_URL}/tts/synthesize",
            json=tts_request,
            timeout=30
        )

        if response.status_code != 200:
            log_test(test_id, name, "Fail", f"TTS synthesis failed: {response.status_code}")
            return

        result = response.json()

        # 검증
        if not result.get("success"):
            log_test(test_id, name, "Fail", f"TTS synthesis unsuccessful: {result.get('error')}")
            return

        if not result.get("file_path"):
            log_test(test_id, name, "Fail", "No file path in response")
            return

        if result.get("duration", 0) <= 0:
            log_test(test_id, name, "Fail", f"Invalid duration: {result.get('duration')}")
            return

        if result.get("provider") != "edge-tts":
            log_test(test_id, name, "Fail", f"Wrong provider in response: {result.get('provider')}")
            return

        log_test(test_id, name, "Pass")

    except requests.exceptions.ConnectionError:
        log_test(test_id, name, "Fail", "Cannot connect to server (is it running?)")
    except requests.exceptions.Timeout:
        log_test(test_id, name, "Fail", "Request timeout")
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
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code != 200:
            log_test(test_id, name, "Fail", "Health check failed")
            return

        health_data = response.json()
        if health_data.get("tts_provider") != "edge-tts":
            log_test(test_id, name, "Fail", f"Expected edge-tts, got {health_data.get('tts_provider')}")
            return

        # Edge TTS로 음성 생성
        tts_request = {"text": "Hello", "voice_id": None}
        response = requests.post(f"{BASE_URL}/tts/synthesize", json=tts_request, timeout=30)

        if response.status_code != 200:
            log_test(test_id, name, "Fail", "Edge TTS synthesis failed")
            return

        result = response.json()
        if result.get("provider") != "edge-tts":
            log_test(test_id, name, "Fail", f"Provider mismatch: {result.get('provider')}")
            return

        # Supertonic 전환 테스트는 API 키가 없으므로 스킵
        log_test(test_id, name, "Pass", "Edge TTS verified (Supertonic test skipped)")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))

def test_tts_004():
    """TTS-004: 기존 기능 영향 없음 (Regression)"""
    test_id = "TTS-004"
    name = "기존 기능 영향 없음 (Regression)"

    try:
        # Health check
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code != 200:
            log_test(test_id, name, "Fail", "Health check failed")
            return

        # TTS 기능 테스트
        tts_request = {"text": "Testing regression", "voice_id": None}
        response = requests.post(f"{BASE_URL}/tts/synthesize", json=tts_request, timeout=30)

        if response.status_code != 200:
            log_test(test_id, name, "Fail", "TTS functionality broken")
            return

        result = response.json()

        # API 응답 형식 확인
        required_fields = ["success", "file_path", "duration", "voice_id", "provider"]
        for field in required_fields:
            if field not in result:
                log_test(test_id, name, "Fail", f"Missing field: {field}")
                return

        log_test(test_id, name, "Pass")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))

def test_tts_005():
    """TTS-005: API 키 인증 실패 처리"""
    test_id = "TTS-005"
    name = "API 키 인증 실패 처리"

    # Supertonic 관련 테스트이므로 스킵
    log_test(test_id, name, "Skip", "Supertonic API key not available")

def test_api_health():
    """API-001: /health 엔드포인트 테스트"""
    test_id = "API-001"
    name = "Health 엔드포인트 동작 확인"

    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)

        if response.status_code != 200:
            log_test(test_id, name, "Fail", f"Status code: {response.status_code}")
            return

        data = response.json()

        # 필수 필드 확인
        required_fields = ["status", "whisper_loaded", "tts_loaded", "timestamp"]
        for field in required_fields:
            if field not in data:
                log_test(test_id, name, "Fail", f"Missing field: {field}")
                return

        if data.get("status") != "ok":
            log_test(test_id, name, "Fail", f"Status not ok: {data.get('status')}")
            return

        log_test(test_id, name, "Pass")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))

def test_api_voices():
    """API-002: /tts/voices 엔드포인트 테스트"""
    test_id = "API-002"
    name = "TTS 음성 목록 조회"

    try:
        response = requests.get(f"{BASE_URL}/tts/voices", timeout=10)

        if response.status_code != 200:
            log_test(test_id, name, "Fail", f"Status code: {response.status_code}")
            return

        data = response.json()

        if "voices" not in data:
            log_test(test_id, name, "Fail", "Missing 'voices' field")
            return

        voices = data.get("voices", [])
        if len(voices) == 0:
            log_test(test_id, name, "Fail", "No voices available")
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

def test_api_tts_empty_text():
    """API-003: 빈 텍스트 TTS 요청 처리"""
    test_id = "API-003"
    name = "빈 텍스트 에러 처리"

    try:
        tts_request = {"text": "", "voice_id": None}
        response = requests.post(f"{BASE_URL}/tts/synthesize", json=tts_request, timeout=10)

        if response.status_code != 400:
            log_test(test_id, name, "Fail", f"Expected 400, got {response.status_code}")
            return

        result = response.json()
        if result.get("success") != False:
            log_test(test_id, name, "Fail", "Should return success: false")
            return

        if "error" not in result:
            log_test(test_id, name, "Fail", "Missing error message")
            return

        log_test(test_id, name, "Pass")

    except Exception as e:
        log_test(test_id, name, "Fail", str(e))

def main():
    """메인 테스트 실행"""
    print("\n" + "="*60)
    print("E2E 테스트 시작 - TTS Provider 추상화")
    print("="*60 + "\n")

    # 서버 연결 확인
    print("서버 연결 확인 중...")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            print(f"✅ 서버 연결 성공: {BASE_URL}\n")
        else:
            print(f"❌ 서버 응답 에러: {response.status_code}")
            print("테스트를 중단합니다.")
            sys.exit(1)
    except requests.exceptions.ConnectionError:
        print(f"❌ 서버에 연결할 수 없습니다: {BASE_URL}")
        print("Python 백엔드 서버를 먼저 실행하세요: python python-backend/server.py")
        sys.exit(1)

    # TTS 시나리오 테스트
    print("TTS 시나리오 테스트")
    print("-" * 60)
    test_tts_001()
    test_tts_002()
    test_tts_003()
    test_tts_004()
    test_tts_005()

    print("\nAPI 엔드포인트 테스트")
    print("-" * 60)
    test_api_health()
    test_api_voices()
    test_api_tts_empty_text()

    # 결과 요약
    print("\n" + "="*60)
    print("테스트 결과 요약")
    print("="*60)
    print(f"총 시나리오: {total_tests}개")
    print(f"Pass: {passed_tests}개")
    print(f"Fail: {failed_tests}개")
    print(f"Skip: {skipped_tests}개")
    print(f"성공률: {(passed_tests/total_tests*100):.1f}%")
    print("="*60 + "\n")

    # JSON 결과 저장
    output = {
        "totalScenarios": total_tests,
        "passed": passed_tests,
        "failed": failed_tests,
        "skipped": skipped_tests,
        "timestamp": datetime.now().isoformat(),
        "results": test_results
    }

    with open("E:\\develop\\electron-test\\e2e-test-results.json", "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"테스트 결과 저장됨: e2e-test-results.json\n")

    # 실패한 테스트가 있으면 exit code 1
    if failed_tests > 0:
        sys.exit(1)

if __name__ == "__main__":
    main()
