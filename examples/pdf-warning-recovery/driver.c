/* Copyright 2026 Tevinch. SPDX-License-Identifier: Apache-2.0 */
#include <cupsfilters/filter.h>
#include <stdio.h>
#include <string.h>
#include <stdarg.h>

static void log_message(void *context, cf_loglevel_t level, const char *message, ...)
{
  va_list ap;
  fprintf(stderr, "filter-log-%d [%s]: ", level, (const char *)context);
  va_start(ap, message);
  vfprintf(stderr, message, ap);
  va_end(ap);
  fputc('\n', stderr);
}

int main(int argc, char **argv)
{
  cf_filter_data_t data;
  int inputfd, outputfd, status;
  if (argc < 3 || argc > 4)
    return (2);
  memset(&data, 0, sizeof(data));
  data.copies = 1;
  data.content_type = "application/pdf";
  data.final_content_type = "application/pdf";
  data.logfunc = log_message;
  data.logdata = "callback-context";
  if (argc == 4)
    data.num_options = cupsParseOptions(argv[3], 0, &data.options);
  inputfd = open(argv[1], O_RDONLY);
  outputfd = open(argv[2], O_WRONLY | O_CREAT | O_TRUNC, 0600);
  if (inputfd < 0 || outputfd < 0)
  {
    perror("fixture file");
    return (2);
  }
  status = cfFilterPDFToPDF(inputfd, outputfd, 1, &data, NULL);
  cupsFreeOptions(data.num_options, data.options);
  close(inputfd);
  close(outputfd);
  printf("filter status: %d\n", status);
  return (status);
}
