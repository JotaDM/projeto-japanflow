import { useMemo, useState, type MouseEvent } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowUp,
  CheckSquare2,
  Loader2,
  Search,
  SlidersHorizontal,
  RotateCcw,
  X,
} from 'lucide-react';
import { Timestamp, deleteField, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { toast } from 'sonner';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { Task, TaskStatus, STATUS_LABELS, Sector } from '@/types';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import TaskCard from './TaskCard';
import TaskDetailDialog from './TaskDetailDialog';
import { useArchivedTasksForBoard } from '@/hooks/useArchivedTasksForBoard';

const ALL_COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'paused', 'done'];
const MOTOBOY_COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'done'];

const normalizeTaskStatus = (value: unknown): TaskStatus => {
  const status = String(value ?? '')
    .trim()
    .toLowerCase();

  if (['todo', 'to_do', 'pending', 'pendente', 'a_fazer', 'a fazer'].includes(status)) {
    return 'todo';
  }

  if (['in_progress', 'in-progress', 'accepted', 'em_andamento', 'em andamento'].includes(status)) {
    return 'in_progress';
  }

  if (['paused', 'pause', 'em_pausa', 'em pausa'].includes(status)) {
    return 'paused';
  }

  if (['done', 'completed', 'complete', 'concluido', 'concluído'].includes(status)) {
    return 'done';
  }

  return 'todo';
};

const COLUMN_STYLES: Record<TaskStatus, { badge: string; dot: string }> = {
  todo: {
    badge: 'bg-primary/10 text-primary',
    dot: 'bg-primary',
  },
  in_progress: {
    badge: 'bg-warning/10 text-warning',
    dot: 'bg-warning',
  },
  paused: {
    badge: 'bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground/60',
  },
  done: {
    badge: 'bg-success/10 text-success',
    dot: 'bg-success',
  },
};

interface KanbanBoardProps {
  tasks: Task[];
  boardUserId: string;
  boardAuthUid?: string;
  showAssignee?: boolean;
}

type ArchivableTask = Task & {
  archivedAt?: string;
  archivedBy?: string;
};

const getLastDoneAt = (task: Task) => {
  const doneEntries = task.statusHistory?.filter((history) => history.status === 'done') ?? [];
  return doneEntries[doneEntries.length - 1]?.enteredAt || task.updatedAt || task.createdAt;
};

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
};

const KanbanColumn = ({
  status,
  tasks,
  onTaskClick,
  selectedIds,
  onTaskSelection,
  onArchivedClick,
  onArchiveCompleted,
  archiving = false,
}: {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  selectedIds: Set<string>;
  onTaskSelection: (task: Task, event: MouseEvent<HTMLDivElement>) => void;
  onArchivedClick?: () => void;
  onArchiveCompleted?: () => void;
  archiving?: boolean;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const styles = COLUMN_STYLES[status];
  const isEmpty = tasks.length === 0;

  return (
    <section className="self-start min-w-[min(85vw,320px)] snap-start flex-1 sm:min-w-[280px] lg:min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', styles.dot)} />
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {STATUS_LABELS[status]}
          </span>
        </div>

        {status === 'done' ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onArchivedClick}
              className={cn(
                'jf-interactive inline-flex min-w-7 items-center justify-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold',
                styles.badge
              )}
              aria-label={`Ver tarefas arquivadas. ${tasks.length} concluída${tasks.length !== 1 ? 's' : ''} no quadro.`}
              title={`${tasks.length} concluída${tasks.length !== 1 ? 's' : ''} no quadro. Clique para consultar arquivadas.`}
            >
              {tasks.length}
              <ArchiveRestore className="h-3 w-3 opacity-70" />
            </button>

            <button
              type="button"
              onClick={onArchiveCompleted}
              disabled={archiving || tasks.length === 0}
              className="jf-interactive relative inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Arquivar tarefas concluídas"
              title="Arquivar tarefas concluídas"
            >
              {archiving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span className="relative block h-4 w-4">
                  <Archive className="absolute inset-0 h-4 w-4" />
                  <ArrowUp className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-card stroke-[2.8]" />
                </span>
              )}
            </button>
          </div>
        ) : (
          <span
            className={cn(
              'inline-flex min-w-7 items-center justify-center rounded-full px-2 py-1 text-[11px] font-semibold',
              styles.badge
            )}
          >
            {tasks.length}
          </span>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'rounded-2xl border border-border/70 bg-muted/20 p-2.5 transition-all duration-220 ease-premium',
          isEmpty ? 'min-h-[150px]' : 'min-h-0',
          isOver &&
            'border-primary/40 bg-primary/[0.035] shadow-[0_0_0_3px_hsl(var(--brand-red)/0.06)]'
        )}
      >
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2.5">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task)}
                selected={selectedIds.has(task.id)}
                onSelectionClick={(event) => onTaskSelection(task, event)}
              />
            ))}
          </div>
        </SortableContext>

        {isEmpty && (
          <div className="flex min-h-[128px] items-center justify-center px-4 text-center">
            <p className="text-xs leading-5 text-muted-foreground/70">
              Nenhuma tarefa nesta etapa.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

const KanbanBoard = ({ tasks, boardUserId, boardAuthUid }: KanbanBoardProps) => {
  const { updateTaskStatus, currentUser } = useApp();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selectionAnchor, setSelectionAnchor] = useState<{ id: string; status: TaskStatus } | null>(
    null
  );
  const [dragTaskIds, setDragTaskIds] = useState<string[]>([]);
  const [archiving, setArchiving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  // Histórico paginado no diálogo; o Kanban operacional permanece intacto.
  const archivedHistory = useArchivedTasksForBoard(
    archiveDialogOpen,
    [boardUserId, boardAuthUid].filter((value): value is string => Boolean(value))
  );

  const normalizedTasks = useMemo(
    () =>
      tasks.map((task) => ({
        ...(task as ArchivableTask),
        status: normalizeTaskStatus(task.status),
      })),
    [tasks]
  );

  const visibleTasks = useMemo(
    () => normalizedTasks.filter((task) => !task.archivedAt),
    [normalizedTasks]
  );

  const archivedTasks = useMemo(
    () =>
      normalizedTasks
        .filter((task) => Boolean(task.archivedAt))
        .sort((a, b) => {
          const aTime = new Date(a.archivedAt || 0).getTime();
          const bTime = new Date(b.archivedAt || 0).getTime();
          return bTime - aTime;
        }),
    [normalizedTasks]
  );

  const pagedArchivedTasks = useMemo(() => {
    // Consulta somente quando o usuário abre o diálogo; desduplicamos o cache
    // do contexto com os resultados paginados. Os registros do Firestore
    // ainda sem data de arquivamento não são erroneamente classificados.
    const existing = new Map(
      archivedTasks.map((task) => [
        task.id,
        {
          id: task.id,
          title: task.title,
          description: task.description,
          archivedAt: task.archivedAt ? new Date(task.archivedAt) : null,
          createdAt: task.createdAt ? new Date(task.createdAt) : null,
          doneAt: getLastDoneAt(task),
        },
      ])
    );
    // O identificador do quadro não depende das tarefas visíveis.
    // Um quadro vazio ainda deve localizar seu histórico arquivado.
    const boardAssignees = new Set([boardUserId, boardAuthUid].filter(Boolean));
    for (const item of archivedHistory.items) {
      const belongsToBoard =
        Boolean(item.assigneeId && boardAssignees.has(item.assigneeId)) ||
        item.assigneeIds.some((id) => boardAssignees.has(id));
      if (item.archivedAt && belongsToBoard && !existing.has(item.id)) {
        existing.set(item.id, {
          id: item.id,
          title: item.title,
          description: item.description,
          archivedAt: item.archivedAt,
          createdAt: item.createdAt,
          doneAt: getLastDoneAt(item.task),
        });
      }
    }
    return [...existing.values()];
  }, [archivedTasks, archivedHistory.items, boardUserId, boardAuthUid]);

  const userIsMotoboy =
    currentUser?.sectors?.includes('motoboys' as Sector) && currentUser?.role !== 'admin';
  const hasMotoTasks = visibleTasks.some((task) => task.sector === 'motoboys');
  const columns = userIsMotoboy && hasMotoTasks ? MOTOBOY_COLUMNS : ALL_COLUMNS;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const completedTasks = visibleTasks.filter((task) => task.status === 'done');

  // Filtros locais: não alteram dados ou assinaturas Firestore.
  const filteredTasks = useMemo(() => {
    const normalize = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR');
    const terms = normalize(search.trim()).split(/\s+/).filter(Boolean);
    return visibleTasks.filter((task) => {
      const haystack = normalize(`${task.title} ${task.description || ''}`);
      return (
        (statusFilter === 'all' || task.status === statusFilter) &&
        (priorityFilter === 'all' || String(task.priority) === priorityFilter) &&
        terms.every((term) => haystack.includes(term))
      );
    });
  }, [visibleTasks, search, priorityFilter, statusFilter]);

  const getColumnTasks = (status: TaskStatus) =>
    filteredTasks.filter((task) => task.status === status);

  const handleTaskSelection = (task: Task, event: MouseEvent<HTMLDivElement>) => {
    const withToggle = event.ctrlKey || event.metaKey;
    const withRange = event.shiftKey;
    const normalizedStatus = normalizeTaskStatus(task.status);

    if (withRange && selectionAnchor?.status === normalizedStatus) {
      const columnTasks = getColumnTasks(normalizedStatus);
      const anchorIndex = columnTasks.findIndex((item) => item.id === selectionAnchor.id);
      const taskIndex = columnTasks.findIndex((item) => item.id === task.id);

      if (anchorIndex >= 0 && taskIndex >= 0) {
        const [start, end] =
          anchorIndex <= taskIndex ? [anchorIndex, taskIndex] : [taskIndex, anchorIndex];
        const rangeIds = columnTasks.slice(start, end + 1).map((item) => item.id);

        setSelectedIds((current) => {
          const next = withToggle ? new Set(current) : new Set<string>();
          rangeIds.forEach((id) => next.add(id));
          return next;
        });
        return;
      }
    }

    if (withToggle) {
      setSelectedIds((current) => {
        const next = new Set(current);
        if (next.has(task.id)) next.delete(task.id);
        else next.add(task.id);
        return next;
      });
      setSelectionAnchor({ id: task.id, status: normalizedStatus });
      return;
    }

    setSelectedIds(new Set([task.id]));
    setSelectionAnchor({ id: task.id, status: normalizedStatus });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionAnchor(null);
  };

  const handleArchiveCompleted = async () => {
    if (archiving || completedTasks.length === 0) return;

    setArchiving(true);

    try {
      const now = Timestamp.now();
      const chunkSize = 450;

      for (let index = 0; index < completedTasks.length; index += chunkSize) {
        const batch = writeBatch(db);
        const chunk = completedTasks.slice(index, index + chunkSize);

        chunk.forEach((task) => {
          batch.update(doc(db, 'tasks', task.id), {
            archived_at: now,
            board_visible: false,
            archived_by: currentUser?.id || null,
            updated_at: now,
          });
        });

        await batch.commit();
      }

      const archivedIds = new Set(completedTasks.map((task) => task.id));
      setSelectedIds((current) => {
        const next = new Set(current);
        archivedIds.forEach((id) => next.delete(id));
        return next;
      });
      if (selectionAnchor && archivedIds.has(selectionAnchor.id)) {
        setSelectionAnchor(null);
      }

      toast.success(
        `${completedTasks.length} tarefa${completedTasks.length !== 1 ? 's' : ''} arquivada${
          completedTasks.length !== 1 ? 's' : ''
        }.`
      );
    } catch (error) {
      console.error('Erro ao arquivar tarefas concluídas:', error);
      toast.error('Não foi possível arquivar as tarefas concluídas.');
    } finally {
      setArchiving(false);
    }
  };

  const handleRestoreTask = async (taskId: string) => {
    if (restoringId) return;

    setRestoringId(taskId);

    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        board_visible: true,
        archived_at: deleteField(),
        archived_by: deleteField(),
        archivedAt: deleteField(),
        archivedBy: deleteField(),
        updated_at: Timestamp.now(),
      });

      archivedHistory.removeItem(taskId);
      toast.success('Tarefa restaurada para o quadro.');
    } catch (error) {
      console.error('Erro ao restaurar tarefa:', error);
      toast.error('Não foi possível restaurar a tarefa.');
    } finally {
      setRestoringId(null);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = filteredTasks.find((item) => item.id === event.active.id);
    if (!task) return;

    setActiveTask(task);

    if (selectedIds.has(task.id)) {
      const ids = visibleTasks.filter((item) => selectedIds.has(item.id)).map((item) => item.id);
      setDragTaskIds(ids);
      return;
    }

    setSelectedIds(new Set([task.id]));
    setSelectionAnchor({ id: task.id, status: normalizeTaskStatus(task.status) });
    setDragTaskIds([task.id]);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) {
      setDragTaskIds([]);
      return;
    }

    const overId = over.id as string;
    let targetStatus: TaskStatus | null = null;

    if (columns.includes(overId as TaskStatus)) {
      targetStatus = overId as TaskStatus;
    } else {
      const overTask = visibleTasks.find((task) => task.id === overId);
      if (overTask) targetStatus = normalizeTaskStatus(overTask.status);
    }

    if (!targetStatus) {
      setDragTaskIds([]);
      return;
    }

    const idsToMove =
      dragTaskIds.length > 0
        ? dragTaskIds
        : selectedIds.has(String(active.id))
          ? Array.from(selectedIds)
          : [String(active.id)];

    const tasksToMove = visibleTasks.filter(
      (task) => idsToMove.includes(task.id) && normalizeTaskStatus(task.status) !== targetStatus
    );

    if (tasksToMove.length === 0) {
      setDragTaskIds([]);
      return;
    }

    if (
      targetStatus === 'done' &&
      userIsMotoboy &&
      tasksToMove.some((task) => task.sector === 'motoboys')
    ) {
      toast.error(
        'Corridas de motoboy precisam ser concluídas individualmente com a foto do cupom.'
      );
      setDragTaskIds([]);
      return;
    }

    try {
      await Promise.all(tasksToMove.map((task) => updateTaskStatus(task.id, targetStatus)));

      if (tasksToMove.length > 1) {
        toast.success(
          `${tasksToMove.length} tarefas movidas para ${STATUS_LABELS[targetStatus].toLowerCase()}.`
        );
      }
    } catch (error) {
      console.error('Erro ao mover tarefas em lote:', error);
      toast.error('Não foi possível mover todas as tarefas selecionadas.');
    } finally {
      setDragTaskIds([]);
    }
  };

  return (
    <section className="jf-surface overflow-hidden p-3 md:p-4">
      <div className="mb-4 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Fluxo de tarefas</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Arraste os cards entre as etapas. Use Ctrl/Cmd + clique para selecionar vários e Shift +
            clique para selecionar um intervalo.
          </p>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.05] px-3 py-2 text-xs font-medium text-foreground">
              <CheckSquare2 className="h-4 w-4 text-primary" />
              {selectedIds.size} selecionada{selectedIds.size !== 1 ? 's' : ''}
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-lg"
              onClick={clearSelection}
              title="Limpar seleção"
              aria-label="Limpar seleção de tarefas"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div
        className="mb-4 rounded-2xl border border-border/70 bg-muted/15 p-3 sm:p-4"
        aria-label="Filtros de tarefas"
      >
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant={filtersExpanded ? 'secondary' : 'outline'}
            className="gap-2 rounded-xl"
            onClick={() => setFiltersExpanded((v) => !v)}
            aria-expanded={filtersExpanded}
          >
            <SlidersHorizontal className="h-4 w-4" /> Encontrar tarefas
            {(search || priorityFilter !== 'all' || statusFilter !== 'all') && (
              <span className="h-2 w-2 rounded-full bg-primary" />
            )}
          </Button>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {filteredTasks.length} de {visibleTasks.length} ativas
          </span>
        </div>
        {filtersExpanded && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(180px,1fr)_180px_180px_auto]">
            <label className="relative block">
              <span className="sr-only">Buscar por título ou descrição</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar tarefa..."
                className="pl-9"
              />
            </label>
            <label className="block">
              <span className="sr-only">Filtrar por prioridade</span>
              <select
                aria-label="Filtrar por prioridade"
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground"
              >
                <option value="all">Todas as prioridades</option>
                {[...new Set(visibleTasks.map((task) => String(task.priority)))]
                  .sort()
                  .map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Filtrar por etapa</span>
              <select
                aria-label="Filtrar por etapa"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground"
              >
                <option value="all">Todas as etapas</option>
                {columns.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={!search && priorityFilter === 'all' && statusFilter === 'all'}
              onClick={() => {
                setSearch('');
                setPriorityFilter('all');
                setStatusFilter('all');
              }}
            >
              Limpar filtros
            </Button>
          </div>
        )}
        {filteredTasks.length === 0 && visibleTasks.length > 0 && (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            Nenhuma tarefa corresponde aos filtros. Limpe os filtros para ver o quadro completo.
          </p>
        )}
      </div>

      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Tarefas arquivadas</DialogTitle>
            <DialogDescription>
              Consulte tarefas concluídas que saíram do Kanban e restaure qualquer uma delas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="relative block">
              <span className="sr-only">Encontrar tarefas arquivadas</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={archiveSearch}
                onChange={(event) => setArchiveSearch(event.target.value)}
                placeholder="Encontrar tarefas arquivadas..."
                className="pl-9"
              />
            </label>
            <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {pagedArchivedTasks.filter((task) =>
                `${task.title} ${task.description || ''}`
                  .toLocaleLowerCase('pt-BR')
                  .includes(archiveSearch.trim().toLocaleLowerCase('pt-BR'))
              ).length === 0 ? (
                <div className="flex min-h-36 items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 text-center">
                  <p className="text-sm text-muted-foreground">Nenhuma tarefa arquivada.</p>
                </div>
              ) : (
                pagedArchivedTasks
                  .filter((task) =>
                    `${task.title} ${task.description || ''}`
                      .toLocaleLowerCase('pt-BR')
                      .includes(archiveSearch.trim().toLocaleLowerCase('pt-BR'))
                  )
                  .map((task) => (
                    <div
                      key={task.id}
                      className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/15 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {task.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span>Concluída: {formatDateTime(task.doneAt)}</span>
                          <span>Arquivada: {formatDateTime(task.archivedAt?.toISOString())}</span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0 gap-2"
                        onClick={() => void handleRestoreTask(task.id)}
                        disabled={restoringId !== null}
                      >
                        {restoringId === task.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                        Restaurar
                      </Button>
                    </div>
                  ))
              )}
              {archivedHistory.error && (
                <p role="alert" className="text-xs text-destructive">
                  {archivedHistory.error}
                </p>
              )}
              {archivedHistory.hasMore && (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={archivedHistory.loading}
                  onClick={() => void archivedHistory.loadMore()}
                >
                  {archivedHistory.loading
                    ? 'Carregando…'
                    : 'Carregar mais tarefas do histórico (25)'}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                A consulta busca apenas tarefas arquivadas vinculadas a este funcionário. Use
                Carregar mais para consultar registros antigos.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex snap-x snap-mandatory items-start gap-3 overflow-x-auto overscroll-x-contain pb-3 lg:grid lg:auto-rows-min lg:grid-cols-2 lg:items-start lg:overflow-visible xl:grid-cols-4">
          {columns.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={getColumnTasks(status)}
              onTaskClick={setDetailTask}
              selectedIds={selectedIds}
              onTaskSelection={handleTaskSelection}
              onArchivedClick={status === 'done' ? () => setArchiveDialogOpen(true) : undefined}
              onArchiveCompleted={
                status === 'done' ? () => void handleArchiveCompleted() : undefined
              }
              archiving={status === 'done' && archiving}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="relative rotate-[1deg] opacity-95 shadow-floating">
              <TaskCard task={activeTask} selected={dragTaskIds.length > 1} />
              {dragTaskIds.length > 1 && (
                <span className="absolute -right-2 -top-2 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground shadow-lg">
                  {dragTaskIds.length}
                </span>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {detailTask && (
        <TaskDetailDialog
          task={detailTask}
          open={!!detailTask}
          onOpenChange={(open) => !open && setDetailTask(null)}
        />
      )}
    </section>
  );
};

export default KanbanBoard;
