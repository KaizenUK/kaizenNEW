"""Encrypted, coordinated backups; restoration always targets a new directory.

Uses restic's authenticated repository and rsync's non-dereferencing file copy.
Never restores into a live store, steals a lock, or prints source/secret contents.
"""
from contextlib import contextmanager, ExitStack
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import socket
import stat
import subprocess
import sys
import uuid


class BackupError(Exception):
    pass


class Busy(BackupError):
    pass


def now():
    return datetime.now(timezone.utc).isoformat()


def real_path(value, directory=True):
    p = Path(value)
    if not p.is_absolute() or p == Path('/') or p.resolve() != p:
        raise BackupError('Use an absolute, unlinked dedicated path.')
    if directory and not p.is_dir():
        raise BackupError('A configured directory is unavailable.')
    return p


def inside(a, b):
    return a == b or a in b.parents


def private_file(value):
    p = real_path(value, False)
    info = p.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077 or info.st_uid not in (0, os.getuid()):
        raise BackupError('A private credential file has unsafe permissions.')
    return p


def atomic_json(file, value):
    temporary = file.with_name(file.name + '.' + uuid.uuid4().hex)
    try:
        with os.fdopen(os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600), 'w') as stream:
            json.dump(value, stream, sort_keys=True)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, file)
    finally:
        temporary.unlink(missing_ok=True)


def command(args, *, cwd=None, env=None, timeout=900):
    try:
        result = subprocess.run(args, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired):
        raise BackupError('A backup command could not complete.') from None
    if result.returncode:
        # restic exit 3 means incomplete source reads: never accept that snapshot.
        raise BackupError('A backup command failed; the previous verified backup remains authoritative.')
    return result.stdout


@contextmanager
def file_claim(file, owner):
    """Same exclusive-file protocol as HostedWebsiteFolders.locked()."""
    try:
        fd = os.open(file, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    except FileExistsError:
        raise Busy('An active or unresolved operation owns a required lock.') from None
    identity = os.fstat(fd)
    try:
        if os.getuid() == 0:
            os.fchown(fd, owner.st_uid, owner.st_gid)
        os.write(fd, json.dumps({'pid': os.getpid(), 'id': str(uuid.uuid4()), 'operation': 'backup'}).encode())
        yield
    finally:
        os.close(fd)
        current = file.lstat() if file.exists() else None
        if current and (current.st_dev, current.st_ino) == (identity.st_dev, identity.st_ino):
            file.unlink()


@contextmanager
def release_claim(root):
    """Coordinate both the deployment build flock and release activation lock."""
    try:
        fd = os.open(root / 'build.lock', os.O_RDWR | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        if os.getuid() == 0:
            owner = root.stat()
            os.fchown(fd, owner.st_uid, owner.st_gid)
    except FileExistsError:
        fd = os.open(root / 'build.lock', os.O_RDWR | os.O_NOFOLLOW)
    created = False
    lock = root / '.activation-lock'
    identity = None
    try:
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            lock.mkdir(mode=0o700)
            created = True
        except (BlockingIOError, FileExistsError):
            raise Busy('A release operation owns a required lock.') from None
        identity = lock.stat()
        if os.getuid() == 0:
            owner = root.stat()
            os.chown(lock, owner.st_uid, owner.st_gid)
        atomic_json(lock / 'owner.json', {'pid': os.getpid(), 'host': socket.gethostname(),
                    'token': str(uuid.uuid4()), 'createdAt': now(), 'operation': 'backup'})
        yield
    finally:
        os.close(fd)
        if created and lock.exists() and lock.stat().st_ino == identity.st_ino:
            (lock / 'owner.json').unlink(missing_ok=True)
            lock.rmdir()


def inventory(root, max_bytes=20 * 1024**3, max_files=500000):
    result = {}
    total = 0
    for folder, directories, files in os.walk(root, followlinks=False):
        for name in sorted(directories + files):
            file = Path(folder) / name
            info = file.lstat()
            key = file.relative_to(root).as_posix()
            item = {'mode': stat.S_IMODE(info.st_mode), 'uid': info.st_uid, 'gid': info.st_gid}
            if stat.S_ISLNK(info.st_mode):
                item.update(type='link', target=os.readlink(file))
            elif stat.S_ISDIR(info.st_mode):
                item.update(type='directory')
            elif stat.S_ISREG(info.st_mode):
                total += info.st_size
                if total > max_bytes:
                    raise BackupError('Backup source exceeds its configured byte limit.')
                digest = hashlib.sha256()
                with file.open('rb') as stream:
                    for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                        digest.update(chunk)
                item.update(type='file', bytes=info.st_size, sha256=digest.hexdigest())
            else:
                raise BackupError('Backup source contains an unsupported special file.')
            result[key] = item
            if len(result) > max_files:
                raise BackupError('Backup source exceeds its configured file limit.')
    return result


class Backups:
    def __init__(self, config, *, restore_only=False):
        if config.get('version') != 1 or (not restore_only and not config.get('sources')):
            raise BackupError('Unsupported or empty backup configuration.')
        self.config = config
        self.restore_only = restore_only
        self.state = real_path(config['stateDirectory'])
        if self.state.stat().st_mode & 0o077:
            raise BackupError('Backup state must be private.')
        self.repo = real_path(config['repository'], False)
        self.password = private_file(config['passwordFile'])
        self.restic = config.get('restic', '/usr/bin/restic')
        self.rsync = config.get('rsync', '/usr/bin/rsync')
        self.sources = []
        self.helper_project_files = {}
        labels = set()
        # A replacement host may have none of the original directories or
        # credentials. Recovery needs only its independent repository/password;
        # the authenticated snapshot manifest supplies protected source paths.
        for source in ([] if restore_only else config['sources']):
            label = source['label']
            kind = source['kind']
            root = real_path(source['path'], kind != 'file')
            if kind == 'file' and not root.is_file():
                raise BackupError('A configured backup file is unavailable.')
            if not re.fullmatch(r'[a-z][a-z0-9-]{0,63}', label) or label in labels or label == 'supabase' or kind not in ('helper', 'release', 'files', 'file'):
                raise BackupError('Invalid backup source.')
            labels.add(label)
            for protected in [self.repo, self.state, self.password]:
                if inside(root, protected) or inside(protected, root):
                    raise BackupError('Backup storage and credentials must be separate from source data.')
            if any(inside(root, old[1]) or inside(old[1], root) for old in self.sources):
                raise BackupError('Backup sources overlap.')
            self.sources.append((label, root, kind))
            if kind == 'helper':
                self.helper_project_files[root] = real_path(source['projectsFile'], False)
        if any(inside(protected, self.repo) or inside(self.repo, protected)
               for protected in [self.state, self.password]):
            raise BackupError('Use separate backup state, credentials and repository paths.')
        self.env = {'PATH': '/usr/bin:/bin', 'HOME': str(self.state), 'LANG': 'C.UTF-8',
                    'RESTIC_REPOSITORY': str(self.repo), 'RESTIC_PASSWORD_FILE': str(self.password),
                    'RESTIC_CACHE_DIR': str(self.state / 'cache')}

    def rest(self, *args, cwd=None):
        return command([self.restic, '--json', *args], cwd=cwd, env=self.env)

    def due(self):
        # The hourly timer retries occupied locks/failures, but a verified backup
        # is normally captured only once per twenty-hour interval.
        try:
            receipt = json.loads(private_file(self.state / 'last-backup.json').read_text())
            stamp = datetime.fromisoformat(receipt['completedAt'].replace('Z', '+00:00'))
            if stamp.tzinfo is None or receipt.get('status') != 'verified' or not re.fullmatch(r'[0-9a-f]{64}', receipt.get('snapshot', '')):
                return True
            age = (datetime.now(timezone.utc) - stamp).total_seconds()
            return not (0 <= age < 20 * 3600 and (self.repo / 'config').is_file())
        except (OSError, ValueError, KeyError, TypeError, BackupError):
            return True

    @contextmanager
    def locked(self):
        fd = os.open(self.state / 'operations.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        try:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise Busy('Another backup operation is running.') from None
            yield
        finally:
            os.close(fd)

    def initialise(self):
        # Explicit operator action. A failed read never silently creates a repo.
        if self.restore_only:
            raise BackupError('Recovery configuration cannot initialize or capture backups.')
        with self.locked():
            if self.repo.exists():
                raise BackupError('The backup repository already exists.')
            self.repo.mkdir(mode=0o700)
            self.rest('init')

    @contextmanager
    def source_locks(self):
        with ExitStack() as locks:
            for _, root, kind in sorted(self.sources):
                if kind == 'release':
                    locks.enter_context(release_claim(root))
                elif kind == 'helper':
                    project_root, lock_root = real_path(root / 'projects'), real_path(root / 'locks')
                    project_file = self.helper_project_files[root]
                    configuration = project_file.read_bytes()
                    document = json.loads(configuration)
                    if document.get('version') != 1 or not isinstance(document.get('projects'), list):
                        raise BackupError('Invalid helper project configuration.')
                    project_ids = {item['projectId'] for item in document['projects']}
                    for project in project_root.iterdir():
                        real_path(project)
                        project_ids.add(project.name)
                    # Include configured but not yet cloned projects so a new
                    # connection cannot create an unlocked working copy mid-run.
                    for project_id in sorted(project_ids):
                        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,95}', project_id):
                            raise BackupError('Invalid managed project directory.')
                        locks.enter_context(file_claim(lock_root / (project_id + '.lock'), lock_root.stat()))
                        if (lock_root / (project_id + '.build.lock')).exists():
                            raise Busy('A website build is still running or requires recovery.')
                    if project_file.read_bytes() != configuration:
                        raise Busy('Helper project configuration changed while acquiring backup locks.')
            yield

    def capture(self, extra_capture=None):
        if self.restore_only:
            raise BackupError('Recovery configuration cannot initialize or capture backups.')
        with self.locked():
            stage = self.state / ('capture-' + uuid.uuid4().hex)
            stage.mkdir(mode=0o700)
            try:
                # Database/Storage capture can add its own verified inputs without
                # holding the website locks while waiting on external services.
                data = stage / 'data'
                data.mkdir(mode=0o700)
                if extra_capture:
                    extra_capture(data)
                with self.source_locks():
                    for label, source, kind in self.sources:
                        target = data / label
                        if kind != 'file':
                            target.mkdir(mode=0o700)
                        exclude = ['node_modules', '.cache', '.vite', '.astro'] if kind == 'helper' else []
                        if kind == 'helper':
                            exclude += ['/locks', '/service.lock']
                        if kind == 'release':
                            exclude += ['/.activation-lock', '/build.lock']
                        command([self.rsync, '-a', '--numeric-ids', *['--exclude=' + x for x in exclude],
                                 '--', str(source) + ('' if kind == 'file' else '/'), str(target) + ('' if kind == 'file' else '/')])
                    entries = inventory(data)
                    # A second source copy must have nothing left to transfer.
                    # This detects uncoordinated writes rather than claiming a
                    # consistent capture while an operator is editing directly.
                    for label, source, kind in self.sources:
                        exclude = ['node_modules', '.cache', '.vite', '.astro', '/locks', '/service.lock'] if kind == 'helper' else (['/.activation-lock', '/build.lock'] if kind == 'release' else [])
                        differences = command([self.rsync, '-anic', '--delete', '--numeric-ids',
                                               *['--exclude=' + x for x in exclude], '--', str(source) + ('' if kind == 'file' else '/'), str(data / label) + ('' if kind == 'file' else '/')])
                        if differences.strip():
                            raise BackupError('A source changed while being captured; no verified backup was recorded.')
                atomic_json(stage / 'manifest.json', {'version': 1, 'createdAt': now(),
                    'sources': [{'label': label, 'path': str(root), 'kind': kind} for label, root, kind in self.sources],
                    'excludedHelperDirectories': ['node_modules', '.cache', '.vite', '.astro', 'locks'], 'entries': entries})
                output = self.rest('backup', '--quiet', '--tag', 'kaizen-ops-v1', str(stage))
                summaries = [json.loads(line) for line in output.splitlines() if line.strip()]
                summary = next((x for x in summaries if x.get('message_type') == 'summary'), None)
                if not summary or not re.fullmatch(r'[0-9a-f]{8,64}', summary.get('snapshot_id', '')):
                    raise BackupError('The backup did not return a snapshot identity.')
                snapshot = summary['snapshot_id']
                # Read encrypted repository data and then restore every captured
                # file for byte, path, ownership, mode and link verification.
                self.rest('check', '--read-data')
                verification = self.state / ('verify-' + uuid.uuid4().hex)
                try:
                    self._restore(snapshot, verification)
                finally:
                    if verification.exists():
                        shutil.rmtree(verification)
                receipt = {'version': 1, 'status': 'verified', 'completedAt': now(),
                           'snapshot': snapshot, 'files': len(entries), 'sourceCount': len(self.sources)}
                atomic_json(self.state / 'last-backup.json', receipt)
                # Retention shares host/tag across capture directories; random
                # snapshot paths must not create an unlimited retention group.
                self.rest('forget', '--tag', 'kaizen-ops-v1', '--group-by', 'host,tags',
                          '--keep-daily', '7', '--keep-weekly', '4', '--keep-monthly', '3', '--prune')
                return receipt
            finally:
                shutil.rmtree(stage)

    def _restore(self, snapshot, target):
        if not re.fullmatch(r'[0-9a-f]{8,64}', snapshot):
            raise BackupError('Restore requires an exact snapshot ID.')
        target = real_path(target, False)
        if target.exists():
            raise BackupError('Restore only into a new empty directory.')
        if any(inside(root, target) or inside(target, root) for _, root, _ in self.sources) or inside(self.repo, target) or inside(target, self.repo):
            raise BackupError('A restore target overlaps live source or backup storage.')
        snapshots = json.loads(self.rest('snapshots', snapshot))
        if len(snapshots) != 1 or snapshots[0].get('tags') != ['kaizen-ops-v1'] or len(snapshots[0]['paths']) != 1:
            raise BackupError('Choose a single Kaizen operations snapshot.')
        prefix = Path(snapshots[0]['paths'][0])
        if not prefix.is_absolute() or '..' in prefix.parts:
            raise BackupError('Invalid snapshot root.')
        manifest = json.loads(self.rest('dump', snapshot, str(prefix / 'manifest.json')))
        if (manifest.get('version') != 1 or not isinstance(manifest.get('sources'), list)
                or not manifest['sources'] or not isinstance(manifest.get('entries'), dict)):
            raise BackupError('The snapshot has an invalid recovery manifest.')
        for source in manifest['sources']:
            original = Path(source['path'])
            if not original.is_absolute() or original == Path('/') or '..' in original.parts:
                raise BackupError('The snapshot records an invalid source path.')
            # Check the recorded path and its current resolution even when the
            # original server/source is gone or the caller omitted sources.
            if any(inside(root, target) or inside(target, root) for root in (original, original.resolve())):
                raise BackupError('A restore target overlaps a recorded source path.')
        target.mkdir(mode=0o700)
        self.rest('restore', snapshot, '--target', str(target))
        restored = real_path(target / str(prefix).lstrip('/'))
        if (json.loads((restored / 'manifest.json').read_text()) != manifest
                or inventory(restored / 'data') != manifest['entries']):
            raise BackupError('Restored bytes, paths or permissions do not match the backup.')
        return {'snapshot': snapshot, 'target': str(target), 'root': str(restored), 'verifiedAt': now()}

    def restore(self, snapshot, target):
        with self.locked():
            return self._restore(snapshot, Path(target))


def main():
    if len(sys.argv) < 3:
        raise BackupError('Use backup.py <private-config.json> init|capture|scheduled|restore [snapshot target].')
    config_file = private_file(sys.argv[1])
    action = sys.argv[2]
    backups = Backups(json.loads(config_file.read_text()), restore_only=action == 'restore')
    if action == 'init' and len(sys.argv) == 3:
        backups.initialise()
        print('Encrypted backup repository created.')
    elif action in ('capture', 'scheduled') and len(sys.argv) == 3:
        if action == 'scheduled' and not backups.due():
            print('The last verified backup is current; no new capture is due.')
            return
        extra_capture = None
        if backups.config.get('supabase'):
            from supabase_backup import SupabaseBackup
            extra_capture = SupabaseBackup(backups.config['supabase']).capture
        print(json.dumps(backups.capture(extra_capture)))
    elif action == 'restore' and len(sys.argv) == 5:
        print(json.dumps(backups.restore(sys.argv[3], sys.argv[4])))
    else:
        raise BackupError('Invalid backup action.')


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
        print('Backup operation failed. Check its private configuration and runtime.', file=sys.stderr)
        sys.exit(1)
