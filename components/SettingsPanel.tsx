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

  const addWorker = () => {
    setLocalSettings(prev => ({
      ...prev,
      workers: [...prev.workers, {
        id: Date.now().toString(),
        name: '',
        phone: '',
        isActive: true
      }]
    }));
  };

  const updateWorker = (index: number, field: string, value: string | boolean) => {
    const newWorkers = [...localSettings.workers];
    newWorkers[index] = { ...newWorkers[index], [field]: value };
    setLocalSettings({ ...localSettings, workers: newWorkers });
  };

  const removeWorker = (index: number) => {
    setLocalSettings(prev => ({
      ...prev,
      workers: prev.workers.filter((_, i) => i !== index)
    }));
  };

  if (!isEditing) {
    return (
      <div className={styles.settingsPreview}>
        <div className={styles.settingsHeader}>
          <h3>System Settings</h3>
          <button onClick={() => setIsEditing(true)}>Edit</button>
        </div>
        <div className={styles.settingsSummary}>
          <p>Default ETA: {localSettings.defaultEtaMinutes} minutes</p>
          <p>Max Workers: {localSettings.maxWorkersPerShift}</p>
          <p>Active Workers: {localSettings.workers.filter(w => w.isActive).length}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.settingsPanel}>
      <div className={styles.settingsHeader}>
        <h3>Edit Settings</h3>
        <div>
          <button onClick={saveSettings} className={styles.saveBtn}>Save</button>
          <button onClick={() => setIsEditing(false)} className={styles.cancelBtn}>Cancel</button>
        </div>
      </div>

      <div className={styles.settingsGrid}>
        <div className={styles.settingGroup}>
          <h4>ETA Configuration</h4>
          <div className={styles.settingRow}>
            <label>Default ETA (minutes):</label>
            <input
              type="number"
              value={localSettings.defaultEtaMinutes}
              onChange={e => setLocalSettings({ ...localSettings, defaultEtaMinutes: parseInt(e.target.value) })}
            />
          </div>
          <div className={styles.settingRow}>
            <label>Calculation Method:</label>
            <select
              value={localSettings.etaCalculationMethod}
              onChange={e => setLocalSettings({ ...localSettings, etaCalculationMethod: e.target.value as 'fixed' | 'dynamic' })}
            >
              <option value="fixed">Fixed Time</option>
              <option value="dynamic">Dynamic (Based on Queue)</option>
            </select>
          </div>
        </div>

        <div className={styles.settingGroup}>
          <h4>Worker Management</h4>
          <div className={styles.settingRow}>
            <label>Max Workers per Shift:</label>
            <input
              type="number"
              value={localSettings.maxWorkersPerShift}
              onChange={e => setLocalSettings({ ...localSettings, maxWorkersPerShift: parseInt(e.target.value) })}
            />
          </div>
        </div>

        <div className={styles.workersSection}>
          <div className={styles.workersHeader}>
            <h4>Workers</h4>
            <button onClick={addWorker}>Add Worker</button>
          </div>
          
          <div className={styles.workersList}>
            {localSettings.workers.map((worker, index) => (
              <div key={worker.id} className={styles.workerRow}>
                <input
                  placeholder="Name"
                  value={worker.name}
                  onChange={e => updateWorker(index, 'name', e.target.value)}
                />
                <input
                  placeholder="Phone"
                  value={worker.phone}
                  onChange={e => updateWorker(index, 'phone', e.target.value)}
                />
                <label>
                  <input
                    type="checkbox"
                    checked={worker.isActive}
                    onChange={e => updateWorker(index, 'isActive', e.target.checked)}
                  />
                  Active
                </label>
                <button onClick={() => removeWorker(index)} className={styles.removeBtn}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}