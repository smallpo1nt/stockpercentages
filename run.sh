#!/bin/bash

mkdir out
node download.js > out/success.tsv 2> out/error.tsv
cat out/error.tsv | sort -k 2 > out/error.sorted.tsv