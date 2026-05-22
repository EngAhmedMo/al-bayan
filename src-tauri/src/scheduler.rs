use std::sync::Mutex;
use tauri::{AppHandle, Manager, Emitter};
use chrono::{Local};
use tauri_plugin_notification::NotificationExt;
use serde::Serialize;

// Simplified structure to hold scheduled azhans
#[derive(Clone, Debug, Serialize)]
pub struct AzhanAlarm {
    pub id: String,
    pub time_str: String, // HH:mm format
    pub prayer_name: String,
    pub muazzin_id: String,
    pub is_pre_alert: bool,
    pub fired: bool,
}

pub struct SchedulerState {
    pub alarms: Mutex<Vec<AzhanAlarm>>,
}

impl SchedulerState {
    pub fn new() -> Self {
        Self {
            alarms: Mutex::new(Vec::new()),
        }
    }
}

#[tauri::command]
pub fn schedule_azhan(
    app: AppHandle,
    id: String,
    time_str: String,
    prayer_name: String,
    muazzin_id: String,
    is_pre_alert: bool,
) {
    let state = app.state::<SchedulerState>();
    let mut alarms = state.alarms.lock().unwrap();
    
    // Check if it already exists
    if let Some(existing) = alarms.iter_mut().find(|a| a.id == id) {
        existing.time_str = time_str.clone();
        existing.prayer_name = prayer_name.clone();
        existing.muazzin_id = muazzin_id;
        existing.is_pre_alert = is_pre_alert;
        existing.fired = false;
    } else {
        alarms.push(AzhanAlarm {
            id,
            time_str: time_str.clone(),
            prayer_name: prayer_name.clone(),
            muazzin_id,
            is_pre_alert,
            fired: false,
        });
    }
    
    log::info!("Scheduled alarm for {} at {}", prayer_name, time_str);
}

#[tauri::command]
pub fn cancel_all_azhan(app: AppHandle) {
    let state = app.state::<SchedulerState>();
    let mut alarms = state.alarms.lock().unwrap();
    alarms.clear();
    log::info!("All azhan alarms canceled.");
}

pub fn start_scheduler_loop(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(30)).await;
            
            let now = Local::now().time();
            let current_time_str = now.format("%H:%M").to_string();
            
            let state = app.state::<SchedulerState>();
            let mut alarms = state.alarms.lock().unwrap();
            
            for alarm in alarms.iter_mut() {
                if !alarm.fired && alarm.time_str == current_time_str {
                    alarm.fired = true;
                    
                    let title = if alarm.prayer_name == "الصلاة على النبي" {
                        "الصلاة على النبي ﷺ".to_string()
                    } else if alarm.is_pre_alert {
                        format!("تنبيه صلاة {}", alarm.prayer_name)
                    } else {
                        format!("حان الآن موعد أذان {}", alarm.prayer_name)
                    };
                    
                    let body = if alarm.prayer_name == "الصلاة على النبي" {
                        "اللهم صل وسلم على نبينا محمد".to_string()
                    } else if alarm.is_pre_alert {
                        "اقترب موعد الصلاة، استعد للوضوء".to_string()
                    } else {
                        "حي على الصلاة، حي على الفلاح".to_string()
                    };
                    
                    // Send notification
                    if let Err(e) = app.notification()
                        .builder()
                        .title(title)
                        .body(body)
                        .show() 
                    {
                        log::error!("Failed to show notification: {}", e);
                    }
                    
                    let _ = app.emit("azhan_triggered", alarm.clone());
                }
            }
            
            // Reset fired status at midnight (simple approach)
            if current_time_str == "00:00" || current_time_str == "00:01" {
                 for alarm in alarms.iter_mut() {
                     alarm.fired = false;
                 }
            }
        }
    });
}
