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
COPY --from=builder /app/static /app/static
RUN mkdir -p /app/uploads && chown -R boxy:boxy /app
USER boxy
EXPOSE 8086
CMD ["/app/boxy"]
