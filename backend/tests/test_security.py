import pytest
from fastapi import HTTPException
from jose import jwt

from app.core.config import settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    get_password_hash,
    verify_password,
)


def test_password_hash_is_not_plaintext_and_verifies():
    hashed = get_password_hash("s3cret-pass")

    assert hashed != "s3cret-pass"
    assert verify_password("s3cret-pass", hashed) is True


def test_verify_password_rejects_wrong_password():
    hashed = get_password_hash("correct-horse")

    assert verify_password("wrong-horse", hashed) is False


def test_password_hashes_are_salted_and_unique():
    first = get_password_hash("same-password")
    second = get_password_hash("same-password")

    assert first != second
    assert verify_password("same-password", first)
    assert verify_password("same-password", second)


def test_create_access_token_roundtrips_subject():
    token = create_access_token("user-123")

    payload = decode_access_token(token)

    assert payload["sub"] == "user-123"
    assert "exp" in payload


def test_create_access_token_encodes_expiry_in_the_future():
    token = create_access_token("user-123")

    payload = jwt.decode(
        token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
    )

    assert payload["exp"] > 0


def test_decode_access_token_rejects_tampered_token():
    token = create_access_token("user-123")
    tampered = token[:-2] + ("aa" if not token.endswith("aa") else "bb")

    with pytest.raises(HTTPException) as exc_info:
        decode_access_token(tampered)

    assert exc_info.value.status_code == 401


def test_decode_access_token_rejects_garbage():
    with pytest.raises(HTTPException) as exc_info:
        decode_access_token("not-a-real-jwt")

    assert exc_info.value.status_code == 401


def test_decode_access_token_rejects_wrong_secret():
    foreign_token = jwt.encode(
        {"sub": "intruder"}, "a-different-secret", algorithm=settings.jwt_algorithm
    )

    with pytest.raises(HTTPException):
        decode_access_token(foreign_token)
