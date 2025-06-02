import { useState, useEffect } from 'react';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { firebaseApp } from '@/utils/firebase';
import styles from '@/styles/dashboard.module.css';
import { toast } from 'react-toastify';

interface Worker {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
}

interface Settings {
  defaultEtaMinutes: number;
  maxWorkersPerShift: number;
  etaCalculationMethod: 'fixed' | 'dynamic';
  workers: Worker[];
}

interface Props {
  settings: Settings;
  onSave: (settings: Settings) => void;
}

export default function SettingsPanel({ settings, onSave }: Props) {
  const [localSettings, setLocalSettings] = useState<Settings>(settings);
  const [isEditing, setIsEditing] = useState(false);
  const db = getFirestore(firebaseApp);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const saveSettings = async () => {
    try {
      await setDoc(doc(db, 'settings', 'global'), localSettings);
      onSave(localSettings);
      setIsEditing(false);
      toast.success('Settings saved successfully');
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error('Failed to save settings');
    }
  };

  if (!isEditing) {
    return (
      <div className={styles.settingsPreview}>
        <div className={styles.settingsHeader}>
          <div className={styles.settingsTitle}>
            <h3>System Settings</h3>
            <p className={styles.settingsSubtitle}>Configure system parameters and worker management</p>
          </div>
          <button onClick={() => setIsEditing(true)} className={styles.editButton}>
            Edit Settings
          </button>
        </div>
        <div className={styles.settingsGrid}>
          <div className={styles.settingCard}>
            <div className={styles.settingIcon}>⏱️</div>
            <div className={styles.settingInfo}>
              <h4>Default ETA</h4>
              <p>{localSettings.defaultEtaMinutes} minutes</p>
            </div>
          </div>
          <div className={styles.settingCard}>
            <div className={styles.settingIcon}>👥</div>
            <div className={styles.settingInfo}>
              <h4>Max Workers</h4>
              <p>{localSettings.maxWorkersPerShift}</p>
            </div>
          </div>
          <div className={styles.settingCard}>
            <div className={styles.settingIcon}>✅</div>
            <div className={styles.settingInfo}>
              <h4>Active Workers</h4>
              <p>{localSettings.workers.filter(w => w.isActive).length}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.settingsPanel}>
      <div className={styles.settingsHeader}>
        <div className={styles.settingsTitle}>
          <h3>Edit Settings</h3>
          <p className={styles.settingsSubtitle}>Modify system configuration</p>
        </div>
        <div className={styles.settingsActions}>
          <button onClick={saveSettings} className={styles.saveButton}>
            Save Changes
          </button>
          <button onClick={() => setIsEditing(false)} className={styles.cancelButton}>
            Cancel
          </button>
        </div>
      </div>

      <div className={styles.settingsForm}>
        <div className={styles.settingGroup}>
          <h4 className={styles.groupTitle}>Time Management</h4>
          <div className={styles.settingRow}>
            <label>Default ETA (minutes)</label>
            <input
              type="number"
              value={localSettings.defaultEtaMinutes}
              onChange={e => setLocalSettings({ ...localSettings, defaultEtaMinutes: parseInt(e.target.value) })}
              min="1"
              max="60"
            />
          </div>
          <div className={styles.settingRow}>
            <label>ETA Calculation</label>
            <select
              value={localSettings.etaCalculationMethod}
              onChange={e => setLocalSettings({ ...localSettings, etaCalculationMethod: e.target.value as 'fixed' | 'dynamic' })}
            >
              <option value="fixed">Fixed Time</option>
              <option value="dynamic">Dynamic (Queue-based)</option>
            </select>
          </div>
        </div>

        <div className={styles.settingGroup}>
          <h4 className={styles.groupTitle}>Workforce Management</h4>
          <div className={styles.settingRow}>
            <label>Maximum Workers per Shift</label>
            <input
              type="number"
              value={localSettings.maxWorkersPerShift}
              onChange={e => setLocalSettings({ ...localSettings, maxWorkersPerShift: parseInt(e.target.value) })}
              min="1"
              max="20"
            />
          </div>
        </div>

        <div className={styles.settingGroup}>
          <div className={styles.workersHeader}>
            <h4 className={styles.groupTitle}>Worker List</h4>
            <button 
              onClick={() => setLocalSettings(prev => ({
                ...prev,
                workers: [...prev.workers, { id: Date.now().toString(), name: '', phone: '', isActive: true }]
              }))}
              className={styles.addWorkerButton}
            >
              Add Worker
            </button>
          </div>
          
          <div className={styles.workersList}>
            {localSettings.workers.map((worker, index) => (
              <div key={worker.id} className={styles.workerCard}>
                <div className={styles.workerInputs}>
                  <input
                    placeholder="Name"
                    value={worker.name}
                    onChange={e => {
                      const newWorkers = [...localSettings.workers];
                      newWorkers[index] = { ...worker, name: e.target.value };
                      setLocalSettings({ ...localSettings, workers: newWorkers });
                    }}
                  />
                  <input
                    placeholder="Phone"
                    value={worker.phone}
                    onChange={e => {
                      const newWorkers = [...localSettings.workers];
                      newWorkers[index] = { ...worker, phone: e.target.value };
                      setLocalSettings({ ...localSettings, workers: newWorkers });
                    }}
                  />
                </div>
                <div className={styles.workerActions}>
                  <label className={styles.statusToggle}>
                    <input
                      type="checkbox"
                      checked={worker.isActive}
                      onChange={e => {
                        const newWorkers = [...localSettings.workers];
                        newWorkers[index] = { ...worker, isActive: e.target.checked };
                        setLocalSettings({ ...localSettings, workers: newWorkers });
                      }}
                    />
                    <span>Active</span>
                  </label>
                  <button
                    onClick={() => {
                      const newWorkers = localSettings.workers.filter((_, i) => i !== index);
                      setLocalSettings({ ...localSettings, workers: newWorkers });
                    }}
                    className={styles.removeWorkerButton}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}