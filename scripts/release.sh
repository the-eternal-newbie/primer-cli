#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 0.2.0

VERSION=${1:-}

if [ -z "$VERSION" ]; then
  echo "Error: version argument required"
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 0.2.0"
  exit 1
fi

# Validate semver format
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: version must be semver (e.g. 0.2.0)"
  exit 1
fi

# Confirm we're on master and clean
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "master" ]; then
  echo "Error: must be on master branch (currently on $BRANCH)"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: uncommitted changes present — commit or stash first"
  exit 1
fi

# Ensure local master is exactly up-to-date with origin/master
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

# Publish templates first so cli can resolve it during lockfile regeneration
echo "Publishing @monomit/primer-templates@$VERSION..."
cd packages/templates
npm publish --access public
cd ../..

# Now regenerate lockfile — templates is live on registry so resolution works
pnpm install --lockfile-only

# Commit the version bump and updated lockfile
git add packages/cli/package.json packages/templates/package.json pnpm-lock.yaml
git commit -m "chore(primer): release v$VERSION"

# Create and push the tag — GitHub Actions publishes @monomit/primer
git tag "v$VERSION"
git push origin master
git push origin "v$VERSION"

echo ""
echo "Done. @monomit/primer-templates@$VERSION published directly."
echo "GitHub Actions will publish @monomit/primer@$VERSION on tag push."
echo "Monitor: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/\.git$//')/actions"