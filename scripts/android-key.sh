#!/usr/bin/env bash
set -euo pipefail
: "${ZIKKY_KEYSTORE:?Set private keystore path outside the repository}"
: "${ZIKKY_SIGNING_PASSWORD_FILE:?Set password file delivered by the private secret mechanism}"
: "${JAVA_HOME:?Set JAVA_HOME}"
if [[ -e "$ZIKKY_KEYSTORE" ]]; then printf '%s\n' 'Key exists; refusing to replace the update identity.' >&2; exit 1; fi
umask 077
mkdir -p "$(dirname "$ZIKKY_KEYSTORE")"
"$JAVA_HOME/bin/keytool" -genkeypair -keystore "$ZIKKY_KEYSTORE" -storetype PKCS12 -storepass:file "$ZIKKY_SIGNING_PASSWORD_FILE" -keypass:file "$ZIKKY_SIGNING_PASSWORD_FILE" -alias zikky -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Zikky Personal Music'
chmod 600 "$ZIKKY_KEYSTORE"
printf '%s\n' 'Back up this key and its password privately. Updates require the same key.'
