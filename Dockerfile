FROM rust:1.78 as builder
WORKDIR /app

COPY Cargo.toml Cargo.lock ./
RUN mkdir -p src
RUN printf 'fn main() {}\n' > src/main.rs
RUN cargo build --release

COPY src ./src
COPY static ./static
RUN cargo build --release

FROM debian:bookworm-slim
RUN useradd -m boxy
WORKDIR /app
COPY --from=builder /app/target/release/boxy /app/boxy
RUN mkdir -p /app/uploads && chown -R boxy:boxy /app
USER boxy
# Bind all interfaces inside the container; reachability is controlled by the
# host's published-port mapping (default BOX_BIND_ADDR=127.0.0.1 would make
# `docker run -p 8086:8086` map to a dead port).
ENV BOX_BIND_ADDR=0.0.0.0
EXPOSE 8086
CMD ["/app/boxy"]
