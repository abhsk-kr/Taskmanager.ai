import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi, taskApi } from '../api/client';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import TaskDetailPanel from '../components/TaskDetailPanel';
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, UniqueIdentifier } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Tab = 'board' | 'members';

const STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;

const statusMeta: Record<string, { label: string; border: string }> = {
  TODO: { label: 'To Do', border: 'border-t-[#2D3248]' },
  IN_PROGRESS: { label: 'In Progress', border: 'border-t-[#6366F1]' },
  DONE: { label: 'Done', border: 'border-t-[#10B981]' },
};

function SortableTaskCard({ task, onClick }: { task: any; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const badgeClass = task.priority === 'HIGH' ? 'bg-[#450A0A] text-[#EF4444]' : task.priority === 'MEDIUM' ? 'bg-[#451A03] text-[#F59E0B]' : 'bg-transparent text-[#94A3B8]';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="kanban-card"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-medium text-[#F1F5F9] leading-snug">{task.title}</h4>
        <span className={`badge ${badgeClass}`}>{task.priority}</span>
      </div>
      {task.description && <p className="text-xs text-[#475569] mb-3 line-clamp-2">{task.description}</p>}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <span className={`text-xs ${new Date(task.dueDate) < new Date() && task.status !== 'DONE' ? 'text-[#EF4444]' : 'text-[#475569]'}`}>
              <svg className="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        {task.assignee && (
          <div className="avatar bg-gradient-to-br from-indigo-400 to-purple-500" title={task.assignee.name}>
            {task.assignee.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({ status, tasks, onTaskClick }: { status: string; tasks: any[]; onTaskClick: (task: any) => void }) {
  return (
    <div className={`kanban-col border-t-4 ${statusMeta[status]?.border || ''}`}>
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h3 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">
          {statusMeta[status]?.label}
        </h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-[#22263A] text-[#94A3B8] font-medium">{tasks.length}</span>
      </div>
      <div className="px-3 pb-3 space-y-2">
        <SortableContext items={tasks.map((t: any) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task: any) => (
            <SortableTaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-[#475569]">
            <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-xs">No tasks</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('board');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<string>('MEDIUM');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('MEMBER');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectApi.list().then((r) => r.data.projects.find((p: any) => p.id === id)),
  });

  const { data: members } = useQuery({
    queryKey: ['members', id],
    queryFn: () => projectApi.getMembers(id!).then((r) => r.data.members),
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', id, filterPriority],
    queryFn: () => taskApi.list(id!, filterPriority || undefined).then((r) => r.data.tasks),
  });

  const createTaskMutation = useMutation({
    mutationFn: () =>
      taskApi.create(id!, {
        title: taskTitle,
        description: taskDesc,
        priority: taskPriority,
        assigneeId: taskAssignee || null,
        dueDate: taskDueDate || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', id] });
      setShowTaskModal(false);
      resetTaskForm();
      toast.success('Task created!');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) => taskApi.updateStatus(taskId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', id] }),
    onError: (err: any) => toast.error(err.response?.data?.message || 'Status update failed'),
  });

  const addMemberMutation = useMutation({
    mutationFn: () => projectApi.addMember(id!, { email: memberEmail, role: memberRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', id] });
      setShowMemberModal(false);
      setMemberEmail('');
      toast.success('Member added!');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => projectApi.removeMember(id!, userId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['members', id] }); toast.success('Member removed'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const resetTaskForm = () => {
    setTaskTitle(''); setTaskDesc(''); setTaskAssignee(''); setTaskDueDate('');
  };

  const tasks = tasksData || [];
  const columns = STATUSES.map((status) => ({
    status,
    tasks: tasks.filter((t: any) => t.status === status),
  }));

  function findColumn(taskId: UniqueIdentifier): string | null {
    for (const col of columns) {
      if (col.tasks.find((t: any) => t.id === taskId)) return col.status;
    }
    return null;
  }

  function handleDragStart(event: DragStartEvent) { setActiveId(event.active.id); }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const activeTask = tasks.find((t: any) => t.id === activeIdStr);
    if (!activeTask) return;
    let targetStatus: string | null = null;
    const overTask = tasks.find((t: any) => t.id === overIdStr);
    if (overTask) { const overCol = findColumn(over.id); if (overCol) targetStatus = overCol; }
    else { const overCol = columns.find((c) => c.tasks.some((t: any) => t.id === overIdStr)); if (overCol) targetStatus = overCol.status; }
    if (!targetStatus) targetStatus = overIdStr;
    if (targetStatus && targetStatus !== activeTask.status) {
      statusMutation.mutate({ taskId: activeTask.id as string, status: targetStatus });
    }
  }

  if (!id) return null;

  return (
    <Layout title={project?.title || 'Project'}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            {project?.description && <p className="text-sm text-[#475569]">{project.description}</p>}
          </div>
          <div className="flex items-center gap-3">
            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
              className="input w-auto text-xs py-1.5 h-9">
              <option value="">All Priorities</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <button onClick={() => setShowMemberModal(true)} className="btn btn-secondary btn-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Members
            </button>
            <button onClick={() => setShowTaskModal(true)} className="btn btn-primary btn-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Task
            </button>
          </div>
        </div>

        <div className="flex gap-6 border-b border-[#2D3248] mb-6">
          <button className={`tab ${activeTab === 'board' ? 'active' : ''}`} onClick={() => setActiveTab('board')}>Board</button>
          <button className={`tab ${activeTab === 'members' ? 'active' : ''}`} onClick={() => setActiveTab('members')}>Members</button>
        </div>

        {activeTab === 'board' && (
          <>
            {tasksLoading ? (
              <div className="flex items-center justify-center py-20">
                <svg className="animate-spin h-8 w-8 text-[#6366F1]" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {columns.map((col) => (
                    <KanbanColumn key={col.status} status={col.status} tasks={col.tasks} onTaskClick={setSelectedTask} />
                  ))}
                </div>
                <DragOverlay>
                  {activeId ? <div className="kanban-card bg-[#1A1D27] border-[#6366F1]/50 shadow-xl"><p className="text-sm text-[#6366F1]">Moving...</p></div> : null}
                </DragOverlay>
              </DndContext>
            )}
          </>
        )}

        {activeTab === 'members' && (
          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2D3248]">
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#475569] uppercase tracking-wider">User</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#475569] uppercase tracking-wider">Email</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#475569] uppercase tracking-wider">Role</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#475569] uppercase tracking-wider">Joined</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-[#475569] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members?.map((m: any) => (
                    <tr key={m.user.id} className="border-b border-[#2D3248]/50 hover:bg-[#22263A]/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="avatar bg-gradient-to-br from-indigo-400 to-purple-500">
                            {m.user.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-[#F1F5F9]">{m.user.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#94A3B8]">{m.user.email}</td>
                      <td className="py-3 px-4">
                        <span className={`badge ${m.role === 'ADMIN' ? 'bg-[#1E293B] text-[#818CF8] border border-[#3730A3]' : 'bg-[#22263A] text-[#94A3B8] border border-[#2D3248]'}`}>
                          {m.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#94A3B8]">{new Date(m.joinedAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => removeMemberMutation.mutate(m.user.id)}
                          className="text-xs text-[#EF4444] hover:text-[#DC2626] transition-colors font-medium">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!members || members.length === 0) && (
                <div className="text-center py-12 text-[#475569]">
                  <p className="text-sm">No members yet. Add members to collaborate.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedTask && (
          <TaskDetailPanel
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onUpdate={() => queryClient.invalidateQueries({ queryKey: ['tasks', id] })}
          />
        )}

        {showTaskModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in" onClick={() => setShowTaskModal(false)}>
            <div className="bg-[#1A1D27] border border-[#2D3248] rounded-xl p-6 w-full max-w-md mx-4 animate-slide-up" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-semibold text-[#F1F5F9] mb-1">New Task</h2>
              <p className="text-sm text-[#475569] mb-5">Add a task to this project</p>
              <div className="space-y-4">
                <input placeholder="Task title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="input" />
                <textarea placeholder="Description (optional)" value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} className="input" rows={2} />
                <div className="grid grid-cols-2 gap-4">
                  <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)} className="input">
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                  <input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} className="input" />
                </div>
                <select value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)} className="input">
                  <option value="">Unassigned</option>
                  {members?.map((m: any) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
                </select>
                <div className="flex gap-3 justify-end pt-2">
                  <button onClick={() => setShowTaskModal(false)} className="btn btn-secondary">Cancel</button>
                  <button onClick={() => createTaskMutation.mutate()} disabled={!taskTitle || taskTitle.length < 3} className="btn btn-primary">
                    Create Task
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showMemberModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in" onClick={() => setShowMemberModal(false)}>
            <div className="bg-[#1A1D27] border border-[#2D3248] rounded-xl p-6 w-full max-w-md mx-4 animate-slide-up" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-semibold text-[#F1F5F9] mb-1">Add Member</h2>
              <p className="text-sm text-[#475569] mb-5">Invite someone to this project</p>
              <div className="space-y-4">
                <input placeholder="user@example.com" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} className="input" />
                <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)} className="input">
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Project Admin</option>
                </select>
                <div className="flex gap-3 justify-end pt-2">
                  <button onClick={() => setShowMemberModal(false)} className="btn btn-secondary">Cancel</button>
                  <button onClick={() => addMemberMutation.mutate()} disabled={!memberEmail} className="btn btn-primary">Add Member</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
