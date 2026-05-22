use rodio::{Decoder, OutputStream, Sink};
use std::fs::File;
use std::io::BufReader;
use std::sync::mpsc::{self, Sender};
use tauri::{AppHandle, Manager, State};

pub enum AudioCommand {
    Play(String),
    Pause,
    Resume,
    Stop,
    SetVolume(f32),
}

pub struct AudioState {
    pub tx: Sender<AudioCommand>,
}

pub fn init_audio_thread() -> Sender<AudioCommand> {
    let (tx, rx) = mpsc::channel::<AudioCommand>();
    
    std::thread::spawn(move || {
        // Initialize the audio stream on this dedicated thread
        let (_stream, stream_handle) = match OutputStream::try_default() {
            Ok(res) => res,
            Err(e) => {
                log::error!("Failed to init audio stream: {}", e);
                return;
            }
        };
        
        let mut sink: Option<Sink> = None;
        
        for cmd in rx {
            match cmd {
                AudioCommand::Play(path) => {
                    if let Some(s) = sink.take() {
                        s.stop();
                    }
                    if let Ok(file) = File::open(&path) {
                        if let Ok(source) = Decoder::new(BufReader::new(file)) {
                            if let Ok(new_sink) = Sink::try_new(&stream_handle) {
                                new_sink.append(source);
                                new_sink.play();
                                sink = Some(new_sink);
                            } else {
                                log::error!("Failed to create Sink");
                            }
                        } else {
                            log::error!("Failed to decode file: {}", path);
                        }
                    } else {
                        log::error!("Failed to open file: {}", path);
                    }
                }
                AudioCommand::Pause => {
                    if let Some(s) = &sink {
                        s.pause();
                    }
                }
                AudioCommand::Resume => {
                    if let Some(s) = &sink {
                        s.play();
                    }
                }
                AudioCommand::Stop => {
                    if let Some(s) = sink.take() {
                        s.stop();
                    }
                }
                AudioCommand::SetVolume(v) => {
                    if let Some(s) = &sink {
                        s.set_volume(v);
                    }
                }
            }
        }
    });
    
    tx
}

#[tauri::command]
pub fn play_audio(app: AppHandle, path: String) -> Result<(), String> {
    let state: State<AudioState> = app.state();
    state.tx.send(AudioCommand::Play(path)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pause_audio(app: AppHandle) {
    let state: State<AudioState> = app.state();
    let _ = state.tx.send(AudioCommand::Pause);
}

#[tauri::command]
pub fn resume_audio(app: AppHandle) {
    let state: State<AudioState> = app.state();
    let _ = state.tx.send(AudioCommand::Resume);
}

#[tauri::command]
pub fn stop_audio(app: AppHandle) {
    let state: State<AudioState> = app.state();
    let _ = state.tx.send(AudioCommand::Stop);
}

#[tauri::command]
pub fn set_audio_volume(app: AppHandle, volume: f32) {
    let state: State<AudioState> = app.state();
    let _ = state.tx.send(AudioCommand::SetVolume(volume));
}
