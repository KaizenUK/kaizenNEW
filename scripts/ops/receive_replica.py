"""Record a verified off-server copy received over the operator's SSH channel."""
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import sys

from backup import BackupError, atomic_json, now, private_file, real_path


def receive(state, value):
    state = real_path(state)
    if state.stat().st_mode & 0o077:
        raise BackupError('Replication receipts require private state.')
    expected = {'version', 'status', 'completedAt', 'sourceCompletedAt', 'sourceSnapshot', 'snapshot'}
    if set(value) != expected or value['version'] != 1 or value['status'] != 'verified':
        raise BackupError('Invalid replica receipt.')
    if any(not re.fullmatch(r'[0-9a-f]{64}', value[key]) for key in ['sourceSnapshot', 'snapshot']):
        raise BackupError('A replica receipt requires exact snapshot identities.')
    times = [datetime.fromisoformat(value[key].replace('Z', '+00:00')) for key in ['sourceCompletedAt', 'completedAt']]
    if any(stamp.tzinfo is None or stamp > datetime.now(timezone.utc) for stamp in times) or times[1] < times[0]:
        raise BackupError('A replica receipt has invalid timestamps.')
    file = state / 'last-replica.json'
    if file.exists():
        previous = json.loads(private_file(file).read_text())
        if datetime.fromisoformat(previous['sourceCompletedAt']) > times[0]:
            raise BackupError('An older replica cannot replace the recorded recovery point.')
    atomic_json(file, {**value, 'receivedAt': now()})
    return {'stored': True, 'snapshot': value['snapshot'], 'sourceSnapshot': value['sourceSnapshot']}


def main():
    if len(sys.argv) != 2:
        raise BackupError('Use receive_replica.py <private-backup-config.json> with a receipt on standard input.')
    config = json.loads(private_file(sys.argv[1]).read_text())
    raw = sys.stdin.buffer.read(16385)
    if len(raw) > 16384:
        raise BackupError('Replica receipt exceeds its limit.')
    print(json.dumps(receive(config['stateDirectory'], json.loads(raw))))


if __name__ == '__main__':
    os.umask(0o077)
    try:
        main()
    except Exception:
        print('The off-server replication receipt could not be recorded.', file=sys.stderr)
        sys.exit(1)
