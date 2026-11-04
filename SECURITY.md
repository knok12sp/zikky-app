# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub's
[security advisory](https://github.com/knok12sp/zikky-app/security/advisories/new)
flow. Do not open a public issue.

Include the affected version or commit, the platform, reproduction steps and the
impact. Remove real server addresses, usernames, passwords, tokens and personal
library details from logs and screenshots.

## Scope

Zikky is a client. Relevant reports include:

- credential or token leakage from the app;
- unsafe handling of server responses or downloaded files;
- path traversal or unintended file access in phone storage;
- insecure plain-HTTP defaults or native network configuration;
- playback or download actions that expose data to another app or account;
- dependency vulnerabilities with a practical impact.

The server itself is out of scope. Report vulnerabilities in Navidrome,
Airsonic, Gonic or another server to that project.

## Supported versions

Security fixes target the latest release on the `main` branch. Older versions
may not receive patches.

## How we respond

We aim to acknowledge a report within a few days, agree on a disclosure timeline,
and credit the reporter unless they prefer otherwise. Please give us reasonable
time to release a fix before public disclosure.

## Deployment guidance

- Use HTTPS for any server reachable outside a trusted network.
- Plain HTTP is opt-in at native build time through `ZIKKY_HTTP_HOSTS`; do not
  enable it for hosts you do not control.
- Use a unique password for the Subsonic account and keep the server patched.
- Phone downloads and cached metadata live in the app's private storage; remove
  account data from Settings before handing the device to someone else.

## Secrets

Never commit credentials, private keys, signing material, `.env` files, real
server addresses or personal library data. The repository ignores common secret
and build files, but review your diff before opening a pull request.
