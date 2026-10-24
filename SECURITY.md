# Security Policy

## Reporting a vulnerability

Please do not open a public issue for security problems. Report them privately through
GitHub: go to the [Security tab](https://github.com/aliciapaz/predium/security) and click
**Report a vulnerability**.

Include what you found, the steps to reproduce it, and the impact you expect. You will get an
acknowledgement within 7 days, and we will keep you updated until the issue is fixed. Please give
us a reasonable amount of time to release a fix before disclosing it publicly.

## Supported versions

Only the latest commit on `main` and the hosted instance at
[app.prediumapp.org](https://app.prediumapp.org) receive security fixes.

## Scope

In scope: this repository's code and the hosted instance at app.prediumapp.org. Testing against
the hosted instance must not access other users' data, degrade the service, or use social
engineering. Accounts are invite-only, so prefer testing against a local copy (see the README).

Out of scope: the static product site at prediumapp.org, and vulnerabilities in third-party
dependencies that are already publicly known (Dependabot tracks those).
