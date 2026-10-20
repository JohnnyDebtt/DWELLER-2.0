#!/bin/bash
# usage: segs.sh <level> <first> <last> : run each segment standalone in parallel, logs in build/seg<L>_<i>.log
L=$1; A=$2; B=$3
cd "$(dirname "$0")/../build"
for i in $(seq $A $B); do
  (timeout ${SEGT:-900} env BOTMAX=${BOTMAX:-600000} node ../tools/bot.js level$L.json /dev/null $i > seg${L}_$i.log 2>&1; echo "exit $?" >> seg${L}_$i.log) &
done
wait
for i in $(seq $A $B); do echo "== $i"; head -1 seg${L}_$i.log; done
