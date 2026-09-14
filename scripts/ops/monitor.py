"""Read-only health observations and bounded operational alerts.

No page contents, user identifiers, raw logs or credentials enter alerts. Mail is
queued only for confirmed new incidents or their recovery; fixtures replace the
mail transport. A VPS-local monitor is complemented by external uptime checks.
"""
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import format_datetime, make_msgid
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.request
import urllib.error

from backup import BackupError, Busy, atomic_json, command, now, private_file, real_path
from supabase_backup import NoRedirect


ERROR_COUNTS = """select json_build_object(
 'clientErrors',(select count(*) from public.builder_client_errors where created_at > now()-interval '15 minutes'),
 'failedPublications',(select count(*) from public.builder_client_jobs where phase='failed' and updated_at > now()-interval '15 minutes'),
 'recoveryRequired',(select count(*) from public.builder_client_jobs where phase='recovery_required'),
 'stalledPublications',(select count(*) from public.builder_client_jobs where phase in ('queued','building','activating','verifying') and updated_at < now()-interval '30 minutes')
) as health"""


def age_seconds(value):
    stamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if stamp.tzinfo is None:
        raise ValueError('Receipt timestamp requires a timezone.')
    age = (datetime.now(timezone.utc) - stamp).total_seconds()
    if age < -300:
        raise ValueError('Receipt timestamp is in the future.')
    return max(0, age)


def http(url, body=None, headers=None, accepted_statuses=(200,)):
    request = urllib.request.Request(url, data=body, headers=headers or {})
    try:
        response = urllib.request.build_opener(NoRedirect()).open(request, timeout=15)
    except urllib.error.HTTPError as error:
        error.close()
        raise BackupError('The health request did not succeed.') from None
    with response:
        if response.status not in accepted_statuses:
            raise BackupError('The health request did not succeed.')
        data = response.read(1024 * 1024 + 1)
    if len(data) > 1024 * 1024:
        raise BackupError('The health response exceeds its limit.')
    return data


def unit(check):
    name = check['unit']
    if not re.fullmatch(r'[a-zA-Z0-9_.@-]+\.(service|timer)', name):
        raise BackupError('Invalid monitored service name.')
    raw = command(['/usr/bin/systemctl', 'show', name,
        '--property=LoadState,ActiveState,Result,ExecMainStatus'], timeout=15)
    values = dict(line.split('=', 1) for line in raw.decode().splitlines() if '=' in line)
    if values.get('LoadState') != 'loaded':
        return False, 'The configured service or timer is missing.'
    active = values.get('ActiveState')
    if check.get('oneshot'):
        healthy = active in ('activating', 'active') or (active == 'inactive' and values.get('Result') == 'success' and values.get('ExecMainStatus') == '0')
    else:
        healthy = active == 'active'
    return healthy, 'Service is healthy.' if healthy else 'Service is stopped or its last operation failed.'


def release(check):
    store = real_path(check['store'])
    selected = (store / 'active.conf').read_text()
    match = re.search(r'^# Kaizen managed release: ([A-Za-z0-9._-]+)$', selected, re.M)
    if not match or match[1] in ('.', '..'):
        return False, 'The selected release could not be identified.'
    marker = real_path(store / 'releases' / match[1] / 'site/.well-known/kaizen-release.json', False).read_bytes()
    observed = http(check['origin'].rstrip('/') + '/.well-known/kaizen-release.json')
    if (store / 'active.conf').read_text() != selected:
        return False, 'The selected release changed during this observation.'
    healthy = hashlib.sha256(observed).digest() == hashlib.sha256(marker).digest()
    return healthy, 'Selected release marker is served.' if healthy else 'The served release marker does not match its store.'


def receipt(check):
    record = json.loads(private_file(check['path']).read_text())
    date_key = check.get('dateField', 'completedAt')
    identities = ['snapshot', 'sourceSnapshot'] if date_key == 'sourceCompletedAt' else ['snapshot']
    healthy = (record.get('status') == 'verified' and
               all(re.fullmatch(r'[0-9a-f]{64}', record.get(key, '')) for key in identities) and
               age_seconds(record[date_key]) <= check['maxAgeSeconds'])
    return healthy, 'A recent verified backup is recorded.' if healthy else 'The last verified backup is too old or unavailable.'


def database(check):
    ref = check['projectRef']
    if not re.fullmatch(r'[a-z]{20}', ref):
        raise BackupError('Invalid monitored database reference.')
    token = private_file(check['managementTokenFile']).read_text().strip()
    result = json.loads(http('https://api.supabase.com/v1/projects/' + ref + '/database/query',
        json.dumps({'query': ERROR_COUNTS, 'read_only': True}).encode(),
        {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'},
        accepted_statuses=(200, 201)))
    values = result[0]['health']
    keys = ['clientErrors', 'failedPublications', 'recoveryRequired', 'stalledPublications']
    if set(values) != set(keys) or any(type(values[key]) is not int or values[key] < 0 for key in keys):
        raise BackupError('Invalid hosted error observation.')
    healthy = not any(values.values())
    return healthy, ('No recent recorded errors or stalled publications.' if healthy else
        'Recorded client errors: {clientErrors}; failed publications: {failedPublications}; recovery required: {recoveryRequired}; stalled publications: {stalledPublications}.'.format(**values))


def observe(check):
    try:
        kind = check['kind']
        if kind == 'unit':
            return unit(check)
        if kind == 'release':
            return release(check)
        if kind == 'receipt':
            return receipt(check)
        if kind == 'database':
            return database(check)
        if kind == 'helper':
            value = json.loads(http(check['url']))
            healthy = value == {'service': 'kaizen-hosted-helper', 'status': 'running'}
            return healthy, 'Hosted helper responds.' if healthy else 'Hosted helper does not report running.'
        if kind == 'disk':
            info = os.statvfs(real_path(check['path']))
            free, total = info.f_bavail * info.f_frsize, info.f_blocks * info.f_frsize
            healthy = free >= check['minFreeBytes'] and total > 0 and free / total >= check['minFreeFraction']
            return healthy, 'Disk reserve is available.' if healthy else 'Free disk space is below the configured reserve.'
        raise BackupError('Unsupported health check.')
    except Exception:
        # A failed observation is unknown/unhealthy, never silent success. Raw
        # network, SQL and filesystem exceptions can contain private material.
        return False, 'This health check could not complete; inspect its private configuration and service journal.'


def queue_email(config, incidents, recoveries):
    for field in ['to', 'from']:
        if not re.fullmatch(r'[A-Za-z0-9.!#$%&\x27*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', config[field]):
            raise BackupError('Invalid operations email address.')
    message = EmailMessage()
    message['To'], message['From'] = config['to'], config['from']
    message['Date'], message['Message-ID'] = format_datetime(datetime.now(timezone.utc)), make_msgid(domain=config['from'].split('@')[1])
    message['Subject'] = '[Kaizen] ' + ('Needs attention' if incidents else 'Service recovered')
    lines = ['Kaizen operations observed these changes:', '']
    lines += ['Needs attention — ' + item['id'] + ': ' + item['detail'] for item in incidents]
    lines += ['Recovered — ' + item['id'] + ': ' + item['detail'] for item in recoveries]
    lines += ['', 'Review the service journal and the Builder backups and recovery guide before taking recovery action.']
    message.set_content('\n'.join(lines))
    try:
        result = subprocess.run([config.get('sendmail', '/usr/sbin/sendmail'), '-odq', '-oi', '-t', '-f', config['from']],
            input=message.as_bytes(), capture_output=True, timeout=30)
    except (OSError, subprocess.TimeoutExpired):
        raise BackupError('The operations alert could not be queued.') from None
    if result.returncode:
        raise BackupError('The operations alert could not be queued.')
    return str(message['Message-ID'])


class Monitor:
    def __init__(self, config):
        if config.get('version') != 1 or not config.get('checks'):
            raise BackupError('Invalid operations monitor configuration.')
        self.config = config
        self.state = real_path(config['stateDirectory'])
        if self.state.stat().st_mode & 0o077:
            raise BackupError('Operations monitoring state must be private.')
        names = [check['id'] for check in config['checks']]
        if len(names) > 40 or len(set(names)) != len(names) or any(not re.fullmatch(r'[a-z][a-z0-9-]{0,63}', name) for name in names):
            raise BackupError('Invalid monitored check names.')

    def check(self):
        results = []
        for check in self.config['checks']:
            healthy, detail = observe(check)
            results.append({'id': check['id'], 'ok': healthy, 'detail': detail})
        return {'version': 1, 'observedAt': now(), 'healthy': all(x['ok'] for x in results), 'checks': results}

    def run(self):
        fd = os.open(self.state / 'monitor.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        try:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise Busy('A monitoring pass is already running.') from None
            file = self.state / 'monitor-state.json'
            previous = json.loads(private_file(file).read_text()) if file.exists() else {}
            observation = self.check()
            counters, notified = {}, set(previous.get('notified', []))
            incidents, recovered = [], []
            for item in observation['checks']:
                name = item['id']
                counters[name] = 0 if item['ok'] else previous.get('failures', {}).get(name, 0) + 1
                if item['ok'] and name in notified:
                    recovered.append(item)
                elif not item['ok'] and counters[name] >= 2 and name not in notified:
                    incidents.append(item)
            observation['alertQueued'] = False
            if incidents or recovered:
                observation['messageId'] = queue_email(self.config['email'], incidents, recovered)
                observation['alertQueued'] = True
                notified.update(item['id'] for item in incidents)
                notified.difference_update(item['id'] for item in recovered)
            atomic_json(file, {'version': 1, 'failures': counters, 'notified': sorted(notified)})
            atomic_json(self.state / 'last-monitor.json', observation)
            return observation
        finally:
            os.close(fd)


def main():
    if len(sys.argv) != 3 or sys.argv[2] not in ('check', 'run'):
        raise BackupError('Use monitor.py <private-config.json> check|run.')
    monitor = Monitor(json.loads(private_file(sys.argv[1]).read_text()))
    result = monitor.check() if sys.argv[2] == 'check' else monitor.run()
    print(json.dumps(result))
    return 0 if result['healthy'] else 1


if __name__ == '__main__':
    os.umask(0o077)
    try:
        sys.exit(main())
    except Busy as error:
        print(str(error), file=sys.stderr)
        sys.exit(75)
    except BackupError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print('Operations monitoring failed. Check its private configuration and runtime.', file=sys.stderr)
        sys.exit(1)
