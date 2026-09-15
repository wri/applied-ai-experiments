# Session image: pinned Claude Code CLI + DuckDB, no user config.
# Each benchmark session runs in a fresh container from this image so
# nothing from the host (global CLAUDE.md, hooks, MCP servers, memory)
# can leak into a run.

FROM node:22-bookworm-slim

ARG CLAUDE_CODE_VERSION=2.1.218
# Must match fixtures/pins.json. The catalogs are GeoParquet 2.0.0, which
# spatial rejects before 1.5: every read fails with "Geoparquet version
# 2.0.0 is not supported", so the whole spatial half of the workflow is
# unreachable and a session can only guess at it.
ARG DUCKDB_VERSION=1.5.5

# Retries + no pipelining: the default mirror route drops connections
RUN apt-get -o Acquire::Retries=10 -o Acquire::http::Pipeline-Depth=0 update \
    && apt-get -o Acquire::Retries=10 -o Acquire::http::Pipeline-Depth=0 \
       install -y --no-install-recommends \
       ca-certificates curl unzip python3 \
    && rm -rf /var/lib/apt/lists/*

# Pinned DuckDB CLI
RUN curl -fsSL -o /tmp/duckdb.zip \
      "https://github.com/duckdb/duckdb/releases/download/v${DUCKDB_VERSION}/duckdb_cli-linux-amd64.zip" \
    && unzip /tmp/duckdb.zip -d /usr/local/bin \
    && rm /tmp/duckdb.zip \
    && duckdb --version

# Pinned Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} \
    && claude --version

# Non-root user with a clean HOME: no CLAUDE.md, no hooks, no MCP config.
#
# The harness runs this image with `--user <host uid>:<host gid>` so the
# mounted credential copy is owned by the process that has to read it and
# write its token refresh back. That uid is not known at build time and is
# not in /etc/passwd at run time, so HOME is set explicitly and the home
# tree is left world-writable: any uid Docker is handed can use it. The
# container is throwaway and holds one session's state, so a permissive
# HOME inside it costs nothing.
#
# The base image already owns uid 1000 as `node`, which is why this cannot
# just be `useradd -m runner` — that lands on 1001 and cannot read files
# owned by a host uid of 1000.
RUN useradd -m -s /bin/bash runner \
    && mkdir -p /home/runner/.claude \
    && chmod -R 0777 /home/runner
ENV HOME=/home/runner
USER runner
WORKDIR /workspace

# Pre-install the DuckDB spatial + httpfs extensions so sessions don't
# depend on extension-install network flakiness at run time
RUN duckdb -c "INSTALL spatial; INSTALL httpfs;"

ENTRYPOINT ["claude"]
