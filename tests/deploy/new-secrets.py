"""Exercise scope and non-disclosure using synthetic credentials only."""
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile

script = Path(__file__).resolve().parents[2] / "scripts/check-new-secrets.py"
with tempfile.TemporaryDirectory(prefix="kaizen-secret-check-fixture-") as temporary:
    folder = Path(temporary)
    env = {**os.environ, "GIT_CONFIG_GLOBAL": "/dev/null", "GIT_CONFIG_NOSYSTEM": "1"}

    def git(*args):
        return subprocess.check_output(["git", "-c", "core.hooksPath=/dev/null", *args], cwd=folder, env=env, stderr=subprocess.PIPE).decode().strip()

    def scan(base, expected):
        result = subprocess.run([sys.executable, str(script), base], cwd=folder, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        assert result.returncode == expected, (result.returncode, result.stdout, result.stderr)
        for value in [old, new]:
            assert value.encode() not in result.stdout + result.stderr, "Synthetic credential must never appear in output"
        return result.stdout

    # Generated strings have a provider's shape but have never been issued.
    old = "npm_" + "".join(secrets.choice("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") for _ in range(36))
    new = "npm_" + "".join(secrets.choice("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") for _ in range(36))
    git("init", "-b", "fixture")
    git("config", "user.name", "Secret check fixture")
    git("config", "user.email", "fixture@example.invalid")
    (folder / "old.js").write_text(f'const NPM_TOKEN = "{old}";\n')
    git("add", ".")
    git("commit", "-m", "Synthetic baseline that must stay outside the scan")
    baseline = git("rev-parse", "HEAD")
    scan(baseline, 0)
    (folder / "new.js").write_text(f'const NPM_TOKEN = "{new}"; // gitleaks:allow\n')
    assert b"new.js" in scan(baseline, 1)
    git("add", ".")
    git("commit", "-m", "Synthetic new credential")
    scan(baseline, 1)
    (folder / "new.js").write_text('const message = "credential removed";\n')
    git("add", ".")
    git("commit", "-m", "Remove synthetic credential from the current file")
    scan(baseline, 1)
    scan(git("rev-parse", "HEAD"), 0)
    (folder / ".env.local").write_text("SYNTHETIC_VALUE=not-even-a-token\n")
    assert b"private-file" in scan(git("rev-parse", "HEAD"), 1)
    (folder / ".env.local").unlink()
    scan("not-a-commit", 2)
print("New-change secret checker: baseline scope, added/removed credentials and redacted output verified.")
