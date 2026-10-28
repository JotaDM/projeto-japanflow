import { useEffect, useMemo, useState } from 'react';
import type { ReactNode, DragEvent } from 'react';
import { ChevronLeft, ChevronRight, GripVertical, RotateCcw, Save, X } from 'lucide-react';
import { toast } from 'sonner';

type Slot = 'main' | 'side';
type Item = { id: string; slot: Slot };
export type WorkspaceBlock = { id: string; label: string; content: ReactNode };
const SCHEMA = 1;
const initial = (blocks: WorkspaceBlock[]): Item[] =>
  blocks.map((b) => ({ id: b.id, slot: b.id === 'calendar' ? 'side' : 'main' }));
function valid(data: unknown, blocks: WorkspaceBlock[]): data is Item[] {
  if (!Array.isArray(data) || data.length !== blocks.length) return false;
  const ids = blocks.map((b) => b.id);
  return (
    data.every(
      (item) =>
        item &&
        typeof item.id === 'string' &&
        ids.includes(item.id) &&
        (item.slot === 'main' || item.slot === 'side')
    ) && new Set(data.map((x) => x.id)).size === ids.length
  );
}

export default function CustomizableWorkspace({
  userId,
  blocks,
  actions,
}: {
  userId: string;
  blocks: WorkspaceBlock[];
  actions?: ReactNode;
}) {
  const key = `jf:workspace:v${SCHEMA}:${userId}`;
  const signature = blocks.map((block) => block.id).join('|');
  const defaults = useMemo(() => initial(blocks), [signature]);
  const [layout, setLayout] = useState<Item[]>(defaults);
  const [draft, setDraft] = useState<Item[]>(defaults);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const activeSideCount = (editing ? draft : layout).filter((item) => item.slot === 'side').length;
  const sideVisible = open && activeSideCount > 0;
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--jf-workspace-side',
      sideVisible ? 'clamp(320px, 27vw, 390px)' : '0px'
    );
    return () => {
      document.documentElement.style.removeProperty('--jf-workspace-side');
    };
  }, [sideVisible]);
  const [dragged, setDragged] = useState<string | null>(null);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(key) || 'null');
      const next = valid(saved, blocks) ? saved : initial(blocks);
      setLayout(next);
      setDraft(next);
    } catch {
      setLayout(initial(blocks));
      setDraft(initial(blocks));
    }
    setEditing(false);
  }, [key, signature]);
  useEffect(() => {
    const start = () => {
      setDraft(layout);
      setEditing(true);
      setOpen(true);
    };
    window.addEventListener('jf:workspace:customize', start);
    return () => window.removeEventListener('jf:workspace:customize', start);
  }, [layout]);
  const move = (id: string, slot: Slot, before?: string) => {
    setDraft((old) => {
      const item = old.find((x) => x.id === id);
      if (!item) return old;
      const remaining = old.filter((x) => x.id !== id);
      const insertAt = before ? remaining.findIndex((x) => x.id === before) : -1;
      const next = { ...item, slot };
      if (insertAt >= 0) remaining.splice(insertAt, 0, next);
      else remaining.push(next);
      return remaining;
    });
  };
  const onDrop = (event: DragEvent, slot: Slot, before?: string) => {
    if (!editing) return;
    event.preventDefault();
    event.stopPropagation();
    const id = event.dataTransfer.getData('text/plain') || dragged;
    if (id) move(id, slot, before);
    setDragged(null);
  };
  const save = () => {
    try {
      localStorage.setItem(key, JSON.stringify(draft));
      setLayout(draft);
      setEditing(false);
      toast.success('Layout salvo neste navegador.');
    } catch {
      toast.error('Não foi possível salvar o layout neste navegador.');
    }
  };
  const reset = () => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* armazenamento indisponível */
    }
    setDraft(defaults);
    setLayout(defaults);
    setEditing(false);
    setOpen(false);
    toast.success('Layout original restaurado.');
  };
  const active = editing ? draft : layout;
  const hasSidebarWidgets = active.some((item) => item.slot === 'side');
  const render = (slot: Slot) =>
    active
      .filter((x) => x.slot === slot)
      .map((item) => {
        const block = blocks.find((b) => b.id === item.id);
        if (!block) return null;
        return (
          <div
            key={block.id}
            className={`min-w-0 ${editing ? 'rounded-xl border-2 border-dashed border-primary/30 p-2' : ''}`}
            draggable={editing}
            onDragStart={(event) => {
              setDragged(block.id);
              event.stopPropagation();
              event.dataTransfer.setData('text/plain', block.id);
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(event) => {
              if (editing) event.preventDefault();
            }}
            onDrop={(event) => onDrop(event, slot, block.id)}
            onDragEnd={() => setDragged(null)}
          >
            {editing && (
              <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-muted px-2 py-1 text-xs">
                <GripVertical className="h-4 w-4" />
                <span className="font-medium">{block.label}</span>
                <button
                  className="ml-auto rounded px-2 py-1 hover:bg-background"
                  onClick={() => move(block.id, slot === 'main' ? 'side' : 'main')}
                >
                  Mover para {slot === 'main' ? 'lateral' : 'quadro'}
                </button>
                <button
                  className="rounded px-2 py-1 hover:bg-background"
                  onClick={() => move(block.id, slot)}
                >
                  Último
                </button>
              </div>
            )}
            {block.content}
          </div>
        );
      });
  return (
    <div className="min-w-0 max-w-full space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {actions}
        {editing && (
          <>
            <button className="rounded-xl border px-3 py-2 text-sm" onClick={reset}>
              <RotateCcw className="mr-1 inline h-4 w-4" />
              Restaurar padrão
            </button>
            <button
              className="rounded-xl border px-3 py-2 text-sm"
              onClick={() => {
                setDraft(layout);
                setEditing(false);
              }}
            >
              <X className="mr-1 inline h-4 w-4" />
              Cancelar
            </button>
            <button
              className="rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground"
              onClick={save}
            >
              <Save className="mr-1 inline h-4 w-4" />
              Salvar layout
            </button>
          </>
        )}
      </div>
      {editing && (
        <p role="status" className="text-xs text-muted-foreground">
          Arraste os blocos para reorganizar. Em telas touch, use “Mover para lateral/quadro” e
          “Último”. As preferências ficam neste navegador.
        </p>
      )}
      <div className="min-w-0">
        <main
          className="min-w-0 flex-1 space-y-4"
          onDragOver={(event) => editing && event.preventDefault()}
          onDrop={(event) => onDrop(event, 'main')}
        >
          {render('main')}
          {editing && (
            <div className="rounded-xl border-2 border-dashed p-4 text-center text-xs text-muted-foreground">
              Solte aqui para enviar ao quadro principal
            </div>
          )}
        </main>
        {hasSidebarWidgets && (
          <>
            <button
              onClick={() => setOpen((value) => !value)}
              className={`fixed top-24 z-50 flex h-10 w-9 items-center justify-center rounded-l-xl border border-r-0 bg-card text-foreground shadow-md transition-[right,background-color] duration-300 hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                sideVisible
                  ? 'right-[min(92vw,390px)] lg:right-[clamp(320px,27vw,390px)]'
                  : 'right-0'
              }`}
              aria-label={sideVisible ? 'Recolher painel lateral' : 'Abrir painel lateral'}
              aria-expanded={sideVisible}
              aria-controls="jf-workspace-sidepanel"
              type="button"
            >
              {sideVisible ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
            <aside
              id="jf-workspace-sidepanel"
              className={`fixed inset-y-0 right-0 z-40 flex w-[min(92vw,390px)] lg:w-[clamp(320px,27vw,390px)] flex-col overflow-hidden border-l bg-card shadow-xl transition-transform duration-300 ease-in-out ${
                sideVisible ? 'translate-x-0' : 'translate-x-full pointer-events-none'
              }`}
              aria-label="Sidebar de widgets"
              aria-hidden={!sideVisible}
            >
              <div
                className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-5 pt-5"
                onDragOver={(event) => editing && event.preventDefault()}
                onDrop={(event) => onDrop(event, 'side')}
              >
                <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Painel lateral
                </p>
                <div className="min-w-0 space-y-3">{render('side')}</div>
                {editing && (
                  <div className="mt-3 rounded-lg border-2 border-dashed p-4 text-center text-xs text-muted-foreground">
                    Solte widgets aqui
                  </div>
                )}
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
