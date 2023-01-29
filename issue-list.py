#!/usr/bin/env python3
"""List open issues from all W3CTAG repositories for agenda planning."""

from __future__ import annotations

import argparse
import os
import sys

try:
    from github3 import GitHub
except ImportError:
    print('run `pip install github3.py`')
    sys.exit(2)


def escape(value: str) -> str:
    """Escape value for CSV."""
    return value.replace('"', '""')


def list_issues(github: GitHub) -> None:
    """List all open issues."""
    repo_issues = {repo: list(repo.issues(state='open')) for repo in github.repositories_by('w3ctag')}

    assignees = set()
    for issues in repo_issues.values():
        for issue in issues:
            assignees.update(issue.assignees)

    assignee_names = [assignee.login for assignee in assignees]
    assignee_names.sort()

    print('"Repo","#","Name","URL"', end='')
    for name in assignee_names:
        print(f',"{name}"', end='')
    print()

    for repo, issues in repo_issues.items():
        for issue in issues:
            print(f'"{escape(repo.name)}",{issue.number},"{escape(issue.title)}","{issue.html_url}"', end='')
            issue_assignees = {asignee.login for asignee in issue.assignees}
            for name in assignee_names:
                print(',1' if (name in issue_assignees) else ',', end='')
            print()


if ('__main__' == __name__):
    argparser = argparse.ArgumentParser(description='List open issues from GitHub')
    argparser.add_argument('-u', '--user', dest='user', metavar='GH_ACCESS_USER', help='User to login as')
    argparser.add_argument('-t', '--token', dest='token', metavar='GH_ACCESS_TOKEN', help='API token for GitHub')
    args = argparser.parse_args()

    user = (args.user or os.environ.get('GH_ACCESS_USER'))
    token = (args.token or os.environ.get('GH_ACCESS_TOKEN'))
    if (user and token):
        github = GitHub(user, token=token)
    else:
        github = GitHub()

    list_issues(github)
