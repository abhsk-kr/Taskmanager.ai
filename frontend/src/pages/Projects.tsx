import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';

function ThreeDotMenu({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-1 rounded text-[#475569] hover:text-[#F1F5F9] hover:bg-white/5 transition-colors"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-[#1A1D27] border border-[#2D3248] rounded-lg shadow-xl z-10 py-1">
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function calcProgress(tasks: { status: string }[]) {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter((t) => t.status === 'DONE').length / tasks.length) * 100);
}

function getDeadlineColor(deadline: string) {
  const now = new Date();
  const d = new Date(deadline);
  const diff = d.getTime() - now.getTime();
  if (diff < 0) return 'text-red-400';
  if (diff <= 7 * 24 * 60 * 60 * 1000) return 'text-amber-400';
  return 'text-[#94A3B8]';
}

export default function Projects() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.list().then((r) => r.data.projects),
  });

  const createMutation = useMutation({
    mutationFn: () => projectApi.create({ title, description, deadline: deadline || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowModal(false);
      setTitle('');
      setDescription('');
      setDeadline('');
      toast.success('Project created!');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to create project'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete'),
  });

  if (isLoading) {
    return (
      <Layout title="Loading...">
        <div className="flex items-center justify-center min-h-[400px]">
          <svg className="animate-spin h-8 w-8 text-[#6366F1]" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Projects">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-[#F1F5F9]">Projects</h1>
      </div>

      <button data-new-project onClick={() => setShowModal(true)} className="absolute opacity-0 pointer-events-none w-0 h-0" aria-hidden="true" tabIndex={-1} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {data?.map((project: any) => {
          const progress = calcProgress(project.tasks);
          const membersArr = project.members || [];
          const visibleMembers = membersArr.slice(0, 4);
          const extra = membersArr.length - 4;

          return (
            <div
              key={project.id}
              className="bg-[#1A1D27] border border-[#2D3248] rounded-lg p-6 hover:border-[#3D4266] transition-colors"
            >
              <div className="flex justify-between items-start mb-3">
                <Link to={`/projects/${project.id}`} className="group">
                  <h3 className="text-lg font-semibold text-[#F1F5F9] group-hover:text-[#6366F1] transition-colors">
                    {project.title}
                  </h3>
                </Link>
                {(user?.role === 'ADMIN' || user?.id === project.ownerId) && (
                  <ThreeDotMenu onDelete={() => deleteMutation.mutate(project.id)} />
                )}
              </div>

              {project.description && (
                <p className="text-sm text-[#94A3B8] line-clamp-2 mb-4">{project.description}</p>
              )}

              <div className="flex items-center gap-4 text-xs text-[#94A3B8] mb-4 flex-wrap">
                {project.deadline && (
                  <div className={`flex items-center gap-1 ${getDeadlineColor(project.deadline)}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {new Date(project.deadline).toLocaleDateString()}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  {project._count?.members} members
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  {project._count?.tasks} tasks
                </div>
              </div>

              {membersArr.length > 0 && (
                <div className="flex items-center mb-4">
                  <div className="flex -space-x-2">
                    {visibleMembers.map((m: any, i: number) => (
                      <div
                        key={i}
                        className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-[#1A1D27]"
                      >
                        {(m.user?.name || '?').charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {extra > 0 && (
                      <div className="w-7 h-7 rounded-full bg-[#22263A] flex items-center justify-center text-[10px] font-medium text-[#94A3B8] ring-2 ring-[#1A1D27]">
                        +{extra}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mb-1">
                <div className="h-[6px] bg-[#22263A] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <div className="text-right text-xs text-[#94A3B8]">{progress}%</div>
            </div>
          );
        })}
        {data?.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-[#94A3B8]">
            <svg className="w-16 h-16 mb-4 text-[#475569]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-lg font-medium mb-1 text-[#F1F5F9]">No projects yet</p>
            <p className="text-sm">Create your first project to get started</p>
          </div>
        )}
      </div>

      {showModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-md mx-4"
            style={{
              perspective: '1200px',
              animation: 'floatIn 0.4s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative"
              style={{
                transformStyle: 'preserve-3d',
                transform: 'rotateX(2deg)',
                transition: 'transform 0.3s ease',
              }}
              onMouseMove={(e) => {
                const el = e.currentTarget;
                const rect = el.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width - 0.5;
                const y = (e.clientY - rect.top) / rect.height - 0.5;
                el.style.transform = `rotateX(${y * -6}deg) rotateY(${x * 6}deg)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'rotateX(2deg) rotateY(0deg)';
              }}
            >
              {/* Glow behind card */}
              <div
                className="absolute -inset-4 rounded-2xl opacity-30 blur-2xl"
                style={{
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6, #06F7F7)',
                  transform: 'translateZ(-20px)',
                }}
              />

              {/* 3D Card layers */}
              <div
                className="absolute inset-0 rounded-xl opacity-20 blur-sm"
                style={{
                  background: 'linear-gradient(135deg, #6366F1, transparent 60%)',
                  transform: 'translateZ(-10px)',
                }}
              />

              <div
                className="relative rounded-xl p-6"
                style={{
                  background: 'linear-gradient(145deg, #1E2130, #161826)',
                  border: '1px solid rgba(99,102,241,0.2)',
                  boxShadow: `
                    0 2px 4px rgba(0,0,0,0.3),
                    0 8px 24px rgba(0,0,0,0.4),
                    0 16px 60px rgba(99,102,241,0.15),
                    inset 0 1px 0 rgba(255,255,255,0.05)
                  `,
                  transform: 'translateZ(0)',
                }}
              >
                {/* Top decorative element */}
                <div className="flex items-center gap-4 mb-6">
                  <div
                    className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.1))',
                      border: '1px solid rgba(99,102,241,0.25)',
                      boxShadow: '0 4px 16px rgba(99,102,241,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
                      transformStyle: 'preserve-3d',
                    }}
                  >
                    {/* 3D isometric cube icon */}
                    <div className="relative w-7 h-7" style={{ transformStyle: 'preserve-3d' }}>
                      <div
                        className="absolute w-full h-full rounded"
                        style={{
                          background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                          transform: 'translateZ(6px)',
                          boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
                        }}
                      />
                      <div
                        className="absolute w-full h-full rounded-sm opacity-60"
                        style={{
                          background: '#818CF8',
                          transform: 'rotateX(60deg) rotateZ(45deg) translateZ(-3px)',
                          filter: 'brightness(1.2)',
                        }}
                      />
                      <div
                        className="absolute w-full h-full rounded-sm opacity-40"
                        style={{
                          background: '#4F46E5',
                          transform: 'rotateY(60deg) rotateZ(-45deg) translateZ(-3px)',
                          filter: 'brightness(0.8)',
                        }}
                      />
                      {/* Plus sign */}
                      <svg className="absolute inset-0 w-full h-full text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ transform: 'translateZ(8px)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold" style={{ color: '#F1F5F9' }}>New Project</h2>
                    <p className="text-xs" style={{ color: '#64748B' }}>Create a new team project</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Title</label>
                    <input
                      placeholder="Project title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full rounded-lg px-3 py-2.5 text-sm transition-all duration-200"
                      style={{
                        background: '#0F1117',
                        border: '1px solid #2D3248',
                        color: '#F1F5F9',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366F1';
                        e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3), 0 0 0 3px rgba(99,102,241,0.15)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#2D3248';
                        e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3)';
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Description</label>
                    <textarea
                      placeholder="Brief description (optional)"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg px-3 py-2.5 text-sm transition-all duration-200 resize-none"
                      style={{
                        background: '#0F1117',
                        border: '1px solid #2D3248',
                        color: '#F1F5F9',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366F1';
                        e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3), 0 0 0 3px rgba(99,102,241,0.15)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#2D3248';
                        e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3)';
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: '#94A3B8', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Deadline</label>
                    <input
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full rounded-lg px-3 py-2.5 text-sm transition-all duration-200"
                      style={{
                        background: '#0F1117',
                        border: '1px solid #2D3248',
                        color: '#F1F5F9',
                        colorScheme: 'dark',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366F1';
                        e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3), 0 0 0 3px rgba(99,102,241,0.15)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#2D3248';
                        e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3)';
                      }}
                    />
                  </div>
                  <div className="flex gap-3 justify-end pt-3">
                    <button
                      onClick={() => setShowModal(false)}
                      className="px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200"
                      style={{
                        color: '#94A3B8',
                        background: 'rgba(15,17,23,0.8)',
                        border: '1px solid #2D3248',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34,38,58,0.8)'; e.currentTarget.style.borderColor = '#3D4266'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(15,17,23,0.8)'; e.currentTarget.style.borderColor = '#2D3248'; }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => createMutation.mutate()}
                      disabled={!title || title.length < 3}
                      className="px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200"
                      style={{
                        color: 'white',
                        background: 'linear-gradient(135deg, #6366F1, #5558E6)',
                        border: 'none',
                        boxShadow: '0 4px 16px rgba(99,102,241,0.35), 0 2px 4px rgba(0,0,0,0.2)',
                        opacity: !title || title.length < 3 ? 0.5 : 1,
                        cursor: !title || title.length < 3 ? 'not-allowed' : 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        if (title && title.length >= 3) {
                          e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.5), 0 2px 4px rgba(0,0,0,0.2)';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.35), 0 2px 4px rgba(0,0,0,0.2)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      Create Project
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes floatIn {
          0% { opacity: 0; transform: translateY(30px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </Layout>
  );
}
