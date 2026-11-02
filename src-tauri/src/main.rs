#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::borrow::Cow;
use tauri::http::header::HeaderValue;
use tauri::webview::WebviewWindowBuilder;
use tauri::WebviewUrl;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Riff-Diff")
                .inner_size(1440.0, 900.0)
                .min_inner_size(960.0, 600.0)
                .resizable(true)
                .on_web_resource_request(
                    |request: tauri::http::Request<Vec<u8>>,
                     response: &mut tauri::http::Response<Cow<'static, [u8]>>| {
                        response.headers_mut().insert(
                            "Cross-Origin-Opener-Policy",
                            HeaderValue::from_static("same-origin"),
                        );
                        response.headers_mut().insert(
                            "Cross-Origin-Embedder-Policy",
                            HeaderValue::from_static("require-corp"),
                        );
                        // Tauri doesn't recognize .mjs as JavaScript
                        if request.uri().path().ends_with(".mjs") {
                            response.headers_mut().insert(
                                "Content-Type",
                                HeaderValue::from_static("application/javascript"),
                            );
                        }
                    },
                )
                // Tauri's native drag-drop handler swallows OS file drops, so the
                // webview never receives HTML5 dragenter/dragover/drop events.
                // Disable it so useDropZone works the same as in the browser.
                .disable_drag_drop_handler()
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
