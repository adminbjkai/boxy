//! Embedded, allowlisted assets: no filesystem exposure and no frontend build step.
use actix_web::{web, HttpResponse};

fn asset(body: &'static [u8], content_type: &'static str) -> HttpResponse {
    HttpResponse::Ok()
        .content_type(content_type)
        .insert_header(("Cache-Control", "public, no-cache"))
        .insert_header(("X-Content-Type-Options", "nosniff"))
        .body(body)
}

pub async fn favicon() -> HttpResponse {
    asset(include_bytes!("../static/favicon.ico"), "image/x-icon")
}

pub async fn app_asset(name: web::Path<String>) -> HttpResponse {
    match name.as_str() {
        "app.css" => asset(
            include_bytes!("../static/app.css"),
            "text/css; charset=utf-8",
        ),
        "app.js" => asset(
            include_bytes!("../static/app.js"),
            "application/javascript; charset=utf-8",
        ),
        _ => HttpResponse::NotFound().finish(),
    }
}

pub async fn vendor_asset(name: web::Path<String>) -> HttpResponse {
    let (body, mime): (&'static [u8], _) = match name.as_str() {
        "prism.min.js" => (
            include_bytes!("../static/vendor/prism.min.js"),
            "application/javascript",
        ),
        "marked.min.js" => (
            include_bytes!("../static/vendor/marked.min.js"),
            "application/javascript",
        ),
        "purify.min.js" => (
            include_bytes!("../static/vendor/purify.min.js"),
            "application/javascript",
        ),
        "prism-theme.min.css" => (
            include_bytes!("../static/vendor/prism-theme.min.css"),
            "text/css",
        ),
        "fonts.css" => (include_bytes!("../static/vendor/fonts.css"), "text/css"),
        "fraunces-latin.woff2" => (
            include_bytes!("../static/vendor/fraunces-latin.woff2"),
            "font/woff2",
        ),
        "space-grotesk-latin.woff2" => (
            include_bytes!("../static/vendor/space-grotesk-latin.woff2"),
            "font/woff2",
        ),
        _ => return HttpResponse::NotFound().finish(),
    };
    asset(body, mime)
}
