#!/usr/bin/env bash
set -euo pipefail

ZIP_URL="https://disclosures-clerk.house.gov/public_disc/financial-pdfs/2025FD.zip"
DEST_ZIP="2025FD.zip"
WORKDIR="financial-pdfs"

# create or clean directory
mkdir -p "$WORKDIR"
rm -rf "${WORKDIR:?}/"*

# download
curl -L --fail "$ZIP_URL" -o "$DEST_ZIP"

# unzip
unzip -o "$DEST_ZIP" -d "$WORKDIR"

# (optional) remove zip
rm "$DEST_ZIP"

exit 0
