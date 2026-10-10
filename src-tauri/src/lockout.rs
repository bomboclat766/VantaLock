use std::time::{SystemTime, UNIX_EPOCH};

pub struct LockoutManager {
    pub threshold: u32,
    pub duration_seconds: u64,
    pub failed_attempts: u32,
    pub lockout_expires_at: u64,
    pub high_water_timestamp: u64,
}

impl LockoutManager {
    pub fn new(threshold: u32, duration_minutes: u32, failed_attempts: u32, lockout_expires_at: u64, high_water_timestamp: u64) -> Self {
        Self {
            threshold: if threshold == 0 { 5 } else { threshold },
            duration_seconds: (duration_minutes as u64) * 60,
            failed_attempts,
            lockout_expires_at,
            high_water_timestamp,
        }
    }

    pub fn get_current_time(&mut self) -> u64 {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        // High-water timestamp check prevents clock rollback bypass
        if now > self.high_water_timestamp {
            self.high_water_timestamp = now;
        }
        self.high_water_timestamp
    }

    pub fn record_failed_attempt(&mut self) -> bool {
        self.failed_attempts += 1;
        let now = self.get_current_time();

        if self.failed_attempts >= self.threshold {
            self.lockout_expires_at = now + self.duration_seconds;
            true // Triggered lockout
        } else {
            false
        }
    }

    pub fn is_locked_out(&mut self) -> (bool, u64) {
        let now = self.get_current_time();
        if now < self.lockout_expires_at {
            let remaining = self.lockout_expires_at - now;
            (true, remaining)
        } else {
            if self.failed_attempts >= self.threshold {
                self.reset();
            }
            (false, 0)
        }
    }

    pub fn reset(&mut self) {
        self.failed_attempts = 0;
        self.lockout_expires_at = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lockout_trigger_and_clock_rollback() {
        let mut mgr = LockoutManager::new(5, 5, 0, 0, 0);

        for _ in 0..4 {
            assert!(!mgr.record_failed_attempt());
        }

        // 5th attempt triggers lockout
        assert!(mgr.record_failed_attempt());
        let (locked, remaining) = mgr.is_locked_out();
        assert!(locked);
        assert!(remaining > 290 && remaining <= 300);

        // Simulate clock rollback: setting stored high_water_timestamp retains current time requirement
        mgr.high_water_timestamp += 100; // Clock advanced
        let (locked2, remaining2) = mgr.is_locked_out();
        assert!(locked2);
        assert!(remaining2 <= 200);
    }
}
