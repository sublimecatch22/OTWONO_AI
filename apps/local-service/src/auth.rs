//! The gate in front of the API.
//!
//! Two independent checks, both required:
//!
//! * a bearer token that only the desktop shell can read from the handshake
//!   file;
//! * an `Origin` that is on an allow-list.
//!
//! The second exists because a page open in the user's browser can reach
//! `127.0.0.1` and *will* attach no token — but a malicious page that somehow
//! learned the token would still be refused, because its origin is not ours.
//! Together they block cross-site request forgery and DNS rebinding.

use axum::extract::State;
use axum::http::{HeaderMap, Request, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};

use crate::error::ApiError;
use crate::state::AppState;

/// Origins the web view may present.
///
/// The packaged application presents a different origin on every platform, and
/// all of them must be here or the interface talks to a service that refuses
/// it:
///
/// * macOS and Linux serve the app from `tauri://localhost`.
/// * **Windows serves it from `http://tauri.localhost`** — plain HTTP. WebView2
///   cannot register a custom scheme, so Tauri uses a real one. It is `https`
///   only when `app.windows.useHttpsScheme` is set, which this application does
///   not set, so both forms are allowed rather than depending on that setting
///   staying as it is.
///
/// The `http://localhost:*` entries are the Vite development server.
///
/// Every entry is an origin the application itself presents. A page anywhere
/// else still gets a `403`, and a request from any of these still needs the
/// token.
pub fn default_allowed_origins() -> Vec<String> {
    vec![
        "tauri://localhost".to_string(),
        "http://tauri.localhost".to_string(),
        "https://tauri.localhost".to_string(),
        "http://localhost:1420".to_string(),
        "http://127.0.0.1:1420".to_string(),
    ]
}

fn origin_allowed(allowed: &[String], origin: &str) -> bool {
    allowed.iter().any(|candidate| candidate == origin)
}

fn bearer(headers: &HeaderMap) -> Option<&str> {
    headers
        .get(axum::http::header::AUTHORIZATION)?
        .to_str()
        .ok()?
        .strip_prefix("Bearer ")
        .map(str::trim)
}

/// Reject a request that carries a disallowed `Origin`, whatever else it has.
pub fn check_origin(state: &AppState, headers: &HeaderMap) -> Result<(), ApiError> {
    let Some(origin) = headers.get(axum::http::header::ORIGIN) else {
        // No `Origin` at all: not a browser-initiated cross-site request. The
        // token check below still applies.
        return Ok(());
    };
    let origin = origin.to_str().unwrap_or_default();
    if origin_allowed(&state.allowed_origins, origin) {
        Ok(())
    } else {
        tracing::warn!(%origin, "refused a request from an origin that is not allowed");
        Err(ApiError::Forbidden(
            "This request came from a page OTWONO does not recognise, so it was refused."
                .to_string(),
        ))
    }
}

pub fn check_token(state: &AppState, headers: &HeaderMap) -> Result<(), ApiError> {
    match bearer(headers) {
        Some(presented) if crate::runtime::tokens_match(&state.token, presented) => Ok(()),
        _ => Err(ApiError::Unauthorised),
    }
}

/// Middleware applied to everything except `/health`.
///
/// A pre-flight `OPTIONS` request never carries the token, so it is answered
/// here on the origin check alone rather than through a catch-all route —
/// which would otherwise turn an unknown path into a 405.
pub async fn guard(
    State(state): State<AppState>,
    request: Request<axum::body::Body>,
    next: Next,
) -> Response {
    let headers = request.headers().clone();
    if let Err(error) = check_origin(&state, &headers) {
        return error.into_response();
    }

    // `check_origin` has already refused anything not on the list, so whatever
    // is here is one we are willing to name. Hold on to it: every response
    // below has to say which single origin it is for.
    let origin = headers
        .get(axum::http::header::ORIGIN)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);

    if request.method() == axum::http::Method::OPTIONS {
        return preflight_response(origin.as_deref());
    }

    // A refusal needs the headers too. Without them the browser blocks the
    // response before the interface can read it, so a 401 arrives as an opaque
    // network error and the screen shows nothing rather than saying what
    // happened.
    if let Err(error) = check_token(&state, &headers) {
        let mut response = error.into_response();
        allow_origin(response.headers_mut(), origin.as_deref());
        return response;
    }

    let mut response = next.run(request).await;
    allow_origin(response.headers_mut(), origin.as_deref());
    response
}

/// Name the one origin this response is for.
///
/// `Access-Control-Allow-Origin` takes a single origin or `*`, never a list.
/// A list is not a wider permission, it is a malformed header: the browser
/// discards the response and the request fails as if the service were not
/// there. `Vary: Origin` is required with it, so that a cached response for
/// one origin is not served to another.
fn allow_origin(headers: &mut HeaderMap, origin: Option<&str>) {
    let Some(origin) = origin else { return };
    let Ok(value) = axum::http::HeaderValue::from_str(origin) else {
        return;
    };
    headers.insert("access-control-allow-origin", value);
    headers.insert(
        axum::http::header::VARY,
        axum::http::HeaderValue::from_static("origin"),
    );
}

fn preflight_response(origin: Option<&str>) -> Response {
    let mut response = (
        StatusCode::NO_CONTENT,
        [
            (
                "access-control-allow-methods",
                "GET, POST, PUT, DELETE, OPTIONS",
            ),
            (
                "access-control-allow-headers",
                "authorization, content-type",
            ),
            ("access-control-max-age", "600"),
        ],
    )
        .into_response();
    allow_origin(response.headers_mut(), origin);
    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    fn headers(origin: Option<&str>, token: Option<&str>) -> HeaderMap {
        let mut headers = HeaderMap::new();
        if let Some(origin) = origin {
            headers.insert(
                axum::http::header::ORIGIN,
                HeaderValue::from_str(origin).unwrap(),
            );
        }
        if let Some(token) = token {
            headers.insert(
                axum::http::header::AUTHORIZATION,
                HeaderValue::from_str(&format!("Bearer {token}")).unwrap(),
            );
        }
        headers
    }

    fn state() -> AppState {
        AppState::for_tests()
    }

    /// Every origin the packaged application can present, on every platform it
    /// is built for. The Windows entry is the one this test existed without:
    /// it asserted the macOS and Linux origin and the development server, so a
    /// Windows build shipped in which the interface was refused by its own
    /// service on every request — every screen empty, settings loading for
    /// ever. Nothing here is theoretical; add the origin for a platform before
    /// shipping to it.
    #[test]
    fn the_packaged_app_and_the_development_server_are_allowed() {
        let allowed = default_allowed_origins();
        for (origin, platform) in [
            ("tauri://localhost", "macOS and Linux"),
            ("http://tauri.localhost", "Windows"),
            ("https://tauri.localhost", "Windows with useHttpsScheme"),
            ("http://localhost:1420", "the development server"),
            ("http://127.0.0.1:1420", "the development server"),
        ] {
            assert!(
                origin_allowed(&allowed, origin),
                "{origin} is what {platform} presents; refusing it breaks the \
                 whole interface"
            );
        }
    }

    /// `Access-Control-Allow-Origin` carries one origin or `*`, never a list.
    /// This once joined the whole allow-list with commas, which is not a wider
    /// permission but a malformed header: browsers discard the response, so
    /// every screen in the application was empty while the service itself
    /// answered correctly to anything that was not a browser. A browser cannot
    /// read this header back, so the assertion has to live here.
    #[test]
    fn the_allow_origin_header_names_exactly_one_origin() {
        for origin in default_allowed_origins() {
            let mut headers = HeaderMap::new();
            allow_origin(&mut headers, Some(&origin));
            let value = headers
                .get("access-control-allow-origin")
                .expect("an allowed origin must be named")
                .to_str()
                .unwrap();
            assert_eq!(
                value, origin,
                "the header must echo the one origin asked for"
            );
            assert!(
                !value.contains(','),
                "a list is a malformed header: {value}"
            );
            assert_eq!(
                headers.get(axum::http::header::VARY).unwrap(),
                "origin",
                "a response that varies by origin must say so, or a cache will \
                 serve one origin's response to another"
            );
        }
    }

    /// No `Origin` means no browser, so there is nothing to allow.
    #[test]
    fn a_request_without_an_origin_gets_no_allow_header() {
        let mut headers = HeaderMap::new();
        allow_origin(&mut headers, None);
        assert!(headers.get("access-control-allow-origin").is_none());
    }

    #[test]
    fn an_unknown_origin_is_refused_even_with_the_right_token() {
        let state = state();
        for hostile in [
            "https://evil.example.com",
            "http://localhost:3000",
            "null",
            "http://otwono.com.evil.example",
        ] {
            let result = check_origin(&state, &headers(Some(hostile), Some(&state.token)));
            assert!(result.is_err(), "{hostile} should have been refused");
        }
    }

    #[test]
    fn a_request_with_no_origin_passes_the_origin_check_but_still_needs_a_token() {
        let state = state();
        assert!(check_origin(&state, &headers(None, None)).is_ok());
        assert!(check_token(&state, &headers(None, None)).is_err());
        assert!(check_token(&state, &headers(None, Some(&state.token))).is_ok());
    }

    #[test]
    fn a_wrong_or_missing_token_is_refused() {
        let state = state();
        assert!(check_token(&state, &headers(None, Some("not-the-token"))).is_err());
        assert!(check_token(&state, &headers(None, Some(""))).is_err());
        assert!(check_token(&state, &HeaderMap::new()).is_err());

        let mut malformed = HeaderMap::new();
        malformed.insert(
            axum::http::header::AUTHORIZATION,
            HeaderValue::from_str(&state.token).unwrap(),
        );
        assert!(
            check_token(&state, &malformed).is_err(),
            "a bare token without the Bearer scheme is not accepted"
        );
    }

    #[test]
    fn a_token_that_is_a_prefix_of_the_real_one_is_refused() {
        let state = state();
        let truncated = &state.token[..state.token.len() - 3];
        assert!(check_token(&state, &headers(None, Some(truncated))).is_err());
    }
}
