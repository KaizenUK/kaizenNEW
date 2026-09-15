"""Trusted sandbox entry point. Only the bounded static output leaves stdout.

The writable website and temp directory are tmpfs charged to the build cgroup;
there is no writable host bind. Package-script output goes to the log pipe.
"""
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys


def main():
    Path("/tmp/npm-user-config").touch(mode=0o600)
    Path("/tmp/npm-global-config").touch(mode=0o600)
    shutil.copytree("/input", "/work", dirs_exist_ok=True, symlinks=False)
    if Path("/dependencies").is_dir():
        # Vite/Astro write caches inside node_modules. They get a disposable
        # copy in the same bounded tmpfs, never a writable host dependency bind.
        shutil.copytree("/dependencies", "/work/node_modules", symlinks=True)
    result = subprocess.run(
        [sys.argv[1], sys.argv[2], "run", "build"],
        cwd="/work", stdin=subprocess.DEVNULL, stdout=sys.stderr, stderr=sys.stderr,
    )
    if result.returncode:
        return min(abs(result.returncode), 125)
    output = Path("/work/dist")
    if not output.is_dir() or output.is_symlink():
        raise ValueError("Build completed without a regular dist directory")
    total = 0
    count = 0
    sys.stdout.buffer.write(b"KAIZEN-DIST-1\n")
    for folder, directories, filenames in os.walk(output, followlinks=False):
        for name in directories:
            if (Path(folder) / name).is_symlink():
                raise ValueError("Static build output cannot contain directory links")
        for name in sorted(filenames):
            source = Path(folder) / name
            with os.fdopen(os.open(source, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), "rb") as stream:
                info = os.fstat(stream.fileno())
                total += info.st_size
                count += 1
                if not stat.S_ISREG(info.st_mode) or info.st_size > 32 * 1024 * 1024 or total > 200 * 1024 * 1024 or count > 10000:
                    raise ValueError("Static build output exceeds its file limits")
                header = json.dumps({"path": str(source.relative_to(output)), "bytes": info.st_size}, separators=(",", ":")).encode()
                if len(header) > 4096:
                    raise ValueError("Static build output has an oversized path")
                sys.stdout.buffer.write(header + b"\n")
                remaining = info.st_size
                while remaining:
                    chunk = stream.read(min(remaining, 64 * 1024))
                    if not chunk:
                        raise ValueError("Static build output changed during capture")
                    sys.stdout.buffer.write(chunk)
                    remaining -= len(chunk)
                if stream.read(1):
                    raise ValueError("Static build output changed during capture")
    sys.stdout.buffer.write(b'{"end":true}\n')
    sys.stdout.buffer.flush()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        # Client-controlled filenames/exceptions are not an operator diagnostic.
        print("The isolated build could not produce a bounded static website.", file=sys.stderr)
        sys.exit(125)
