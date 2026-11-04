#!/usr/bin/env bash
set -euo pipefail
# Installs user-local build tools; does not require root, a VM or an emulator.
[[ "$(uname -s)" == Linux && "$(uname -m)" == x86_64 ]] || { printf '%s\n' 'This helper supports Linux x86_64.' >&2; exit 1; }
ZIKKY_TOOLCHAIN_DIR="${ZIKKY_TOOLCHAIN_DIR:-$HOME/.cache/zikky-toolchain}"
export ZIKKY_TOOLCHAIN_DIR
python3 - <<'PY'
import hashlib,json,os,pathlib,tarfile,subprocess,zipfile
root=pathlib.Path(os.environ['ZIKKY_TOOLCHAIN_DIR']);root.mkdir(parents=True,exist_ok=True)
def download(url,path,checksum):
    if not path.exists(): subprocess.run(['curl','-fL','--retry','2',url,'-o',str(path)],check=True)
    if hashlib.sha256(path.read_bytes()).hexdigest()!=checksum:raise SystemExit('Toolchain checksum mismatch; remove cached archive and retry.')
if not (root/'jdk').exists():
    asset=json.loads(subprocess.check_output(['curl','-fsSL','https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jdk&os=linux&vendor=eclipse']))[0]['binary']['package']
    archive=root/'jdk.tar.gz';download(asset['link'],archive,asset['checksum'])
    with tarfile.open(archive) as t:t.extractall(root/'jdk',filter='data')
if not (root/'sdk/cmdline-tools/latest').exists():
    archive=root/'android-tools.zip'
    download('https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip',archive,'4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583')
    with zipfile.ZipFile(archive) as z:z.extractall(root/'sdk')
    (root/'sdk/cmdline-tools').rename(root/'sdk/tools-tmp');(root/'sdk/cmdline-tools').mkdir();(root/'sdk/tools-tmp').rename(root/'sdk/cmdline-tools/latest')
    for p in (root/'sdk/cmdline-tools/latest/bin').iterdir():p.chmod(0o755)
PY
JAVA_HOME="$(find "$ZIKKY_TOOLCHAIN_DIR/jdk" -mindepth 1 -maxdepth 1 -type d | head -1)"
ANDROID_HOME="$ZIKKY_TOOLCHAIN_DIR/sdk"
export JAVA_HOME ANDROID_HOME
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --licenses
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" 'platform-tools' 'platforms;android-37.0' 'build-tools;37.0.0' 'ndk;27.1.12297006' 'cmake;3.22.1'
printf '%s\n' "Toolchain installed at $ZIKKY_TOOLCHAIN_DIR. Set JAVA_HOME and ANDROID_HOME before building."
