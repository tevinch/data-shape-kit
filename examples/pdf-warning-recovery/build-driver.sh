#!/bin/sh
# Build the real PDF filter and its option code from a libcupsfilters source tree.
# SPDX-License-Identifier: Apache-2.0
set -eu
if [ "$#" -ne 2 ]; then
  echo "Usage: $0 LIBCUPSFILTERS_SOURCE OUTPUT_DRIVER" >&2
  exit 2
fi
source_dir=$(cd "$1" && pwd)
example_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
config_dir=${CONFIG_DIR:-$source_dir}
test -f "$config_dir/config.h" || { echo 'Configure libcupsfilters first (config.h is required).' >&2; exit 2; }
if [ "${PDFIO_CFLAGS+x}" != x ]; then PDFIO_CFLAGS=$(pkg-config --cflags pdfio); fi
if [ "${PDFIO_LIBS+x}" != x ]; then PDFIO_LIBS=$(pkg-config --libs pdfio); fi
if [ "${CUPS_CFLAGS+x}" != x ]; then
  if command -v cups-config >/dev/null 2>&1; then CUPS_CFLAGS=$(cups-config --cflags); else CUPS_CFLAGS=$(pkg-config --cflags cups); fi
fi
if [ "${CUPS_LIBS+x}" != x ]; then
  if command -v cups-config >/dev/null 2>&1; then CUPS_LIBS=$(cups-config --libs); else CUPS_LIBS=$(pkg-config --libs cups); fi
fi
# Compiler flag variables deliberately allow multiple shell words; no eval is used.
${CC:-cc} ${CFLAGS:-} -I"$config_dir" -I"$source_dir" -I"$source_dir/cupsfilters" \
  $PDFIO_CFLAGS $CUPS_CFLAGS "$example_dir/driver.c" \
  "$source_dir/cupsfilters/pdftopdf.c" "$source_dir/cupsfilters/ipp-options.c" \
  $PDFIO_LIBS $CUPS_LIBS ${LDFLAGS:-} -lz -lm -o "$2"
