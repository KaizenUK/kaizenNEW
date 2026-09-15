"""Scan changes after an explicit commit, never the repository's old history.

Output is limited to finding locations/rule names; matching text and credentials
are never printed. The working tree is included for pre-commit use.
"""
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tarfile
import tempfile
import urllib.request

VERSION = "8.30.1"
ARCHIVE_SHA = "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"
DOWNLOAD = f"https://github.com/gitleaks/gitleaks/releases/download/v{VERSION}/gitleaks_{VERSION}_linux_x64.tar.gz"


def git(*arguments):
    return subprocess.check_output(["git", "--no-pager", *arguments], stderr=subprocess.PIPE)


def scanner(folder):
    configured = os.environ.get("GITLEAKS_BINARY")
    if configured:
        binary = Path(configured)
        if not binary.is_absolute() or not binary.is_file():
            raise ValueError("Invalid scanner path")
        return binary
    with urllib.request.urlopen(DOWNLOAD, timeout=30) as response:
        data = response.read(20 * 1024 * 1024)
    if hashlib.sha256(data).hexdigest() != ARCHIVE_SHA:
        raise ValueError("Scanner checksum mismatch")
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
        member = archive.getmember("gitleaks")
        if not member.isfile():
            raise ValueError("Invalid scanner archive")
        binary = folder / "gitleaks"
        binary.write_bytes(archive.extractfile(member).read())
    binary.chmod(0o700)
    return binary


def check(base):
    if not re.fullmatch(r"[0-9a-f]{40}", base):
        raise ValueError("Provide an explicit commit SHA for the start of this change")
    git("cat-file", "-e", base + "^{commit}")
    git("merge-base", "--is-ancestor", base, "HEAD")
    changed_names = set(git("diff", "--name-only", "--diff-filter=ACMR", "-z", base, "--").split(b"\0"))
    untracked_names = git("ls-files", "--others", "--exclude-standard", "-z").split(b"\0")
    changed_names.update(untracked_names)
    private = []
    for raw in changed_names:
        name = os.fsdecode(raw)
        leaf = Path(name).name.lower()
        if (leaf.startswith("kaizen-private-migration") or
            (leaf.startswith(".env") and not leaf.endswith((".example", ".sample"))) or
            leaf in ("id_rsa", "id_ed25519", "deploy-key") or
            leaf.endswith(("-key.txt", "-token.txt", ".key"))):
            private.append({"rule": "private-file", "file": name, "line": 0})
    if private:
        print(json.dumps({"newSecretFindings": private}))
        return 1
    # Retain only added lines from the uncommitted diff. Binary and historical
    # file contents are not read by this pass.
    lines = []
    locations = []
    current = "", 0
    diff = git("diff", "--no-ext-diff", "--unified=0", "HEAD", "--").decode("utf8", errors="replace")
    for line in diff.splitlines():
        if line.startswith("+++ b/"):
            current = line[6:], 0
        elif line.startswith("@@"):
            match = re.search(r"\+(\d+)(?:,\d+)? @@", line)
            if match:
                current = current[0], int(match[1])
        elif line.startswith("+") and not line.startswith("+++"):
            lines.append(line[1:])
            locations.append(current)
            current = current[0], current[1] + 1
    for raw in untracked_names:
        if not raw:
            continue
        name = os.fsdecode(raw)
        file = Path(name)
        if file.is_symlink() or not file.is_file():
            raise ValueError("Untracked scan inputs must be regular files")
        if file.stat().st_size > 10 * 1024 * 1024:
            raise ValueError("Review oversized untracked files before scanning")
        data = file.read_bytes()
        if b"\0" in data:
            continue
        for number, line in enumerate(data.decode("utf8", errors="replace").splitlines(), 1):
            lines.append(line)
            locations.append((name, number))
    with tempfile.TemporaryDirectory(prefix="kaizen-new-secrets-") as temporary:
        folder = Path(temporary)
        binary = scanner(folder)
        config = folder / "config.toml"
        config.write_text("[extend]\nuseDefault = true\n")
        findings = []
        scans = [("commits", ["git", f"--log-opts={base}..HEAD", "."], None)]
        if lines:
            scans.append(("working", ["stdin"], ("\n".join(lines) + "\n").encode()))
        for kind, arguments, data in scans:
            report = folder / f"{kind}.json"
            result = subprocess.run([
                str(binary), *arguments, "--redact=100", "--no-banner", "--ignore-gitleaks-allow",
                "--gitleaks-ignore-path", str(folder / "no-ignored-findings"),
                "--config", str(config), "--report-format=json", "--report-path", str(report),
            ], input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120)
            records = json.loads(report.read_text()) if report.exists() else []
            if result.returncode not in (0, 1) or (result.returncode == 1 and not records):
                raise ValueError("The secret checker did not complete")
            for record in records:
                file, line = record.get("File", "unknown"), record.get("StartLine", 0)
                if kind == "working" and isinstance(line, int) and 0 < line <= len(locations):
                    file, line = locations[line - 1]
                findings.append({"rule": record.get("RuleID"), "file": file, "line": line})
        if findings:
            print(json.dumps({"newSecretFindings": findings}))
            return 1
        print("No secrets detected in commits or working changes after the supplied baseline.")
        return 0


if __name__ == "__main__":
    try:
        if len(sys.argv) == 3 and sys.argv[1] == "--install":
            target = Path(sys.argv[2])
            if not target.is_absolute():
                raise ValueError("Provide an absolute tool directory")
            target.mkdir(parents=True, exist_ok=True, mode=0o700)
            print(scanner(target))
            sys.exit(0)
        sys.exit(check(sys.argv[1] if len(sys.argv) == 2 else ""))
    except Exception:
        # Git/scanner failures may contain source context. Never echo them.
        print("The new-change secret check failed to run. Check the baseline commit and scanner installation.", file=sys.stderr)
        sys.exit(2)
