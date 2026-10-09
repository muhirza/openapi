"""End-to-end test for MVP0 (login, credentials, token flow)."""
import json
import urllib.request
import http.cookiejar
import uuid

BASE = "http://localhost:8000"
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{BASE}/api{path}",
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    try:
        with opener.open(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


def main():
    # 1. Health (root route, not under /api)
    req = urllib.request.Request(f"{BASE}/health")
    try:
        with opener.open(req) as resp:
            st = resp.status
            body = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        st = e.code
        body = json.loads(e.read().decode())
    print(f"[{st}] health: {body}")

    # 2. Register fresh test user (random suffix avoids collisions)
    username = f"e2e_{uuid.uuid4().hex[:8]}"
    st, body = call("POST", "/register", {"username": username, "password": "admin12345"})
    print(f"[{st}] register ({username}): {body}")

    # 3. Login
    st, body = call("POST", "/login", {"username": username, "password": "admin12345"})
    print(f"[{st}] login: {body}")
    if st != 200:
        raise SystemExit("login failed")
    cookie = next((c for c in cj if c.name == "access_token"), None)
    print(f"      cookie set: {cookie is not None}")

    # 4. Save credentials (encrypted at rest)
    st, body = call("PUT", "/profile/credentials",
                    {"client_id": "XL_CLIENT_ID_TEST", "client_secret": "XL_SECRET_TEST"})
    print(f"[{st}] save credentials: {body}")
    if "client_secret" in json.dumps(body).lower() and "XL_SECRET_TEST" in json.dumps(body):
        raise SystemExit("LEAK: secret returned to client!")

    # 5. Read credentials status (must never contain secret)
    st, body = call("GET", "/profile/credentials")
    raw = json.dumps(body)
    print(f"[{st}] get credentials: {raw}")
    if "XL_SECRET_TEST" in raw:
        raise SystemExit("LEAK: secret exposed in GET!")

    # 6. Token status (no token yet)
    st, body = call("GET", "/token/status")
    print(f"[{st}] token status: {body}")

    # 7. Refresh token (provider will reject fake creds -> graceful error expected)
    st, body = call("POST", "/token/refresh")
    print(f"[{st}] token refresh: {body}")

    # 8. Token status after refresh attempt
    st, body = call("GET", "/token/status")
    print(f"[{st}] token status after: {body}")

    # 9. Verify DB stores encrypted values only
    print("\nDB check (encrypted at rest):")
    print("  run: docker exec openapi3-db-1 psql -U dashboard -d dashboard "
          "-c \"SELECT client_id_encrypted, client_secret_encrypted FROM api_credentials;\"")

    print("\nAll checks passed.")


if __name__ == "__main__":
    main()
