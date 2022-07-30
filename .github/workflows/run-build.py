#!/usr/bin/env python3

import re
import subprocess
import sys

def default_main():
  cmd = "nix --no-sandbox build"
  # Turn off sandboxing because Bazel needs to run http_archive calls.
  # We pin the SHAs used by Bazel, so that part should be OK.
  # Unfortunately, sandboxing is all-or-nothing; it would be nice to
  # have a way to only allow Bazel to fetch stuff.
  #
  # In the future, if want to use BuildBuddy or similar, we will
  # need internet access anyways.

  proc = subprocess.Popen(
    cmd.split(), stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT, encoding='utf-8')

  text = ""
  while proc.poll() is None:
      line = proc.stdout.readline().strip()
      line = line.strip()
      if len(line) == 0:
        continue
      text += line
      print(line)

  if proc.returncode != 0:
    match = re.search("run 'nix log ([^']+)'", text)
    if match:
      log_path = match.group(1)
      print("running 'nix log {}'".format(log_path))
      _ = subprocess.call(["nix", "log", log_path])
    print("\nNix build failed.")
    sys.exit(1)

if __name__ == '__main__':
  default_main()
