#!/usr/bin/env bash
set -euo pipefail

VERSION=${1:-}

if [ -z "$VERSION" ]; then
  echo "Error: version argument required"
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 0.2.0"
  exit 1
fi

if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: version must be semver (e.g. 0.2.0)"
  exit 1
fi

BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "master" ]; then
  echo "Error: must be on master branch (currently on $BRANCH)"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: uncommitted changes present — commit or stash first"
  exit 1
fi

git fetch origin master
LOCAL_HEAD=$(git rev-parse HEAD)
REMOTE_HEAD=$(git rev-parse origin/master)
if [ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]; then
  echo "Error: local master is not up-to-date with origin/master"
  echo "Please pull the latest changes before releasing"
  exit 1
fi

echo "Releasing v$VERSION..."

# Bump versions in both packages
npm version "$VERSION" --no-git-tag-version \
  --prefix packages/cli
npm version "$VERSION" --no-git-tag-version \
  --prefix packages/templates

# Pin templates dependency to exact version in cli package.json
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('packages/cli/package.json', 'utf8'));
  pkg.dependencies['@monomit/primer-templates'] = '$VERSION';
  fs.writeFileSync('packages/cli/package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Regenerate lockfile using current registry state
# Note: templates is not yet published — lockfile uses the workspace version
pnpm install --lockfile-only --no-frozen-lockfile

# Commit the version bump and updated lockfile
git add packages/cli/package.json packages/templates/package.json pnpm-lock.yaml
git commit -m "chore(primer): release v$VERSION"

# Tag and push — GitHub Actions handles all publishing
git tag "v$VERSION"
git push origin master
git push origin "v$VERSION"

echo ""
echo "Done. v$VERSION tagged and pushed."
echo "GitHub Actions will publish both packages in sequence."
echo "Monitor: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/\.git$//')/actions"