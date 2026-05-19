import { useState, useEffect } from 'react';
import { taskApi } from '../api/client';

const STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;

const priorityColors: Record<string, string> = {
  LOW: 'badge-low',
  MEDIUM: 'badge-medium',
  HIGH: 'badge-high',
};

interface Task {
  id?: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignee?: { id: string; name: string } | null;
  dueDate?: string | null;
  projectId?: string;
}

interface Activity {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  user?: { name: string };
}

interface TaskDetailPanelProps {
  task: Task;
  onClose: () => void;
  onUpdate: (task: Task) => void;
}

export default function TaskDetailPanel({ task, onClose, onUpdate }: TaskDetailPanelProps) {
  const [title, setTitle] = useState(task.title);
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [assignee] = useState(task.assignee?.name || '');
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.slice(0, 10) : '');
  const [description, setDescription] = useState(task.description || '');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task.id) {
      setActivities([]);
      setActivities([
        { id: '1', type: 'created', message: 'Task created', createdAt: new Date().toISOString(), user: { name: 'System' } },
      ]);
    }
  }, [task.id]);

  const handleSave = async (field: string, value: any) => {
    if (!task.id) return;
    setSaving(true);
    try {
      const { data } = await taskApi.update(task.id, { [field]: value });
      onUpdate(data.task || data);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    handleSave('status', newStatus);
  };

  const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setPriority(val);
    handleSave('priority', val);
  };

  const handleTitleBlur = () => {
    if (title !== task.title) {
      handleSave('title', title);
    }
  };

  const handleDescriptionBlur = () => {
    if (description !== (task.description || '')) {
      handleSave('description', description);
    }
  };

  const handleDueDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDueDate(val);
    handleSave('dueDate', val || null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <div className="side-panel-overlay" onClick={onClose} />
      <div className="side-panel">
        <div className="flex items-center justify-between px-5 h-14 border-b border-border-default shrink-0">
          <span className="text-sm font-medium text-text-secondary">Task Details</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              className="w-full bg-transparent text-lg font-semibold text-text-primary border-none outline-none placeholder-text-muted p-0"
              placeholder="Task title"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Status</label>
            <div className="segmented-control">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={status === s ? 'active' : ''}
                >
                  {s === 'IN_PROGRESS' ? 'In Progress' : s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Priority</label>
            <select
              value={priority}
              onChange={handlePriorityChange}
              className="input w-full"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <div className="mt-1.5">
              <span className={`badge ${priorityColors[priority] || 'badge-low'}`}>
                {priority}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Assignee</label>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                {assignee ? assignee.charAt(0).toUpperCase() : '?'}
              </div>
              <span className="text-sm text-text-primary">{assignee || 'Unassigned'}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={handleDueDateChange}
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              className="input w-full resize-none"
              rows={4}
              placeholder="Add a description..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
              Activity
              <span className="ml-1.5 text-[10px] font-normal normal-case text-text-muted">
                ({activities.length})
              </span>
            </label>
            <div className="space-y-3">
              {activities.length === 0 && (
                <p className="text-xs text-text-muted">No activity yet</p>
              )}
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-bg-tertiary flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary">{activity.message}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-text-muted">{activity.user?.name || 'System'}</span>
                      <span className="text-xs text-text-muted">&middot;</span>
                      <span className="text-xs text-text-muted">{formatDate(activity.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {saving && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-bg-tertiary border border-border-default shadow-lg">
            <div className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4 text-indigo-400" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-text-secondary">Saving...</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
