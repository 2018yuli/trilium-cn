#!/usr/bin/env bash

VERSION=`jq -r ".version" package.json`
SERIES=${VERSION:0:4}-latest

cat package.json | grep -v electron > server-package.json

sudo docker build -t zadam/trilium:$VERSION -t zadam/trilium:$SERIES .

if [[ $VERSION != *"beta"* ]]; then
  sudo docker tag zadam/trilium:$VERSION zadam/trilium:latest
fi
