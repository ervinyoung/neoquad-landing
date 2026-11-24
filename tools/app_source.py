"""The iOS app's source, as the site was drawn from it.

Repository : ~/Documents/GitHub/neoQuad-ios (or wherever NEOQUAD_IOS points)
Commit     : 5d968ad ("Bring in more of Jacob's 1.3 (5), the event row that grows in place, and the
             new icon", 18 Oct 2026). Every part of the app on the site (src/components/app,
             src/components/how) and every file the tools read comes from this commit. The app has
             moved on since (its HEAD redraws the map pins); the site follows this commit until the
             owner chooses otherwise, so the tools read it here and never from the working tree.
"""
import os
import subprocess

REPO = os.environ.get('NEOQUAD_IOS', os.path.expanduser('~/Documents/GitHub/neoQuad-ios'))
COMMIT = '5d968ad'


def read(path):
    """A file of the app at COMMIT, as bytes. `path` is relative to the repository's root."""
    try:
        return subprocess.run(['git', '-C', REPO, 'show', f'{COMMIT}:{path}'], check=True, capture_output=True).stdout
    except (OSError, subprocess.CalledProcessError) as error:
        detail = getattr(error, 'stderr', b'') or str(error).encode()
        raise SystemExit(f'Cannot read {path} at {COMMIT} in {REPO} (set NEOQUAD_IOS to the repo): {detail.decode().strip()}')
