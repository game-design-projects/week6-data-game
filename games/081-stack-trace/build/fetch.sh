#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/raw"
q() { # name query pages
  for p in $(seq 1 $3); do
    f="$1-$p.json"; [ -s "$f" ] && continue
    gh api -X GET search/issues -f q="$2 is:issue" -f per_page=100 -f page=$p -f sort=updated > "$f" || true
    sleep 4
  done
}
q py 'Traceback "most recent call last" language:python in:body' 3
q pydjango '"most recent call last" django in:body' 2
q pyflask '"most recent call last" flask in:body' 1
q java '"Exception in thread" "at org.springframework" in:body' 2
q java2 '"Caused by: java" "at java.base" in:body' 2
q node '"at Object.<anonymous>" "node_modules" in:body' 3
q react '"The above error occurred in the" react in:body' 1
q go 'goroutine "panic:" ".go:" in:body' 3
q rust '"thread main panicked at" in:body' 2
q cs '"System.NullReferenceException" "at " ".cs:line" in:body' 2
q ruby 'rails "ActionController" ".rb:" "in `" in:body' 2
q php 'laravel "Stack trace:" "#0" in:body' 2
q ts 'typescript "at Module._compile" node_modules in:body' 1
q kotlin '"at kotlinx.coroutines" "Exception" in:body' 1
