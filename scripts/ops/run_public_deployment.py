#!/usr/bin/python3 -I
"""Narrow root launcher. Request arguments never select paths, users or commands."""
import argparse
import grp
import json
import os
from pathlib import Path
import pwd
import re
import subprocess
import sys

CONFIG = Path('/etc/kaizen/native-deploy.json')


def fail(message):
    raise ValueError('Deployment launcher: ' + message)


def request(argv):
    parser = argparse.ArgumentParser(description='Run a configured Kaizen deployment')
    parser.add_argument('--branch', required=True, choices=['main', 'stage'])
    parser.add_argument('--sha', default='')
    parser.add_argument('--release', default='')
    parser.add_argument('--request', default='')
    parser.add_argument('--restore', default='')
    parser.add_argument('--build-number', default='')
    parser.add_argument('--mode', choices=['deploy', 'preflight', 'reconcile', 'maintain'], default='deploy')
    value = vars(parser.parse_args(argv))
    if value['mode'] == 'maintain':
        if any(value[key] for key in ['sha', 'release', 'request', 'restore', 'build_number']):
            fail('Maintenance accepts only its fixed branch, with no new publication metadata.')
        return value
    if not re.fullmatch(r'[a-f0-9]{40}', value['sha']): fail('Invalid source commit.')
    for key in ['release', 'restore']:
        if (key == 'release' or value[key]) and not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}', value[key]): fail('Invalid release identifier.')
    if value['request'] and not re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', value['request']): fail('Invalid publication identifier.')
    if value['build_number'] and not re.fullmatch(r'[0-9]{1,20}', value['build_number']): fail('Invalid build number.')
    if value['restore'] and value['mode'] != 'reconcile': fail('Restoration needs reconciliation mode.')
    return value


def absolute(value):
    if not isinstance(value, str) or not re.fullmatch(r'/[a-zA-Z0-9_./-]+', value) or value == '/' or os.path.normpath(value) != value or str(Path(value).resolve()) != value:
        fail('Use canonical absolute configured paths.')
    return value


def configuration(value):
    if not isinstance(value, dict) or set(value) != {'schemaVersion', 'user', 'node', 'worker', 'preflight', 'targets'} or type(value['schemaVersion']) is not int or value['schemaVersion'] != 1:
        fail('Invalid installed configuration.')
    if value['user'] != 'kaizen-deploy': fail('The deployment account must be kaizen-deploy.')
    for key in ['node', 'worker', 'preflight']: absolute(value[key])
    targets = value['targets']
    if not isinstance(targets, dict) or set(targets) != {'main', 'stage'}: fail('Configure both deployment destinations.')
    paths=[]
    workers=set()
    for branch, target in targets.items():
        if not isinstance(target, dict) or set(target) != {'appDirectory', 'releaseStore', 'stateDirectory', 'environmentFile', 'domain', 'repository', 'projectId', 'workerId', 'cloud'}:
            fail('Invalid fixed deployment destination.')
        for key in ['appDirectory', 'releaseStore', 'stateDirectory', 'environmentFile']: absolute(target[key])
        if target['projectId'] != 'kaizen' or type(target['cloud']) is not bool or target['cloud'] != (branch == 'main'):
            fail('Keep the original publication queue on its production destination.')
        if not isinstance(target['domain'], str) or not re.fullmatch(r'[a-z0-9][a-z0-9.-]+', target['domain']): fail('Invalid public hostname.')
        if not isinstance(target['repository'], str) or not re.fullmatch(r'(?:git@[a-z0-9.-]+:|https://[a-z0-9.-]+/)[a-zA-Z0-9_-]+/[a-zA-Z0-9_.-]+\.git', target['repository']):
            fail('Configure the fixed repository without embedded credentials.')
        if not isinstance(target['workerId'], str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,100}', target['workerId']) or target['workerId'] in workers:
            fail('Each destination needs a distinct worker identity.')
        workers.add(target['workerId'])
        paths += [Path(target[key]) for key in ['appDirectory', 'releaseStore', 'stateDirectory']]
    for index, path in enumerate(paths):
        for other in paths[index+1:]:
            if path == other or path in other.parents or other in path.parents: fail('Deployment and state directories must be separate across both destinations.')
    if targets['main']['domain'].removeprefix('www.') == targets['stage']['domain'].removeprefix('www.'):
        fail('Staging cannot use the production domain.')
    return value


def installed_file(path):
    path=Path(path)
    info=path.lstat()
    if path.is_symlink() or not path.is_file() or info.st_uid != 0 or info.st_mode & 0o022 or info.st_nlink != 1:
        fail('Installed runtime/configuration files must be owned and writable only by root.')
    for parent in path.parents:
        info=parent.lstat()
        if parent.is_symlink() or info.st_uid != 0 or info.st_mode & 0o022: fail('Installed paths must have trusted parents.')


def command(config, item, group):
    target=config['targets'][item['branch']]
    production=config['targets']['main']
    unit='kaizen-native-deploy-'+item['branch']+'.service'
    environment={
        'PATH': str(Path(config['node']).parent)+':/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        'NODE_ENV':'production',
        'KAIZEN_APP_DIR':target['appDirectory'], 'KAIZEN_RELEASE_STORE':target['releaseStore'],
        'KAIZEN_PUBLIC_DOMAIN':target['domain'], 'KAIZEN_DEPLOY_BRANCH':item['branch'],
        'KAIZEN_DEPLOY_SHA':item['sha'], 'KAIZEN_RELEASE_ID':item['release'],
        'KAIZEN_BUILDER_REQUEST_ID':item['request'], 'KAIZEN_RESTORE_RELEASE_ID':item['restore'],
        'KAIZEN_PRODUCTION_APP_DIR':production['appDirectory'],
        'KAIZEN_PRODUCTION_RELEASE_STORE':production['releaseStore'], 'KAIZEN_PRODUCTION_DOMAIN':production['domain'],
        'KAIZEN_NATIVE_REPOSITORY':target['repository'], 'KAIZEN_NATIVE_PREFLIGHT':config['preflight'],
        'BUILDER_RELEASE_ENV_FILE':target['environmentFile'], 'BUILDER_RELEASE_PROJECT_ID':target['projectId'],
        'BUILDER_NATIVE_WORKER_ID':target['workerId'], 'BUILDER_NATIVE_STATE_DIRECTORY':target['stateDirectory'],
        'VITE_BUILDER_CLOUD':'1' if target['cloud'] else '0',
        'VITE_BUILD_SHA':item['sha'], 'VITE_BUILD_NUMBER':item['build_number'],
        'XDG_CACHE_HOME':target['stateDirectory']+'/cache', 'XDG_DATA_HOME':target['stateDirectory']+'/data',
        'npm_config_cache':target['stateDirectory']+'/cache/npm',
    }
    properties={
        'Type':'exec','User':config['user'],'Group':group,'WorkingDirectory':target['appDirectory'],
        'KillMode':'control-group','SendSIGKILL':'yes','TimeoutStopSec':'90s',
        'Delegate':'cpu memory pids','DelegateSubgroup':'supervisor','UMask':'0077',
        'PrivateTmp':'yes','ProtectHome':'read-only','ProtectSystem':'full',
        'ProtectControlGroups':'yes',
        'ReadWritePaths':'/sys/fs/cgroup/system.slice/'+unit,
    }
    # Nginx verification/reload uses the account's existing two sudo commands.
    # Do not grant arbitrary systemd-run or root execution to the caller.
    args=['/usr/bin/systemd-run','--unit='+unit,'--wait','--pipe','--collect']
    for key,value in properties.items(): args+=['--property='+key+'='+value]
    for key,value in environment.items(): args+=['--setenv='+key+'='+value]
    args += ['/usr/bin/flock','--nonblock','--no-fork',target['releaseStore']+'/build.lock',config['node'],config['worker'],'--'+item['mode']]
    return args


def main(argv):
    if os.geteuid() != 0: fail('Use the installed sudo launcher.')
    item=request(argv)
    installed_file(CONFIG)
    if CONFIG.stat().st_size > 16384: fail('Configuration is too large.')
    config=configuration(json.loads(CONFIG.read_text()))
    for key in ['node','worker','preflight']: installed_file(config[key])
    for target in config['targets'].values(): installed_file(target['environmentFile'])
    account=pwd.getpwnam(config['user'])
    target=config['targets'][item['branch']]
    for key in ['appDirectory','releaseStore']:
        p=Path(target[key]);info=p.lstat()
        if not p.is_dir() or info.st_uid != account.pw_uid or info.st_mode & 0o022: fail('The dedicated destination must belong to the deployment account.')
    state=Path(target['stateDirectory'])
    if not state.exists():
        # Its parent is installed by the operator, never derived from a request.
        parent=state.parent.lstat()
        if parent.st_uid != 0 or parent.st_mode & 0o022: fail('Install the private state parent first.')
        state.mkdir(mode=0o700);os.chown(state,account.pw_uid,account.pw_gid)
    info=state.lstat()
    if state.is_symlink() or not state.is_dir() or info.st_uid != account.pw_uid or info.st_mode & 0o077:
        fail('The private worker directory has unexpected ownership or permissions.')
    result=subprocess.run(command(config,item,grp.getgrgid(account.pw_gid).gr_name),env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8'})
    return result.returncode


if __name__ == '__main__':
    try:
        raise SystemExit(main(sys.argv[1:]))
    except (ValueError,OSError,KeyError,json.JSONDecodeError) as error:
        print(str(error),file=sys.stderr)
        raise SystemExit(1)
