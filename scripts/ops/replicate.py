"""Copy only a verified snapshot into an independent encrypted repository."""
from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

from backup import BackupError, Busy, atomic_json, command, inside, now, private_file, real_path


class Replica:
    def __init__(self, config):
        if config.get('version') != 1:
            raise BackupError('Unsupported replication configuration.')
        self.state = real_path(config['stateDirectory'])
        if self.state.stat().st_mode & 0o077:
            raise BackupError('Replication state must be private.')
        self.repo = real_path(config['repository'], False)
        self.password = private_file(config['passwordFile'])
        self.source_password = private_file(config['sourcePasswordFile'])
        self.restic = config.get('restic', '/usr/bin/restic')
        source = config['source']
        self.alias = source.get('sshAlias')
        self.report_to_source = source.get('reportToSource', False)
        if self.report_to_source and not self.alias:
            raise BackupError('Source reporting requires the operations SSH receiver.')
        self.source_path, self.receipt_path = source['repository'], source['receiptFile']
        if self.alias:
            if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,63}', self.alias):
                raise BackupError('Invalid replication SSH alias.')
            for value in [self.source_path, self.receipt_path]:
                if not re.fullmatch(r'/[A-Za-z0-9_./-]+', value) or '..' in Path(value).parts or value == '/':
                    raise BackupError('Invalid remote backup path.')
            self.source = 'sftp:' + self.alias + ':' + self.source_path
        else:
            self.source = str(real_path(self.source_path))
            private_file(self.receipt_path)
            if inside(Path(self.source), self.repo) or inside(self.repo, Path(self.source)):
                raise BackupError('Source and replica repositories must be separate.')
        for protected in [self.state, self.password, self.source_password]:
            if inside(self.repo, protected) or inside(protected, self.repo):
                raise BackupError('Replica storage, state and credentials must be separate.')
        self.env = {'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8', 'HOME': str(Path.home()),
                    'RESTIC_REPOSITORY': str(self.repo), 'RESTIC_PASSWORD_FILE': str(self.password),
                    'RESTIC_CACHE_DIR': str(self.state / 'cache')}
        if os.environ.get('SSH_AUTH_SOCK'):
            self.env['SSH_AUTH_SOCK'] = os.environ['SSH_AUTH_SOCK']
        self.options = ['-o', 'sftp.args=-oBatchMode=yes -oStrictHostKeyChecking=yes -oConnectTimeout=15'] if self.alias else []
        self.from_args = ['--from-repo', self.source, '--from-password-file', str(self.source_password)]

    def rest(self, *args, source=False):
        env = self.env
        if source:
            env = {**env, 'RESTIC_REPOSITORY': self.source, 'RESTIC_PASSWORD_FILE': str(self.source_password)}
        return command([self.restic, '--json', *self.options, *args], env=env, timeout=3600)

    @contextmanager
    def locked(self):
        fd = os.open(self.state / 'replication.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        try:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise Busy('A backup replication is already running.') from None
            yield
        finally:
            os.close(fd)

    def initialise(self):
        with self.locked():
            if self.repo.exists():
                raise BackupError('The replica repository already exists.')
            self.repo.mkdir(mode=0o700)
            self.rest('init', '--copy-chunker-params', *self.from_args)

    def source_receipt(self):
        if self.alias:
            raw = command(['/usr/bin/ssh', '-oBatchMode=yes', '-oStrictHostKeyChecking=yes',
                '-oConnectTimeout=15', '--', self.alias, 'cat', '--', self.receipt_path], timeout=30)
        else:
            raw = private_file(self.receipt_path).read_bytes()
        if len(raw) > 16384:
            raise BackupError('The source backup receipt exceeds its limit.')
        receipt = json.loads(raw)
        if receipt.get('status') != 'verified' or not re.fullmatch(r'[0-9a-f]{64}', receipt.get('snapshot', '')):
            raise BackupError('The source has no verified snapshot to replicate.')
        return receipt

    def capture(self):
        with self.locked():
            receipt = self.source_receipt()
            snapshot = receipt['snapshot']
            source = json.loads(self.rest('snapshots', snapshot, source=True))
            if len(source) != 1 or source[0].get('tags') != ['kaizen-ops-v1'] or len(source[0].get('paths', [])) != 1:
                raise BackupError('The source receipt does not identify a Kaizen operations snapshot.')
            prefix = source[0]['paths'][0]
            if not Path(prefix).is_absolute() or '..' in Path(prefix).parts:
                raise BackupError('The source snapshot has an invalid capture path.')
            manifest = prefix + '/manifest.json'
            expected = hashlib.sha256(self.rest('dump', snapshot, manifest, source=True)).hexdigest()
            self.rest('copy', *self.from_args, snapshot)
            copies = json.loads(self.rest('snapshots', '--tag', 'kaizen-ops-v1'))
            matching = [item for item in copies if item.get('original') == snapshot]
            if len(matching) != 1 or matching[0].get('paths') != source[0]['paths']:
                raise BackupError('The copied snapshot identity could not be verified.')
            copied = matching[0]['id']
            if hashlib.sha256(self.rest('dump', copied, manifest)).hexdigest() != expected:
                raise BackupError('The replica manifest does not match its source.')
            self.rest('check', '--read-data')
            result = {'version': 1, 'status': 'verified', 'completedAt': now(),
                      'sourceCompletedAt': receipt['completedAt'], 'sourceSnapshot': snapshot, 'snapshot': copied}
            atomic_json(self.state / 'last-replica.json', result)
            if self.report_to_source:
                try:
                    response = subprocess.run(['/usr/bin/ssh', '-oBatchMode=yes', '-oStrictHostKeyChecking=yes',
                        '-oConnectTimeout=15', '--', self.alias, '/usr/bin/python3', '/opt/kaizen-ops/receive_replica.py',
                        '/etc/kaizen-ops/backup.json'], input=json.dumps(result).encode(), capture_output=True, timeout=30)
                    confirmed = json.loads(response.stdout) if response.returncode == 0 else None
                except (OSError, subprocess.TimeoutExpired, ValueError):
                    confirmed = None
                if confirmed != {'stored': True, 'snapshot': copied, 'sourceSnapshot': snapshot}:
                    raise BackupError('The replica is verified locally but its source acknowledgement failed.')
            self.rest('forget', '--tag', 'kaizen-ops-v1', '--group-by', 'host,tags',
                      '--keep-daily', '7', '--keep-weekly', '4', '--keep-monthly', '3', '--prune')
            return result


def main():
    if len(sys.argv) != 3 or sys.argv[2] not in ('init', 'capture'):
        raise BackupError('Use replicate.py <private-config.json> init|capture.')
    replica = Replica(json.loads(private_file(sys.argv[1]).read_text()))
    if sys.argv[2] == 'init':
        replica.initialise()
        print('Independent encrypted replica repository created.')
    else:
        print(json.dumps(replica.capture()))


if __name__ == '__main__':
    os.umask(0o077)
    try:
        main()
    except Busy as error:
        print(str(error), file=sys.stderr)
        sys.exit(75)
    except BackupError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print('Backup replication failed. Check its private configuration and runtime.', file=sys.stderr)
        sys.exit(1)
