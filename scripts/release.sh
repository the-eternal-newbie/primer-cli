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

echo "Releasing v$VERSION..."

# Bump versions in both packages
npm version "$VERSION" --no-git-tag-version \
  --prefix packages/cli
npm version "$VERSION" --no-git-tag-version \
  --prefix packages/templates

# Update templates dependency in cli package.json
# to match the new version exactly
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('packages/cli/package.json', 'utf8'));
  pkg.dependencies['@monomit/primer-templates'] = '^$VERSION';
  fs.writeFileSync('packages/cli/package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Commit the version bump
git add packages/cli/package.json packages/templates/package.json
git commit -m "chore(primer): release v$VERSION"

# Create and push the tag
git tag "v$VERSION"
git push origin master
git push origin "v$VERSION"

echo ""
echo "Done. v$VERSION tagged and pushed."
echo "GitHub Actions will publish to npm automatically."
echo "Monitor progress at: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/.git$//')/actions"