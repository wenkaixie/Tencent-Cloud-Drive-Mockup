import { useState, useRef } from 'react';
import { GraduationCap, BookOpen, Maximize2, Minimize2 } from 'lucide-react';

type FocusPane = 'both' | 'teacher' | 'student';

export function SplitViewPage() {
  const [focus, setFocus] = useState<FocusPane>('both');
  const [dividerPct, setDividerPct] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function onDividerMouseDown() {
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMove(e: MouseEvent) {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setDividerPct(Math.min(80, Math.max(20, pct)));
    }

    function onUp() {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  const teacherWidth = focus === 'both' ? `${dividerPct}%` : focus === 'teacher' ? '100%' : '0%';
  const studentWidth = focus === 'both' ? `${100 - dividerPct}%` : focus === 'student' ? '100%' : '0%';

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gray-900">
      {/* Top bar */}
      <div className="h-10 flex-shrink-0 bg-gray-900 flex items-center justify-between px-4 gap-4">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-sm tracking-wide">Education Drive</span>
          <span className="text-gray-500 text-xs">— Mockup Preview</span>
        </div>

        {/* Pane focus controls */}
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => { setFocus('teacher'); }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              focus === 'teacher' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            Teacher only
          </button>
          <button
            onClick={() => { setFocus('both'); setDividerPct(50); }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              focus === 'both' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Side by side
          </button>
          <button
            onClick={() => { setFocus('student'); }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              focus === 'student' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Student only
          </button>
        </div>

        <div className="text-gray-600 text-xs">
          Drag the divider to resize · Data is namespaced per role
        </div>
      </div>

      {/* Pane labels */}
      <div className="h-7 flex-shrink-0 flex overflow-hidden">
        {focus !== 'student' && (
          <div
            className="flex items-center justify-center gap-1.5 bg-blue-700 text-white text-xs font-semibold transition-all"
            style={{ width: focus === 'both' ? `${dividerPct}%` : '100%' }}
          >
            <GraduationCap className="w-3 h-3" />
            TEACHER VIEW — /teacher
          </div>
        )}
        {focus === 'both' && (
          <div className="w-1 bg-gray-900 flex-shrink-0" />
        )}
        {focus !== 'teacher' && (
          <div
            className="flex items-center justify-center gap-1.5 bg-emerald-700 text-white text-xs font-semibold transition-all"
            style={{ width: focus === 'both' ? `${100 - dividerPct}%` : '100%' }}
          >
            <BookOpen className="w-3 h-3" />
            STUDENT VIEW — /student
          </div>
        )}
      </div>

      {/* Iframe panes */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden relative">
        {/* Teacher pane */}
        {focus !== 'student' && (
          <div
            className="h-full relative overflow-hidden transition-[width] duration-200"
            style={{ width: focus === 'both' ? `${dividerPct}%` : '100%' }}
          >
            <iframe
              src="/teacher"
              className="w-full h-full border-0"
              title="Teacher View"
            />
            {focus === 'both' && (
              <button
                onClick={() => setFocus('teacher')}
                className="absolute top-2 right-2 p-1 bg-white/80 hover:bg-white rounded shadow text-gray-600 z-10"
                title="Expand Teacher pane"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
            {focus === 'teacher' && (
              <button
                onClick={() => { setFocus('both'); setDividerPct(50); }}
                className="absolute top-2 right-2 p-1 bg-white/80 hover:bg-white rounded shadow text-gray-600 z-10"
                title="Back to side by side"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Draggable divider */}
        {focus === 'both' && (
          <div
            onMouseDown={onDividerMouseDown}
            className="w-1.5 bg-gray-900 hover:bg-blue-500 cursor-col-resize flex-shrink-0 transition-colors"
            title="Drag to resize"
          />
        )}

        {/* Student pane */}
        {focus !== 'teacher' && (
          <div
            className="h-full relative overflow-hidden transition-[width] duration-200"
            style={{ width: focus === 'both' ? `${100 - dividerPct}%` : '100%' }}
          >
            <iframe
              src="/student"
              className="w-full h-full border-0"
              title="Student View"
            />
            {focus === 'both' && (
              <button
                onClick={() => setFocus('student')}
                className="absolute top-2 right-2 p-1 bg-white/80 hover:bg-white rounded shadow text-gray-600 z-10"
                title="Expand Student pane"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
            {focus === 'student' && (
              <button
                onClick={() => { setFocus('both'); setDividerPct(50); }}
                className="absolute top-2 right-2 p-1 bg-white/80 hover:bg-white rounded shadow text-gray-600 z-10"
                title="Back to side by side"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
