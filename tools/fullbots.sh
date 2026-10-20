#!/bin/bash
# full continuous-time bot runs, two levels at a time
cd "$(dirname "$0")/../build"
run() { env BOTMAX=${BOTMAX:-900000} node --max-old-space-size=3500 ../tools/bot.js level$1.json solution$1.json > bot$1.log 2>&1; }
while [ $# -gt 0 ]; do
  run $1 & a=$!; shift
  if [ $# -gt 0 ]; then run $1 & b=$!; shift; wait $b; fi
  wait $a
done
