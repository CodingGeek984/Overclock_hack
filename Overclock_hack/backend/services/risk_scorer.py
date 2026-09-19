

"""
risk_scorer.py
--------------
Определяет детерминированную оценку риска транзакции (0–100) и список факторов
для объяснимого ИИ (аналог локального движка на фронтенде).

Используется эндпоинтами:
  POST /api/v1/transactions/check
  POST /api/v1/transactions/
  POST /api/v1/transactions/batch
  POST /analyze
"""

from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# Константы риска
# ---------------------------------------------------------------------------

BASE_SCORE = 18

RISKY_COUNTRY_CODES = {"11", "2", "14", "12", "13", "15", "6", "9"}
RISKY_COUNTRIES = {"NG", "RU", "CN", "VN", "PH", "MA", "UA", "BY"}

# ISO → числовой код (зеркало COUNTRY_CODES на фронтенде)
COUNTRY_TO_CODE = {
    "KZ": "1", "RU": "2", "US": "3", "DE": "4", "TR": "5", "UA": "6",
    "UZ": "7", "KG": "8", "BY": "9", "GB": "10", "NG": "11", "VN": "12",
    "PH": "13", "CN": "14", "MA": "15", "AZ": "16", "NL": "17", "RO": "18",
    "GE": "19",
}

VPN_IP_PATTERNS = [
    re.compile(r"^185\.220\."),
    re.compile(r"^104\.218\."),
    re.compile(r"^45\.61\."),
    re.compile(r"^5\.188\."),
    re.compile(r"^2\.58\."),
    re.compile(r"^78\.128\."),
    re.compile(r"^195\.158\."),
]

HIGH_RISK_MERCHANTS = re.compile(r"crypto|bet|casino|poker|wallet|gift|vpn|exchange", re.I)
EMULATOR_DEVICES = re.compile(r"emulator|vpn|proxy", re.I)

# Код устройства → скорость угрозы (для бэкенд-кодов)
RISKY_DEVICE_CODES = {"4", "5", "6"}  # эмулятор, VPN, прокси


def clamp(value: float, low: float = 2, high: float = 100) -> int:
    """Ограничивает значение и приводит к целому числу."""
    return min(high, max(low, round(value)))


def detect_vpn(ip: str | None, device: str | None, merchant: str | None = "") -> int:
    """Определяет признак использования VPN/Proxy/эмулятора."""
    haystack = f"{ip or ''} {device or ''} {merchant or ''}"
    if any(pattern.search(haystack) for pattern in VPN_IP_PATTERNS):
        return 1
    if EMULATOR_DEVICES.search(haystack):
        return 1
    return 0


def normalize_country_code(country_code: str | None) -> str:
    """Приводит ISO-код (KZ) или числовой код (1) к числовому виду."""
    if not country_code:
        return "1"
    code = str(country_code).strip().upper()
    if code in COUNTRY_TO_CODE:
        return COUNTRY_TO_CODE[code]
    return code


_DEVICE_KNOWN_MOBILE = re.compile(r"iPhone|Pixel|Samsung|Huawei|iPad|known", re.I)
_DEVICE_NEW_MOBILE = re.compile(r"Samsung S24|iPhone (1[0-5])|new", re.I)
_DEVICE_DESKTOP = re.compile(r"MacBook|desktop|PC|web", re.I)


def device_code_to_code(device: str | None) -> str:
    """Переводит строку устройства в числовой код (зеркало deviceToCode)."""
    d = str(device or "")
    if EMULATOR_DEVICES.search(d):
        return "4"
    if re.search(r"\bvpn\b", d, re.I):
        return "5"
    if re.search(r"\bproxy\b", d, re.I):
        return "6"
    if _DEVICE_NEW_MOBILE.search(d) and not re.search(r"known", d, re.I):
        return "2"
    if _DEVICE_DESKTOP.search(d):
        return "3"
    if _DEVICE_KNOWN_MOBILE.search(d):
        return "1"
    return "1"


def _add_factor(factors: list[dict], name: str, effect: float, detail: str, strength: str) -> None:
    factors.append({
        "name": name,
        "effect": round(effect, 3),
        "detail": detail,
        "strength": strength,
        "positive": effect > 0,
        "contribution_pct": round(abs(effect) * 100, 1),
    })


def score_features(
    amount: float,
    country_code: str,
    device_code: str,
    velocity_1h: int,
    vpn: int,
    merchant: str = "",
) -> dict:
    """
    Возвращает словарь:
      score   — риск 0–100
      status  — APPROVE / CHALLENGE / BLOCK
      is_fraud — флаг фрода
      factors — список объяснимых факторов
    """
    factors: list[dict] = []
    score = float(BASE_SCORE)

    amount = float(amount or 0)

    if amount > 800_000:
        score += 19
        _add_factor(factors, "Amount Deviation", 0.42,
                    f"Сумма {amount:,.0f} ₸ значительно выше медианы карты", "high")
    elif amount > 300_000:
        score += 12
        _add_factor(factors, "Amount Deviation", 0.26,
                    f"Сумма {amount:,.0f} ₸ превышает типичный чек", "medium")
    elif 0 < amount < 3_000:
        score += 5
        _add_factor(factors, "Amount Deviation", 0.13,
                    "Микроплатеж — типичный pattern кардинга", "low")
    else:
        _add_factor(factors, "Amount Deviation", -0.10,
                    "Сумма в пределах обычного диапазона", "low")

    cc = normalize_country_code(country_code)
    if cc in RISKY_COUNTRY_CODES:
        score += 15
        _add_factor(factors, "Country Risk", 0.31,
                    f"Страна {cc} в списке повышенного риска", "high")
    else:
        _add_factor(factors, "Country Risk", -0.08,
                    "География платежа привычная", "low")

    dc = str(device_code or "1")
    if dc in RISKY_DEVICE_CODES or EMULATOR_DEVICES.search(str(device_code or "")):
        score += 11
        _add_factor(factors, "Device Fingerprint", 0.24,
                    f"Устройство «{device_code}» не прошло fingerprint-check", "medium")
    elif dc == "2":
        score += 6
        _add_factor(factors, "Device Fingerprint", 0.15,
                    "Новое устройство в flow клиента", "medium")
    else:
        _add_factor(factors, "Device Fingerprint", -0.10,
                    "Trusted device — оценка max", "low")

    if vpn:
        score += 17
        _add_factor(factors, "VPN / Proxy", 0.38,
                    "IP из пула анонимайзеров или среда эмулятора", "high")
    else:
        _add_factor(factors, "VPN / Proxy", -0.12,
                    "IP не из proxy-подозрительных диапазонов", "low")

    if merchant and HIGH_RISK_MERCHANTS.search(merchant):
        score += 13
        _add_factor(factors, "Merchant Category", 0.28,
                    f"MCC мерчанта «{merchant}» в зоне риска", "high")
    else:
        _add_factor(factors, "Merchant Category", -0.09,
                    "Категория мерчанта типична", "low")

    freq = int(velocity_1h or 0)
    if freq >= 8:
        score += 14
        _add_factor(factors, "Transaction Frequency", 0.30,
                    f"{freq} операций за час — аномальная скорость", "high")
    elif freq >= 4:
        score += 8
        _add_factor(factors, "Transaction Frequency", 0.18,
                    f"{freq} операций за час — выше обычного", "medium")
    else:
        _add_factor(factors, "Transaction Frequency", -0.06,
                    "Частота операций в норме", "low")

    score = clamp(score)
    status = "BLOCK" if score >= 80 else "CHALLENGE" if score >= 50 else "APPROVE"
    factors.sort(key=lambda f: abs(f["effect"]), reverse=True)
    factors = factors[:6]

    return {
        "score": score,
        "status": status,
        "is_fraud": score >= 80,
        "factors": factors,
    }


def top_factor_explanation(result: dict) -> str:
    """Короткое объяснение по top-фактору."""
    factors = result.get("factors", [])
    if not factors:
        return "Существенных факторов риска не выявлено."
    top = factors[0]
    arrow = "повышает" if top["effect"] > 0 else "снижает"
    return (
        f"Основной вклад: признак «{top['name']}» {arrow} риск "
        f"на {abs(top['effect']) * 100:.0f}%. {top['detail']}."
    )