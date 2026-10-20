#!/bin/bash
# usage: segs2.sh <level> <seg> [<seg>...] : runs segments two at a time (memory-friendly)
L=$1; shift
cd "$(dirname "$0")/../build"
run() { timeout ${SEGT:-900} env BOTMAX=${BOTMAX:-600000} node --max-old-space-size=3000 ../tools/bot.js level$L.json /dev/null $1 > seg${L}_$1.log 2>&1; echo "exit $?" >> seg${L}_$1.log; }
while [ $# -gt 0 ]; do
  run $1 & a=$!; shift
  if [ $# -gt 0 ]; then run $1 & b=$!; shift; wait $b; fi
  wait $a
done
