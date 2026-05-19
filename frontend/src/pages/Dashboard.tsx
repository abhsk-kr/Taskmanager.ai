/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, taskApi } from '../api/client';
import toast from 'react-hot-toast';
import { useMemo } from 'react';
import Layout from '../components/Layout';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const PRIORITY_COLORS = {
  LOW: '#6B7280',
  MEDIUM: '#F59E0B',
  HIGH: '#EF4444',
};

function MetricCard({ label, value, borderColor }: { label: string; value: number; borderColor: string }) {
  return (
    <div className={`relative bg-[#1A1D27] border border-[#2D3248] rounded-lg p-6 border-l-4 ${borderColor}`}>
      <p className="text-xs font-medium text-[#475569] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold text-[#F1F5F9]">{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();

  const { data: summary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => dashboardApi.summary().then((r) => r.data),
  });

  const { data: myTasks } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => dashboardApi.myTasks().then((r) => r.data.tasks),
  });

  const { data: overdue } = useQuery({
    queryKey: ['overdue'],
    queryFn: () => dashboardApi.overdue().then((r) => r.data.tasks),
  });

  const markDoneMutation = useMutation({
    mutationFn: (taskId: string) => taskApi.updateStatus(taskId, 'DONE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['overdue'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      toast.success('Marked as done');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const statusCounts = useMemo(() => {
    if (!myTasks) return { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
    return {
      TODO: myTasks.filter((t: any) => t.status === 'TODO').length,
      IN_PROGRESS: myTasks.filter((t: any) => t.status === 'IN_PROGRESS').length,
      DONE: myTasks.filter((t: any) => t.status === 'DONE').length,
    };
  }, [myTasks]);

  const statusBarData = useMemo(() => [{
    name: 'Tasks',
    TODO: statusCounts.TODO,
    IN_PROGRESS: statusCounts.IN_PROGRESS,
    DONE: statusCounts.DONE,
  }], [statusCounts]);

  const priorityData = useMemo(() => {
    if (!myTasks) return [];
    const counts: Record<string, number> = {};
    myTasks.forEach((t: any) => {
      counts[t.priority] = (counts[t.priority] || 0) + 1;
    });
    return [
      { name: 'LOW', value: counts['LOW'] || 0, color: PRIORITY_COLORS.LOW },
      { name: 'MEDIUM', value: counts['MEDIUM'] || 0, color: PRIORITY_COLORS.MEDIUM },
      { name: 'HIGH', value: counts['HIGH'] || 0, color: PRIORITY_COLORS.HIGH },
    ].filter((d) => d.value > 0);
  }, [myTasks]);

  return (
    <Layout title="Dashboard">
      <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="h2 text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-muted mt-1">Overview of your workspace</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="TOTAL TASKS" value={summary?.totalTasks || 0} borderColor="border-[#6366F1]" />
        <MetricCard label="COMPLETED THIS WEEK" value={summary?.completedThisWeek || 0} borderColor="border-[#10B981]" />
        <MetricCard label="OVERDUE TASKS" value={summary?.overdueTasks || 0} borderColor="border-[#EF4444]" />
        <MetricCard label="ACTIVE PROJECTS" value={summary?.activeProjects || 0} borderColor="border-[#6366F1]" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 mb-8">
        {/* Task Status Breakdown */}
        <div className="bg-[#1A1D27] border border-[#2D3248] rounded-lg p-6">
          <h3 className="text-lg font-semibold text-[#F1F5F9] mb-4">Task Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusBarData} layout="vertical" barSize={32}>
              <XAxis type="number" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" hide />
              <Tooltip
                contentStyle={{ background: '#1A1D27', border: '1px solid #2D3248', borderRadius: '8px' }}
                labelStyle={{ color: '#F1F5F9' }}
              />
              <Bar dataKey="TODO" stackId="a" fill="#6B7280" radius={[4, 0, 0, 4]} />
              <Bar dataKey="IN_PROGRESS" stackId="a" fill="#6366F1" />
              <Bar dataKey="DONE" stackId="a" fill="#10B981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-4 text-xs text-[#94A3B8]">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#6B7280]" /> TODO ({statusCounts.TODO})</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#6366F1]" /> In Progress ({statusCounts.IN_PROGRESS})</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#10B981]" /> Done ({statusCounts.DONE})</span>
          </div>
        </div>

        {/* Priority Distribution */}
        <div className="bg-[#1A1D27] border border-[#2D3248] rounded-lg p-6">
          <h3 className="text-lg font-semibold text-[#F1F5F9] mb-4">Priority Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={priorityData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
              >
                {priorityData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1A1D27', border: '1px solid #2D3248', borderRadius: '8px' }}
                labelStyle={{ color: '#F1F5F9' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-[#94A3B8]">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#6B7280]" /> Low</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#F59E0B]" /> Medium</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#EF4444]" /> High</span>
          </div>
        </div>
      </div>

      {/* Lists Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue Tasks */}
        <div>
          <h3 className="text-lg font-semibold text-[#F1F5F9] mb-4">Overdue Tasks</h3>
          {(!overdue || overdue.length === 0) ? (
            <div className="bg-[#1A1D27] border border-[#2D3248] rounded-lg p-6 text-center">
              <p className="text-sm text-[#475569]">No overdue tasks — great work!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {overdue.map((task: any) => (
                <div key={task.id} className="bg-[#1A1D27] border border-[#2D3248] rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-[#F1F5F9] truncate">{task.title}</h4>
                      <p className="text-xs text-[#94A3B8] mt-1 truncate">
                        {task.project?.title} &middot; {task.assignee?.name || 'Unassigned'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <span className="text-[11px] px-2 py-1 rounded-full bg-red-500/20 text-[#EF4444] border border-red-500/20 whitespace-nowrap font-medium">
                        {task.daysOverdue}d overdue
                      </span>
                      <button
                        onClick={() => markDoneMutation.mutate(task.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-[#10B981] border border-green-500/20 hover:bg-green-500/20 transition-colors whitespace-nowrap font-medium"
                      >
                        Mark Done
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Tasks */}
        <div>
          <h3 className="text-lg font-semibold text-[#F1F5F9] mb-4">My Tasks</h3>
          {(!myTasks || myTasks.length === 0) ? (
            <div className="bg-[#1A1D27] border border-[#2D3248] rounded-lg p-6 text-center">
              <p className="text-sm text-[#475569]">No tasks assigned to you</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myTasks.map((task: any) => {
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';
                return (
                  <div key={task.id} className="bg-[#1A1D27] border border-[#2D3248] rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`badge ${task.status === 'DONE' ? 'badge-done' : task.status === 'IN_PROGRESS' ? 'badge-in_progress' : 'badge-todo'}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                      <span className={`badge ${task.priority === 'HIGH' ? 'badge-high' : task.priority === 'MEDIUM' ? 'badge-medium' : 'badge-low'}`}>
                        {task.priority}
                      </span>
                      {isOverdue && (
                        <span className="badge badge-high text-[10px]">Overdue</span>
                      )}
                    </div>
                    <h4 className="text-sm font-medium text-[#F1F5F9] mb-1">{task.title}</h4>
                    <p className="text-xs text-[#94A3B8] mb-1">{task.project?.title}</p>
                    {task.dueDate && (
                      <p className="text-xs text-[#94A3B8] mb-2">
                        Due: {new Date(task.dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                    )}
                    {task.status !== 'DONE' && (
                      <button
                        onClick={() => markDoneMutation.mutate(task.id)}
                        className="text-xs text-[#6366F1] hover:text-[#818CF8] transition-colors font-medium"
                      >
                        Mark as done &rarr;
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </div>
    </Layout>
  );
}
